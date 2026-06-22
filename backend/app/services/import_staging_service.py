import json
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.logging import log_event

RUN_SELECT = """
    SELECT id, file_name, sheet_name, status, total_rows, inserted_rows, updated_rows,
           unchanged_rows, ignored_rows, error_rows, created_at, applied_at, error_message,
           phase, progress_current, progress_total, progress_percent, progress_message,
           started_at, finished_at, source_file_path, preview_meta
    FROM app_import_runs
"""


def create_import_run(
    db: Session,
    *,
    file_name: str,
    sheet_name: str | None = None,
    status: str = "PENDING",
    total_rows: int = 0,
    source_file_path: str | None = None,
) -> int:
    query = text(
        """
        INSERT INTO app_import_runs (file_name, sheet_name, status, total_rows, source_file_path, started_at)
        VALUES (:file_name, :sheet_name, :status, :total_rows, :source_file_path, now())
        RETURNING id
        """
    )
    result = db.execute(
        query,
        {
            "file_name": file_name,
            "sheet_name": sheet_name,
            "status": status,
            "total_rows": total_rows,
            "source_file_path": source_file_path,
        },
    ).scalar()
    db.flush()
    return int(result)


def update_import_progress(
    db: Session,
    run_id: int,
    *,
    status: str | None = None,
    phase: str | None = None,
    current: int | None = None,
    total: int | None = None,
    message: str | None = None,
    commit: bool = True,
) -> None:
    sets: list[str] = []
    params: dict[str, Any] = {"id": run_id}

    if status is not None:
        sets.append("status = :status")
        params["status"] = status
    if phase is not None:
        sets.append("phase = :phase")
        params["phase"] = phase
    if current is not None:
        sets.append("progress_current = :progress_current")
        params["progress_current"] = current
    if total is not None:
        sets.append("progress_total = :progress_total")
        params["progress_total"] = total
    if message is not None:
        sets.append("progress_message = :progress_message")
        params["progress_message"] = message

    if current is not None and total is not None and total > 0:
        percent = round((current / total) * 100, 2)
        sets.append("progress_percent = :progress_percent")
        params["progress_percent"] = percent

    if not sets:
        return

    query = text(f"UPDATE app_import_runs SET {', '.join(sets)} WHERE id = :id")
    db.execute(query, params)

    if commit:
        db.commit()

    log_event(
        "EXCEL_IMPORT",
        "progress",
        run_id=run_id,
        status=status,
        phase=phase,
        current=current,
        total=total,
        message=message,
    )


def update_run_status(
    db: Session,
    run_id: int,
    status: str,
    *,
    error_message: str | None = None,
    applied: bool = False,
) -> None:
    applied_clause = ", applied_at = now()" if applied else ""
    query = text(
        f"""
        UPDATE app_import_runs
        SET status = :status,
            error_message = :error_message
            {applied_clause}
        WHERE id = :id
        """
    )
    db.execute(
        query,
        {"id": run_id, "status": status, "error_message": error_message},
    )


def update_run_counts(
    db: Session,
    run_id: int,
    *,
    inserted_rows: int = 0,
    updated_rows: int = 0,
    unchanged_rows: int = 0,
    ignored_rows: int = 0,
    error_rows: int = 0,
    status: str | None = None,
    applied: bool = False,
) -> None:
    sets = [
        "inserted_rows = :inserted_rows",
        "updated_rows = :updated_rows",
        "unchanged_rows = :unchanged_rows",
        "ignored_rows = :ignored_rows",
        "error_rows = :error_rows",
    ]
    if status:
        sets.append("status = :status")
    if applied:
        sets.append("applied_at = now()")

    query = text(
        f"""
        UPDATE app_import_runs
        SET {", ".join(sets)}
        WHERE id = :id
        """
    )
    params = {
        "id": run_id,
        "inserted_rows": inserted_rows,
        "updated_rows": updated_rows,
        "unchanged_rows": unchanged_rows,
        "ignored_rows": ignored_rows,
        "error_rows": error_rows,
        "status": status,
    }
    db.execute(query, params)


def clear_staging_rows(db: Session, run_id: int) -> None:
    db.execute(text("DELETE FROM app_import_rows WHERE import_run_id = :run_id"), {"run_id": run_id})


def save_staging_rows(
    db: Session,
    run_id: int,
    rows: list[dict[str, Any]],
    *,
    commit_batch_size: int = 500,
) -> int:
    if not rows:
        return 0
    query = text(
        """
        INSERT INTO app_import_rows (import_run_id, excel_row_number, raw_json)
        VALUES (:import_run_id, :excel_row_number, CAST(:raw_json AS jsonb))
        """
    )
    saved = 0
    for row in rows:
        db.execute(
            query,
            {
                "import_run_id": run_id,
                "excel_row_number": row["excel_row_number"],
                "raw_json": json.dumps(row["raw_json"], ensure_ascii=False, default=str),
            },
        )
        saved += 1
        if commit_batch_size and saved % commit_batch_size == 0:
            db.commit()
    return saved


def save_column_mappings(
    db: Session,
    run_id: int,
    mappings: list[dict[str, Any]],
) -> None:
    delete_query = text("DELETE FROM app_import_column_mappings WHERE import_run_id = :run_id")
    db.execute(delete_query, {"run_id": run_id})

    insert_query = text(
        """
        INSERT INTO app_import_column_mappings
            (import_run_id, excel_column_name, target_column_name, action, confidence)
        VALUES
            (:import_run_id, :excel_column_name, :target_column_name, :action, :confidence)
        """
    )
    for mapping in mappings:
        db.execute(
            insert_query,
            {
                "import_run_id": run_id,
                "excel_column_name": mapping["excel_column_name"],
                "target_column_name": mapping.get("target_column_name"),
                "action": mapping.get("action", "IGNORE"),
                "confidence": mapping.get("confidence"),
            },
        )


def get_column_mappings(db: Session, run_id: int) -> list[dict[str, Any]]:
    query = text(
        """
        SELECT excel_column_name, target_column_name, action, confidence
        FROM app_import_column_mappings
        WHERE import_run_id = :run_id
        ORDER BY excel_column_name
        """
    )
    rows = db.execute(query, {"run_id": run_id}).mappings().all()
    return [dict(row) for row in rows]


def get_staging_rows(
    db: Session,
    run_id: int,
    *,
    offset: int = 0,
    limit: int | None = None,
) -> list[dict[str, Any]]:
    limit_clause = "LIMIT :limit" if limit is not None else ""
    query = text(
        f"""
        SELECT id, excel_row_number, target_id, row_status, raw_json, error_message
        FROM app_import_rows
        WHERE import_run_id = :run_id
        ORDER BY excel_row_number
        OFFSET :offset
        {limit_clause}
        """
    )
    params: dict[str, Any] = {"run_id": run_id, "offset": offset}
    if limit is not None:
        params["limit"] = limit
    rows = db.execute(query, params).mappings().all()
    return [dict(row) for row in rows]


def count_staging_rows(db: Session, run_id: int) -> int:
    result = db.execute(
        text("SELECT COUNT(*) FROM app_import_rows WHERE import_run_id = :run_id"),
        {"run_id": run_id},
    ).scalar()
    return int(result or 0)


def save_preview_meta(db: Session, run_id: int, meta: dict[str, Any]) -> None:
    db.execute(
        text("UPDATE app_import_runs SET preview_meta = CAST(:meta AS jsonb) WHERE id = :id"),
        {"meta": json.dumps(meta, ensure_ascii=False), "id": run_id},
    )


def clear_preview_artifacts(db: Session, run_id: int) -> None:
    """Remove diffs/errors/warnings anteriores antes de regenerar preview."""
    db.execute(text("DELETE FROM app_import_diffs WHERE import_run_id = :run_id"), {"run_id": run_id})
    db.execute(text("DELETE FROM app_import_errors WHERE import_run_id = :run_id"), {"run_id": run_id})

    db.execute(
        text("UPDATE app_import_runs SET preview_meta = NULL WHERE id = :id"),
        {"id": run_id},
    )

    db.execute(
        text(
            """
            UPDATE app_import_rows
            SET target_id = NULL, row_status = 'PENDING', error_message = NULL
            WHERE import_run_id = :run_id
            """
        ),
        {"run_id": run_id},
    )


def update_staging_row_preview(
    db: Session,
    *,
    row_id: int,
    target_id: int | None,
    row_status: str,
    error_message: str | None = None,
) -> None:
    query = text(
        """
        UPDATE app_import_rows
        SET target_id = :target_id,
            row_status = :row_status,
            error_message = :error_message
        WHERE id = :id
        """
    )
    db.execute(
        query,
        {
            "id": row_id,
            "target_id": target_id,
            "row_status": row_status,
            "error_message": error_message,
        },
    )


def save_diff(
    db: Session,
    *,
    run_id: int,
    import_row_id: int,
    excel_row_number: int,
    target_id: int | None,
    column_name: str,
    old_value: str | None,
    new_value: str | None,
    diff_type: str,
    warning_message: str | None = None,
    raw_value: str | None = None,
    parsed_value: str | None = None,
    coercion_method: str | None = None,
    scale_divisor: Any = None,
) -> None:
    query = text(
        """
        INSERT INTO app_import_diffs
            (import_run_id, import_row_id, excel_row_number, target_id,
             column_name, old_value, new_value, diff_type, warning_message,
             raw_value, parsed_value, coercion_method, scale_divisor)
        VALUES
            (:import_run_id, :import_row_id, :excel_row_number, :target_id,
             :column_name, :old_value, :new_value, :diff_type, :warning_message,
             :raw_value, :parsed_value, :coercion_method, :scale_divisor)
        """
    )
    db.execute(
        query,
        {
            "import_run_id": run_id,
            "import_row_id": import_row_id,
            "excel_row_number": excel_row_number,
            "target_id": target_id,
            "column_name": column_name,
            "old_value": old_value,
            "new_value": new_value,
            "diff_type": diff_type,
            "warning_message": warning_message,
            "raw_value": raw_value,
            "parsed_value": parsed_value,
            "coercion_method": coercion_method,
            "scale_divisor": scale_divisor,
        },
    )


def record_import_error(
    db: Session,
    *,
    import_run_id: int,
    import_row_id: int | None = None,
    excel_row_number: int | None = None,
    column_name: str | None = None,
    value: str | None = None,
    error_message: str,
) -> None:
    query = text(
        """
        INSERT INTO app_import_errors
            (import_run_id, import_row_id, excel_row_number, column_name, value, error_message)
        VALUES
            (:import_run_id, :import_row_id, :excel_row_number, :column_name, :value, :error_message)
        """
    )
    db.execute(
        query,
        {
            "import_run_id": import_run_id,
            "import_row_id": import_row_id,
            "excel_row_number": excel_row_number,
            "column_name": column_name,
            "value": value,
            "error_message": error_message,
        },
    )


def record_apply_log(
    db: Session,
    *,
    import_run_id: int,
    action_type: str,
    target_id: int | None = None,
    column_name: str | None = None,
    old_value: str | None = None,
    new_value: str | None = None,
) -> None:
    query = text(
        """
        INSERT INTO app_import_apply_log
            (import_run_id, action_type, target_id, column_name, old_value, new_value)
        VALUES
            (:import_run_id, :action_type, :target_id, :column_name, :old_value, :new_value)
        """
    )
    db.execute(
        query,
        {
            "import_run_id": import_run_id,
            "action_type": action_type,
            "target_id": target_id,
            "column_name": column_name,
            "old_value": old_value,
            "new_value": new_value,
        },
    )


def get_import_run(db: Session, run_id: int) -> dict[str, Any] | None:
    query = text(f"{RUN_SELECT} WHERE id = :id")
    row = db.execute(query, {"id": run_id}).mappings().first()
    return dict(row) if row else None


def get_run_status(db: Session, run_id: int) -> dict[str, Any] | None:
    run = get_import_run(db, run_id)
    if not run:
        return None

    summary = None
    if run["status"] in {"PREVIEW_READY", "APPLIED", "FAILED"}:
        mappings = get_column_mappings(db, run_id)
        mapped_count = sum(1 for m in mappings if m["action"] == "MAP_TO_EXISTING")
        ignored_count = sum(1 for m in mappings if m["action"] == "IGNORE")
        summary = {
            "total_rows": run["total_rows"],
            "valid_rows": (run["inserted_rows"] or 0) + (run["updated_rows"] or 0) + (run["unchanged_rows"] or 0),
            "row_error_rows": run["error_rows"],
            "insert_rows": run["inserted_rows"],
            "update_rows": run["updated_rows"],
            "unchanged_rows": run["unchanged_rows"],
            "ignored_rows": run["ignored_rows"],
            "error_rows": run["error_rows"],
            "mapped_count": mapped_count,
            "ignored_count": ignored_count,
            "can_apply_valid_rows": count_applyable_rows(db, run_id) > 0,
        }

    unknown_columns = [
        m["excel_column_name"]
        for m in get_column_mappings(db, run_id)
        if m.get("action") == "IGNORE" or (m.get("confidence") or 0) < 1.0
    ]

    terminal_error = run["status"] in {"FAILED", "CORRUPTED_STAGING", "CANCELLED"}

    return {
        "ok": not terminal_error,
        "run_id": run_id,
        "status": run["status"],
        "phase": run.get("phase"),
        "progress_current": run.get("progress_current") or 0,
        "progress_total": run.get("progress_total") or 0,
        "progress_percent": float(run.get("progress_percent") or 0),
        "message": run.get("progress_message"),
        "file_name": run.get("file_name"),
        "sheet_name": run.get("sheet_name"),
        "unknown_columns": unknown_columns,
        "summary": summary,
        "error_message": run.get("error_message"),
    }


def get_preview_diffs_paginated(
    db: Session,
    run_id: int,
    *,
    page: int = 1,
    page_size: int = 100,
) -> dict[str, Any]:
    offset = (page - 1) * page_size
    total = db.execute(
        text(
            """
            SELECT COUNT(*) FROM app_import_diffs
            WHERE import_run_id = :run_id AND diff_type != 'WARNING'
            """
        ),
        {"run_id": run_id},
    ).scalar() or 0
    rows = db.execute(
        text(
            """
            SELECT excel_row_number, target_id, column_name, old_value, new_value, diff_type,
                   raw_value, parsed_value
            FROM app_import_diffs
            WHERE import_run_id = :run_id AND diff_type != 'WARNING'
            ORDER BY excel_row_number, id
            OFFSET :offset LIMIT :limit
            """
        ),
        {"run_id": run_id, "offset": offset, "limit": page_size},
    ).mappings().all()
    return {"page": page, "page_size": page_size, "total": int(total), "items": [dict(r) for r in rows]}


def count_applyable_rows(db: Session, run_id: int) -> int:
    query = text(
        """
        SELECT COUNT(*)
        FROM app_import_rows
        WHERE import_run_id = :run_id
          AND row_status IN ('INSERT', 'UPDATE', 'UNCHANGED')
        """
    )
    return int(db.execute(query, {"run_id": run_id}).scalar() or 0)


def count_row_error_rows(db: Session, run_id: int) -> int:
    query = text(
        """
        SELECT COUNT(*)
        FROM app_import_rows
        WHERE import_run_id = :run_id
          AND row_status IN ('ROW_ERROR', 'ERROR')
        """
    )
    return int(db.execute(query, {"run_id": run_id}).scalar() or 0)


def export_import_errors_csv(db: Session, run_id: int) -> str:
    rows = db.execute(
        text(
            """
            SELECT excel_row_number, column_name, value, error_message
            FROM app_import_errors
            WHERE import_run_id = :run_id
            ORDER BY excel_row_number, id
            """
        ),
        {"run_id": run_id},
    ).mappings().all()

    lines = ["excel_row_number,column_name,value,error_message"]
    for row in rows:
        values = [
            str(row.get("excel_row_number") or ""),
            _csv_escape(row.get("column_name")),
            _csv_escape(row.get("value")),
            _csv_escape(row.get("error_message")),
        ]
        lines.append(",".join(values))
    return "\n".join(lines) + "\n"


def _csv_escape(value: Any) -> str:
    text_value = "" if value is None else str(value)
    if any(ch in text_value for ch in [",", '"', "\n", "\r"]):
        return '"' + text_value.replace('"', '""') + '"'
    return text_value


def get_preview_errors_paginated(
    db: Session,
    run_id: int,
    *,
    page: int = 1,
    page_size: int = 100,
) -> dict[str, Any]:
    offset = (page - 1) * page_size
    total = db.execute(
        text("SELECT COUNT(*) FROM app_import_errors WHERE import_run_id = :run_id"),
        {"run_id": run_id},
    ).scalar() or 0
    rows = db.execute(
        text(
            """
            SELECT excel_row_number, column_name, value, error_message
            FROM app_import_errors
            WHERE import_run_id = :run_id
            ORDER BY excel_row_number, id
            OFFSET :offset LIMIT :limit
            """
        ),
        {"run_id": run_id, "offset": offset, "limit": page_size},
    ).mappings().all()
    return {"page": page, "page_size": page_size, "total": int(total), "items": [dict(r) for r in rows]}


def get_preview_warnings_paginated(
    db: Session,
    run_id: int,
    *,
    page: int = 1,
    page_size: int = 100,
) -> dict[str, Any]:
    offset = (page - 1) * page_size
    total = db.execute(
        text(
            """
            SELECT COUNT(*) FROM app_import_diffs
            WHERE import_run_id = :run_id AND warning_message IS NOT NULL
            """
        ),
        {"run_id": run_id},
    ).scalar() or 0
    rows = db.execute(
        text(
            """
            SELECT excel_row_number, column_name, raw_value, parsed_value,
                   coercion_method, scale_divisor, warning_message
            FROM app_import_diffs
            WHERE import_run_id = :run_id
              AND warning_message IS NOT NULL
            ORDER BY excel_row_number, column_name, id
            OFFSET :offset LIMIT :limit
            """
        ),
        {"run_id": run_id, "offset": offset, "limit": page_size},
    ).mappings().all()
    items = [
        {
            "excel_row_number": row["excel_row_number"],
            "column_name": row["column_name"],
            "raw_value": row.get("raw_value"),
            "parsed_value": row.get("parsed_value"),
            "coercion_method": row.get("coercion_method"),
            "scale_divisor": str(row["scale_divisor"]) if row.get("scale_divisor") is not None else None,
            "warning_message": row["warning_message"],
        }
        for row in rows
    ]
    return {"page": page, "page_size": page_size, "total": int(total), "items": items}


def get_preview_diffs(db: Session, run_id: int, limit: int = 100) -> list[dict[str, Any]]:
    query = text(
        """
        SELECT excel_row_number, target_id, column_name, old_value, new_value, diff_type,
               warning_message, raw_value, parsed_value
        FROM app_import_diffs
        WHERE import_run_id = :run_id
        ORDER BY excel_row_number, id
        LIMIT :limit
        """
    )
    rows = db.execute(query, {"run_id": run_id, "limit": limit}).mappings().all()
    return [dict(row) for row in rows]


def get_preview_errors(db: Session, run_id: int) -> list[dict[str, Any]]:
    query = text(
        """
        SELECT excel_row_number, column_name, value, error_message
        FROM app_import_errors
        WHERE import_run_id = :run_id
        ORDER BY excel_row_number, id
        """
    )
    rows = db.execute(query, {"run_id": run_id}).mappings().all()
    return [dict(row) for row in rows]


def count_warning_rows(db: Session, run_id: int) -> int:
    result = db.execute(
        text(
            """
            SELECT COUNT(DISTINCT excel_row_number)
            FROM app_import_diffs
            WHERE import_run_id = :run_id AND warning_message IS NOT NULL
            """
        ),
        {"run_id": run_id},
    ).scalar()
    return int(result or 0)


def get_preview_warnings(db: Session, run_id: int, limit: int = 100) -> list[dict[str, Any]]:
    query = text(
        """
        SELECT excel_row_number, column_name, raw_value, parsed_value,
               coercion_method, scale_divisor, warning_message
        FROM app_import_diffs
        WHERE import_run_id = :run_id AND warning_message IS NOT NULL
        ORDER BY excel_row_number, column_name, id
        LIMIT :limit
        """
    )
    rows = db.execute(query, {"run_id": run_id, "limit": limit}).mappings().all()
    return [
        {
            "excel_row_number": row["excel_row_number"],
            "column_name": row["column_name"],
            "raw_value": row.get("raw_value"),
            "parsed_value": row.get("parsed_value"),
            "coercion_method": row.get("coercion_method"),
            "scale_divisor": str(row["scale_divisor"]) if row.get("scale_divisor") is not None else None,
            "warning_message": row["warning_message"],
        }
        for row in rows
    ]


def list_import_runs(db: Session) -> list[dict[str, Any]]:
    query = text(f"{RUN_SELECT} ORDER BY created_at DESC")
    rows = db.execute(query).mappings().all()
    return [dict(row) for row in rows]


def get_column_samples(db: Session, run_id: int, excel_column: str, limit: int = 5) -> list[str]:
    query = text(
        """
        SELECT raw_json
        FROM app_import_rows
        WHERE import_run_id = :run_id
        ORDER BY excel_row_number
        LIMIT 200
        """
    )
    rows = db.execute(query, {"run_id": run_id}).mappings().all()
    samples: list[str] = []
    for row in rows:
        raw = row["raw_json"]
        if isinstance(raw, str):
            raw = json.loads(raw)
        value = raw.get(excel_column)
        if value is None or str(value).strip() == "":
            continue
        text_value = str(value)
        if text_value not in samples:
            samples.append(text_value)
        if len(samples) >= limit:
            break
    return samples
