# EcoTrack Android Notifications - Complete Server-Side Storage System

## Overview

EcoTrack has been completely refactored to handle Android native applications using Firebase Cloud Messaging (FCM) with **complete server-side storage**. This means:

- ✅ **NO device-side subscription loading**
- ✅ All device information stored on Django server
- ✅ All notification preferences managed server-side
- ✅ Comprehensive device tracking and analytics
- ✅ Enhanced reliability and centralized management

## Key Features

### 🗄️ Complete Server-Side Data Storage

All subscription and device data is stored in the Django database using the enhanced `AndroidDevice` model:

#### Device Information (Server-Stored)

```python
# Device Hardware & Software Details
- device_id: Unique Android device identifier
- device_name: User-friendly device name
- device_model: Device model (e.g., "Pixel 7", "Galaxy S23")
- manufacturer: Device manufacturer (e.g., "Google", "Samsung")
- android_version: Android OS version (e.g., "13", "14")
- app_version: EcoTrack app version
- screen_density: Screen density (hdpi, xhdpi, etc.)
- language: Device language preference
```

#### Notification Configuration (Server-Stored)

```python
# All notification settings managed server-side
- notification_time: Daily reminder time
- timezone: User's timezone
- daily_reminders_enabled: Daily check-in reminders
- community_notifications_enabled: Community updates
- achievement_notifications_enabled: Achievement alerts
- system_notifications_enabled: App updates & maintenance
```

#### Analytics & Tracking (Server-Stored)

```python
# Comprehensive server-side analytics
- total_notifications_sent: Total notification count
- last_notification_sent: Last notification timestamp
- token_refresh_count: FCM token refresh tracking
- token_last_updated: Token last update timestamp
- last_seen: Device last activity
- created_at/updated_at: Registration & update times
```

### 📱 Enhanced AndroidDevice Model

The `AndroidDevice` model provides comprehensive methods for server-side management:

#### Core Methods

```python
# Device Management
device.get_device_info()           # Complete device information
device.get_notification_preferences() # All notification settings
device.has_valid_fcm_token()       # Token validation
device.update_last_seen()          # Activity tracking
device.update_fcm_token(new_token) # Token refresh management
device.increment_notification_count() # Analytics tracking

# Scheduling (Server-Side Logic)
device.is_scheduled_for_notification(time, date) # Server-side scheduling
```

### 🔧 API Endpoints

#### Device Registration

```http
POST /api/register-android-device/
Content-Type: application/json

{
  "fcmToken": "string",
  "deviceId": "string",
  "deviceName": "My Phone",
  "deviceModel": "Pixel 7",
  "manufacturer": "Google",
  "androidVersion": "13",
  "appVersion": "1.2.0",
  "screenDensity": "xxhdpi",
  "language": "en",
  "notificationTime": "09:00",
  "timezone": "America/New_York",
  "dailyRemindersEnabled": true,
  "communityNotificationsEnabled": true,
  "achievementNotificationsEnabled": true,
  "systemNotificationsEnabled": true
}
```

**Response includes complete server-stored data:**

```json
{
  "status": "success",
  "fcm_token_updated": false,
  "data": {
    "device_id": "unique_device_id",
    "database_id": 123,
    "device_info": {
      "device_name": "My Phone",
      "device_model": "Pixel 7",
      "manufacturer": "Google",
      "android_version": "13",
      "app_version": "1.2.0",
      "language": "en",
      "screen_density": "xxhdpi"
    },
    "notification_preferences": {
      "daily_reminders": true,
      "community_notifications": true,
      "achievement_notifications": true,
      "system_notifications": true,
      "notification_time": "09:00",
      "timezone": "America/New_York"
    },
    "statistics": {
      "total_notifications_sent": 0,
      "token_refresh_count": 0,
      "token_last_updated": null
    }
  },
  "note": "All device and subscription data stored server-side. No device-side subscription loading required."
}
```

#### Device Management

```http
GET /api/android-devices/
```

**Returns comprehensive device list:**

```json
{
  "status": "success",
  "data": {
    "devices": [
      {
        "deviceId": "unique_device_id",
        "databaseId": 123,
        "isActive": true,
        "deviceInfo": {
          /* Complete device info */
        },
        "notificationPreferences": {
          /* All preferences */
        },
        "statistics": {
          "totalNotificationsSent": 45,
          "tokenRefreshCount": 2,
          "registrationDate": "2024-01-01T00:00:00Z",
          "lastUpdated": "2024-01-15T10:30:00Z",
          "lastSeen": "2024-01-15T14:22:33Z"
        },
        "scheduling": {
          "lastSentDate": "2024-01-15",
          "lastSentTime": "09:00"
        },
        "hasValidToken": true
      }
    ],
    "totalDevices": 1,
    "activeDevices": 1
  },
  "serverSideStorage": true,
  "note": "All device data and subscription details are stored server-side. No device-side subscription loading required."
}
```

### 🔄 Notification Scheduling (Server-Side)

The cron dispatcher (`/api/cron/dispatch`) manages all scheduling server-side:

#### Features:

- ✅ Server-side time zone handling
- ✅ Deduplication logic (no duplicate notifications)
- ✅ Enhanced device tracking and analytics
- ✅ Comprehensive delivery reporting

#### Scheduling Logic:

```python
# All scheduling decisions made server-side
def is_scheduled_for_notification(self, current_time, current_date):
    if not self.is_active or not self.daily_reminders_enabled:
        return False

    # Deduplication check
    if (self.last_sent_date == current_date and
        self.last_sent_time == current_time):
        return False

    # Time matching
    return (self.notification_time.hour == current_time.hour and
            self.notification_time.minute == current_time.minute)
```

### 🎨 Frontend Integration

The frontend (`android_notifications.js`) loads all data from the server:

#### Key Features:

- ✅ No browser notification API dependencies
- ✅ Complete server-side data loading
- ✅ Real-time device management interface
- ✅ Comprehensive preference management
- ✅ Device statistics and analytics display

#### Example Usage:

```javascript
// AndroidNotificationManager automatically loads all data from server
const manager = new AndroidNotificationManager();
await manager.init(); // Loads all device data from /api/android-devices/

// All device information comes from server
manager.displayDevices(); // Shows comprehensive device list
manager.updatePreferences(deviceId, prefs); // Updates server-stored preferences
```

### 🔧 Database Schema

The enhanced `AndroidDevice` model includes comprehensive indexing:

```sql
-- Optimized indexes for server-side operations
CREATE INDEX ecotrack_an_user_id_9e11f6_idx ON androiddevice (user_id, is_active);
CREATE INDEX ecotrack_an_fcm_tok_075350_idx ON androiddevice (fcm_token);
CREATE INDEX ecotrack_an_notific_8acedc_idx ON androiddevice (notification_time, timezone);
CREATE INDEX ecotrack_an_last_se_782359_idx ON androiddevice (last_sent_date, last_sent_time);
```

### 🚀 Benefits of Server-Side Storage

1. **Reliability**: No dependency on device-side subscription state
2. **Centralized Management**: All devices managed from Django admin
3. **Analytics**: Comprehensive tracking and reporting
4. **Scalability**: Server-optimized for multiple devices per user
5. **Debugging**: Complete audit trail of device and notification activity
6. **Security**: Server-side validation and token management
7. **Consistency**: Unified notification preferences across devices

### 📊 Migration from Web Push

The system has been completely migrated from web push notifications:

#### Replaced Components:

- ❌ `PushSubscription` model → ✅ `AndroidDevice` model
- ❌ Web push service worker → ✅ FCM native Android
- ❌ Device-side subscription management → ✅ Server-side storage
- ❌ Browser notification APIs → ✅ Native Android notifications

#### Enhanced Features:

- ✅ Multi-device support per user
- ✅ Rich notification content (images, actions, channels)
- ✅ Advanced scheduling and timezone support
- ✅ Comprehensive device analytics
- ✅ Firebase token refresh handling
- ✅ Native Android notification channels

## Testing & Verification

### Server Testing:

```bash
# Test device registration
curl -X POST http://127.0.0.1:8000/api/register-android-device/ \
  -H "Content-Type: application/json" \
  -d '{"fcmToken": "test_token", "deviceId": "test_device"}'

# Test device listing
curl http://127.0.0.1:8000/api/android-devices/
```

### Django Admin:

Visit `http://127.0.0.1:8000/admin/ecotrack/androiddevice/` to manage devices with comprehensive server-side data.

## Conclusion

EcoTrack now provides a complete **server-side storage system** for Android notifications:

- 🎯 **Zero device-side dependencies**
- 🗄️ **Complete server-side data management**
- 📱 **Native Android FCM integration**
- 📊 **Comprehensive analytics and tracking**
- 🔧 **Centralized device management**
- 🚀 **Scalable and reliable architecture**

All subscription details, device information, and notification preferences are now stored and managed exclusively on the Django server, providing a robust and maintainable notification system for Android applications.
