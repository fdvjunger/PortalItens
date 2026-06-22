class ImportGuardError(ValueError):
    """Bloqueio de preview/apply por staging contaminado ou erros no preview."""

    def __init__(self, detail: dict):
        self.detail = detail
        super().__init__(detail.get("message", "Importação bloqueada"))


def validate_preview_ready_for_apply(
    db,
    run_id: int,
    *,
    mode: str = "valid_rows_only",
) -> dict:
    from sqlalchemy import text

    from app.services import import_staging_service as staging

    run = staging.get_import_run(db, run_id)
    if not run:
        raise ValueError(f"Run {run_id} não encontrado.")

    if run["status"] == "APPLIED":
        raise ValueError("Importação já aplicada.")

    if run["status"] not in {"PREVIEW_READY", "APPLYING"}:
        raise ValueError(
            f"Run {run_id} não está pronto para apply. Status atual: {run['status']}."
        )

    diff_count = db.execute(
        text(
            """
            SELECT COUNT(*)
            FROM app_import_diffs
            WHERE import_run_id = :run_id
            """
        ),
        {"run_id": run_id},
    ).scalar() or 0

    if diff_count <= 0:
        raise ValueError("Gere o preview antes de aplicar. Nenhum diff encontrado.")

    fatal_error_count = db.execute(
        text(
            """
            SELECT COUNT(*)
            FROM app_import_errors
            WHERE import_run_id = :run_id
              AND COALESCE(error_message, '') NOT ILIKE '%linha será ignorada%'
            """
        ),
        {"run_id": run_id},
    ).scalar() or 0

    if fatal_error_count > 0:
        raise ValueError(
            f"Existem {fatal_error_count} erros fatais. Corrija antes de aplicar."
        )

    valid_row_count = staging.count_applyable_rows(db, run_id)
    if valid_row_count <= 0:
        raise ValueError("Nenhuma linha válida para aplicar.")

    if mode == "all_or_nothing" and (run.get("error_rows") or 0) > 0:
        raise ImportGuardError(preview_errors_detail(run["error_rows"]))

    return {
        "run": run,
        "diff_count": int(diff_count),
        "valid_row_count": valid_row_count,
        "fatal_error_count": int(fatal_error_count),
    }


def restore_preview_ready_after_apply_failure(db, run_id: int) -> dict:
    from sqlalchemy import text

    from app.services import import_staging_service as staging

    run = staging.get_import_run(db, run_id)
    if not run:
        raise ValueError(f"Run {run_id} não encontrado.")

    if run["status"] != "FAILED":
        raise ValueError(
            f"Run {run_id} não pode ser restaurado. Status atual: {run['status']}."
        )

    error_message = run.get("error_message") or ""
    if "Gere o preview antes de aplicar" not in error_message:
        raise ValueError(
            "Run só pode ser restaurado quando falhou por validação incorreta de preview no apply."
        )

    diff_count = db.execute(
        text(
            """
            SELECT COUNT(*)
            FROM app_import_diffs
            WHERE import_run_id = :run_id
            """
        ),
        {"run_id": run_id},
    ).scalar() or 0
    if diff_count <= 0:
        raise ValueError("Não é possível restaurar: nenhum diff de preview encontrado.")

    db.execute(
        text(
            """
            UPDATE app_import_runs
            SET
                status = 'PREVIEW_READY',
                phase = 'completed',
                progress_current = progress_total,
                progress_percent = 100,
                progress_message = 'Preview pronto para revisão.',
                error_message = NULL,
                finished_at = NULL
            WHERE id = :run_id
              AND status = 'FAILED'
              AND error_message ILIKE '%Gere o preview antes de aplicar%'
            """
        ),
        {"run_id": run_id},
    )
    db.commit()

    return {
        "ok": True,
        "run_id": run_id,
        "status": "PREVIEW_READY",
        "message": "Run restaurado para PREVIEW_READY.",
        "diff_count": int(diff_count),
    }


def corrupted_staging_detail(corruption: dict) -> dict:
    return {
        "ok": False,
        "status": "CORRUPTED_STAGING",
        "message": (
            "Foram detectados valores numéricos incompatíveis no staging. "
            "Use o diagnóstico para confirmar se o arquivo Excel já veio corrompido "
            "ou se houve erro durante o staging."
        ),
        "hint": "Use o botão Diagnosticar valores do Excel antes de reanalisar ou reenviar o arquivo.",
        "corruption": corruption,
    }


def no_valid_rows_detail() -> dict:
    return {
        "ok": False,
        "status": "NO_VALID_ROWS",
        "message": "Nenhuma linha válida para aplicar.",
        "fatal_errors": 1,
    }


def preview_errors_detail(error_rows: int) -> dict:
    return {
        "ok": False,
        "status": "PREVIEW_HAS_ERRORS",
        "message": "Existem erros no preview. Corrija antes de aplicar.",
        "error_rows": error_rows,
    }
