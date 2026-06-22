import json
from decimal import Decimal
from typing import Any

from sqlalchemy.orm import Session

from app.core.logging import log_error
from app.services import import_staging_service as staging
from app.utils.excel_raw_value import format_stored_raw_value

CORRUPTION_CHECK_COLUMNS = {
    "weight",
    "dn_mm",
    "od_mm",
    "wall_thk_mm",
    "id_mm",
    "half_od_mm",
    "dm_ex",
    "sch_mm",
    "area_m2_per_m",
    "radius",
}

EXPECTED_MAX: dict[str, Decimal] = {
    "weight": Decimal("100000"),
    "dn_mm": Decimal("100000"),
    "od_mm": Decimal("100000"),
    "wall_thk_mm": Decimal("10000"),
    "id_mm": Decimal("100000"),
    "half_od_mm": Decimal("100000"),
    "dm_ex": Decimal("100000"),
    "sch_mm": Decimal("10000"),
    "area_m2_per_m": Decimal("1000"),
    "radius": Decimal("100000"),
}

CORRUPTION_SAMPLE_LIMIT = 200
CORRUPTION_HIT_THRESHOLD = 1


def is_likely_corrupted_raw_numeric(raw_value: Any, column_name: str) -> bool:
    if raw_value is None or column_name not in CORRUPTION_CHECK_COLUMNS:
        return False

    max_expected = EXPECTED_MAX.get(column_name)
    if max_expected is None:
        return False

    raw_text = format_stored_raw_value(raw_value)
    if raw_text is None:
        return False

    if "." in raw_text or "," in raw_text:
        return False

    try:
        numeric = Decimal(raw_text)
    except Exception:
        return False

    if abs(numeric) <= max_expected:
        return False

    if abs(numeric) >= Decimal("1000000"):
        return True

    return False


def detect_corrupted_numeric_staging(db: Session, run_id: int) -> dict[str, Any]:
    mappings = staging.get_column_mappings(db, run_id)
    numeric_mappings = [
        m
        for m in mappings
        if m.get("action") == "MAP_TO_EXISTING"
        and m.get("target_column_name") in CORRUPTION_CHECK_COLUMNS
    ]

    if not numeric_mappings:
        return {"is_corrupted": False, "reason": None, "samples": []}

    rows = staging.get_staging_rows(db, run_id, offset=0, limit=CORRUPTION_SAMPLE_LIMIT)
    samples: list[dict[str, Any]] = []

    for row in rows:
        raw_json = row["raw_json"]
        if isinstance(raw_json, str):
            raw_json = json.loads(raw_json)

        for mapping in numeric_mappings:
            excel_col = mapping["excel_column_name"]
            target_col = mapping["target_column_name"]
            raw_value = raw_json.get(excel_col)
            if not is_likely_corrupted_raw_numeric(raw_value, target_col):
                continue

            samples.append(
                {
                    "excel_row_number": row["excel_row_number"],
                    "column_name": target_col,
                    "excel_column_name": excel_col,
                    "raw_value": format_stored_raw_value(raw_value),
                }
            )
            if len(samples) >= 20:
                break
        if len(samples) >= 20:
            break

    is_corrupted = len(samples) >= CORRUPTION_HIT_THRESHOLD
    result = {
        "is_corrupted": is_corrupted,
        "reason": (
            "Valores numéricos no staging parecem ter perdido o ponto decimal."
            if is_corrupted
            else None
        ),
        "samples": samples[:20],
    }

    if is_corrupted:
        log_error(
            "EXCEL_IMPORT",
            "corrupted_numeric_staging_detected",
            run_id=run_id,
            samples=samples[:20],
        )

    return result
