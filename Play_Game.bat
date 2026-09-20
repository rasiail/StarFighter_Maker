@echo off
python tools\balance\build.py
if errorlevel 1 (
    echo Balance data conversion failed.
    pause
    exit /b 1
)
echo Starting Starfighter Ace Web Server...
start http://localhost:8000/index.html
python -m http.server 8000
