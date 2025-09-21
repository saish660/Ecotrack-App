#!/usr/bin/env python
"""
Simple scheduler for daily push notifications.
This script runs continuously and sends notifications at appropriate times.
For production, use a proper task scheduler like cron (Linux/Mac) or Task Scheduler (Windows).
"""

import os
import sys
import time
import schedule
import django
from datetime import datetime

# Add the Django project to the path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'DjangoProject.settings')
django.setup()

# Import after Django setup
from django.core.management import call_command


def send_notifications():
    """Send daily notifications using Django management command"""
    try:
        print(f"{datetime.now()} - Running daily notifications...")
        call_command('send_daily_notifications')
        print(f"{datetime.now()} - Daily notifications completed")
    except Exception as e:
        print(f"{datetime.now()} - Error running notifications: {e}")


def main():
    print("Starting EcoTrack notification scheduler...")
    
    # Schedule the notification check to run every minute
    # The management command will only send notifications to users whose time has come
    schedule.every().minute.do(send_notifications)
    
    print("Scheduler started. Press Ctrl+C to stop.")
    
    try:
        while True:
            schedule.run_pending()
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nScheduler stopped.")


if __name__ == "__main__":
    main()