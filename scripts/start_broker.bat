@echo off
call "%~dp0set_demo_env.bat"
cd /d "%~dp0..\Mosquitto"
if not exist "mosquitto.exe" (
    echo Mosquitto bulunamadi: %cd%\mosquitto.exe
    pause
    exit /b 1
)
title BROKER
mosquitto.exe -p %MQTT_BROKER_PORT% -v
pause
