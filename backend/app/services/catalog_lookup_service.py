"""Find-or-create em tabelas auxiliares do catálogo normalizado."""

from decimal import Decimal
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.db_schema import get_db_schema_config, qualified
from app.services.catalog_identity import normalize_decimal, normalize_text
from app.utils.sql_utils import quote_identifier


class CatalogLookupError(ValueError):
    pass


def _insert_returning_id(
    db: Session,
    *,
    table: str,
    id_column: str,
    columns: dict[str, Any],
) -> int:
    full_table = qualified(table)
    qid = quote_identifier(id_column)
    col_names = ", ".join(quote_identifier(col) for col in columns)
    col_params = ", ".join(f":{col}" for col in columns)
    dialect = get_db_schema_config()["dialect"]

    if dialect == "mssql":
        query = text(
            f"""
            INSERT INTO {full_table} ({col_names})
            OUTPUT INSERTED.{qid} AS id
            VALUES ({col_params})
            """
        )
    else:
        query = text(
            f"""
            INSERT INTO {full_table} ({col_names})
            VALUES ({col_params})
            RETURNING {qid} AS id
            """
        )

    row = db.execute(query, columns).mappings().first()
    if not row:
        raise CatalogLookupError(f"Falha ao criar registro em {table}")
    return int(row["id"])


def _find_or_create_text_lookup(
    db: Session,
    *,
    table: str,
    id_column: str,
    value_column: str,
    value: Any,
    required: bool = False,
) -> int | None:
    normalized = normalize_text(value)
    if normalized is None:
        if required:
            raise CatalogLookupError(f"Valor obrigatório ausente para {table}.{value_column}")
        return None

    full_table = qualified(table)
    qid = quote_identifier(id_column)
    qval = quote_identifier(value_column)

    existing = db.execute(
        text(
            f"""
            SELECT {qid} AS id
            FROM {full_table}
            WHERE UPPER(LTRIM(RTRIM({qval}))) = :normalized
            """
        ),
        {"normalized": normalized},
    ).mappings().first()

    if existing:
        return int(existing["id"])

    return _insert_returning_id(
        db,
        table=table,
        id_column=id_column,
        columns={value_column: str(value).strip()},
    )


def find_or_create_item_type_id(db: Session, value: Any) -> int | None:
    return _find_or_create_text_lookup(
        db,
        table="catalog_item_types",
        id_column="item_type_id",
        value_column="item_type_code",
        value=value,
        required=True,
    )


def find_or_create_schedule_id(db: Session, value: Any) -> int | None:
    return _find_or_create_text_lookup(
        db,
        table="catalog_schedules",
        id_column="schedule_id",
        value_column="schedule_code",
        value=value,
    )


def find_or_create_material_id(db: Session, value: Any) -> int | None:
    return _find_or_create_text_lookup(
        db,
        table="catalog_materials",
        id_column="material_id",
        value_column="material_description",
        value=value,
    )


def find_or_create_end_connection_id(db: Session, value: Any) -> int | None:
    return _find_or_create_text_lookup(
        db,
        table="catalog_end_connections",
        id_column="end_connection_id",
        value_column="connection_code",
        value=value,
    )


def find_or_create_rating_id(db: Session, value: Any) -> int | None:
    return _find_or_create_text_lookup(
        db,
        table="catalog_ratings",
        id_column="rating_id",
        value_column="rating_code",
        value=value,
    )


def find_or_create_mds_id(db: Session, value: Any) -> int | None:
    return _find_or_create_text_lookup(
        db,
        table="catalog_mds_codes",
        id_column="mds_id",
        value_column="mds_code",
        value=value,
    )


def find_or_create_seam_type_id(db: Session, value: Any) -> int | None:
    return _find_or_create_text_lookup(
        db,
        table="catalog_seam_types",
        id_column="seam_type_id",
        value_column="seam_type_code",
        value=value,
    )


def find_or_create_geometric_standard_id(db: Session, value: Any) -> int | None:
    return _find_or_create_text_lookup(
        db,
        table="catalog_geometric_standards",
        id_column="geometric_standard_id",
        value_column="geometric_standard_code",
        value=value,
    )


def find_or_create_client_id(db: Session, value: Any) -> int | None:
    return _find_or_create_text_lookup(
        db,
        table="catalog_clients",
        id_column="client_id",
        value_column="client_code",
        value=value,
    )


def find_or_create_nps_id(db: Session, value: Any) -> int | None:
    normalized = normalize_decimal(value)
    if normalized is None:
        return None

    full_table = qualified("catalog_nps_sizes")
    qid = quote_identifier("nps_id")
    qnps = quote_identifier("nps_inches")

    existing = db.execute(
        text(
            f"""
            SELECT {qid} AS id
            FROM {full_table}
            WHERE {qnps} = :nps
            """
        ),
        {"nps": Decimal(normalized)},
    ).mappings().first()
    if existing:
        return int(existing["id"])

    return _insert_returning_id(
        db,
        table="catalog_nps_sizes",
        id_column="nps_id",
        columns={"nps_inches": Decimal(normalized)},
    )


def resolve_catalog_dimension_ids(db: Session, payload: dict[str, Any]) -> dict[str, int | None]:
    return {
        "item_type_id": find_or_create_item_type_id(db, payload.get("item_type")),
        "nps_id": find_or_create_nps_id(db, payload.get("nps")),
        "schedule_id": find_or_create_schedule_id(db, payload.get("schedule")),
        "material_id": find_or_create_material_id(db, payload.get("material_description")),
        "end_conn_1_id": find_or_create_end_connection_id(db, payload.get("end_conn_1")),
        "end_conn_2_id": find_or_create_end_connection_id(db, payload.get("end_conn_2")),
        "mds_id": find_or_create_mds_id(db, payload.get("mds")),
        "rating_id": find_or_create_rating_id(db, payload.get("rating")),
        "seam_type_id": find_or_create_seam_type_id(db, payload.get("pipe_seam_type")),
        "geometric_standard_id": find_or_create_geometric_standard_id(db, payload.get("geometric_standard")),
        "client_id": find_or_create_client_id(db, payload.get("cliente")),
    }
