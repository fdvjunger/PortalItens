from typing import Any

CRITICAL_COLUMNS = frozenset({"id", "nps", "item_type", "short_code"})

EMPTY_LIKE = {
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

APPLYABLE_ROW_STATUSES = frozenset({"INSERT", "UPDATE", "UNCHANGED"})
SKIPPED_ROW_STATUSES = frozenset({"ROW_ERROR", "ERROR", "SKIPPED_ERROR", "IGNORED"})


def is_nonempty_excel_value(raw_value: Any) -> bool:
    if raw_value is None:
        return False
    raw_str = str(raw_value).strip()
    return bool(raw_str) and raw_str.upper() not in EMPTY_LIKE


def critical_row_error_message(column_name: str, detail: str | None = None) -> str:
    if detail and "será ignorada" in detail:
        return detail
    return f"Campo crítico {column_name} inválido. A linha será ignorada no Apply."


def is_critical_row_error(column_name: str, raw_value: Any, error: str | None) -> bool:
    return bool(error) and column_name in CRITICAL_COLUMNS and is_nonempty_excel_value(raw_value)
