"""Testes de identidade canônica do catálogo normalizado."""

from decimal import Decimal

from app.services.catalog_identity import (
    build_canonical_item_key,
    include_radius_in_identity,
)

failed = 0


def check(name: str, condition: bool) -> None:
    global failed
    if condition:
        print(f"OK   {name}")
    else:
        print(f"FAIL {name}")
        failed += 1


check("radius only for curves", include_radius_in_identity("LR ELL 90 DEG"))
check("radius not for pipe", not include_radius_in_identity("PIPE"))

key_sch40 = build_canonical_item_key(
    {
        "item_type": "LR ELL 90 DEG",
        "short_code": "ELL",
        "nps": Decimal("4"),
        "schedule": "SCH40",
        "geometric_standard": "ASME",
        "material_description": "CARBON STEEL",
        "has_nace": False,
        "end_conn_1": "BW",
        "end_conn_2": "BW",
        "mds": "CS",
        "rating": "150",
        "pipe_seam_type": None,
        "radius": Decimal("1.5"),
    }
)
key_sch80 = build_canonical_item_key(
    {
        "item_type": "LR ELL 90 DEG",
        "short_code": "ELL",
        "nps": Decimal("4"),
        "schedule": "SCH80",
        "geometric_standard": "ASME",
        "material_description": "CARBON STEEL",
        "has_nace": False,
        "end_conn_1": "BW",
        "end_conn_2": "BW",
        "mds": "CS",
        "rating": "150",
        "pipe_seam_type": None,
        "radius": Decimal("1.5"),
    }
)
check("schedule change produces different canonical key", key_sch40 != key_sch80)
check("schedule present in key", "schedule=SCH80" in key_sch80)

pipe_key = build_canonical_item_key(
    {
        "item_type": "PIPE",
        "short_code": "PIP",
        "nps": Decimal("2"),
        "schedule": "SCH40",
        "radius": Decimal("99"),
    }
)
check("pipe ignores radius in key", "radius=" not in pipe_key)

if failed:
    raise SystemExit(1)

print("All catalog identity tests passed.")
