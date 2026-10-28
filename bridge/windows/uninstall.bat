@echo off
rem Stops the printer bridge and removes it from startup.
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='wscript.exe'\" | Where-Object { $_.CommandLine -like '*run-hidden.vbs*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"
taskkill /im broasted-printer.exe /f >nul 2>&1
del "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\BroastedPrinter.vbs" >nul 2>&1
echo Stopped and removed from startup.
pause
