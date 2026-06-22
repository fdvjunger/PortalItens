import json
import logging
import sys
import uuid
from datetime import datetime, timezone
from typing import Any


def setup_logging() -> None:
    root = logging.getLogger()
    root.setLevel(logging.INFO)

    for handler in list(root.handlers):
        root.removeHandler(handler)

    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(logging.INFO)
    handler.setFormatter(logging.Formatter(
        "[%(asctime)s] [%(levelname)s] [%(name)s] %(message)s"
    ))

    root.addHandler(handler)


def _json_safe(value: Any) -> Any:
    try:
        json.dumps(value, ensure_ascii=False, default=str)
        return value
    except Exception:
        return str(value)


def log_event(category: str, event: str, **kwargs: Any) -> None:
    logger = logging.getLogger(category)

    payload = {
        "event": event,
        "ts": datetime.now(timezone.utc).isoformat(),
        **kwargs,
    }

    safe_payload = {k: _json_safe(v) for k, v in payload.items()}

    logger.info(json.dumps(safe_payload, ensure_ascii=False, default=str))
    for handler in logging.getLogger().handlers:
        try:
            handler.flush()
        except Exception:
            pass


def log_error(category: str, event: str, **kwargs: Any) -> None:
    logger = logging.getLogger(category)

    payload = {
        "event": event,
        "ts": datetime.now(timezone.utc).isoformat(),
        **kwargs,
    }

    safe_payload = {k: _json_safe(v) for k, v in payload.items()}

    logger.error(json.dumps(safe_payload, ensure_ascii=False, default=str))
    for handler in logging.getLogger().handlers:
        try:
            handler.flush()
        except Exception:
            pass


def new_request_id() -> str:
    return uuid.uuid4().hex[:12]
