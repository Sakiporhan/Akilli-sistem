@echo off
cd /d "%~dp0.."
set "ROOT=%cd%"
call "%ROOT%\scripts\set_demo_env.bat"
echo Dashboard bridge: %MQTT_BROKER_HOST%:%MQTT_BROKER_PORT% -^> http://127.0.0.1:8765
py -m src.dashboard_bridge
pause
