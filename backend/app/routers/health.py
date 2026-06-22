from fastapi import APIRouter

from app.core.database import check_database_connection

router = APIRouter(prefix="/api", tags=["health"])


@router.get("/health")
def health_check():
    database_status = "connected"
    try:
        check_database_connection()
    except Exception:
        database_status = "disconnected"

    return {
        "ok": database_status == "connected",
        "app": "Itens Portal",
        "database": database_status,
    }
