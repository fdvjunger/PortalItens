import time

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import get_settings
from app.core.database import SessionLocal
from app.core.logging import log_error, log_event, new_request_id, setup_logging
from app.routers import health, import_excel, spec_items

setup_logging()

settings = get_settings()

app = FastAPI(title="Itens Portal", version="0.1.0")


@app.on_event("startup")
def validate_import_schema_on_startup() -> None:
    from app.services.import_schema import ensure_import_schema

    db = SessionLocal()
    try:
        missing = ensure_import_schema(db)
        if missing:
            log_error(
                "SCHEMA",
                "import_schema_startup_check_failed",
                missing_columns=missing,
                message=(
                    "Schema de importação incompleto no startup. "
                    "Execute database/003_add_import_diff_coercion_columns.sql."
                ),
            )
    finally:
        db.close()


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def request_logging_middleware(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID") or new_request_id()
    start = time.perf_counter()

    log_event(
        "HTTP",
        "request_started",
        request_id=request_id,
        method=request.method,
        path=request.url.path,
        query=str(request.url.query),
    )

    try:
        response = await call_next(request)
        duration_ms = round((time.perf_counter() - start) * 1000, 2)

        response.headers["X-Request-ID"] = request_id

        log_event(
            "HTTP",
            "request_completed",
            request_id=request_id,
            method=request.method,
            path=request.url.path,
            status_code=response.status_code,
            duration_ms=duration_ms,
        )

        return response

    except Exception as exc:
        duration_ms = round((time.perf_counter() - start) * 1000, 2)

        log_error(
            "HTTP",
            "request_failed",
            request_id=request_id,
            method=request.method,
            path=request.url.path,
            duration_ms=duration_ms,
            error=str(exc),
            error_type=type(exc).__name__,
        )

        return JSONResponse(
            status_code=500,
            content={
                "detail": {
                    "message": "Erro interno do servidor.",
                    "request_id": request_id,
                    "error": str(exc),
                    "error_type": type(exc).__name__,
                }
            },
            headers={"X-Request-ID": request_id},
        )


app.include_router(health.router)
app.include_router(spec_items.router)
app.include_router(import_excel.router)
app.include_router(import_excel.legacy_router)
