from datetime import date, datetime
from decimal import Decimal
from typing import Any


def serialize_raw_excel_value(value: Any) -> Any:
    """
    Salva o valor cru do Excel de forma JSON-safe.
    Não faz parse de decimal, não remove ponto, não transforma vírgula.
    """
    if value is None:
        return None

    if isinstance(value, (datetime, date)):
        return value.isoformat()

    if isinstance(value, Decimal):
        return str(value)

    if isinstance(value, bool):
        return value

    if isinstance(value, (int, float)):
        return value

    return str(value)


def format_stored_raw_value(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, float):
        return str(value)
    return str(value)
