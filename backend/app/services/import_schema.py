from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.logging import log_error

IMPORT_DIFF_COERCION_MIGRATION = "database/003_add_import_diff_coercion_columns.sql"

REQUIRED_IMPORT_COLUMNS: dict[str, list[str]] = {
    "app_import_diffs": [
        "raw_value",
        "parsed_value",
        "coercion_method",
        "scale_divisor",
        "repair_applied",
        "repair_divisor",
    ],
}


class ImportSchemaError(Exception):
    def __init__(self, detail: dict[str, Any]):
        self.detail = detail
        super().__init__(detail.get("message", "Schema de importação incompleto."))


def get_missing_import_columns(db: Session) -> list[str]:
    tables = list(REQUIRED_IMPORT_COLUMNS.keys())
    query = text(
        """
        SELECT table_name, column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = ANY(:tables)
        """
    )
    rows = db.execute(query, {"tables": tables}).mappings().all()
    existing = {(row["table_name"], row["column_name"]) for row in rows}

    missing: list[str] = []
    for table_name, columns in REQUIRED_IMPORT_COLUMNS.items():
        for column_name in columns:
            if (table_name, column_name) not in existing:
                missing.append(f"{table_name}.{column_name}")
    return missing


def ensure_import_schema(db: Session) -> list[str]:
    missing = get_missing_import_columns(db)
    for qualified_name in missing:
        table_name, column_name = qualified_name.split(".", 1)
        message = (
            f"Schema incompleto: {qualified_name} não existe. "
            f"Execute {IMPORT_DIFF_COERCION_MIGRATION}."
        )
        log_error(
            "SCHEMA",
            "import_schema_incomplete",
            table=table_name,
            column=column_name,
            message=message,
        )
    return missing


def validate_import_schema(db: Session) -> dict[str, Any] | None:
    missing = get_missing_import_columns(db)
    if not missing:
        return None

    ensure_import_schema(db)
    return {
        "ok": False,
        "status": "SCHEMA_INCOMPLETE",
        "message": (
            "Schema de importação incompleto. "
            f"Execute a migration {IMPORT_DIFF_COERCION_MIGRATION}."
        ),
        "missing_columns": missing,
    }


def ensure_import_schema_or_raise(db: Session) -> None:
    """Alias explícito para validação antes de analyze/preview."""
    require_import_schema(db)


def require_import_schema(db: Session) -> None:
    detail = validate_import_schema(db)
    if detail:
        raise ImportSchemaError(detail)
