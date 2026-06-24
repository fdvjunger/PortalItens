"""Regras de escopo produtivo do dashboard (exclui itens comprados/externos)."""

from typing import Any

from app.utils.sql_utils import like_operator, quote_identifier

EXCLUDED_ITEM_TYPE_MARKERS = (
    "BOLT",
    "SCREW",
    "STUD",
    "NUT",
    "WASHER",
    "FASTENER",
    "GASKET",
    "VALVE",
)

PRODUCTIVE_DASHBOARD_NOTE = (
    "Indicadores produtivos desconsideram válvulas, gaskets e fixadores, "
    "por serem itens comprados/externos."
)


def is_productive_dashboard_item(item_type: str | None) -> bool:
    """Retorna True se o item deve entrar nos indicadores produtivos do dashboard."""
    if item_type is None:
        return True
    normalized = str(item_type).strip().upper()
    if not normalized:
        return True
    return not any(marker in normalized for marker in EXCLUDED_ITEM_TYPE_MARKERS)


def parse_include_external_items(value: Any, *, default: bool) -> bool:
    """True = incluir itens externos; False = escopo produtivo apenas."""
    if value is None or value == "":
        return default
    return str(value).lower() in {"true", "1", "yes"}


def productive_exclusion_sql(column: str = "item_type") -> str:
    """Condição SQL que exclui famílias externas/compradas."""
    like_op = like_operator()
    quoted = quote_identifier(column)
    normalized_col = f"UPPER(LTRIM(RTRIM(CAST({quoted} AS VARCHAR(1000)))))"
    matches = " OR ".join(
        f"{normalized_col} {like_op} '%{marker}%'" for marker in EXCLUDED_ITEM_TYPE_MARKERS
    )
    return f"NOT ({matches})"


def append_productive_exclusion(where_clause: str, include_external_items: bool) -> str:
    if include_external_items:
        return where_clause
    exclusion = productive_exclusion_sql()
    if where_clause:
        return f"{where_clause} AND {exclusion}"
    return f"WHERE {exclusion}"


def and_condition(where_clause: str, condition: str) -> str:
    connector = "AND" if where_clause else "WHERE"
    return f"{where_clause} {connector} {condition}"
