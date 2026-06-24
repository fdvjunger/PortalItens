from typing import Any

from sqlalchemy import bindparam, text
from sqlalchemy.orm import Session

from app.core.db_schema import get_db_schema_config, read_source_sql
from app.services.dashboard_productivity import (
    EXCLUDED_ITEM_TYPE_MARKERS,
    PRODUCTIVE_DASHBOARD_NOTE,
    and_condition,
    append_productive_exclusion,
    parse_include_external_items,
)
from app.services.catalog_item_upsert_service import (
    CatalogUpsertError,
    deactivate_spec_occurrence,
    upsert_spec_item_from_flat_payload,
)
from app.utils.sql_utils import (
    bool_false_sql,
    bool_true_sql,
    information_schema_table_filter,
    like_operator,
    quote_identifier,
    read_object_name_for_metadata,
)

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
    "rating",
]

QUALITY_FILTER_FIELDS = (
    "has_weight",
    "has_alterdata",
    "has_paint_area",
    "has_material",
)


def _read_from() -> str:
    return read_source_sql()


def _use_catalog_writes() -> bool:
    return bool(get_db_schema_config()["use_catalog_writes"])


def get_column_metadata(db: Session) -> list[dict[str, Any]]:
    schema_filter, schema_value = information_schema_table_filter()
    object_name = read_object_name_for_metadata()
    query = text(
        f"""
        SELECT column_name, data_type, is_nullable, ordinal_position,
               numeric_precision, numeric_scale
        FROM information_schema.columns
        WHERE {schema_filter}
          AND table_name = :table_name
        ORDER BY ordinal_position
        """
    )
    rows = db.execute(query, {"table_schema": schema_value, "table_name": object_name}).mappings().all()
    return [
        {
            "column_name": row["column_name"],
            "data_type": row["data_type"],
            "is_nullable": row["is_nullable"] in {"YES", "yes", True},
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


def _is_blank_sql(column: str) -> str:
    quoted = quote_identifier(column)
    return f"({quoted} IS NULL OR LTRIM(RTRIM(CAST({quoted} AS VARCHAR(1000)))) = '')"


def _quality_filter_sql(field: str, value: str) -> str | None:
    normalized = str(value).lower()
    if normalized not in {"true", "false", "1", "0", "yes", "no"}:
        return None
    positive = normalized in {"true", "1", "yes"}

    if field == "has_weight":
        weight = quote_identifier("weight")
        return f"({weight} IS NOT NULL AND {weight} <> 0)" if positive else f"({weight} IS NULL OR {weight} = 0)"
    if field == "has_alterdata":
        col = quote_identifier("alterDataID")
        blank = _is_blank_sql("alterDataID")
        return f"NOT {blank}" if positive else blank
    if field == "has_paint_area":
        area = quote_identifier("area_m2_per_m")
        return f"({area} IS NOT NULL AND {area} <> 0)" if positive else f"({area} IS NULL OR {area} = 0)"
    if field == "has_material":
        blank = _is_blank_sql("material_description")
        return f"NOT {blank}" if positive else blank
    return None


def _build_filters(
    params: dict[str, Any],
    valid_columns: list[str],
) -> tuple[str, dict[str, Any]]:
    conditions: list[str] = []
    bind: dict[str, Any] = {}
    like_op = like_operator()

    global_search = params.get("global_search")
    if global_search:
        search_clauses = []
        for idx, column in enumerate(GLOBAL_SEARCH_COLUMNS):
            if column not in valid_columns:
                continue
            param_name = f"gs_{idx}"
            search_clauses.append(f"{quote_identifier(column)} {like_op} :{param_name}")
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
                conditions.append(f"{quote_identifier(column)} IS {bool_true_sql()}")
            elif str(value).lower() in {"false", "0", "no"}:
                conditions.append(f"{quote_identifier(column)} IS {bool_false_sql()}")
            continue

        if column == "spec_id":
            conditions.append(f"{quote_identifier(column)} = :filter_{column}")
            bind[f"filter_{column}"] = int(value)
            continue

        conditions.append(f"{quote_identifier(column)} {like_op} :filter_{column}")
        bind[f"filter_{column}"] = f"%{value}%"

    for quality_field in QUALITY_FILTER_FIELDS:
        quality_value = params.get(quality_field)
        if not quality_value:
            continue
        clause = _quality_filter_sql(quality_field, quality_value)
        if clause:
            conditions.append(clause)

    where_clause = ""
    if conditions:
        where_clause = "WHERE " + " AND ".join(conditions)

    return where_clause, bind


def _pagination_clause() -> str:
    dialect = get_db_schema_config()["dialect"]
    if dialect == "mssql":
        return "OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY"
    return "LIMIT :limit OFFSET :offset"


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

    filter_params = dict(filters)
    include_external_items = parse_include_external_items(
        filter_params.pop("include_external_items", None),
        default=True,
    )
    where_clause, bind = _build_filters(filter_params, valid_columns)
    where_clause = append_productive_exclusion(where_clause, include_external_items)
    source = _read_from()

    count_query = text(f"SELECT COUNT(*) AS total FROM {source} {where_clause}")
    total = db.execute(count_query, bind).scalar() or 0

    offset = (page - 1) * page_size
    bind_with_pagination = {**bind, "limit": page_size, "offset": offset}

    data_query = text(
        f"""
        SELECT *
        FROM {source}
        {where_clause}
        ORDER BY {quote_identifier(sort_column)} {direction}
        {_pagination_clause()}
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
    query = text(f"SELECT * FROM {_read_from()} WHERE {quote_identifier('id')} = :id")
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

    select_list = ", ".join(quote_identifier(col) for col in export_columns)
    data_query = text(
        f"""
        SELECT {select_list}
        FROM {_read_from()}
        {where_clause}
        ORDER BY {quote_identifier(sort_column)} {direction}
        """
    )
    rows = db.execute(data_query, bind).mappings().all()
    return export_columns, [dict(row) for row in rows]


def get_dashboard_stats(db: Session, **filters: Any) -> dict[str, Any]:
    source = _read_from()
    like_op = like_operator()
    valid_columns = get_valid_column_names(db)
    filter_params = dict(filters)
    include_external_items = parse_include_external_items(
        filter_params.pop("include_external_items", None),
        default=False,
    )
    where_clause, bind = _build_filters(filter_params, valid_columns)
    where_clause = append_productive_exclusion(where_clause, include_external_items)

    total = db.execute(text(f"SELECT COUNT(*) FROM {source} {where_clause}"), bind).scalar() or 0

    unique_clients = db.execute(
        text(
            f"""
            SELECT COUNT(DISTINCT cliente)
            FROM {source}
            {and_condition(where_clause, "cliente IS NOT NULL AND LTRIM(RTRIM(CAST(cliente AS VARCHAR(1000)))) <> ''")}
            """
        ),
        bind,
    ).scalar() or 0

    unique_specs = db.execute(
        text(
            f"""
            SELECT COUNT(DISTINCT spec_id)
            FROM {source}
            {and_condition(where_clause, "spec_id IS NOT NULL")}
            """
        ),
        bind,
    ).scalar() or 0

    unique_catalog_items = _count_unique_catalog_items(db, source, where_clause, bind)

    deduplication_percent = 0.0
    if total > 0 and unique_catalog_items is not None:
        deduplication_percent = round((1 - (unique_catalog_items / total)) * 100, 2)

    by_client_rows = db.execute(
        text(
            f"""
            SELECT
                COALESCE(cliente, '(sem cliente)') AS cliente,
                COUNT(*) AS total_occurrences,
                COUNT(DISTINCT spec_id) AS total_specs,
                COUNT(DISTINCT NULLIF(LTRIM(RTRIM(CAST(item_key AS VARCHAR(1000)))), '')) AS total_items_estimate,
                SUM(CASE WHEN weight IS NULL OR weight = 0 THEN 1 ELSE 0 END) AS without_weight,
                SUM(CASE WHEN {_is_blank_sql('alterDataID')} THEN 1 ELSE 0 END) AS without_alterdata,
                SUM(CASE WHEN area_m2_per_m IS NULL OR area_m2_per_m = 0 THEN 1 ELSE 0 END) AS without_paint_area,
                SUM(CASE WHEN {_is_blank_sql('material_description')} THEN 1 ELSE 0 END) AS without_material
            FROM {source}
            {where_clause}
            GROUP BY cliente
            ORDER BY total_occurrences DESC, cliente
            """
        ),
        bind,
    ).mappings().all()

    quality_by_family = db.execute(
        text(
            f"""
            SELECT
                COALESCE(item_type, '(sem família)') AS item_type,
                COUNT(*) AS total,
                SUM(CASE WHEN weight IS NULL OR weight = 0 THEN 1 ELSE 0 END) AS without_weight,
                SUM(CASE WHEN {_is_blank_sql('alterDataID')} THEN 1 ELSE 0 END) AS without_alterdata,
                SUM(CASE WHEN area_m2_per_m IS NULL OR area_m2_per_m = 0 THEN 1 ELSE 0 END) AS without_paint_area,
                SUM(CASE WHEN {_is_blank_sql('material_description')} THEN 1 ELSE 0 END) AS without_material
            FROM {source}
            {where_clause}
            GROUP BY item_type
            ORDER BY total DESC, item_type
            """
        ),
        bind,
    ).mappings().all()

    top_schedules = db.execute(
        text(
            f"""
            SELECT COALESCE(schedule, '(sem schedule)') AS label, COUNT(*) AS total
            FROM {source}
            {where_clause}
            GROUP BY schedule
            ORDER BY total DESC
            OFFSET 0 ROWS FETCH NEXT 10 ROWS ONLY
            """
        )
        if get_db_schema_config()["dialect"] == "mssql"
        else text(
            f"""
            SELECT COALESCE(schedule, '(sem schedule)') AS label, COUNT(*) AS total
            FROM {source}
            {where_clause}
            GROUP BY schedule
            ORDER BY total DESC
            LIMIT 10
            """
        ),
        bind,
    ).mappings().all()

    top_materials = db.execute(
        text(
            f"""
            SELECT COALESCE(material_description, '(sem material)') AS label, COUNT(*) AS total
            FROM {source}
            {where_clause}
            GROUP BY material_description
            ORDER BY total DESC
            OFFSET 0 ROWS FETCH NEXT 10 ROWS ONLY
            """
        )
        if get_db_schema_config()["dialect"] == "mssql"
        else text(
            f"""
            SELECT COALESCE(material_description, '(sem material)') AS label, COUNT(*) AS total
            FROM {source}
            {where_clause}
            GROUP BY material_description
            ORDER BY total DESC
            LIMIT 10
            """
        ),
        bind,
    ).mappings().all()

    with_weight = db.execute(
        text(
            f"""
            SELECT COUNT(*) FROM {source}
            {and_condition(where_clause, "weight IS NOT NULL AND weight <> 0")}
            """
        ),
        bind,
    ).scalar() or 0

    with_alterdata = db.execute(
        text(
            f"""
            SELECT COUNT(*) FROM {source}
            {and_condition(where_clause, f"NOT {_is_blank_sql('alterDataID')}")}
            """
        ),
        bind,
    ).scalar() or 0

    with_paint_area = db.execute(
        text(
            f"""
            SELECT COUNT(*) FROM {source}
            {and_condition(where_clause, "area_m2_per_m IS NOT NULL AND area_m2_per_m <> 0")}
            """
        ),
        bind,
    ).scalar() or 0

    with_material = db.execute(
        text(
            f"""
            SELECT COUNT(*) FROM {source}
            {and_condition(where_clause, f"NOT {_is_blank_sql('material_description')}")}
            """
        ),
        bind,
    ).scalar() or 0

    total_pipe = db.execute(
        text(f"SELECT COUNT(*) FROM {source} {and_condition(where_clause, f"item_type {like_op} '%PIPE%'")}"),
        bind,
    ).scalar() or 0

    total_flange = db.execute(
        text(f"SELECT COUNT(*) FROM {source} {and_condition(where_clause, f"item_type {like_op} '%FLANGE%'")}"),
        bind,
    ).scalar() or 0

    without_alterdata = total - with_alterdata

    def _pct(row: dict[str, Any], field: str) -> float:
        row_total = int(row.get("total") or row.get("total_occurrences") or 0)
        if row_total <= 0:
            return 0.0
        return round((int(row[field] or 0) / row_total) * 100, 1)

    clients_summary = []
    for row in by_client_rows:
        item = dict(row)
        item["pct_without_weight"] = _pct(item, "without_weight")
        item["pct_without_alterdata"] = _pct(item, "without_alterdata")
        item["pct_without_paint_area"] = _pct(item, "without_paint_area")
        item["pct_without_material"] = _pct(item, "without_material")
        clients_summary.append(item)

    family_quality = []
    for row in quality_by_family:
        item = dict(row)
        item["pct_without_weight"] = _pct(item, "without_weight")
        item["pct_without_alterdata"] = _pct(item, "without_alterdata")
        item["pct_without_paint_area"] = _pct(item, "without_paint_area")
        item["pct_without_material"] = _pct(item, "without_material")
        family_quality.append(item)

    return {
        "total_items": int(total),
        "total_occurrences": int(total),
        "unique_clients": int(unique_clients),
        "unique_specs": int(unique_specs),
        "unique_catalog_items": unique_catalog_items,
        "deduplication_percent": deduplication_percent,
        "by_client": [{"cliente": r["cliente"], "total": r["total_occurrences"]} for r in clients_summary],
        "clients_summary": clients_summary,
        "quality_by_family": family_quality,
        "top_schedules": [dict(r) for r in top_schedules],
        "top_materials": [dict(r) for r in top_materials],
        "distribution": {
            "with_weight": int(with_weight),
            "without_weight": int(total - with_weight),
            "with_alterdata_id": int(with_alterdata),
            "without_alterdata_id": int(without_alterdata),
            "with_paint_area": int(with_paint_area),
            "without_paint_area": int(total - with_paint_area),
            "with_material": int(with_material),
            "without_material": int(total - with_material),
        },
        "total_pipe": int(total_pipe),
        "total_flange": int(total_flange),
        "with_alterdata_id": int(with_alterdata),
        "without_alterdata_id": int(without_alterdata),
        "productive_scope": {
            "include_external_items": include_external_items,
            "note": PRODUCTIVE_DASHBOARD_NOTE,
            "excluded_markers": list(EXCLUDED_ITEM_TYPE_MARKERS),
        },
    }


def _pct_from_counts(row: dict[str, Any], numer_field: str, denom_field: str = "total_occurrences") -> float:
    row_total = int(row.get(denom_field) or row.get("total") or row.get("total_occurrences") or 0)
    if row_total <= 0:
        return 0.0
    return round((int(row[numer_field] or 0) / row_total) * 100, 1)


def _quality_agg_sql() -> str:
    return f"""
        SUM(CASE WHEN weight IS NULL OR weight = 0 THEN 1 ELSE 0 END) AS without_weight,
        SUM(CASE WHEN {_is_blank_sql('alterDataID')} THEN 1 ELSE 0 END) AS without_alterdata,
        SUM(CASE WHEN area_m2_per_m IS NULL OR area_m2_per_m = 0 THEN 1 ELSE 0 END) AS without_paint_area,
        SUM(CASE WHEN {_is_blank_sql('material_description')} THEN 1 ELSE 0 END) AS without_material
    """


def _enrich_quality_percentages(item: dict[str, Any], denom_field: str = "total_occurrences") -> dict[str, Any]:
    item["pct_without_weight"] = _pct_from_counts(item, "without_weight", denom_field)
    item["pct_without_alterdata"] = _pct_from_counts(item, "without_alterdata", denom_field)
    item["pct_without_paint_area"] = _pct_from_counts(item, "without_paint_area", denom_field)
    item["pct_without_material"] = _pct_from_counts(item, "without_material", denom_field)
    return item


def _prepare_dashboard_scope(db: Session, **filters: Any) -> tuple[str, str, dict[str, Any], bool]:
    source = _read_from()
    valid_columns = get_valid_column_names(db)
    filter_params = dict(filters)
    include_external_items = parse_include_external_items(
        filter_params.pop("include_external_items", None),
        default=False,
    )
    where_clause, bind = _build_filters(filter_params, valid_columns)
    where_clause = append_productive_exclusion(where_clause, include_external_items)
    return source, where_clause, bind, include_external_items


def _productive_scope_payload(include_external_items: bool) -> dict[str, Any]:
    return {
        "include_external_items": include_external_items,
        "note": PRODUCTIVE_DASHBOARD_NOTE,
        "excluded_markers": list(EXCLUDED_ITEM_TYPE_MARKERS),
    }


def list_clients_page(db: Session, **filters: Any) -> dict[str, Any]:
    stats = get_dashboard_stats(db, **filters)
    return {
        "items": stats["clients_summary"],
        "total": len(stats["clients_summary"]),
        "productive_scope": stats["productive_scope"],
    }


def list_specs_summary(db: Session, **filters: Any) -> dict[str, Any]:
    source, where_clause, bind, include_external_items = _prepare_dashboard_scope(db, **filters)
    quality_agg = _quality_agg_sql()
    rows = db.execute(
        text(
            f"""
            SELECT
                spec_id,
                MAX(cliente) AS cliente,
                MAX(eds_vds) AS revision,
                COUNT(*) AS total_occurrences,
                COUNT(DISTINCT NULLIF(LTRIM(RTRIM(CAST(item_key AS VARCHAR(1000)))), '')) AS total_items_estimate,
                {quality_agg}
            FROM {source}
            {and_condition(where_clause, "spec_id IS NOT NULL")}
            GROUP BY spec_id
            ORDER BY total_occurrences DESC, spec_id
            """
        ),
        bind,
    ).mappings().all()

    items = [_enrich_quality_percentages(dict(row)) for row in rows]
    return {
        "items": items,
        "total": len(items),
        "productive_scope": _productive_scope_payload(include_external_items),
    }


def get_client_detail(db: Session, cliente: str, **filters: Any) -> dict[str, Any]:
    merged = {**filters, "cliente": cliente}
    stats = get_dashboard_stats(db, **merged)
    source, where_clause, bind, _ = _prepare_dashboard_scope(db, **merged)
    quality_agg = _quality_agg_sql()
    spec_rows = db.execute(
        text(
            f"""
            SELECT
                spec_id,
                MAX(eds_vds) AS revision,
                COUNT(*) AS total_occurrences,
                COUNT(DISTINCT NULLIF(LTRIM(RTRIM(CAST(item_key AS VARCHAR(1000)))), '')) AS total_items_estimate,
                {quality_agg}
            FROM {source}
            {and_condition(where_clause, "spec_id IS NOT NULL")}
            GROUP BY spec_id
            ORDER BY total_occurrences DESC, spec_id
            """
        ),
        bind,
    ).mappings().all()

    specs = [_enrich_quality_percentages(dict(row)) for row in spec_rows]
    summary_row = next((row for row in stats["clients_summary"] if row["cliente"] == cliente), None)
    if summary_row is None and stats["clients_summary"]:
        summary_row = stats["clients_summary"][0]

    return {
        "cliente": cliente,
        "summary": summary_row or {
            "cliente": cliente,
            "total_occurrences": stats["total_occurrences"],
            "total_specs": stats["unique_specs"],
            "total_items_estimate": stats["unique_catalog_items"] or 0,
            "pct_without_weight": 0.0,
            "pct_without_alterdata": 0.0,
            "pct_without_paint_area": 0.0,
            "pct_without_material": 0.0,
        },
        "total_occurrences": stats["total_occurrences"],
        "total_specs": stats["unique_specs"],
        "unique_catalog_items": stats["unique_catalog_items"],
        "distribution": stats["distribution"],
        "quality_by_family": stats["quality_by_family"],
        "specs": specs,
        "productive_scope": stats["productive_scope"],
    }


def get_spec_detail(db: Session, spec_id: int, **filters: Any) -> dict[str, Any]:
    merged = {**filters, "spec_id": spec_id}
    stats = get_dashboard_stats(db, **merged)
    source, where_clause, bind, _ = _prepare_dashboard_scope(db, **merged)
    meta = db.execute(
        text(
            f"""
            SELECT MAX(cliente) AS cliente, MAX(eds_vds) AS revision
            FROM {source}
            {where_clause}
            """
        ),
        bind,
    ).mappings().first()

    return {
        "spec_id": spec_id,
        "cliente": meta["cliente"] if meta else None,
        "revision": meta["revision"] if meta else None,
        "total_occurrences": stats["total_occurrences"],
        "unique_catalog_items": stats["unique_catalog_items"],
        "distribution": stats["distribution"],
        "quality_by_family": stats["quality_by_family"],
        "productive_scope": stats["productive_scope"],
        "summary": _enrich_quality_percentages(
            {
                "total_occurrences": stats["total_occurrences"],
                "without_weight": stats["distribution"]["without_weight"],
                "without_alterdata": stats["distribution"]["without_alterdata_id"],
                "without_paint_area": stats["distribution"]["without_paint_area"],
                "without_material": stats["distribution"]["without_material"],
            }
        ),
    }


def _count_unique_catalog_items(
    db: Session,
    source: str,
    where_clause: str,
    bind: dict[str, Any],
) -> int | None:
    cfg = get_db_schema_config()
    if cfg.get("use_catalog_writes"):
        try:
            count = db.execute(
                text(f"SELECT COUNT(*) FROM {cfg['catalog_items_table']}"),
            ).scalar()
            return int(count or 0)
        except Exception:
            pass

    count = db.execute(
        text(
            f"""
            SELECT COUNT(DISTINCT NULLIF(LTRIM(RTRIM(CAST(item_key AS VARCHAR(1000)))), ''))
            FROM {source}
            {where_clause}
            """
        ),
        bind,
    ).scalar()
    return int(count or 0)


def get_existing_ids(db: Session, ids: list[int]) -> set[int]:
    if not ids:
        return set()
    query = text(
        f"""
        SELECT {quote_identifier('id')}
        FROM {_read_from()}
        WHERE {quote_identifier('id')} IN :ids
        """
    ).bindparams(bindparam("ids", expanding=True))
    rows = db.execute(query, {"ids": ids}).scalars().all()
    return set(rows)


def get_next_id(db: Session) -> int:
    cfg = get_db_schema_config()
    if _use_catalog_writes():
        table = cfg["spec_catalog_items_table"]
        query = text(
            f"""
            SELECT COALESCE(MAX({quote_identifier('id')}), 0) + 1
            FROM {table}
            """
        )
    else:
        query = text(
            f"""
            SELECT COALESCE(MAX({quote_identifier('id')}), 0) + 1
            FROM {_read_from()}
            """
        )
    result = db.execute(query).scalar()
    return int(result)


def upsert_spec_item(db: Session, item_id: int, data: dict[str, Any], is_update: bool) -> dict[str, Any] | None:
    if _use_catalog_writes():
        payload = {**data, "id": item_id}
        result = upsert_spec_item_from_flat_payload(
            db,
            payload,
            legacy_spec_item_id=item_id,
            is_update=is_update,
        )
        return result

    if is_update:
        set_parts = []
        bind: dict[str, Any] = {"id": item_id}
        for key, value in data.items():
            if key == "id":
                continue
            set_parts.append(f"{quote_identifier(key)} = :{key}")
            bind[key] = value
        if not set_parts:
            return None
        query = text(
            f"UPDATE {_read_from()} SET {', '.join(set_parts)} WHERE {quote_identifier('id')} = :id"
        )
        db.execute(query, bind)
    else:
        columns = ["id"] + list(data.keys())
        values = [":id"] + [f":{col}" for col in data.keys()]
        bind = {"id": item_id, **data}
        col_list = ", ".join(quote_identifier(col) for col in columns)
        val_list = ", ".join(values)
        query = text(f"INSERT INTO {_read_from()} ({col_list}) VALUES ({val_list})")
        db.execute(query, bind)
    return None


def delete_spec_item(db: Session, item_id: int) -> None:
    if _use_catalog_writes():
        deactivate_spec_occurrence(db, item_id)
        return
    raise CatalogUpsertError("DELETE direto não suportado no modo legado.")
