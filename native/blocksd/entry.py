"""PyInstaller entry point: the same as `python -m blocksd`, plus a lifetime link to Keylight.

Keylight starts the daemon with `--keylight-token <token>`. When that flag is present the daemon
ends itself if Keylight goes away: its stdin is a pipe owned by Keylight (EOF means Keylight died
or closed it), and the parent PID is checked every two seconds as a second signal. Without the
flag (a hand-run daemon) nothing changes. The flag and token are removed before blocksd's own
command line parser sees the arguments.
"""
import multiprocessing
import os
import signal
import sys
import threading
import time

multiprocessing.freeze_support()


def _end() -> None:
    """Ask for a clean shutdown, and exit anyway if it does not happen within 5 seconds."""
    try:
        os.kill(os.getpid(), signal.SIGTERM)
    except OSError:
        os._exit(0)
    threading.Timer(5.0, lambda: os._exit(0)).start()


def _watch_parent() -> None:
    parent = os.getppid()

    def stdin_eof() -> None:
        try:
            # the raw descriptor, not sys.stdin: a buffered reader's lock aborts the interpreter at exit
            while os.read(0, 4096):
                pass
        except Exception:
            pass
        _end()

    def parent_gone() -> None:
        while True:
            time.sleep(2.0)
            if os.getppid() != parent:
                _end()
                return

    threading.Thread(target=stdin_eof, daemon=True, name="keylight-stdin").start()
    threading.Thread(target=parent_gone, daemon=True, name="keylight-parent").start()


if "--keylight-token" in sys.argv:
    i = sys.argv.index("--keylight-token")
    del sys.argv[i : i + 2]
    _watch_parent()

from blocksd.cli.app import app  # noqa: E402

app()
