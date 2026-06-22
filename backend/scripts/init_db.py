"""Script auxiliar para criar o banco e executar migrations iniciais."""
from pathlib import Path

from sqlalchemy import create_engine, text

ROOT = Path(__file__).resolve().parents[2]
DATABASE_DIR = ROOT / "database"

admin_engine = create_engine(
    "postgresql+psycopg://postgres:postgres@localhost:5432/postgres",
    isolation_level="AUTOCOMMIT",
)

with admin_engine.connect() as conn:
    exists = conn.execute(
        text("SELECT 1 FROM pg_database WHERE datname = 'itens_portal'")
    ).scalar()
    if not exists:
        conn.execute(text("CREATE DATABASE itens_portal"))
        print("Database itens_portal criado.")
    else:
        print("Database itens_portal já existe.")

app_engine = create_engine("postgresql+psycopg://postgres:postgres@localhost:5432/itens_portal")

for sql_file in [
    "001_create_spec_items.sql",
    "002_create_import_audit.sql",
    "003_extend_import_staging.sql",
    "004_import_progress.sql",
    "005_import_preview_meta.sql",
    "006_import_diff_raw_parsed.sql",
    "007_import_diff_coercion.sql",
    "003_add_import_diff_coercion_columns.sql",
]:
    sql = (DATABASE_DIR / sql_file).read_text(encoding="utf-8")
    with app_engine.begin() as conn:
        conn.execute(text(sql))
    print(f"OK: {sql_file}")
