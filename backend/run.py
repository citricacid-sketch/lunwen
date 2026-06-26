"""论文整改工具 — standalone launcher"""
import os
import sys
import time
import threading
import webbrowser

import uvicorn


def open_browser(port: int, delay: float = 1.5):
    """Open browser after a short delay to let the server start."""
    time.sleep(delay)
    webbrowser.open(f"http://localhost:{port}")


def main():
    port = int(os.environ.get("PORT", "8000"))
    no_browser = os.environ.get("NO_BROWSER", "").lower() in ("1", "true", "yes")

    if not no_browser:
        threading.Thread(target=open_browser, args=(port,), daemon=True).start()

    uvicorn.run(
        "app.main:app",
        host="127.0.0.1",
        port=port,
        log_level="info",
    )


if __name__ == "__main__":
    main()
