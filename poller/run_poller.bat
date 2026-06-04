@echo off
setlocal

set POLLER_DIR=%~dp0
cd /d "%POLLER_DIR%"

if exist "%POLLER_DIR%venv\Scripts\activate.bat" (
  call "%POLLER_DIR%venv\Scripts\activate.bat"
)

echo [%date% %time%] Starting printer poller >> "%POLLER_DIR%poller.log"
python "%POLLER_DIR%printer_poller.py" >> "%POLLER_DIR%poller.log" 2>&1
echo [%date% %time%] Printer poller finished with exit code %ERRORLEVEL% >> "%POLLER_DIR%poller.log"

endlocal
