"""Testes de escopo produtivo do dashboard."""

from app.services.dashboard_productivity import (
    EXCLUDED_ITEM_TYPE_MARKERS,
    is_productive_dashboard_item,
    parse_include_external_items,
)

failed = 0

cases_exclude = [
    "BOLT",
    "STUD BOLT",
    "MACHINE BOLT",
    "HEX BOLT",
    "SCREW",
    "STUD",
    "NUT",
    "WASHER",
    "FASTENER",
    "GASKET",
    "SPIRAL WOUND GASKET",
    "VALVE",
    "GATE VALVE",
    "BALL VALVE",
]

cases_include = [
    "PIPE",
    "FLANGE",
    "LR ELL 90 DEG",
    "TEE",
    "REDUCER",
    None,
    "",
]

for item_type in cases_exclude:
    if is_productive_dashboard_item(item_type):
        print(f"FAIL should exclude {item_type!r}")
        failed += 1
    else:
        print(f"OK   exclude {item_type!r}")

for item_type in cases_include:
    if not is_productive_dashboard_item(item_type):
        print(f"FAIL should include {item_type!r}")
        failed += 1
    else:
        print(f"OK   include {item_type!r}")

assert parse_include_external_items(None, default=False) is False
assert parse_include_external_items("true", default=False) is True
assert parse_include_external_items(None, default=True) is True
assert parse_include_external_items("false", default=False) is False
print("OK   parse_include_external_items")

assert len(EXCLUDED_ITEM_TYPE_MARKERS) == 8
print("OK   markers count")

if failed:
    raise SystemExit(1)

print("All productive dashboard tests passed.")
