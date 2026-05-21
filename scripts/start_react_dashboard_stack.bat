@echo off
cd /d "%~dp0.."
set "ROOT=%cd%"
call "%ROOT%\scripts\set_demo_env.bat"

echo.
echo === React dashboard + MQTT koprusu ===
echo MQTT: %MQTT_BROKER_HOST%:%MQTT_BROKER_PORT%
echo Kopru: http://127.0.0.1:8765  (WebSocket /ws, REST /api)
echo Vite:  http://localhost:5173
echo.
echo ONEMLI: Once broker + controller calisiyor olmali.
echo   Ornek: start_all_demo.bat  (Node-RED'i kapatabilirsiniz) 
echo   veya sadece broker + start_controller.bat
echo.

start "DASHBOARD_BRIDGE" /D "%ROOT%" cmd /k "call scripts\set_demo_env.bat && title DASHBOARD_BRIDGE && py -m src.dashboard_bridge"
timeout /t 2 /nobreak >nul

start "VITE" /D "%ROOT%\web\smartroom-dashboard" cmd /k "title VITE_REACT_DASHBOARD && npm run dev"
timeout /t 5 /nobreak >nul

start "" "http://localhost:5173/"
echo Acildi: http://localhost:5173/
echo Demo (MQTT'siz): http://localhost:5173/?demo=1
pause
