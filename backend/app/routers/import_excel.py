from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.logging import log_error
from app.services import import_debug_service
from app.services import import_async
from app.services import import_flow_service
from app.services import import_staging_service as staging
from app.services.import_guard import ImportGuardError, restore_preview_ready_after_apply_failure
from app.services.import_schema import ImportSchemaError

router = APIRouter(prefix="/api/spec-items/import-excel", tags=["import-excel"])


class ColumnMappingItem(BaseModel):
    excel_column_name: str
    action: str
    target_column_name: str | None = None
    confidence: float | None = None


class SaveMappingRequest(BaseModel):
    mappings: list[ColumnMappingItem] = Field(default_factory=list)


class MarkFailedRequest(BaseModel):
    reason: str | None = None


class ApplyImportRequest(BaseModel):
    mode: str = "valid_rows_only"


@router.post("/analyze")
async def analyze_import(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename or not file.filename.lower().endswith(".xlsx"):
        raise HTTPException(status_code=400, detail="Arquivo deve ser .xlsx")

    try:
        return await import_async.start_analyze_from_upload(db, file)
    except ImportSchemaError as exc:
        log_error(
            "EXCEL_IMPORT",
            "analyze_schema_incomplete",
            missing_columns=exc.detail.get("missing_columns"),
        )
        raise HTTPException(status_code=503, detail=exc.detail) from exc
    except ValueError as exc:
        log_error("EXCEL_IMPORT", "analyze_validation_failed", error=str(exc))
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        log_error("EXCEL_IMPORT", "analyze_failed", error=str(exc), error_type=type(exc).__name__)
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/runs/{run_id}/status")
def get_import_status(run_id: int, db: Session = Depends(get_db)):
    status = staging.get_run_status(db, run_id)
    if not status:
        raise HTTPException(status_code=404, detail="Importação não encontrada")
    return status


@router.get("/runs/{run_id}")
def get_import_run(run_id: int, db: Session = Depends(get_db)):
    try:
        return import_flow_service.get_run_with_mappings(db, run_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except HTTPException:
        raise
    except Exception as exc:
        log_error(
            "EXCEL_IMPORT",
            "get_run_detail_failed",
            run_id=run_id,
            error=str(exc),
            error_type=type(exc).__name__,
        )
        raise HTTPException(
            status_code=500,
            detail={
                "message": "Erro ao carregar detalhes da importação.",
                "run_id": run_id,
                "error": str(exc),
                "error_type": type(exc).__name__,
            },
        ) from exc


@router.post("/runs/{run_id}/mapping")
def save_mapping(run_id: int, payload: SaveMappingRequest, db: Session = Depends(get_db)):
    try:
        mappings = [item.model_dump() for item in payload.mappings]
        return import_async.save_mapping_only(db, run_id, mappings)
    except ValueError as exc:
        log_error("EXCEL_IMPORT", "mapping_validation_failed", run_id=run_id, error=str(exc))
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        log_error("EXCEL_IMPORT", "mapping_failed", run_id=run_id, error=str(exc))
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/runs/{run_id}/preview")
def start_preview(run_id: int, db: Session = Depends(get_db)):
    try:
        return import_async.start_preview(db, run_id)
    except ImportSchemaError as exc:
        log_error(
            "EXCEL_IMPORT",
            "preview_schema_incomplete",
            run_id=run_id,
            missing_columns=exc.detail.get("missing_columns"),
        )
        raise HTTPException(status_code=503, detail=exc.detail) from exc
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/runs/{run_id}/debug/raw-excel-sample")
def debug_raw_excel_sample(
    run_id: int,
    max_rows: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
):
    try:
        return import_debug_service.get_raw_excel_sample(db, run_id, max_rows=max_rows)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        log_error("EXCEL_IMPORT", "debug_raw_excel_sample_failed", run_id=run_id, error=str(exc))
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/runs/{run_id}/debug/raw-vs-staging")
def debug_raw_vs_staging(
    run_id: int,
    max_rows: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    try:
        return import_debug_service.get_raw_vs_staging(db, run_id, max_rows=max_rows)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        log_error("EXCEL_IMPORT", "debug_raw_vs_staging_failed", run_id=run_id, error=str(exc))
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/runs/{run_id}/preview")
def get_preview(run_id: int, db: Session = Depends(get_db)):
    try:
        return import_flow_service.get_preview(db, run_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        log_error("EXCEL_IMPORT", "preview_get_failed", run_id=run_id, error=str(exc))
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/runs/{run_id}/reanalyze")
def reanalyze_import(run_id: int, db: Session = Depends(get_db)):
    try:
        result = import_async.start_reanalyze(db, run_id)
        if not result.get("ok"):
            raise HTTPException(status_code=400, detail=result)
        return result
    except ValueError as exc:
        log_error("EXCEL_IMPORT", "reanalyze_validation_failed", run_id=run_id, error=str(exc))
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        log_error("EXCEL_IMPORT", "reanalyze_failed", run_id=run_id, error=str(exc))
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/runs/{run_id}/rebuild-preview")
def rebuild_preview(run_id: int, db: Session = Depends(get_db)):
    try:
        return import_async.start_rebuild_preview(db, run_id)
    except ImportSchemaError as exc:
        log_error(
            "EXCEL_IMPORT",
            "preview_schema_incomplete",
            run_id=run_id,
            missing_columns=exc.detail.get("missing_columns"),
        )
        raise HTTPException(status_code=503, detail=exc.detail) from exc
    except ImportGuardError as exc:
        raise HTTPException(status_code=409, detail=exc.detail) from exc
    except ValueError as exc:
        log_error("EXCEL_IMPORT", "rebuild_preview_validation_failed", run_id=run_id, error=str(exc))
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        log_error("EXCEL_IMPORT", "rebuild_preview_failed", run_id=run_id, error=str(exc))
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/runs/{run_id}/restore-preview-ready")
def restore_preview_ready(run_id: int, db: Session = Depends(get_db)):
    """Restaura run FAILED por bug de validação de apply para PREVIEW_READY."""
    try:
        return restore_preview_ready_after_apply_failure(db, run_id)
    except ValueError as exc:
        log_error("EXCEL_IMPORT", "restore_preview_ready_failed", run_id=run_id, error=str(exc))
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        log_error("EXCEL_IMPORT", "restore_preview_ready_failed", run_id=run_id, error=str(exc))
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/runs/{run_id}/apply")
def apply_import(run_id: int, payload: ApplyImportRequest | None = None, db: Session = Depends(get_db)):
    mode = (payload.mode if payload else "valid_rows_only") or "valid_rows_only"
    if mode not in {"valid_rows_only", "all_or_nothing"}:
        raise HTTPException(status_code=400, detail="mode deve ser valid_rows_only ou all_or_nothing")
    try:
        return import_async.start_apply(db, run_id, mode=mode)
    except ImportGuardError as exc:
        log_error("EXCEL_IMPORT", "apply_blocked", run_id=run_id, detail=exc.detail)
        raise HTTPException(status_code=409, detail=exc.detail) from exc
    except ValueError as exc:
        log_error("EXCEL_IMPORT", "apply_validation_failed", run_id=run_id, error=str(exc))
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        log_error("EXCEL_IMPORT", "apply_failed", run_id=run_id, error=str(exc))
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/runs/{run_id}/errors")
def get_errors(
    run_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    if not staging.get_import_run(db, run_id):
        raise HTTPException(status_code=404, detail="Importação não encontrada")
    return staging.get_preview_errors_paginated(db, run_id, page=page, page_size=page_size)


@router.get("/runs/{run_id}/errors/export")
def export_errors(run_id: int, db: Session = Depends(get_db)):
    if not staging.get_import_run(db, run_id):
        raise HTTPException(status_code=404, detail="Importação não encontrada")
    csv_content = staging.export_import_errors_csv(db, run_id)
    return Response(
        content=csv_content,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="import_run_{run_id}_errors.csv"'},
    )


@router.get("/runs/{run_id}/warnings")
def get_warnings(
    run_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    if not staging.get_import_run(db, run_id):
        raise HTTPException(status_code=404, detail="Importação não encontrada")
    return staging.get_preview_warnings_paginated(db, run_id, page=page, page_size=page_size)


@router.get("/runs/{run_id}/diffs")
def get_diffs(
    run_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    if not staging.get_import_run(db, run_id):
        raise HTTPException(status_code=404, detail="Importação não encontrada")
    return staging.get_preview_diffs_paginated(db, run_id, page=page, page_size=page_size)


@router.post("/runs/{run_id}/mark-failed")
def mark_run_failed(run_id: int, payload: MarkFailedRequest, db: Session = Depends(get_db)):
    if not staging.get_import_run(db, run_id):
        raise HTTPException(status_code=404, detail="Importação não encontrada.")

    reason = payload.reason or "Marcado como FAILED manualmente."
    db.execute(
        text(
            """
            UPDATE app_import_runs
            SET
                status = 'FAILED',
                phase = 'failed',
                progress_message = :reason,
                error_message = :reason,
                finished_at = now()
            WHERE id = :run_id
            """
        ),
        {"run_id": run_id, "reason": reason},
    )
    db.commit()
    log_error("EXCEL_IMPORT", "run_marked_failed_manual", run_id=run_id, reason=reason)
    return {"ok": True, "run_id": run_id, "status": "FAILED", "message": reason}


@router.post("/runs/{run_id}/cancel")
def cancel_import(run_id: int, db: Session = Depends(get_db)):
    try:
        return import_flow_service.cancel_import(db, run_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


legacy_router = APIRouter(prefix="/api", tags=["import"])


@legacy_router.get("/import-runs")
def list_import_runs(db: Session = Depends(get_db)):
    return staging.list_import_runs(db)


@legacy_router.get("/import-runs/{run_id}")
def get_legacy_import_run(run_id: int, db: Session = Depends(get_db)):
    run = staging.get_import_run(db, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Importação não encontrada")
    errors = staging.get_preview_errors_paginated(db, run_id, page=1, page_size=100)
    result = dict(run)
    result["errors"] = errors["items"]
    return result
