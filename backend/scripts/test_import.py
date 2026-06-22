"""Teste rápido de importação Excel."""
import io
from pathlib import Path

from openpyxl import Workbook
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.services.excel_service import import_excel_file

engine = create_engine("postgresql+psycopg://postgres:postgres@localhost:5432/itens_portal")
Session = sessionmaker(bind=engine)

wb = Workbook()
ws = wb.active
ws.title = "spec_items"
ws.append(["id", "cliente", "item_type", "short_code", "nps"])
ws.append([1, "SBM", "PIPE", "P001", "38,1"])
ws.append([None, "SBM", "FLANGE", "F001", "1.95"])

buffer = io.BytesIO()
wb.save(buffer)

db = Session()
result = import_excel_file(db, buffer.getvalue(), "test_import.xlsx")
print("Import result:", result)

with engine.connect() as conn:
  rows = conn.execute(text("SELECT id, cliente, item_type, short_code, nps FROM spec_items ORDER BY id")).mappings().all()
  for row in rows:
    print(dict(row))
