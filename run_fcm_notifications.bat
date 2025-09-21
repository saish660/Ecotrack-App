@echo off
REM EcoTrack FCM Notification Scheduler Script
REM Use this script with Windows Task Scheduler instead of the old notification_scheduler.py

cd /d "C:\Users\saish\Computer Science\lenovo_leap_final_project\ecotrack"

REM Use the virtual environment Python
..\\.venv\\Scripts\\python.exe manage.py send_daily_notifications

REM Log the result
if %errorlevel% equ 0 (
    echo [%date% %time%] FCM notifications processed successfully >> scheduler.log
) else (
    echo [%date% %time%] FCM notification processing failed with error %errorlevel% >> scheduler.log
)