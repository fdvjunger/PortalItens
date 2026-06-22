"""Testes da coerção inteligente para importação Excel."""
from decimal import Decimal

from app.utils.db_coercion import (
    coerce_decimal_for_column,
    coerce_nps_value,
    coerce_value_for_db,
    parse_decimal_basic,
    parse_nps_from_item_key,
    parse_nps_inches,
)

SCALE_CASES = [
    ("1950000000000", "weight", Decimal("1.95")),
    ("2900000000000", "weight", Decimal("2.9")),
    ("4240000000000", "weight", Decimal("4.24")),
    ("79710000", "weight", Decimal("79.71")),
    ("104970000", "weight", Decimal("104.97")),
    ("1500000000", "dn_mm", Decimal("150")),
    ("1174000000", "id_mm", Decimal("117.4")),
    ("213000", "od_mm", Decimal("21.3")),
    ("106500", "half_od_mm", Decimal("10.65")),
    ("47800", "wall_thk_mm", Decimal("4.78")),
    ("1017000", "area_m2_per_m", Decimal("1.017")),
    ("100000000", "nps", Decimal("1")),
    ("150000000", "nps", Decimal("1.5")),
    ("200000000", "nps", Decimal("2")),
    ("300000000", "nps", Decimal("3")),
    ("400000000", "nps", Decimal("4")),
    ("600000000", "nps", Decimal("6")),
    ("800000000", "nps", Decimal("8")),
    ("1000000000", "nps", Decimal("10")),
    ("0.5000", "nps", Decimal("0.5000")),
    ("0.7500", "nps", Decimal("0.7500")),
    ("1143000", "od_mm", Decimal("114.3")),
    ("1683000", "od_mm", Decimal("168.3")),
    ("1095500", "half_od_mm", Decimal("109.55")),
]

NPS_CONTEXT_CASES = [
    ("10000", '1"', Decimal("1"), Decimal("10000")),
    ("15000", '1 1/2"', Decimal("1.5"), Decimal("10000")),
    ("20000", '2"', Decimal("2"), Decimal("10000")),
    ("30000", '3"', Decimal("3"), Decimal("10000")),
    ("40000", '4"', Decimal("4"), Decimal("10000")),
    ("60000", '6"', Decimal("6"), Decimal("10000")),
    ("12500", '1 1/4"', Decimal("1.25"), Decimal("10000")),
    ("27500", '2 3/4"', Decimal("2.75"), Decimal("10000")),
    ("100000000", '1"', Decimal("1"), Decimal("100000000")),
    ("150000000", '1 1/2"', Decimal("1.5"), Decimal("100000000")),
]

NPS_MAGNITUDE_CASES = [
    ("10000", Decimal("1")),
    ("15000", Decimal("1.5")),
    ("20000", Decimal("2")),
]

EMPTY_CASES = [
    ("#N/A", "weight"),
    ("NULL", "dn_mm"),
    ("NA", "id_mm"),
]

failed = 0

for raw, col, expected in SCALE_CASES:
    result = coerce_decimal_for_column(raw, col)
    if result["value"] != expected:
        print(f"FAIL {col} {raw!r} -> {result['value']} (expected {expected}) method={result['method']}")
        failed += 1
    else:
        print(f"OK   {col} {raw!r} -> {result['value']} ({result['method']})")

for raw, nps_polegadas, expected, expected_divisor in NPS_CONTEXT_CASES:
    result = coerce_nps_value(raw, {"nps_polegadas": nps_polegadas})
    if result["value"] != expected or result.get("scale_divisor") != expected_divisor:
        print(
            f"FAIL nps context {raw!r} + {nps_polegadas!r} -> {result['value']} "
            f"divisor={result.get('scale_divisor')} (expected {expected}, {expected_divisor})"
        )
        failed += 1
    else:
        print(f"OK   nps context {raw!r} + {nps_polegadas!r} -> {result['value']} (/{expected_divisor})")

for raw, expected in NPS_MAGNITUDE_CASES:
    result = coerce_nps_value(raw, {})
    if result["value"] != expected:
        print(f"FAIL nps magnitude {raw!r} -> {result['value']} (expected {expected})")
        failed += 1
    else:
        print(f"OK   nps magnitude {raw!r} -> {result['value']}")

wrong = coerce_nps_value("10000", {"nps_polegadas": '1"'})
if wrong["value"] == Decimal("0.0001"):
    print("FAIL nps 10000 must not become 0.0001")
    failed += 1
else:
    print("OK   nps 10000 does not become 0.0001")

item_key = "30D01|A3|'O'-RING|GAS|1.5000|40S|"
parsed_key = parse_nps_from_item_key(item_key)
if parsed_key != Decimal("1.5000"):
    print(f"FAIL parse_nps_from_item_key -> {parsed_key}")
    failed += 1
else:
    print("OK   parse_nps_from_item_key")

result_item_key = coerce_nps_value("15000", {"item_key": item_key})
if result_item_key["value"] != Decimal("1.5"):
    print(f"FAIL nps via item_key -> {result_item_key['value']}")
    failed += 1
else:
    print("OK   nps via item_key fallback")

assert parse_nps_inches('1/2"') == Decimal("0.5")
assert parse_nps_inches("3/4") == Decimal("0.75")
assert parse_nps_inches('1 1/2"') == Decimal("1.5")

for raw, col in EMPTY_CASES:
    coerced = coerce_value_for_db(raw, col, {"data_type": "numeric", "is_nullable": True})
    if coerced["value"] is not None:
        print(f"FAIL {col} {raw!r} should be NULL, got {coerced['value']}")
        failed += 1
    else:
        print(f"OK   {col} {raw!r} -> NULL ({coerced['method']})")

nps_error = coerce_value_for_db(
    "99999999999999",
    "nps",
    {"data_type": "numeric", "is_nullable": True},
)
if nps_error.get("error") is None:
    print("FAIL nps out-of-profile should return error")
    failed += 1
else:
    print(f"OK   nps out-of-profile -> error ({nps_error['error']})")
    if "será ignorada" not in nps_error["error"]:
        print("FAIL nps error message should mention row skip")
        failed += 1

geometry_peers = {
    "od_mm": 1143000,
    "half_od_mm": 571500,
}
od_result = coerce_decimal_for_column(1143000, "od_mm", row_peers=geometry_peers)
half_result = coerce_decimal_for_column(571500, "half_od_mm", row_peers=geometry_peers)
if od_result["value"] != Decimal("114.3") or half_result["value"] != Decimal("57.15"):
    print(
        f"FAIL geometry od/half -> {od_result['value']}/{half_result['value']} "
        f"(expected 114.3/57.15)"
    )
    failed += 1
else:
    print("OK   geometry od_mm/half_od_mm coherent")

assert parse_decimal_basic("1.950000000000") == Decimal("1.950000000000")
assert parse_decimal_basic("38,1") == Decimal("38.1")

if failed:
    raise SystemExit(1)

print("All coercion tests passed.")
