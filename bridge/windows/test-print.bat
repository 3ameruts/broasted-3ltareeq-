@echo off
rem Prints a test receipt with the installed settings.
"%LOCALAPPDATA%\BroastedPrinter\broasted-printer.exe" --test
echo Check the printer. Log: %LOCALAPPDATA%\BroastedPrinter\broasted-printer.log
pause
