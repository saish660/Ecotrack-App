#!/usr/bin/env python
"""
Test script for EcoTrack Android API endpoints.
This script demonstrates how to interact with the Android-specific API endpoints.

Usage:
    python test_android_api.py

Make sure the Django server is running before executing this script.
"""

import requests
import json
import uuid
from datetime import datetime

# Configuration
BASE_URL = "http://localhost:8000"
USERNAME = "testuser"
PASSWORD = "testpass123"

class EcoTrackAndroidTester:
    def __init__(self, base_url):
        self.base_url = base_url
        self.session = requests.Session()
        self.csrf_token = None
        self.device_id = str(uuid.uuid4())
        
    def get_csrf_token(self):
        """Get CSRF token from the server"""
        response = self.session.get(f"{self.base_url}/accounts")
        # Extract CSRF token from cookies
        self.csrf_token = self.session.cookies.get('csrftoken')
        return self.csrf_token
    
    def login(self, username, password):
        """Login to get authenticated session"""
        print(f"🔐 Logging in as {username}...")
        
        # Get CSRF token first
        self.get_csrf_token()
        
        login_data = {
            'username': username,
            'password': password,
            'csrfmiddlewaretoken': self.csrf_token
        }
        
        response = self.session.post(
            f"{self.base_url}/login",
            data=login_data,
            headers={'Referer': f"{self.base_url}/accounts"}
        )
        
        if response.status_code == 200:
            print("✅ Login successful")
            return True
        else:
            print(f"❌ Login failed: {response.status_code}")
            return False
    
    def register_android_device(self):
        """Test Android device registration"""
        print("\n📱 Testing Android device registration...")
        
        device_data = {
            'fcmToken': f'fake_fcm_token_{self.device_id}',
            'deviceId': self.device_id,
            'deviceName': 'Test Android Device',
            'deviceModel': 'Samsung Galaxy Test',
            'appVersion': '1.0.0',
            'notificationTime': '09:00',
            'timezone': 'America/New_York'
        }
        
        response = self.session.post(
            f"{self.base_url}/api/android/register",
            data=json.dumps(device_data),
            headers={
                'Content-Type': 'application/json',
                'X-CSRFToken': self.csrf_token
            }
        )
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Device registered: {result['message']}")
            return True
        else:
            print(f"❌ Device registration failed: {response.status_code} - {response.text}")
            return False
    
    def get_android_devices(self):
        """Test getting user's Android devices"""
        print("\n📋 Testing get Android devices...")
        
        response = self.session.get(f"{self.base_url}/api/android/devices")
        
        if response.status_code == 200:
            result = response.json()
            devices = result['data']['devices']
            print(f"✅ Found {len(devices)} registered device(s)")
            for device in devices:
                print(f"   📱 {device['deviceName']} ({device['deviceModel']}) - Active: {device['isActive']}")
            return True
        else:
            print(f"❌ Failed to get devices: {response.status_code} - {response.text}")
            return False
    
    def update_notification_settings(self):
        """Test updating notification settings"""
        print("\n⚙️ Testing notification settings update...")
        
        settings_data = {
            'deviceId': self.device_id,
            'notificationTime': '10:30',
            'dailyReminders': True,
            'communityNotifications': False,
            'achievementNotifications': True,
            'timezone': 'America/Los_Angeles'
        }
        
        response = self.session.post(
            f"{self.base_url}/api/android/update-settings",
            data=json.dumps(settings_data),
            headers={
                'Content-Type': 'application/json',
                'X-CSrfToken': self.csrf_token
            }
        )
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Settings updated: {result['message']}")
            return True
        else:
            print(f"❌ Settings update failed: {response.status_code} - {response.text}")
            return False
    
    def test_notification(self):
        """Test sending a notification"""
        print("\n🔔 Testing notification sending...")
        
        test_data = {
            'deviceId': self.device_id
        }
        
        response = self.session.post(
            f"{self.base_url}/api/android/test-notification",
            data=json.dumps(test_data),
            headers={
                'Content-Type': 'application/json',
                'X-CSRFToken': self.csrf_token
            }
        )
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Test notification result: {result['message']}")
            return True
        else:
            print(f"❌ Test notification failed: {response.status_code} - {response.text}")
            return False
    
    def send_achievement_notification(self):
        """Test sending achievement notification"""
        print("\n🏆 Testing achievement notification...")
        
        achievement_data = {
            'achievementType': 'streak_milestone',
            'title': 'Test Achievement Unlocked!',
            'message': 'You have completed 7 days of eco-friendly habits! 🌱'
        }
        
        response = self.session.post(
            f"{self.base_url}/api/android/send-achievement",
            data=json.dumps(achievement_data),
            headers={
                'Content-Type': 'application/json',
                'X-CSRFToken': self.csrf_token
            }
        )
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Achievement notification: {result['message']}")
            return True
        else:
            print(f"❌ Achievement notification failed: {response.status_code} - {response.text}")
            return False
    
    def unregister_device(self):
        """Test device unregistration"""
        print("\n🗑️ Testing device unregistration...")
        
        unregister_data = {
            'deviceId': self.device_id
        }
        
        response = self.session.post(
            f"{self.base_url}/api/android/unregister",
            data=json.dumps(unregister_data),
            headers={
                'Content-Type': 'application/json',
                'X-CSRFToken': self.csrf_token
            }
        )
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Device unregistered: {result['message']}")
            return True
        else:
            print(f"❌ Device unregistration failed: {response.status_code} - {response.text}")
            return False
    
    def run_all_tests(self, username, password):
        """Run all Android API tests"""
        print("🚀 Starting EcoTrack Android API Tests")
        print("="*50)
        
        # Login first
        if not self.login(username, password):
            print("❌ Cannot proceed without authentication")
            return False
        
        # Run tests in sequence
        tests = [
            self.register_android_device,
            self.get_android_devices,
            self.update_notification_settings,
            self.get_android_devices,  # Check updated settings
            self.test_notification,
            self.send_achievement_notification,
            self.unregister_device,
            self.get_android_devices,  # Verify unregistration
        ]
        
        passed = 0
        failed = 0
        
        for test in tests:
            try:
                if test():
                    passed += 1
                else:
                    failed += 1
            except Exception as e:
                print(f"❌ Test failed with exception: {e}")
                failed += 1
        
        print("\n" + "="*50)
        print(f"📊 Test Results: {passed} passed, {failed} failed")
        
        if failed == 0:
            print("🎉 All tests passed! Android API is working correctly.")
        else:
            print("⚠️ Some tests failed. Check the error messages above.")
        
        return failed == 0

def main():
    """Main function"""
    print("EcoTrack Android API Tester")
    print("This script tests the Android-specific API endpoints.")
    print("Make sure the Django server is running at http://localhost:8000\n")
    
    # You may need to create a test user first
    print("Note: Make sure you have a test user account or create one through the web interface.")
    username = input(f"Username (default: {USERNAME}): ").strip() or USERNAME
    password = input(f"Password (default: {PASSWORD}): ").strip() or PASSWORD
    
    tester = EcoTrackAndroidTester(BASE_URL)
    success = tester.run_all_tests(username, password)
    
    if success:
        print("\n✅ All Android API endpoints are working correctly!")
    else:
        print("\n❌ Some endpoints failed. Check the server logs for more details.")

if __name__ == "__main__":
    main()