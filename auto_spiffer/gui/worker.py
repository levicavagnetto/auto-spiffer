"""Run slow work (reading PDFs, matching) on a background thread without freezing the window.

Tk is not thread-safe, so the thread only computes; its result is handed back through a queue and
the callbacks run on the main thread. In tests `synchronous=True` runs everything immediately.
"""
from __future__ import annotations

import queue
import threading
from typing import Any, Callable, Optional


class Worker:
    def __init__(self, root, synchronous: bool = False):
        self.root = root
        self.synchronous = synchronous
        self._queue: "queue.Queue[tuple]" = queue.Queue()
        self._pending = 0

    def run(self, func: Callable[[], Any], on_done: Optional[Callable[[Any], None]] = None,
            on_error: Optional[Callable[[Exception], None]] = None) -> None:
        if self.synchronous:
            try:
                value = func()
            except Exception as exc:
                if on_error is None:
                    raise
                on_error(exc)
                return
            if on_done:
                on_done(value)
            return

        def target() -> None:
            try:
                self._queue.put(("ok", func(), on_done))
            except Exception as exc:  # reported on the main thread
                self._queue.put(("error", exc, on_error))

        self._pending += 1
        threading.Thread(target=target, daemon=True).start()
        self.root.after(40, self._poll)

    def _poll(self) -> None:
        try:
            while True:
                kind, payload, callback = self._queue.get_nowait()
                self._pending -= 1
                if kind == "ok" and callback:
                    callback(payload)
                elif kind == "error":
                    if callback:
                        callback(payload)
                    else:
                        raise payload
        except queue.Empty:
            pass
        if self._pending > 0:
            self.root.after(40, self._poll)

    @property
    def busy(self) -> bool:
        return self._pending > 0
