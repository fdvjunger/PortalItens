from concurrent.futures import ThreadPoolExecutor

from sqlalchemy import text

from app.core.database import SessionLocal
from app.core.logging import log_error, log_event

executor = ThreadPoolExecutor(max_workers=2)


def mark_import_run_failed(run_id: int, error: Exception) -> None:
    message = f"{type(error).__name__}: {error}"
    db = SessionLocal()
    try:
        db.execute(
            text(
                """
                UPDATE app_import_runs
                SET
                    status = 'FAILED',
                    phase = 'failed',
                    progress_message = :message,
                    error_message = :message,
                    finished_at = now()
                WHERE id = :run_id
                  AND status NOT IN ('APPLIED', 'CANCELLED')
                """
            ),
            {"run_id": run_id, "message": message},
        )
        db.commit()
    except Exception as exc:
        db.rollback()
        log_error(
            "JOB",
            "mark_import_run_failed_error",
            run_id=run_id,
            error=str(exc),
            error_type=type(exc).__name__,
        )
    finally:
        db.close()


def submit_job(name: str, fn, *args, **kwargs):
    log_event("JOB", "job_submitted", name=name)
    future = executor.submit(fn, *args, **kwargs)

    def _done_callback(f):
        try:
            f.result()
            log_event("JOB", "job_completed", name=name)
        except Exception as exc:
            log_error(
                "JOB",
                "job_failed",
                name=name,
                error=str(exc),
                error_type=type(exc).__name__,
            )

    future.add_done_callback(_done_callback)
    return future


def submit_import_job(name: str, run_id: int, fn, *args, **kwargs):
    log_event("JOB", "job_submitted", name=name, run_id=run_id)
    future = executor.submit(fn, *args, **kwargs)

    def _done_callback(f):
        try:
            f.result()
            log_event("JOB", "job_completed", name=name, run_id=run_id)
        except Exception as exc:
            log_error(
                "JOB",
                "job_failed",
                name=name,
                run_id=run_id,
                error=str(exc),
                error_type=type(exc).__name__,
            )
            mark_import_run_failed(run_id, exc)

    future.add_done_callback(_done_callback)
    return future
