#!/usr/bin/env python
"""
Android-focused notification scheduler for EcoTrack.
This script sends scheduled push notifications to registered Android devices using Firebase Cloud Messaging.

Usage:
    python android_notification_scheduler.py

Environment Variables:
    CRON_SECRET: Secret token for authenticating with the cron endpoint
    ECOTRACK_URL: Base URL of the EcoTrack application (default: http://localhost:8000)
"""

import os
import sys
import requests
from datetime import datetime
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('android_notifications.log'),
        logging.StreamHandler(sys.stdout)
    ]
)

logger = logging.getLogger(__name__)

def send_android_notifications():
    """Send scheduled notifications to Android devices"""
    
    # Get configuration from environment variables
    cron_secret = os.getenv('CRON_SECRET')
    if not cron_secret:
        logger.error("CRON_SECRET environment variable not set")
        return False
    
    base_url = os.getenv('ECOTRACK_URL', 'http://localhost:8000')
    endpoint = f"{base_url}/api/cron/dispatch"
    
    try:
        # Call the cron dispatch endpoint
        response = requests.get(
            endpoint,
            params={'token': cron_secret},
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            logger.info(f"✅ Notifications sent successfully:")
            logger.info(f"   Time: {data.get('time', 'Unknown')}")
            logger.info(f"   Total candidates: {data.get('total_candidates', 0)}")
            logger.info(f"   Successfully sent: {data.get('sent', 0)}")
            logger.info(f"   Failed: {data.get('failed', 0)}")
            
            if data.get('failed', 0) > 0:
                logger.warning(f"   Failed device IDs: {data.get('failed_ids', [])}")
            
            return True
        else:
            logger.error(f"❌ HTTP {response.status_code}: {response.text}")
            return False
            
    except requests.exceptions.RequestException as e:
        logger.error(f"❌ Network error: {e}")
        return False
    except Exception as e:
        logger.error(f"❌ Unexpected error: {e}")
        return False

def main():
    """Main function"""
    logger.info("🚀 Starting Android notification scheduler")
    
    success = send_android_notifications()
    
    if success:
        logger.info("✅ Android notification scheduler completed successfully")
        sys.exit(0)
    else:
        logger.error("❌ Android notification scheduler failed")
        sys.exit(1)

if __name__ == "__main__":
    main()