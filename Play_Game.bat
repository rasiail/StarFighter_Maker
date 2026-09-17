@echo off
echo Starting Starfighter Ace Web Server...
start http://localhost:8000/index.html
python -m http.server 8000
