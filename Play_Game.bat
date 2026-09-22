@echo off
setlocal
cd /d "%~dp0"
python tools\balance\build.py
if errorlevel 1 (
    echo Balance data conversion failed.
    pause
    exit /b 1
)
echo Starting Starfighter Ace Web Server...
node tools\serve.js --open
if errorlevel 1 pause
