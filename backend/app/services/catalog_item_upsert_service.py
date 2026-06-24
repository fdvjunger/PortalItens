"""Escrita normalizada: flat payload -> catalog_items + spec_catalog_items."""

from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.db_schema import get_db_schema_config, qualified
from app.services.catalog_identity import (
    build_canonical_item_key,
    include_radius_in_identity,
    normalize_bool,
    normalize_decimal,
)
from app.services.catalog_lookup_service import CatalogLookupError, resolve_catalog_dimension_ids
from app.utils.sql_utils import quote_identifier


class CatalogUpsertError(ValueError):
    pass


def _table(name: str) -> str:
    cfg = get_db_schema_config()
    mapping = {
        "catalog_items": cfg["catalog_items_table"],
        "spec_catalog_items": cfg["spec_catalog_items_table"],
        "catalog_item_alterdata_ids": cfg["catalog_item_alterdata_ids_table"],
    }
    return mapping.get(name, qualified(name))


def _decimal_or_none(value: Any) -> Decimal | None:
    normalized = normalize_decimal(value)
    if normalized is None:
        return None
    return Decimal(normalized)


def _find_catalog_item_by_key(db: Session, canonical_key: str) -> dict[str, Any] | None:
    row = db.execute(
        text(
            f"""
            SELECT *
            FROM {_table('catalog_items')}
            WHERE {quote_identifier('canonical_item_key')} = :canonical_key
            """
        ),
        {"canonical_key": canonical_key},
    ).mappings().first()
    return dict(row) if row else None


def _create_catalog_item(
    db: Session,
    *,
    canonical_key: str,
    dimension_ids: dict[str, int | None],
    payload: dict[str, Any],
) -> int:
    columns = {
        "canonical_item_key": canonical_key,
        "item_type_id": dimension_ids["item_type_id"],
        "nps_id": dimension_ids.get("nps_id"),
        "schedule_id": dimension_ids.get("schedule_id"),
        "material_id": dimension_ids.get("material_id"),
        "end_conn_1_id": dimension_ids.get("end_conn_1_id"),
        "end_conn_2_id": dimension_ids.get("end_conn_2_id"),
        "mds_id": dimension_ids.get("mds_id"),
        "rating_id": dimension_ids.get("rating_id"),
        "seam_type_id": dimension_ids.get("seam_type_id"),
        "geometric_standard_id": dimension_ids.get("geometric_standard_id"),
        "has_nace": normalize_bool(payload.get("has_nace")) == "1",
        "dn_mm": _decimal_or_none(payload.get("dn_mm")),
        "od_mm": _decimal_or_none(payload.get("od_mm")),
        "wall_thk_mm": _decimal_or_none(payload.get("wall_thk_mm")),
        "id_mm": _decimal_or_none(payload.get("id_mm")),
        "weight": _decimal_or_none(payload.get("weight")),
        "weight_unit": payload.get("weight_unit"),
        "weight_basis": payload.get("weight_basis"),
        "dm_ex": _decimal_or_none(payload.get("dm_ex")),
        "area_m2_per_m": _decimal_or_none(payload.get("area_m2_per_m")),
        "sch_mm": _decimal_or_none(payload.get("sch_mm")),
    }

    if include_radius_in_identity(payload.get("item_type")):
        columns["radius"] = _decimal_or_none(payload.get("radius"))

    col_names = ", ".join(quote_identifier(k) for k in columns)
    col_params = ", ".join(f":{k}" for k in columns)
    dialect = get_db_schema_config()["dialect"]

    if dialect == "mssql":
        query = text(
            f"""
            INSERT INTO {_table('catalog_items')} ({col_names})
            OUTPUT INSERTED.{quote_identifier('catalog_item_id')} AS id
            VALUES ({col_params})
            """
        )
    else:
        query = text(
            f"""
            INSERT INTO {_table('catalog_items')} ({col_names})
            VALUES ({col_params})
            RETURNING {quote_identifier('catalog_item_id')} AS id
            """
        )

    row = db.execute(query, columns).mappings().first()
    if not row:
        raise CatalogUpsertError("Falha ao criar catalog_items")
    return int(row["id"])


def _get_spec_link_by_legacy_id(db: Session, legacy_id: int) -> dict[str, Any] | None:
    row = db.execute(
        text(
            f"""
            SELECT *
            FROM {_table('spec_catalog_items')}
            WHERE {quote_identifier('id')} = :legacy_id
            """
        ),
        {"legacy_id": legacy_id},
    ).mappings().first()
    return dict(row) if row else None


def _occurrence_values(payload: dict[str, Any], dimension_ids: dict[str, int | None]) -> dict[str, Any]:
    values: dict[str, Any] = {
        "spec_id": payload.get("spec_id"),
        "source_page": payload.get("source_page"),
        "eds_vds": payload.get("eds_vds"),
        "notes": payload.get("notes"),
        "nps_polegadas": payload.get("nps_polegadas"),
        "item_key": payload.get("item_key"),
        "sort_order": payload.get("sort_order"),
        "is_active": payload.get("is_active", True),
        "nps_table_col_index": payload.get("nps_table_col_index"),
        "nps_raw": payload.get("nps_raw"),
        "nps_row_raw_cells_json": payload.get("nps_row_raw_cells_json"),
        "nps_table": payload.get("nps_table"),
        "half_od_mm": _decimal_or_none(payload.get("half_od_mm")),
        "weight_source_file": payload.get("weight_source_file"),
        "weight_source_sheet": payload.get("weight_source_sheet"),
        "weight_source_row": payload.get("weight_source_row"),
        "weight_match_method": payload.get("weight_match_method"),
        "weight_match_confidence": _decimal_or_none(payload.get("weight_match_confidence")),
        "alterDataID": payload.get("alterDataID"),
        "legacy_r": _decimal_or_none(payload.get("legacy_r") or payload.get("r")),
        "client_id": dimension_ids.get("client_id"),
        "updated_at": datetime.utcnow(),
    }
    return {k: v for k, v in values.items() if v is not None or k in {"spec_id", "is_active"}}


def _upsert_alterdata_relation(db: Session, catalog_item_id: int, alterdata_id: Any) -> None:
    if alterdata_id is None:
        return
    text_id = str(alterdata_id).strip()
    if not text_id:
        return

    table = _table("catalog_item_alterdata_ids")
    if get_db_schema_config()["dialect"] == "mssql":
        query = text(
            f"""
            MERGE {table} AS target
            USING (SELECT :catalog_item_id AS catalog_item_id, :alterdata_id AS alterdata_id) AS source
            ON target.{quote_identifier('catalog_item_id')} = source.catalog_item_id
               AND target.{quote_identifier('alterdata_id')} = source.alterdata_id
            WHEN NOT MATCHED THEN
                INSERT ({quote_identifier('catalog_item_id')}, {quote_identifier('alterdata_id')})
                VALUES (source.catalog_item_id, source.alterdata_id);
            """
        )
    else:
        query = text(
            f"""
            INSERT INTO {table}
                ({quote_identifier('catalog_item_id')}, {quote_identifier('alterdata_id')})
            VALUES (:catalog_item_id, :alterdata_id)
            ON CONFLICT DO NOTHING
            """
        )

    db.execute(query, {"catalog_item_id": catalog_item_id, "alterdata_id": text_id})


def _insert_spec_link(
    db: Session,
    *,
    legacy_id: int | None,
    catalog_item_id: int,
    occurrence: dict[str, Any],
) -> int:
    occurrence = {**occurrence, "catalog_item_id": catalog_item_id}
    if legacy_id is not None:
        occurrence["id"] = legacy_id

    col_names = ", ".join(quote_identifier(k) for k in occurrence)
    col_params = ", ".join(f":{k}" for k in occurrence)
    dialect = get_db_schema_config()["dialect"]
    table = _table("spec_catalog_items")

    if legacy_id is not None and dialect == "mssql":
        db.execute(text(f"SET IDENTITY_INSERT {table} ON"))
        try:
            db.execute(
                text(f"INSERT INTO {table} ({col_names}) VALUES ({col_params})"),
                occurrence,
            )
        finally:
            db.execute(text(f"SET IDENTITY_INSERT {table} OFF"))
        return int(legacy_id)

    if dialect == "mssql":
        if legacy_id is not None:
            query = text(f"INSERT INTO {table} ({col_names}) VALUES ({col_params})")
            db.execute(query, occurrence)
            return int(legacy_id)
        row = db.execute(
            text(
                f"""
                INSERT INTO {table} ({col_names})
                OUTPUT INSERTED.{quote_identifier('id')} AS id
                VALUES ({col_params})
                """
            ),
            occurrence,
        ).mappings().first()
        return int(row["id"])

    if legacy_id is not None:
        db.execute(text(f"INSERT INTO {table} ({col_names}) VALUES ({col_params})"), occurrence)
        return int(legacy_id)

    row = db.execute(
        text(
            f"""
            INSERT INTO {table} ({col_names})
            VALUES ({col_params})
            RETURNING {quote_identifier('id')} AS id
            """
        ),
        occurrence,
    ).mappings().first()
    return int(row["id"])


def _update_spec_link(
    db: Session,
    legacy_id: int,
    *,
    catalog_item_id: int,
    occurrence: dict[str, Any],
) -> None:
    set_parts = [f"{quote_identifier('catalog_item_id')} = :catalog_item_id"]
    bind: dict[str, Any] = {"legacy_id": legacy_id, "catalog_item_id": catalog_item_id}

    for key, value in occurrence.items():
        if key in {"id", "spec_id"}:
            continue
        set_parts.append(f"{quote_identifier(key)} = :{key}")
        bind[key] = value

    db.execute(
        text(
            f"""
            UPDATE {_table('spec_catalog_items')}
            SET {', '.join(set_parts)}
            WHERE {quote_identifier('id')} = :legacy_id
            """
        ),
        bind,
    )


def deactivate_spec_occurrence(db: Session, legacy_id: int) -> None:
    db.execute(
        text(
            f"""
            UPDATE {_table('spec_catalog_items')}
            SET {quote_identifier('is_active')} = {0 if get_db_schema_config()['dialect'] == 'mssql' else 'FALSE'},
                {quote_identifier('updated_at')} = :updated_at
            WHERE {quote_identifier('id')} = :legacy_id
            """
        ),
        {"legacy_id": legacy_id, "updated_at": datetime.utcnow()},
    )


def upsert_spec_item_from_flat_payload(
    db: Session,
    payload: dict[str, Any],
    *,
    legacy_spec_item_id: int | None = None,
    is_update: bool = False,
) -> dict[str, Any]:
    """
    Recebe linha flat (formato da view/planilha) e persiste no modelo normalizado.
    Nunca altera catalog_items existente de forma a afetar outras specs.
    """
    if payload.get("spec_id") is None:
        raise CatalogUpsertError("spec_id é obrigatório para vincular ocorrência à spec.")

    try:
        dimension_ids = resolve_catalog_dimension_ids(db, payload)
        canonical_key = build_canonical_item_key(payload)

        existing_catalog = _find_catalog_item_by_key(db, canonical_key)
        catalog_item_created = False
        if existing_catalog:
            catalog_item_id = int(existing_catalog["catalog_item_id"])
        else:
            catalog_item_id = _create_catalog_item(
                db,
                canonical_key=canonical_key,
                dimension_ids=dimension_ids,
                payload=payload,
            )
            catalog_item_created = True

        occurrence = _occurrence_values(payload, dimension_ids)
        occurrence["spec_id"] = payload["spec_id"]

        legacy_id = legacy_spec_item_id or payload.get("id")
        spec_link_created = False
        spec_link_updated = False

        if is_update and legacy_id is not None:
            existing_link = _get_spec_link_by_legacy_id(db, int(legacy_id))
            if not existing_link:
                raise CatalogUpsertError(f"Ocorrência legacy_spec_item_id={legacy_id} não encontrada.")
            _update_spec_link(db, int(legacy_id), catalog_item_id=catalog_item_id, occurrence=occurrence)
            spec_link_updated = True
            result_legacy_id = int(legacy_id)
        else:
            result_legacy_id = _insert_spec_link(
                db,
                legacy_id=int(legacy_id) if legacy_id is not None else None,
                catalog_item_id=catalog_item_id,
                occurrence=occurrence,
            )
            spec_link_created = True

        _upsert_alterdata_relation(db, catalog_item_id, payload.get("alterDataID"))

        return {
            "legacy_spec_item_id": result_legacy_id,
            "catalog_item_id": catalog_item_id,
            "catalog_item_created": catalog_item_created,
            "spec_link_created": spec_link_created,
            "spec_link_updated": spec_link_updated,
            "canonical_item_key": canonical_key,
            "action": "update" if spec_link_updated else "insert",
        }
    except CatalogLookupError as exc:
        raise CatalogUpsertError(str(exc)) from exc


def upsert_spec_item_from_flat_payload_batch(
    db: Session,
    rows: list[dict[str, Any]],
) -> dict[str, Any]:
    """Processa lote de linhas flat e retorna relatório agregado."""
    report: dict[str, Any] = {
        "processed_rows": 0,
        "catalog_items_created": 0,
        "spec_links_created": 0,
        "spec_links_updated": 0,
        "errors": [],
        "results": [],
    }

    for index, row in enumerate(rows, start=1):
        try:
            legacy_id = row.get("legacy_spec_item_id") or row.get("id")
            is_update = bool(row.get("is_update"))
            payload = row.get("payload") or row
            result = upsert_spec_item_from_flat_payload(
                db,
                payload,
                legacy_spec_item_id=int(legacy_id) if legacy_id is not None else None,
                is_update=is_update,
            )
            report["processed_rows"] += 1
            if result["catalog_item_created"]:
                report["catalog_items_created"] += 1
            if result["spec_link_created"]:
                report["spec_links_created"] += 1
            if result["spec_link_updated"]:
                report["spec_links_updated"] += 1
            report["results"].append(result)
        except Exception as exc:
            report["errors"].append(
                {
                    "row_index": index,
                    "legacy_spec_item_id": row.get("id"),
                    "excel_row_number": row.get("excel_row_number"),
                    "error": str(exc),
                }
            )

    return report
