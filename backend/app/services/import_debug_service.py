import json
from pathlib import Path
from typing import Any

from sqlalchemy.orm import Session

from app.core.logging import log_event
from app.services import import_staging_service as staging
from app.utils.excel_debug import (
    TARGET_NUMERIC_COLUMNS,
    compare_sample_status,
    debug_excel_raw_cells,
    infer_diagnosis,
)
from app.utils.excel_raw_value import format_stored_raw_value, serialize_raw_excel_value


def _diagnosis_message(diagnosis: str, samples: list[dict[str, Any]]) -> str:
    if diagnosis == "CONTAMINATED_SOURCE":
        examples = [
            f"Linha {s['excel_row_number']}, {s['column']} = {s['excel_raw_value']}"
            for s in samples
            if s["status"] == "OK_CONTAMINATED_SOURCE"
        ][:3]
        detail = "; ".join(examples) if examples else "valores numéricos incompatíveis no Excel"
        return (
            "O arquivo Excel enviado já contém valores corrompidos. "
            f"Exemplo: {detail}. Reenvie um Excel original/exportado correto."
        )
    if diagnosis == "STAGING_BUG":
        examples = [
            (
                f"Linha {s['excel_row_number']}, {s['column']}: "
                f"Excel={s['excel_raw_value']} vs Staging={s['staging_raw_value']}"
            )
            for s in samples
            if s["status"] == "MISMATCH"
        ][:3]
        detail = "; ".join(examples) if examples else "divergência entre Excel e staging"
        return (
            "O arquivo Excel está correto, mas o staging corrompeu os valores. "
            f"Exemplo: {detail}. Corrija o analyze/staging e reanalise."
        )
    if diagnosis == "OK":
        return "Excel e staging estão consistentes nas amostras verificadas."
    return (
        "Foram detectados valores numéricos incompatíveis. "
        "Use o diagnóstico para confirmar se o arquivo Excel já veio corrompido "
        "ou se houve erro durante o staging."
    )


def _numeric_columns_for_run(db: Session, run_id: int) -> list[tuple[str, str]]:
    """
    Retorna pares (target_column, excel_column_header) para colunas numéricas monitoradas.
    """
    mappings = staging.get_column_mappings(db, run_id)
    pairs: list[tuple[str, str]] = []
    seen: set[str] = set()

    for mapping in mappings:
        target = mapping.get("target_column_name")
        excel_col = mapping.get("excel_column_name")
        if not target or not excel_col:
            continue
        if target not in TARGET_NUMERIC_COLUMNS:
            continue
        if target in seen:
            continue
        pairs.append((target, excel_col))
        seen.add(target)

    return pairs


def get_raw_excel_sample(db: Session, run_id: int, *, max_rows: int = 10) -> dict[str, Any]:
    run = staging.get_import_run(db, run_id)
    if not run:
        raise ValueError("Importação não encontrada.")

    file_path = run.get("source_file_path")
    if not file_path or not Path(file_path).exists():
        raise ValueError("Arquivo original não encontrado. Reenvie o Excel.")

    sheet_name = run.get("sheet_name")
    rows = debug_excel_raw_cells(file_path, sheet_name=sheet_name, max_rows=max_rows)

    log_event(
        "EXCEL_IMPORT",
        "debug_raw_excel_sample",
        run_id=run_id,
        file_path=file_path,
        rows=len(rows),
    )

    return {
        "ok": True,
        "run_id": run_id,
        "source_file_path": file_path,
        "sheet_name": sheet_name,
        "rows": rows,
    }


def get_raw_vs_staging(db: Session, run_id: int, *, max_rows: int = 20) -> dict[str, Any]:
    run = staging.get_import_run(db, run_id)
    if not run:
        raise ValueError("Importação não encontrada.")

    file_path = run.get("source_file_path")
    if not file_path or not Path(file_path).exists():
        raise ValueError("Arquivo original não encontrado. Reenvie o Excel.")

    sheet_name = run.get("sheet_name")
    column_pairs = _numeric_columns_for_run(db, run_id)
    if not column_pairs:
        column_pairs = [(col, col) for col in sorted(TARGET_NUMERIC_COLUMNS)]

    excel_rows = debug_excel_raw_cells(file_path, sheet_name=sheet_name, max_rows=max_rows)
    excel_by_row: dict[int, dict[str, dict[str, Any]]] = {}
    for row in excel_rows:
        excel_by_row[row["excel_row_number"]] = {
            cell["excel_column"]: cell for cell in row["cells"]
        }

    staging_rows = staging.get_staging_rows(db, run_id, offset=0, limit=max_rows)
    staging_by_row: dict[int, dict[str, Any]] = {}
    for row in staging_rows:
        raw_json = row["raw_json"]
        if isinstance(raw_json, str):
            raw_json = json.loads(raw_json)
        staging_by_row[row["excel_row_number"]] = raw_json

    row_numbers = sorted(set(excel_by_row) | set(staging_by_row))[:max_rows]
    samples: list[dict[str, Any]] = []

    for row_number in row_numbers:
        excel_cells = excel_by_row.get(row_number, {})
        staging_json = staging_by_row.get(row_number, {})

        for target_col, excel_col in column_pairs:
            excel_cell = excel_cells.get(excel_col)
            excel_value = excel_cell["value"] if excel_cell else None
            staging_value = staging_json.get(excel_col)
            excel_present = excel_cell is not None
            staging_present = excel_col in staging_json

            status = compare_sample_status(
                column=target_col,
                excel_value=excel_value,
                staging_value=staging_value,
                excel_present=excel_present,
                staging_present=staging_present,
            )

            samples.append(
                {
                    "excel_row_number": row_number,
                    "column": target_col,
                    "excel_column": excel_col,
                    "excel_raw_value": format_stored_raw_value(
                        serialize_raw_excel_value(excel_value) if excel_present else None
                    ),
                    "excel_python_type": excel_cell["python_type"] if excel_cell else None,
                    "excel_data_type": excel_cell["data_type"] if excel_cell else None,
                    "excel_number_format": excel_cell["number_format"] if excel_cell else None,
                    "staging_raw_value": format_stored_raw_value(staging_value),
                    "status": status,
                }
            )

    diagnosis = infer_diagnosis(samples)
    message = _diagnosis_message(diagnosis, samples)

    log_event(
        "EXCEL_IMPORT",
        "debug_raw_vs_staging",
        run_id=run_id,
        diagnosis=diagnosis,
        sample_count=len(samples),
    )

    return {
        "ok": True,
        "run_id": run_id,
        "source_file_path": file_path,
        "sheet_name": sheet_name,
        "diagnosis": diagnosis,
        "message": message,
        "samples": samples,
    }
