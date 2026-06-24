"""Campos de identidade técnica vs ocorrência da spec."""

from decimal import Decimal
from typing import Any

TECHNICAL_IDENTITY_FIELDS = frozenset(
    {
        "item_type",
        "short_code",
        "nps",
        "schedule",
        "geometric_standard",
        "material_description",
        "has_nace",
        "end_conn_1",
        "end_conn_2",
        "mds",
        "rating",
        "pipe_seam_type",
        "dn_mm",
        "od_mm",
        "wall_thk_mm",
        "id_mm",
        "weight",
        "weight_unit",
        "weight_basis",
        "dm_ex",
        "area_m2_per_m",
        "sch_mm",
        "radius",
    }
)

OCCURRENCE_FIELDS = frozenset(
    {
        "spec_id",
        "source_page",
        "eds_vds",
        "notes",
        "nps_polegadas",
        "item_key",
        "sort_order",
        "is_active",
        "nps_table_col_index",
        "nps_raw",
        "nps_row_raw_cells_json",
        "nps_table",
        "half_od_mm",
        "weight_source_file",
        "weight_source_sheet",
        "weight_source_row",
        "weight_match_method",
        "weight_match_confidence",
        "alterDataID",
        "legacy_r",
        "cliente",
        "r",
    }
)

CURVE_ITEM_TYPE_MARKERS = ("LR", "SR", "RETURN", "ELL", "CURVE", "BEND")


def normalize_text(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text or text.upper() in {"NULL", "NONE", "N/A", "NA"}:
        return None
    return text.upper()


def normalize_decimal(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, Decimal):
        return format(value.normalize(), "f")
    text = str(value).strip().replace(",", ".")
    if not text:
        return None
    try:
        return format(Decimal(text).normalize(), "f")
    except Exception:
        return text.upper()


def normalize_bool(value: Any) -> str:
    if value is None:
        return "0"
    if isinstance(value, bool):
        return "1" if value else "0"
    text = str(value).strip().lower()
    if text in {"1", "true", "yes", "sim", "s"}:
        return "1"
    return "0"


def include_radius_in_identity(item_type: str | None) -> bool:
    if not item_type:
        return False
    upper = item_type.upper()
    return any(marker in upper for marker in CURVE_ITEM_TYPE_MARKERS)


def build_canonical_item_key(payload: dict[str, Any]) -> str:
    item_type = normalize_text(payload.get("item_type"))
    parts: list[str] = []

    ordered_fields = [
        "item_type",
        "short_code",
        "nps",
        "schedule",
        "geometric_standard",
        "material_description",
        "has_nace",
        "end_conn_1",
        "end_conn_2",
        "mds",
        "rating",
        "pipe_seam_type",
        "dn_mm",
        "od_mm",
        "wall_thk_mm",
        "id_mm",
        "weight",
        "weight_unit",
        "weight_basis",
        "dm_ex",
        "area_m2_per_m",
        "sch_mm",
    ]

    for field in ordered_fields:
        raw = payload.get(field)
        if field == "has_nace":
            parts.append(f"{field}={normalize_bool(raw)}")
        elif field in {"nps", "dn_mm", "od_mm", "wall_thk_mm", "id_mm", "weight", "dm_ex", "area_m2_per_m", "sch_mm"}:
            parts.append(f"{field}={normalize_decimal(raw) or ''}")
        else:
            parts.append(f"{field}={normalize_text(raw) or ''}")

    if include_radius_in_identity(item_type):
        parts.append(f"radius={normalize_decimal(payload.get('radius')) or ''}")

    return "|".join(parts)
