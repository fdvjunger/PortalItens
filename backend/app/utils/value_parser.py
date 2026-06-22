import re

from datetime import datetime

from decimal import Decimal

from typing import Any



from app.core.logging import log_error, log_event
from app.utils.excel_raw_value import format_stored_raw_value



DATETIME_COLUMNS = {"created_at", "updated_at"}



NUMERIC_COLUMNS = {

    "nps",

    "weight",

    "dn_mm",

    "od_mm",

    "wall_thk_mm",

    "id_mm",

    "half_od_mm",

    "weight_match_confidence",

    "dm_ex",

    "area_m2_per_m",

    "sch_mm",

    "radius",

}



INTEGER_COLUMNS = {

    "id",

    "spec_id",

    "source_page",

    "sort_order",

    "nps_table_col_index",

    "weight_source_row",

}



BOOLEAN_COLUMNS = {"is_active", "has_nace"}



EXCEL_ERROR_VALUES = {

    "#N/A",

    "#VALUE!",

    "#DIV/0!",

    "#REF!",

    "#NAME?",

    "#NULL!",

    "#NUM!",

}



EXCEL_NULL_STRINGS = {"", "NULL", "null", "None", "none"}





def normalize_blank(value: Any) -> Any:

    if value is None:

        return None



    if isinstance(value, str):

        raw = value.strip()

        if raw == "":

            return None

        if raw.upper() == "NULL":

            return None

        if raw.upper() in EXCEL_ERROR_VALUES:

            return None

        return raw



    return value





def is_excel_error_value(value: Any) -> bool:

    if value is None:

        return False

    return str(value).strip().upper() in EXCEL_ERROR_VALUES





def parse_decimal_value(value: Any, column_name: str) -> Decimal | None:

    """Compat: delega para parse_decimal_basic via coerce_value_for_db."""

    from app.utils.db_coercion import parse_decimal_basic



    return parse_decimal_basic(value)





def validate_numeric_range(

    value: Decimal | None,

    column_name: str,

    *,

    precision: int = 18,

    scale: int = 6,

) -> None:

    if value is None:

        return



    max_abs = Decimal(10) ** Decimal(precision - scale)

    if abs(value) >= max_abs:

        raise ValueError(

            f"Valor fora do limite numeric({precision},{scale}) para {column_name}: {value}. "

            f"O valor absoluto precisa ser menor que {max_abs}."

        )





def parse_integer_value(value: Any, column_name: str) -> int | None:

    from app.utils.db_coercion import parse_decimal_basic



    value = normalize_blank(value)

    if value is None:

        return None



    if isinstance(value, bool):

        raise ValueError(f"Valor inteiro inválido para {column_name}: {value}")



    if isinstance(value, int):

        return value



    if isinstance(value, float):

        if value != int(value):

            raise ValueError(f"Valor inteiro inválido para {column_name}: {value}")

        return int(value)



    parsed = parse_decimal_basic(value)

    if parsed is None:

        return None

    if parsed != int(parsed):

        raise ValueError(f"Valor inteiro inválido para {column_name}: {value}")

    return int(parsed)





def parse_boolean_value(value: Any, column_name: str) -> bool | None:

    value = normalize_blank(value)

    if value is None:

        return None



    if isinstance(value, bool):

        return value



    text = str(value).strip().lower()

    if text in {"true", "1", "yes", "sim", "s"}:

        return True

    if text in {"false", "0", "no", "nao", "não", "n"}:

        return False



    raise ValueError(f"Valor booleano inválido para {column_name}: {value}")





def parse_datetime_value(value: Any) -> datetime | None:

    if value is None:

        return None



    if isinstance(value, datetime):

        return value



    raw = str(value).strip()

    if raw == "":

        return None



    if raw.upper() in EXCEL_ERROR_VALUES:

        return None



    raw = re.sub(r"\s+([+-]\d{2}:\d{2})$", r"\1", raw)



    if re.match(r"^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}", raw):

        raw = raw.replace(" ", "T", 1)



    raw = re.sub(r"(\.\d{6})\d+", r"\1", raw)



    if raw.endswith("Z"):

        raw = raw[:-1] + "+00:00"



    try:

        return datetime.fromisoformat(raw)

    except Exception:

        pass



    original = str(value).strip()

    for fmt in (

        "%Y-%m-%d %H:%M:%S.%f",

        "%Y-%m-%d %H:%M:%S",

        "%d/%m/%Y %H:%M:%S",

        "%d/%m/%Y",

        "%Y-%m-%d",

    ):

        try:

            return datetime.strptime(original, fmt)

        except ValueError:

            continue



    raise ValueError(f"Data/hora inválida: {value}")





def try_parse_datetime_for_import(

    column_name: str,

    value: Any,

    *,

    is_update: bool,

) -> tuple[Any, str | None, str | None, str]:

    if column_name not in DATETIME_COLUMNS:

        raise ValueError("Coluna não é datetime")



    if is_update:

        return "__SKIP__", None, None, "skipped"



    if value is None or str(value).strip() == "":

        return None, None, None, "ignored"



    try:

        parsed = parse_datetime_value(value)

        if parsed is not None:

            return parsed, None, None, "parsed"

        return None, None, None, "ignored"

    except ValueError:

        warning = (

            f"{column_name}: data/hora ignorada: {value}. "

            f"A linha não será bloqueada; será usado now() no insert."

        )

        return None, None, warning, "warning"





def coerce_value_for_column(

    value: Any,

    column_name: str,

    *,

    is_update: bool = False,

    is_nullable: bool = True,

    run_id: int | None = None,

    excel_row_number: int | None = None,

    column_meta: dict[str, Any] | None = None,

    row_peers: dict[str, Any] | None = None,

    row_context: dict[str, Any] | None = None,

) -> tuple[Any, str | None, str | None, dict[str, Any] | None]:

    """

    Retorna (valor_convertido, erro, warning, meta).

    meta contém raw/parsed/coercion_method para colunas convertidas.

    """

    if column_name in DATETIME_COLUMNS:

        converted, error, warning, _status = try_parse_datetime_for_import(

            column_name, value, is_update=is_update

        )

        return converted, error, warning, None

    from app.utils.db_coercion import coerce_value_for_db

    meta_dict = column_meta or {

        "column_name": column_name,

        "data_type": "numeric" if column_name in NUMERIC_COLUMNS else "text",

        "is_nullable": is_nullable,

    }



    coerced = coerce_value_for_db(
        value, column_name, meta_dict, row_peers=row_peers, row_context=row_context
    )



    if coerced.get("method") == "NUMERIC_SCALE_INFERRED" and run_id is not None:

        log_event(

            "EXCEL_IMPORT",

            "numeric_scale_inferred",

            run_id=run_id,

            excel_row_number=excel_row_number,

            column_name=column_name,

            raw_value=coerced.get("raw_value"),

            parsed_value=coerced.get("parsed_value"),

            scale_divisor=str(coerced.get("scale_divisor")),

        )



    meta = {

        "raw_value": coerced.get("raw_value") or format_stored_raw_value(value),

        "parsed_value": coerced.get("parsed_value"),

        "coercion_method": coerced.get("method"),

        "scale_divisor": coerced.get("scale_divisor"),

        "warning_message": coerced.get("warning"),

    }



    if coerced.get("error"):

        return None, coerced["error"], None, meta



    return coerced.get("value"), None, coerced.get("warning"), meta


