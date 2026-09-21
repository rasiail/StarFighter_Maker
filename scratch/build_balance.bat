@echo off
cd /d "%~dp0.."
echo 엑셀 밸런스 데이터 변환을 시작합니다...
python tools\balance\build.py
if errorlevel 1 (
    echo.
    echo [오류] 데이터 변환에 실패했습니다. 엑셀 파일의 내용을 확인해주세요.
    pause
    exit /b 1
)
echo.
echo [성공] 게임 데이터 변환이 완료되었습니다!
pause
