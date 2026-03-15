@echo off
cd /d "%~dp0.."
call npm run rebuild:flashscore
pause
