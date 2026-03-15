@echo off
setlocal
cd /d "%~dp0.."

:menu
cls
echo ============================================
echo              RugbyNow - Menu
echo ============================================
echo.
echo  1. Levantar local (npm run dev)
echo  2. Build local (npm run build:next)
echo  3. Deploy produccion (npm run deploy)
echo  4. Sync matches / Flashscore (npm run sync:matches)
echo  5. Sync live (npm run sync:live)
echo  6. Sync live clock (npm run sync:live:clock)
echo  7. Sync live finish (npm run sync:live:finish)
echo  8. Sync standings (npm run sync:standings)
echo  9. Export snapshot (npm run export:supabase-snapshot)
echo 10. Check Supabase (npm run check:supabase)
echo 11. Rebuild Flashscore (npm run rebuild:flashscore)
echo 12. Generar team profiles (npm run generate:team-profiles)
echo 13. Build weekly (npm run build:weekly)
echo 14. Lint (npm run lint)
echo 15. Salir
echo.
set /p choice=Elegi una opcion: 

if "%choice%"=="1" call npm run dev && goto end
if "%choice%"=="2" call npm run build:next && goto end
if "%choice%"=="3" call npm run deploy && goto end
if "%choice%"=="4" call npm run sync:matches && goto end
if "%choice%"=="5" call npm run sync:live && goto end
if "%choice%"=="6" call npm run sync:live:clock && goto end
if "%choice%"=="7" call npm run sync:live:finish && goto end
if "%choice%"=="8" call npm run sync:standings && goto end
if "%choice%"=="9" call npm run export:supabase-snapshot && goto end
if "%choice%"=="10" call npm run check:supabase && goto end
if "%choice%"=="11" call npm run rebuild:flashscore && goto end
if "%choice%"=="12" call npm run generate:team-profiles && goto end
if "%choice%"=="13" call npm run build:weekly && goto end
if "%choice%"=="14" call npm run lint && goto end
if "%choice%"=="15" exit /b 0

echo.
echo Opcion invalida.
pause
goto menu

:end
echo.
pause
