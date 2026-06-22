import re
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

from app.utils.value_parser import (
    BOOLEAN_COLUMNS,
    DATETIME_COLUMNS,
    INTEGER_COLUMNS,
    NUMERIC_COLUMNS,
    coerce_value_for_column,
    is_excel_error_value,
    parse_datetime_value,
)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def is_excel_error(value: Any) -> bool:
    return is_excel_error_value(value)


def normalize_null(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, str):
        stripped = value.strip()
        if stripped in {"", "NULL", "null", "None", "none"} or is_excel_error_value(stripped):
            return None
    return value


def convert_cell_value(column_name: str, value: Any, is_update: bool = False) -> Any:
    converted, error, warning, _meta = coerce_value_for_column(
        value,
        column_name,
        is_update=is_update,
        is_nullable=True,
    )
    if error:
        raise ValueError(error)
    if warning:
        pass
    return converted


def convert_value_for_import(
    column_name: str,
    value: Any,
    *,
    is_update: bool,
    is_nullable: bool = True,
    run_id: int | None = None,
    excel_row_number: int | None = None,
    column_meta: dict[str, Any] | None = None,
    row_peers: dict[str, Any] | None = None,
    row_context: dict[str, Any] | None = None,
) -> tuple[Any, str | None, str | None, dict[str, Any] | None]:
    """Retorna (valor_convertido, erro, warning, meta)."""
    return coerce_value_for_column(
        value,
        column_name,
        is_update=is_update,
        is_nullable=is_nullable,
        run_id=run_id,
        excel_row_number=excel_row_number,
        column_meta=column_meta,
        row_peers=row_peers,
        row_context=row_context,
    )


def serialize_for_compare(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, Decimal):
        return format(value.normalize(), "f")
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value).strip()


def detect_sheet_name(sheet_names: list[str]) -> str | None:
    preferred = ["spec_items", "ALTERADO", "ALTERADOS"]
    for name in preferred:
        if name in sheet_names:
            return name
    if len(sheet_names) == 1:
        return sheet_names[0]
    return None


def normalize_header(header: str) -> str:
    return re.sub(r"\s+", " ", str(header).strip())
