from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.utils.sql_utils import quote_pg_identifier

GLOBAL_SEARCH_COLUMNS = [
    "cliente",
    "item_type",
    "short_code",
    "schedule",
    "geometric_standard",
    "end_conn_1",
    "end_conn_2",
    "material_description",
    "mds",
    "rating",
    "notes",
    "nps_polegadas",
    "item_key",
    "alterDataID",
]

FILTERABLE_COLUMNS = [
    "cliente",
    "item_type",
    "short_code",
    "schedule",
    "material_description",
    "mds",
    "spec_id",
    "has_nace",
]


def get_column_metadata(db: Session) -> list[dict[str, Any]]:
    query = text(
        """
        SELECT column_name, data_type, is_nullable, ordinal_position,
               numeric_precision, numeric_scale
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'spec_items'
        ORDER BY ordinal_position
        """
    )
    rows = db.execute(query).mappings().all()
    return [
        {
            "column_name": row["column_name"],
            "data_type": row["data_type"],
            "is_nullable": row["is_nullable"] == "YES",
            "ordinal_position": row["ordinal_position"],
            "numeric_precision": row.get("numeric_precision"),
            "numeric_scale": row.get("numeric_scale"),
        }
        for row in rows
    ]


def get_valid_column_names(db: Session) -> list[str]:
    return [col["column_name"] for col in get_column_metadata(db)]


def validate_sort_column(sort_by: str | None, valid_columns: list[str]) -> str:
    if not sort_by:
        return "id"
    if sort_by not in valid_columns:
        raise ValueError(f"Coluna de ordenação inválida: {sort_by}")
    return sort_by


def _build_filters(
    params: dict[str, Any],
    valid_columns: list[str],
) -> tuple[str, dict[str, Any]]:
    conditions: list[str] = []
    bind: dict[str, Any] = {}

    global_search = params.get("global_search")
    if global_search:
        search_clauses = []
        for idx, column in enumerate(GLOBAL_SEARCH_COLUMNS):
            if column not in valid_columns:
                continue
            param_name = f"gs_{idx}"
            search_clauses.append(f"{quote_pg_identifier(column)} ILIKE :{param_name}")
            bind[param_name] = f"%{global_search}%"
        if search_clauses:
            conditions.append("(" + " OR ".join(search_clauses) + ")")

    for column in FILTERABLE_COLUMNS:
        value = params.get(column)
        if value is None or value == "":
            continue
        if column not in valid_columns:
            continue

        if column == "has_nace":
            if str(value).lower() in {"true", "1", "yes"}:
                conditions.append(f"{quote_pg_identifier(column)} IS TRUE")
            elif str(value).lower() in {"false", "0", "no"}:
                conditions.append(f"{quote_pg_identifier(column)} IS FALSE")
            continue

        if column == "spec_id":
            conditions.append(f"{quote_pg_identifier(column)} = :filter_{column}")
            bind[f"filter_{column}"] = int(value)
            continue

        conditions.append(f"{quote_pg_identifier(column)} ILIKE :filter_{column}")
        bind[f"filter_{column}"] = f"%{value}%"

    where_clause = ""
    if conditions:
        where_clause = "WHERE " + " AND ".join(conditions)

    return where_clause, bind


def list_spec_items(
    db: Session,
    *,
    page: int = 1,
    page_size: int = 50,
    sort_by: str | None = "id",
    sort_dir: str = "asc",
    **filters: Any,
) -> dict[str, Any]:
    valid_columns = get_valid_column_names(db)
    sort_column = validate_sort_column(sort_by, valid_columns)
    direction = "DESC" if sort_dir.lower() == "desc" else "ASC"

    where_clause, bind = _build_filters(filters, valid_columns)

    count_query = text(f"SELECT COUNT(*) AS total FROM spec_items {where_clause}")
    total = db.execute(count_query, bind).scalar() or 0

    offset = (page - 1) * page_size
    bind_with_pagination = {**bind, "limit": page_size, "offset": offset}

    data_query = text(
        f"""
        SELECT *
        FROM spec_items
        {where_clause}
        ORDER BY {quote_pg_identifier(sort_column)} {direction}
        LIMIT :limit OFFSET :offset
        """
    )
    rows = db.execute(data_query, bind_with_pagination).mappings().all()
    items = [dict(row) for row in rows]

    return {
        "page": page,
        "page_size": page_size,
        "total": total,
        "items": items,
    }


def get_spec_item_by_id(db: Session, item_id: int) -> dict[str, Any] | None:
    query = text("SELECT * FROM spec_items WHERE id = :id")
    row = db.execute(query, {"id": item_id}).mappings().first()
    return dict(row) if row else None


def fetch_items_for_export(
    db: Session,
    *,
    columns: list[str] | None = None,
    sort_by: str | None = "id",
    sort_dir: str = "asc",
    **filters: Any,
) -> tuple[list[str], list[dict[str, Any]]]:
    valid_columns = get_valid_column_names(db)
    export_columns = columns if columns else valid_columns
    export_columns = [col for col in export_columns if col in valid_columns]

    if not export_columns:
        export_columns = valid_columns

    sort_column = validate_sort_column(sort_by, valid_columns)
    direction = "DESC" if sort_dir.lower() == "desc" else "ASC"
    where_clause, bind = _build_filters(filters, valid_columns)

    select_list = ", ".join(quote_pg_identifier(col) for col in export_columns)
    data_query = text(
        f"""
        SELECT {select_list}
        FROM spec_items
        {where_clause}
        ORDER BY {quote_pg_identifier(sort_column)} {direction}
        """
    )
    rows = db.execute(data_query, bind).mappings().all()
    return export_columns, [dict(row) for row in rows]


def get_dashboard_stats(db: Session) -> dict[str, Any]:
    total = db.execute(text("SELECT COUNT(*) FROM spec_items")).scalar() or 0

    by_client = db.execute(
        text(
            """
            SELECT COALESCE(cliente, '(sem cliente)') AS cliente, COUNT(*) AS total
            FROM spec_items
            GROUP BY cliente
            ORDER BY total DESC, cliente
            """
        )
    ).mappings().all()

    total_pipe = db.execute(
        text("SELECT COUNT(*) FROM spec_items WHERE item_type ILIKE '%PIPE%'")
    ).scalar() or 0

    total_flange = db.execute(
        text("SELECT COUNT(*) FROM spec_items WHERE item_type ILIKE '%FLANGE%'")
    ).scalar() or 0

    with_alterdata = db.execute(
        text('SELECT COUNT(*) FROM spec_items WHERE "alterDataID" IS NOT NULL AND TRIM("alterDataID") <> \'\'')
    ).scalar() or 0

    without_alterdata = db.execute(
        text('SELECT COUNT(*) FROM spec_items WHERE "alterDataID" IS NULL OR TRIM("alterDataID") = \'\'')
    ).scalar() or 0

    return {
        "total_items": total,
        "by_client": [dict(row) for row in by_client],
        "total_pipe": total_pipe,
        "total_flange": total_flange,
        "with_alterdata_id": with_alterdata,
        "without_alterdata_id": without_alterdata,
    }


def get_existing_ids(db: Session, ids: list[int]) -> set[int]:
    if not ids:
        return set()
    query = text("SELECT id FROM spec_items WHERE id = ANY(:ids)")
    rows = db.execute(query, {"ids": ids}).scalars().all()
    return set(rows)


def get_next_id(db: Session) -> int:
    db.execute(text("LOCK TABLE spec_items IN EXCLUSIVE MODE"))
    result = db.execute(text("SELECT COALESCE(MAX(id), 0) + 1 FROM spec_items")).scalar()
    return int(result)


def upsert_spec_item(db: Session, item_id: int, data: dict[str, Any], is_update: bool) -> None:
    if is_update:
        set_parts = []
        bind: dict[str, Any] = {"id": item_id}
        for key, value in data.items():
            if key == "id":
                continue
            set_parts.append(f"{quote_pg_identifier(key)} = :{key}")
            bind[key] = value
        if not set_parts:
            return
        query = text(f"UPDATE spec_items SET {', '.join(set_parts)} WHERE id = :id")
        db.execute(query, bind)
    else:
        columns = ["id"] + list(data.keys())
        values = [":id"] + [f":{col}" for col in data.keys()]
        bind = {"id": item_id, **data}
        col_list = ", ".join(quote_pg_identifier(col) for col in columns)
        val_list = ", ".join(values)
        query = text(f"INSERT INTO spec_items ({col_list}) VALUES ({val_list})")
        db.execute(query, bind)
