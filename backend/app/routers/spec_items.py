import time

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.logging import log_error, log_event
from app.services import excel_service, spec_items_service

router = APIRouter(prefix="/api/spec-items", tags=["spec-items"])


class ExportExcelRequest(BaseModel):
    global_search: str = ""
    filters: dict[str, Any] = Field(default_factory=dict)
    sort_by: str = "id"
    sort_dir: str = "asc"
    columns: list[str] = Field(default_factory=list)


@router.get("/columns")
def get_columns(db: Session = Depends(get_db)):
    return spec_items_service.get_column_metadata(db)


@router.get("/stats")
def get_stats(db: Session = Depends(get_db)):
    return spec_items_service.get_dashboard_stats(db)


@router.get("")
def list_spec_items(
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    global_search: str | None = None,
    sort_by: str | None = "id",
    sort_dir: str = "asc",
    cliente: str | None = None,
    item_type: str | None = None,
    short_code: str | None = None,
    schedule: str | None = None,
    material_description: str | None = None,
    mds: str | None = None,
    spec_id: int | None = None,
    has_nace: str | None = None,
):
    try:
        log_event(
            "SPEC_ITEMS",
            "list_started",
            page=page,
            page_size=page_size,
            global_search=global_search,
            sort_by=sort_by,
            sort_dir=sort_dir,
            filters={
                "cliente": cliente,
                "item_type": item_type,
                "short_code": short_code,
                "schedule": schedule,
                "material_description": material_description,
                "mds": mds,
                "spec_id": spec_id,
                "has_nace": has_nace,
            },
        )
        result = spec_items_service.list_spec_items(
            db,
            page=page,
            page_size=page_size,
            global_search=global_search,
            sort_by=sort_by,
            sort_dir=sort_dir,
            cliente=cliente,
            item_type=item_type,
            short_code=short_code,
            schedule=schedule,
            material_description=material_description,
            mds=mds,
            spec_id=spec_id,
            has_nace=has_nace,
        )
        log_event(
            "SPEC_ITEMS",
            "list_completed",
            page=page,
            page_size=page_size,
            total=result["total"],
            returned=len(result["items"]),
        )
        return result
    except ValueError as exc:
        log_error("SPEC_ITEMS", "list_failed", error=str(exc))
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/export-excel")
def export_excel(payload: ExportExcelRequest, db: Session = Depends(get_db)):
    started = time.time()
    filters = {
        "global_search": payload.global_search,
        **payload.filters,
    }
    columns = payload.columns or []
    log_event(
        "EXPORT_EXCEL",
        "export_started",
        filters=filters,
        columns=columns,
        sort_by=payload.sort_by,
        sort_dir=payload.sort_dir,
    )
    try:
        export_columns, rows = spec_items_service.fetch_items_for_export(
            db,
            columns=payload.columns or None,
            sort_by=payload.sort_by,
            sort_dir=payload.sort_dir,
            **filters,
        )
        log_event(
            "EXPORT_EXCEL",
            "export_query_completed",
            rows_count=len(rows),
        )
        content = excel_service.build_export_workbook(export_columns, rows)
        file_name = "spec_items_export.xlsx"
        duration_ms = int((time.time() - started) * 1000)
        log_event(
            "EXPORT_EXCEL",
            "export_completed",
            rows_count=len(rows),
            columns_count=len(export_columns),
            duration_ms=duration_ms,
            file_name=file_name,
        )
        return StreamingResponse(
            iter([content]),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f'attachment; filename="{file_name}"'},
        )
    except ValueError as exc:
        log_error("EXPORT_EXCEL", "export_failed", error=str(exc), error_type=type(exc).__name__, phase="export_excel")
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        log_error("EXPORT_EXCEL", "export_failed", error=str(exc), error_type=type(exc).__name__, phase="export_excel")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/export-template")
def export_template(db: Session = Depends(get_db)):
    content = excel_service.build_template_workbook(db)
    return StreamingResponse(
        iter([content]),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="spec_items_template.xlsx"'},
    )


@router.get("/{item_id}")
def get_spec_item(item_id: int, db: Session = Depends(get_db)):
    item = spec_items_service.get_spec_item_by_id(db, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item não encontrado")
    return item
