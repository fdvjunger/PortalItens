from typing import Any

from app.utils.column_mapping_utils import normalize_header
from app.utils.excel_raw_value import serialize_raw_excel_value
from app.utils.excel_utils import normalize_null


def build_raw_row_json(raw_headers: list[str], row: tuple[Any, ...]) -> dict[str, Any]:
    row_data: dict[str, Any] = {}
    for col_idx, header in enumerate(raw_headers):
        if not header:
            continue
        value = row[col_idx] if col_idx < len(row) else None
        row_data[header] = serialize_raw_excel_value(value)
    return row_data


def is_empty_excel_row(row: tuple[Any, ...]) -> bool:
    return all(normalize_null(cell) is None for cell in row)


def normalize_excel_headers(header_row: tuple[Any, ...]) -> list[str]:
    return [normalize_header(h) if h is not None else "" for h in header_row]
