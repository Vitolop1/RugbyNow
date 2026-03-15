@echo off
cd /d "%~dp0.."
call npm run generate:team-profiles
pause
