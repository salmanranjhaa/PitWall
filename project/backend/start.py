"""
Backend startup script.

Run from the project/backend directory:
    uv run python start.py
or:
    .venv/Scripts/python start.py
"""

import os
import sys

# Make sure the app package is on the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "app"))

import uvicorn

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info",
    )
