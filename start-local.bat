@echo off
chcp 65001 >nul
cd /d "%~dp0web"
echo.
echo   Ducky: локальний запуск
echo   Відкрийте в браузері: http://localhost:3000
echo   Щоб зупинити, закрийте це вікно.
echo.
start "" http://localhost:3000
where python >nul 2>nul && ( python -m http.server 3000 & goto :end )
where py >nul 2>nul && ( py -m http.server 3000 & goto :end )
where npx >nul 2>nul && ( npx --yes serve -l 3000 . & goto :end )
echo Не знайдено ні Python, ні Node.js. Встановіть Python з python.org і запустіть знову.
pause
:end
