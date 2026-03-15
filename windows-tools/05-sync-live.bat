@echo off
cd /d "%~dp0.."
call npm run sync:live
pause
