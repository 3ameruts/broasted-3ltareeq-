@echo off
rem Broasted 3ltareeq printer bridge: installs for this Windows user and starts automatically at logon.
setlocal
set "DEST=%LOCALAPPDATA%\BroastedPrinter"
set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
if not exist "%~dp0config.json" (
  echo config.json is missing next to install.bat. Fill it in first ^(see READ-ME-AR.txt^).
  pause & exit /b 1
)
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='wscript.exe'\" | Where-Object { $_.CommandLine -like '*run-hidden.vbs*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"
taskkill /im broasted-printer.exe /f >nul 2>&1
if not exist "%DEST%" mkdir "%DEST%"
copy /y "%~dp0broasted-printer.exe" "%DEST%\" >nul
copy /y "%~dp0config.json" "%DEST%\" >nul
copy /y "%~dp0run-hidden.vbs" "%DEST%\" >nul
rem start at logon (hidden, restarts itself if it ever stops)
> "%STARTUP%\BroastedPrinter.vbs" echo CreateObject("WScript.Shell").Run "wscript.exe ""%DEST%\run-hidden.vbs""", 0, False
echo Printing a test receipt...
"%DEST%\broasted-printer.exe" --test
start "" wscript.exe "%DEST%\run-hidden.vbs"
echo.
echo Done. The bridge is running in the background and will start with Windows.
echo Log file: %DEST%\broasted-printer.log
pause
