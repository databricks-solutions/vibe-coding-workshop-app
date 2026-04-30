@echo off
REM vibe2value - Installer and deployment CLI for Vibe Coding Workshop App (Windows)
REM Usage: vibe2value install ^| configure ^| deploy ^| doctor ^| uninstall
setlocal
set "PROJECT_ROOT=%~dp0"
python "%PROJECT_ROOT%scripts\vibe2value.py" %*
exit /b %ERRORLEVEL%
