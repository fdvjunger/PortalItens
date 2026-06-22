import threading

_registry_lock = threading.Lock()
_run_locks: dict[int, threading.Lock] = {}


def try_acquire_run_lock(run_id: int) -> bool:
    with _registry_lock:
        if run_id not in _run_locks:
            _run_locks[run_id] = threading.Lock()
        lock = _run_locks[run_id]
    return lock.acquire(blocking=False)


def release_run_lock(run_id: int) -> None:
    with _registry_lock:
        lock = _run_locks.get(run_id)
    if lock is None:
        return
    try:
        if lock.locked():
            lock.release()
    except RuntimeError:
        pass
