import re
import unicodedata

COLUMN_SYNONYMS = {
    "DIAMETRO EXTERNO MM": "dm_ex",
    "DIÂMETRO EXTERNO MM": "dm_ex",
    "DIAMETRO_EXTERNO_MM": "dm_ex",
    "DM EX": "dm_ex",
    "DM_EX": "dm_ex",
    "ÁREA (M²/M": "area_m2_per_m",
    "AREA (M²/M": "area_m2_per_m",
    "AREA M2/M": "area_m2_per_m",
    "AREA_M2_PER_M": "area_m2_per_m",
    "SCHEDULE MM": "sch_mm",
    "SCHEDULE_MM": "sch_mm",
    "SCH MM": "sch_mm",
    "SCH_MM": "sch_mm",
    "R": "radius",
    "RAIO": "radius",
    "RADIUS": "radius",
    "ALTERDATAID": "alterDataID",
    "ALTERDATA ID": "alterDataID",
    "ALTERDATA_ID": "alterDataID",
}


def normalize_header(header: str) -> str:
    return re.sub(r"\s+", " ", str(header).strip())


def normalize_column_key(name: str) -> str:
    text = normalize_header(name).upper()
    text = unicodedata.normalize("NFKD", text)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = text.replace("²", "2").replace("³", "3")
    text = re.sub(r"[\s_\-/()]+", "", text)
    return text


def build_synonym_lookup() -> dict[str, str]:
    lookup: dict[str, str] = {}
    for excel_name, target in COLUMN_SYNONYMS.items():
        lookup[normalize_column_key(excel_name)] = target
    return lookup


SYNONYM_LOOKUP = build_synonym_lookup()


def suggest_column_mapping(
    excel_column: str,
    db_columns: list[str],
) -> dict[str, object]:
    normalized_excel = normalize_header(excel_column)
    db_set = set(db_columns)

    if normalized_excel in db_set:
        return {
            "excel_column": normalized_excel,
            "suggested_target_column": normalized_excel,
            "confidence": 1.0,
            "action": "MAP_TO_EXISTING",
        }

    normalized_key = normalize_column_key(normalized_excel)
    if normalized_key in SYNONYM_LOOKUP and SYNONYM_LOOKUP[normalized_key] in db_set:
        target = SYNONYM_LOOKUP[normalized_key]
        return {
            "excel_column": normalized_excel,
            "suggested_target_column": target,
            "confidence": 0.95,
            "action": "MAP_TO_EXISTING",
        }

    for db_col in db_columns:
        if normalize_column_key(db_col) == normalized_key:
            return {
                "excel_column": normalized_excel,
                "suggested_target_column": db_col,
                "confidence": 0.9,
                "action": "MAP_TO_EXISTING",
            }

    return {
        "excel_column": normalized_excel,
        "suggested_target_column": None,
        "confidence": 0.0,
        "action": "IGNORE",
    }
