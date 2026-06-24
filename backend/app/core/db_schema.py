"""Configuração de schema/tabelas para specDB normalizado."""

from functools import lru_cache

from app.core.config import get_settings


def detect_dialect(database_url: str) -> str:
    url = database_url.lower()
    if "mssql" in url or "pyodbc" in url or "pymssql" in url:
        return "mssql"
    return "postgresql"


@lru_cache
def get_db_schema_config() -> dict:
    settings = get_settings()
    dialect = settings.db_dialect or detect_dialect(settings.database_url)
    schema = settings.db_schema or ("dbo" if dialect == "mssql" else "public")

    read_source = settings.spec_items_read_source or (
        f"{schema}.v_spec_items_portal" if dialect == "mssql" else "spec_items"
    )

    return {
        "dialect": dialect,
        "schema": schema,
        "read_source": read_source,
        "use_catalog_writes": settings.use_catalog_writes,
        "catalog_items_table": f"{schema}.catalog_items",
        "spec_catalog_items_table": f"{schema}.spec_catalog_items",
        "catalog_item_alterdata_ids_table": f"{schema}.catalog_item_alterdata_ids",
    }


def qualified(table_name: str) -> str:
    cfg = get_db_schema_config()
    if "." in table_name:
        return table_name
    return f"{cfg['schema']}.{table_name}"


def read_source_sql() -> str:
    return get_db_schema_config()["read_source"]
