def quote_pg_identifier(name: str) -> str:
    if not name:
        raise ValueError("Identificador vazio")
    if '"' in name:
        raise ValueError("Identificador inválido")
    return f'"{name}"'
