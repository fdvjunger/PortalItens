from app.core.db_schema import get_db_schema_config


def quote_identifier(name: str) -> str:
    if not name:
        raise ValueError("Identificador vazio")
    dialect = get_db_schema_config()["dialect"]
    if dialect == "mssql":
        if "]" in name:
            raise ValueError("Identificador inválido")
        return f"[{name}]"
    if '"' in name:
        raise ValueError("Identificador inválido")
    return f'"{name}"'


def quote_pg_identifier(name: str) -> str:
    """Compat: delega para quote_identifier."""
    return quote_identifier(name)


def like_operator() -> str:
    return "ILIKE" if get_db_schema_config()["dialect"] == "postgresql" else "LIKE"


def paginate_clause() -> str:
    return "LIMIT :limit OFFSET :offset"


def bool_true_sql() -> str:
    return "TRUE" if get_db_schema_config()["dialect"] == "postgresql" else "1"


def bool_false_sql() -> str:
    return "FALSE" if get_db_schema_config()["dialect"] == "postgresql" else "0"


def ids_in_clause(param_name: str = "ids") -> str:
    dialect = get_db_schema_config()["dialect"]
    if dialect == "postgresql":
        return f"= ANY(:{param_name})"
    return f"IN (SELECT value FROM OPENJSON(:{param_name}))"


def information_schema_table_filter() -> tuple[str, str]:
    cfg = get_db_schema_config()
    if cfg["dialect"] == "mssql":
        return "TABLE_SCHEMA = :table_schema", cfg["schema"]
    return "table_schema = :table_schema", "public"


def read_object_name_for_metadata() -> str:
    source = get_db_schema_config()["read_source"]
    if "." in source:
        return source.split(".", 1)[1]
    return source
