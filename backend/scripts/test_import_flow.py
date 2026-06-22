"""Teste do fluxo analyze -> mapping -> preview -> apply."""
import io
import json

from openpyxl import Workbook

from app.services.import_flow_service import (
    analyze_excel_file,
    apply_import,
    get_preview,
    save_mapping_and_preview,
)
from app.core.database import SessionLocal

wb = Workbook()
ws = wb.active
ws.title = "spec_items"
ws.append(["id", "cliente", "DIAMETRO EXTERNO MM", "Schedule MM", "R"])
ws.append([1, "SBM", "38,1", "5.5", "10"])
ws.append([None, "SBM", "42,0", "6.0", "12"])

buffer = io.BytesIO()
wb.save(buffer)

db = SessionLocal()
try:
    analyze = analyze_excel_file(db, buffer.getvalue(), "test_flow.xlsx")
    print("ANALYZE:", json.dumps(analyze, ensure_ascii=False, default=str))

    mappings = []
    for col in analyze["known_columns"] + analyze["unknown_columns"]:
        suggestion = next(
            (s for s in analyze["suggested_mappings"] if s["excel_column"] == col),
            None,
        )
        if col in analyze["known_columns"]:
            mappings.append(
                {
                    "excel_column_name": col,
                    "action": "MAP_TO_EXISTING",
                    "target_column_name": col,
                }
            )
        elif suggestion and suggestion.get("suggested_target_column"):
            mappings.append(
                {
                    "excel_column_name": col,
                    "action": "MAP_TO_EXISTING",
                    "target_column_name": suggestion["suggested_target_column"],
                }
            )

    preview = save_mapping_and_preview(db, analyze["run_id"], mappings)
    print("PREVIEW:", json.dumps(preview["summary"], ensure_ascii=False, default=str))

    if preview["summary"]["error_rows"] == 0:
        result = apply_import(db, analyze["run_id"])
        print("APPLY:", json.dumps(result, ensure_ascii=False, default=str))
    else:
        print("ERRORS:", preview["errors"])
finally:
    db.close()
