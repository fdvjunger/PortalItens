"""Testes rápidos do parser decimal."""
from decimal import Decimal

from app.services.staging_integrity import is_likely_corrupted_raw_numeric
from app.utils.excel_raw_value import serialize_raw_excel_value
from app.utils.value_parser import parse_decimal_value, validate_numeric_range

CASES = [
    ("1.950000000000", "weight", Decimal("1.950000000000")),
    ("2.900000000000", "weight", Decimal("2.900000000000")),
    ("4.240000000000", "weight", Decimal("4.240000000000")),
    ("150.0000000", "dn_mm", Decimal("150.0000000")),
    ("117.4000000", "id_mm", Decimal("117.4000000")),
    ("21.3000", "od_mm", Decimal("21.3000")),
    ("4.7800", "wall_thk_mm", Decimal("4.7800")),
    ("38,1", "dm_ex", Decimal("38.1")),
    ("0,02149", "area_m2_per_m", Decimal("0.02149")),
    ("1.234,56", "weight", Decimal("1234.56")),
    ("1,234.56", "weight", Decimal("1234.56")),
]

CORRUPTED_RAW = [
    (1950000000000, "weight"),
    (2900000000000, "weight"),
    ("1950000000000", "weight"),
]

failed = 0
for raw, col, expected in CASES:
    parsed = parse_decimal_value(raw, col)
    if parsed != expected:
        print(f"FAIL {raw!r} -> {parsed} (expected {expected})")
        failed += 1
    else:
        validate_numeric_range(parsed, col)
        print(f"OK   {raw!r} -> {parsed}")

for raw, col in CORRUPTED_RAW:
    if not is_likely_corrupted_raw_numeric(raw, col):
        print(f"FAIL {raw!r} should be detected as corrupted staging")
        failed += 1
    else:
        print(f"OK   {raw!r} detected as corrupted staging")

assert serialize_raw_excel_value("1.950000000000") == "1.950000000000"
assert serialize_raw_excel_value(1.95) == 1.95
print("OK   serialize_raw_excel_value preserves raw values")

if failed:
    raise SystemExit(1)
print("All decimal parser tests passed.")
