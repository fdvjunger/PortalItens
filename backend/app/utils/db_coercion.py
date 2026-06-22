import re
from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import Any

from app.utils.excel_raw_value import format_stored_raw_value
from app.services.import_rules import CRITICAL_COLUMNS, critical_row_error_message, is_nonempty_excel_value

DATETIME_COLUMNS = {"created_at", "updated_at"}

EMPTY_LIKE_VALUES = {
    "",
    "NULL",
    "NONE",
    "N/A",
    "NA",
    "#N/A",
    "#VALUE!",
    "#DIV/0!",
    "#REF!",
    "#NAME?",
    "#NULL!",
    "#NUM!",
    "-",
    "--",
}

NUMERIC_COLUMN_PROFILES = {
    "nps": {
        "min": Decimal("0"),
        "max": Decimal("100"),
        "preferred_scale_candidates": ["1", "10000", "100000000"],
    },
    "dn_mm": {
        "min": Decimal("0"),
        "max": Decimal("100000"),
        "preferred_scale_candidates": ["1", "10000000"],
    },
    "id_mm": {
        "min": Decimal("0"),
        "max": Decimal("100000"),
        "preferred_scale_candidates": ["1", "10000000"],
    },
    "od_mm": {
        "min": Decimal("0"),
        "max": Decimal("100000"),
        "preferred_scale_candidates": ["1", "10000", "1000000"],
    },
    "half_od_mm": {
        "min": Decimal("0"),
        "max": Decimal("100000"),
        "preferred_scale_candidates": ["1", "10000", "1000000"],
    },
    "wall_thk_mm": {
        "min": Decimal("0"),
        "max": Decimal("10000"),
        "preferred_scale_candidates": ["1", "10000", "1000000"],
    },
    "weight": {
        "min": Decimal("0.001"),
        "max": Decimal("100000"),
        "preferred_scale_candidates": ["1", "1000000", "1000000000000"],
    },
    "area_m2_per_m": {
        "min": Decimal("0"),
        "max": Decimal("1000"),
        "preferred_scale_candidates": ["1", "1000000"],
    },
    "dm_ex": {
        "min": Decimal("0"),
        "max": Decimal("100000"),
        "preferred_scale_candidates": ["1", "10000", "1000000"],
    },
    "sch_mm": {
        "min": Decimal("0"),
        "max": Decimal("10000"),
        "preferred_scale_candidates": ["1", "10000", "1000000"],
    },
    "radius": {
        "min": Decimal("0"),
        "max": Decimal("100000"),
        "preferred_scale_candidates": ["1", "10000", "1000000"],
    },
}

PIPE_GEOMETRY_COLUMNS = frozenset({"od_mm", "half_od_mm", "id_mm", "wall_thk_mm"})
PIPE_ROW_PEER_COLUMNS = PIPE_GEOMETRY_COLUMNS | {"nps"}

NPS_SCALE_CANDIDATES = [
    Decimal("1"),
    Decimal("10000"),
    Decimal("100000000"),
]

NPS_ROW_CONTEXT_COLUMNS = frozenset({"nps_polegadas", "nps_raw", "item_key"})


def _normalize_empty(raw: str) -> str | None:
    if raw.upper() in EMPTY_LIKE_VALUES:
        return None
    return raw


def parse_decimal_basic(raw_value: Any) -> Decimal | None:
    if raw_value is None:
        return None

    if isinstance(raw_value, Decimal):
        return raw_value

    if isinstance(raw_value, bool):
        raise ValueError(f"Valor numérico inválido: {raw_value}")

    if isinstance(raw_value, int):
        return Decimal(raw_value)

    if isinstance(raw_value, float):
        return Decimal(str(raw_value))

    raw = str(raw_value).strip()
    normalized = _normalize_empty(raw)
    if normalized is None:
        return None

    raw = normalized.replace("\u00a0", "").replace(" ", "")
    raw = raw.replace("KG", "").replace("kg", "")
    raw = raw.replace("MM", "").replace("mm", "")

    if "," in raw and "." in raw:
        if raw.rfind(",") > raw.rfind("."):
            raw = raw.replace(".", "")
            raw = raw.replace(",", ".")
        else:
            raw = raw.replace(",", "")
    elif "," in raw and "." not in raw:
        raw = raw.replace(",", ".")
    elif "." in raw and "," not in raw:
        pass

    if "/" in raw:
        raise ValueError(f"Valor numérico inválido: {raw_value}")

    if not re.match(r"^-?\d+(\.\d+)?$", raw):
        raise ValueError(f"Valor numérico inválido: {raw_value}")

    try:
        return Decimal(raw)
    except InvalidOperation as exc:
        raise ValueError(f"Valor numérico inválido: {raw_value}") from exc


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
            f"Valor fora do limite numeric({precision},{scale}) para {column_name}: {value}."
        )


def parse_boolean_value(value: Any, column_name: str) -> bool | None:
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
    if raw == "" or raw.upper() in EMPTY_LIKE_VALUES:
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


def _profile_scale_candidates(profile: dict[str, Any]) -> list[str]:
    return profile.get("preferred_scale_candidates") or profile.get("scale_candidates", ["1"])


def _collect_valid_scale_options(
    parsed: Decimal,
    min_value: Decimal,
    max_value: Decimal,
    candidates: list[str],
) -> list[tuple[Decimal, Decimal]]:
    options: list[tuple[Decimal, Decimal]] = []
    for divisor_raw in candidates:
        divisor = Decimal(str(divisor_raw))
        candidate = parsed / divisor
        if min_value <= abs(candidate) <= max_value:
            options.append((divisor, candidate))
    return options


def _geometry_score(
    od: Decimal | None,
    half_od: Decimal | None,
    id_mm: Decimal | None,
    wall_thk_mm: Decimal | None,
) -> Decimal:
    score = Decimal("0")

    if od is not None and half_od is not None and od != 0:
        relative_error = abs(half_od - (od / Decimal(2))) / abs(od)
        if relative_error <= Decimal("0.02"):
            score += Decimal("100")
        elif relative_error <= Decimal("0.10"):
            score += Decimal("20")
        else:
            score -= Decimal("50")

    if od is not None and id_mm is not None and id_mm >= od:
        score -= Decimal("30")

    if od is not None and wall_thk_mm is not None:
        if wall_thk_mm <= 0:
            score -= Decimal("20")
        elif od != 0 and wall_thk_mm >= od / Decimal(2):
            score -= Decimal("20")

    return score


def _coerce_peer_with_divisor(
    peer_col: str,
    peer_parsed: Decimal,
    divisor: Decimal,
) -> Decimal | None:
    profile = NUMERIC_COLUMN_PROFILES.get(peer_col)
    if not profile:
        return peer_parsed

    candidate = peer_parsed / divisor
    if profile["min"] <= abs(candidate) <= profile["max"]:
        return candidate

    peer_options = _collect_valid_scale_options(
        peer_parsed,
        profile["min"],
        profile["max"],
        _profile_scale_candidates(profile),
    )
    return peer_options[0][1] if peer_options else None


def _select_scale_option(
    column_name: str,
    valid_options: list[tuple[Decimal, Decimal]],
    row_peers: dict[str, Any] | None,
) -> tuple[Decimal, Decimal]:
    if len(valid_options) == 1:
        return valid_options[0]

    if not row_peers or column_name not in PIPE_GEOMETRY_COLUMNS:
        return valid_options[0]

    peer_parsed: dict[str, Decimal] = {}
    for peer_col, peer_raw in row_peers.items():
        if peer_col in PIPE_GEOMETRY_COLUMNS and peer_col != column_name:
            parsed_peer = parse_decimal_basic(peer_raw)
            if parsed_peer is not None:
                peer_parsed[peer_col] = parsed_peer

    if not peer_parsed:
        return valid_options[0]

    best_option = valid_options[0]
    best_score = Decimal("-999999")

    for divisor, candidate in valid_options:
        coerced: dict[str, Decimal | None] = {column_name: candidate}
        for peer_col, peer_val in peer_parsed.items():
            coerced[peer_col] = _coerce_peer_with_divisor(peer_col, peer_val, divisor)

        score = _geometry_score(
            coerced.get("od_mm"),
            coerced.get("half_od_mm"),
            coerced.get("id_mm"),
            coerced.get("wall_thk_mm"),
        )
        if score > best_score:
            best_score = score
            best_option = (divisor, candidate)

    return best_option


def parse_nps_inches(value: Any) -> Decimal | None:
    if value is None:
        return None

    raw = str(value).strip()
    if raw == "" or raw.upper() == "NULL":
        return None

    raw = raw.replace('"', "").replace("″", "").strip()

    if re.match(r"^\d+\s*/\s*\d+$", raw):
        num, den = raw.split("/")
        return Decimal(num.strip()) / Decimal(den.strip())

    if re.match(r"^\d+\s+\d+\s*/\s*\d+$", raw):
        whole, frac = raw.split(" ", 1)
        num, den = frac.split("/")
        return Decimal(whole) + (Decimal(num.strip()) / Decimal(den.strip()))

    raw = raw.replace(",", ".")
    if re.match(r"^\d+(\.\d+)?$", raw):
        return Decimal(raw)

    return None


def parse_nps_from_item_key(item_key: Any) -> Decimal | None:
    if not item_key:
        return None

    parts = str(item_key).split("|")

    if len(parts) <= 4:
        return None

    candidate = parts[4].strip().replace(",", ".")

    try:
        return Decimal(candidate)
    except (InvalidOperation, ValueError):
        return None


def coerce_nps_value(
    raw_value: Any,
    row_context: dict[str, Any] | None = None,
) -> dict[str, Any]:
    parsed = parse_decimal_basic(raw_value)
    context = row_context or {}

    if parsed is None:
        return {
            "value": None,
            "method": "NULL_EMPTY",
            "warning": None,
            "scale_divisor": None,
        }

    expected = (
        parse_nps_inches(context.get("nps_polegadas"))
        or parse_nps_inches(context.get("nps_raw"))
        or parse_nps_from_item_key(context.get("item_key"))
    )

    candidates: list[tuple[Decimal, Decimal]] = []
    for divisor in NPS_SCALE_CANDIDATES:
        candidate = parsed / divisor
        if Decimal("0") < abs(candidate) <= Decimal("100"):
            candidates.append((divisor, candidate))

    if expected is not None and candidates:
        divisor, candidate = min(
            candidates,
            key=lambda item: abs(item[1] - expected),
        )
        if abs(candidate - expected) <= Decimal("0.0001"):
            if divisor == 1:
                return {
                    "value": candidate,
                    "method": "NUMERIC_DIRECT",
                    "warning": None,
                    "scale_divisor": None,
                }
            return {
                "value": candidate,
                "method": "NUMERIC_SCALE_INFERRED",
                "warning": (
                    f"Valor {raw_value} normalizado para {candidate} "
                    f"dividindo por {divisor} na coluna nps."
                ),
                "scale_divisor": divisor,
            }

    if parsed >= Decimal("10000") and parsed < Decimal("1000000"):
        candidate = parsed / Decimal("10000")
        if Decimal("0") < abs(candidate) <= Decimal("100"):
            return {
                "value": candidate,
                "method": "NUMERIC_SCALE_INFERRED",
                "warning": (
                    f"Valor {raw_value} normalizado para {candidate} "
                    f"dividindo por 10000 na coluna nps."
                ),
                "scale_divisor": Decimal("10000"),
            }

    if parsed >= Decimal("100000000"):
        candidate = parsed / Decimal("100000000")
        if Decimal("0") < abs(candidate) <= Decimal("100"):
            return {
                "value": candidate,
                "method": "NUMERIC_SCALE_INFERRED",
                "warning": (
                    f"Valor {raw_value} normalizado para {candidate} "
                    f"dividindo por 100000000 na coluna nps."
                ),
                "scale_divisor": Decimal("100000000"),
            }

    if Decimal("0") < abs(parsed) <= Decimal("100"):
        return {
            "value": parsed,
            "method": "NUMERIC_DIRECT",
            "warning": None,
            "scale_divisor": None,
        }

    return {
        "value": None,
        "method": "NULL_NUMERIC_OUT_OF_PROFILE",
        "warning": (
            f"Valor numérico fora do perfil esperado para nps: {raw_value}. "
            f"Valor convertido para NULL."
        ),
        "scale_divisor": None,
    }


def coerce_decimal_for_column(
    raw_value: Any,
    column_name: str,
    row_peers: dict[str, Any] | None = None,
    row_context: dict[str, Any] | None = None,
) -> dict[str, Any]:
    if column_name == "nps":
        return coerce_nps_value(raw_value, row_context)

    parsed = parse_decimal_basic(raw_value)

    if parsed is None:
        return {
            "value": None,
            "method": "NULL_EMPTY",
            "warning": None,
            "scale_divisor": None,
        }

    profile = NUMERIC_COLUMN_PROFILES.get(column_name)
    if not profile:
        return {
            "value": parsed,
            "method": "NUMERIC_DIRECT",
            "warning": None,
            "scale_divisor": None,
        }

    min_value = profile["min"]
    max_value = profile["max"]
    candidates = _profile_scale_candidates(profile)

    valid_options = _collect_valid_scale_options(parsed, min_value, max_value, candidates)
    if not valid_options:
        return {
            "value": None,
            "method": "NULL_NUMERIC_OUT_OF_PROFILE",
            "warning": (
                f"Valor numérico fora do perfil esperado para {column_name}: {raw_value}. "
                f"Valor convertido para NULL."
            ),
            "scale_divisor": None,
        }

    divisor, candidate = _select_scale_option(column_name, valid_options, row_peers)

    if divisor == 1:
        return {
            "value": candidate,
            "method": "NUMERIC_DIRECT",
            "warning": None,
            "scale_divisor": None,
        }

    return {
        "value": candidate,
        "method": "NUMERIC_SCALE_INFERRED",
        "warning": (
            f"Valor {raw_value} normalizado para {candidate} "
            f"dividindo por {divisor} na coluna {column_name}."
        ),
        "scale_divisor": divisor,
    }


def build_coercion_warning_message(
    column_name: str,
    *,
    raw_value: Any,
    parsed_value: Any,
    coercion_method: str | None,
    scale_divisor: Any = None,
    fallback_warning: str | None = None,
) -> str | None:
    if coercion_method == "NUMERIC_SCALE_INFERRED":
        if raw_value is not None and parsed_value is not None and scale_divisor is not None:
            return (
                f"Valor {raw_value} normalizado para {parsed_value} "
                f"dividindo por {scale_divisor} na coluna {column_name}."
            )
    if coercion_method in {"NULL_PARSE_FAILED", "NULL_NUMERIC_OUT_OF_PROFILE"} and fallback_warning:
        return fallback_warning
    return fallback_warning


def validate_warning_matches_parsed(
    warning_message: str | None,
    parsed_value: Any,
) -> bool:
    if not warning_message or parsed_value is None:
        return True
    parsed_text = _format_parsed_value(parsed_value) if not isinstance(parsed_value, str) else parsed_value
    if not parsed_text:
        return True
    if parsed_text in warning_message:
        return True
    # Reject obviously stale tiny values when parsed is larger
    if "normalizado para 0.0000" in warning_message and parsed_text and not parsed_text.startswith("0.0000"):
        return False
    return True


def _is_nonempty_raw(raw_value: Any) -> bool:
    if raw_value is None:
        return False
    raw_str = str(raw_value).strip()
    return bool(raw_str) and raw_str.upper() not in EMPTY_LIKE_VALUES


def coerce_boolean_value(raw_value: Any, column_name: str, is_nullable: bool) -> dict[str, Any]:
    try:
        parsed = parse_boolean_value(raw_value, column_name)
        return {
            "value": parsed,
            "method": "BOOLEAN_PARSED",
            "warning": None,
            "error": None,
            "scale_divisor": None,
        }
    except ValueError as exc:
        if is_nullable:
            return {
                "value": None,
                "method": "NULL_PARSE_FAILED",
                "warning": f"Valor inválido para {column_name}: {raw_value}. Convertido para NULL.",
                "error": None,
                "scale_divisor": None,
            }
        return {
            "value": None,
            "method": "PARSE_FAILED",
            "warning": None,
            "error": str(exc),
            "scale_divisor": None,
        }


def coerce_datetime_value(raw_value: Any, column_name: str, is_nullable: bool) -> dict[str, Any]:
    try:
        parsed = parse_datetime_value(raw_value)
        if parsed is None:
            return {
                "value": None,
                "method": "NULL_EMPTY",
                "warning": None,
                "error": None,
                "scale_divisor": None,
            }
        return {
            "value": parsed,
            "method": "DATETIME_PARSED",
            "warning": None,
            "error": None,
            "scale_divisor": None,
        }
    except ValueError as exc:
        if is_nullable:
            return {
                "value": None,
                "method": "NULL_PARSE_FAILED",
                "warning": f"Data/hora inválida para {column_name}: {raw_value}. Convertido para NULL.",
                "error": None,
                "scale_divisor": None,
            }
        return {
            "value": None,
            "method": "PARSE_FAILED",
            "warning": None,
            "error": str(exc),
            "scale_divisor": None,
        }


def _format_parsed_value(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, Decimal):
        return format(value.normalize(), "f")
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, bool):
        return "true" if value else "false"
    return str(value)


def coerce_value_for_db(
    raw_value: Any,
    column_name: str,
    column_meta: dict[str, Any],
    row_peers: dict[str, Any] | None = None,
    row_context: dict[str, Any] | None = None,
) -> dict[str, Any]:
    data_type = (column_meta.get("data_type") or "").lower()
    is_nullable = bool(column_meta.get("is_nullable", True))
    raw_display = format_stored_raw_value(raw_value)

    base = {
        "raw_value": raw_display,
        "parsed_value": None,
        "scale_divisor": None,
    }

    try:
        if raw_value is None:
            return {
                **base,
                "value": None,
                "method": "NULL_EMPTY",
                "warning": None,
                "error": None,
            }

        raw_str = str(raw_value).strip()
        if raw_str.upper() in EMPTY_LIKE_VALUES:
            return {
                **base,
                "value": None,
                "method": "NULL_EMPTY",
                "warning": None,
                "error": None,
            }

        if data_type in {"numeric", "decimal", "double precision", "real"}:
            if column_name == "nps":
                result = coerce_nps_value(raw_value, row_context)
            else:
                result = coerce_decimal_for_column(
                    raw_value, column_name, row_peers=row_peers, row_context=row_context
                )
            value = result["value"]
            if value is not None:
                validate_numeric_range(value, column_name)

            if (
                column_name in CRITICAL_COLUMNS
                and value is None
                and result["method"] in {"NULL_NUMERIC_OUT_OF_PROFILE", "NULL_PARSE_FAILED", "PARSE_FAILED"}
                and is_nonempty_excel_value(raw_value)
            ):
                return {
                    **base,
                    "value": None,
                    "method": result["method"],
                    "warning": None,
                    "error": critical_row_error_message(column_name),
                }

            if value is None and not is_nullable:
                return {
                    **base,
                    "value": None,
                    "method": result["method"],
                    "warning": None,
                    "error": f"Coluna {column_name} não permite NULL.",
                }

            return {
                **base,
                "value": value,
                "method": result["method"],
                "warning": result.get("warning"),
                "error": None,
                "parsed_value": _format_parsed_value(value),
                "scale_divisor": result.get("scale_divisor"),
            }

        if data_type in {"integer", "bigint", "smallint"}:
            parsed = parse_decimal_basic(raw_value)
            if parsed is None:
                return {
                    **base,
                    "value": None,
                    "method": "NULL_EMPTY",
                    "warning": None,
                    "error": None,
                }
            if parsed != int(parsed):
                if is_nullable:
                    return {
                        **base,
                        "value": None,
                        "method": "NULL_PARSE_FAILED",
                        "warning": f"Valor inteiro inválido para {column_name}: {raw_value}. Convertido para NULL.",
                        "error": None,
                    }
                return {
                    **base,
                    "value": None,
                    "method": "PARSE_FAILED",
                    "warning": None,
                    "error": f"Valor inteiro inválido para {column_name}: {raw_value}.",
                }
            int_value = int(parsed)
            return {
                **base,
                "value": int_value,
                "method": "INTEGER_PARSED",
                "warning": None,
                "error": None,
                "parsed_value": str(int_value),
            }

        if data_type == "boolean":
            result = coerce_boolean_value(raw_value, column_name, is_nullable)
            return {
                **base,
                **result,
                "parsed_value": _format_parsed_value(result["value"]),
            }

        if "timestamp" in data_type:
            result = coerce_datetime_value(raw_value, column_name, is_nullable)
            return {
                **base,
                **result,
                "parsed_value": _format_parsed_value(result["value"]),
            }

        text_value = str(raw_value).strip()
        return {
            **base,
            "value": text_value,
            "method": "TEXT_STRING",
            "warning": None,
            "error": None,
            "parsed_value": text_value,
        }

    except Exception as exc:
        if is_nullable:
            return {
                **base,
                "value": None,
                "method": "NULL_PARSE_FAILED",
                "warning": f"Valor inválido para {column_name}: {raw_value}. Convertido para NULL.",
                "error": None,
            }
        return {
            **base,
            "value": None,
            "method": "PARSE_FAILED",
            "warning": None,
            "error": f"Valor inválido para {column_name}: {raw_value}. Erro: {exc}",
        }
