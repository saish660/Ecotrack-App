# EcoTrack Android Notification Configuration

This document outlines the notification types and data payloads that your Android app will receive from the EcoTrack backend.

## Notification Channels

Create these notification channels in your Android app:

```java
// Main notification channel
NotificationChannel mainChannel = new NotificationChannel(
    "ecotrack_notifications",
    "EcoTrack Notifications",
    NotificationManager.IMPORTANCE_DEFAULT
);
mainChannel.setDescription("General EcoTrack notifications");
mainChannel.enableLights(true);
mainChannel.setLightColor(Color.parseColor("#4CAF50"));
mainChannel.enableVibration(true);

// Daily reminder channel
NotificationChannel dailyChannel = new NotificationChannel(
    "daily_reminders",
    "Daily Reminders",
    NotificationManager.IMPORTANCE_HIGH
);
dailyChannel.setDescription("Daily check-in reminders");

// Community channel
NotificationChannel communityChannel = new NotificationChannel(
    "community_messages",
    "Community Messages",
    NotificationManager.IMPORTANCE_DEFAULT
);
communityChannel.setDescription("Community messages and updates");

// Achievement channel
NotificationChannel achievementChannel = new NotificationChannel(
    "achievements",
    "Achievements",
    NotificationManager.IMPORTANCE_HIGH
);
achievementChannel.setDescription("Achievement notifications");
```

## Notification Types and Data Payloads

### 1. Daily Reminder Notifications

**Type**: `daily_reminder`
**Channel**: `ecotrack_notifications`

```json
{
  "notification": {
    "title": "EcoTrack Reminder",
    "body": "Time to track your eco-friendly habits! 🌱"
  },
  "data": {
    "type": "daily_reminder",
    "action": "open_app",
    "screen": "dashboard"
  }
}
```

**Android Handling**:

```java
case "daily_reminder":
    Intent intent = new Intent(this, MainActivity.class);
    intent.putExtra("screen", data.get("screen"));
    intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
    showNotification("ecotrack_notifications", title, body, intent);
    break;
```

### 2. Community Message Notifications

**Type**: `community`
**Channel**: `community_messages`

```json
{
  "notification": {
    "title": "New message in [Community Name]",
    "body": "[Username]: [Message preview...]"
  },
  "data": {
    "type": "community",
    "action": "open_community",
    "community_id": "123",
    "message_id": "456",
    "sender": "username",
    "message_type": "text"
  }
}
```

**Android Handling**:

```java
case "community":
    Intent intent = new Intent(this, CommunityActivity.class);
    intent.putExtra("community_id", data.get("community_id"));
    intent.putExtra("message_id", data.get("message_id"));
    intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
    showNotification("community_messages", title, body, intent);
    break;
```

### 3. Achievement Notifications

**Type**: `achievement`  
**Channel**: `achievements`

```json
{
  "notification": {
    "title": "Achievement Unlocked! 🏆",
    "body": "Congratulations on your eco-friendly achievement!"
  },
  "data": {
    "type": "achievement",
    "action": "open_achievements",
    "achievement_type": "streak_milestone",
    "screen": "achievements"
  }
}
```

**Android Handling**:

```java
case "achievement":
    Intent intent = new Intent(this, AchievementsActivity.class);
    intent.putExtra("achievement_type", data.get("achievement_type"));
    intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
    showNotification("achievements", title, body, intent);
    break;
```

### 4. Test Notifications

**Type**: `test`
**Channel**: `ecotrack_notifications`

```json
{
  "notification": {
    "title": "EcoTrack Test Notification",
    "body": "This is a test notification from EcoTrack! 🌱"
  },
  "data": {
    "type": "test",
    "action": "open_app",
    "screen": "dashboard",
    "timestamp": "2025-09-26T10:30:00Z"
  }
}
```

## Firebase Messaging Service Implementation

```java
public class EcoTrackMessagingService extends FirebaseMessagingService {

    private static final String TAG = "EcoTrackFCM";

    @Override
    public void onMessageReceived(RemoteMessage remoteMessage) {
        Log.d(TAG, "From: " + remoteMessage.getFrom());

        // Check if message contains notification payload
        if (remoteMessage.getNotification() != null) {
            String title = remoteMessage.getNotification().getTitle();
            String body = remoteMessage.getNotification().getBody();

            // Get data payload
            Map<String, String> data = remoteMessage.getData();
            String type = data.get("type");

            // Handle different notification types
            handleNotification(title, body, type, data);
        }
    }

    private void handleNotification(String title, String body, String type, Map<String, String> data) {
        switch (type) {
            case "daily_reminder":
                handleDailyReminder(title, body, data);
                break;
            case "community":
                handleCommunityMessage(title, body, data);
                break;
            case "achievement":
                handleAchievementNotification(title, body, data);
                break;
            case "test":
                handleTestNotification(title, body, data);
                break;
            default:
                Log.w(TAG, "Unknown notification type: " + type);
                handleDefaultNotification(title, body);
        }
    }

    private void handleDailyReminder(String title, String body, Map<String, String> data) {
        Intent intent = new Intent(this, MainActivity.class);
        intent.putExtra("screen", data.get("screen"));
        showNotification("ecotrack_notifications", title, body, intent, R.drawable.ic_eco_reminder);
    }

    private void handleCommunityMessage(String title, String body, Map<String, String> data) {
        Intent intent = new Intent(this, CommunityActivity.class);
        intent.putExtra("community_id", data.get("community_id"));
        intent.putExtra("message_id", data.get("message_id"));
        showNotification("community_messages", title, body, intent, R.drawable.ic_community);
    }

    private void handleAchievementNotification(String title, String body, Map<String, String> data) {
        Intent intent = new Intent(this, AchievementsActivity.class);
        intent.putExtra("achievement_type", data.get("achievement_type"));
        showNotification("achievements", title, body, intent, R.drawable.ic_achievement);
    }

    private void showNotification(String channelId, String title, String body, Intent intent, int iconRes) {
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this, 0, intent, PendingIntent.FLAG_ONE_SHOT | PendingIntent.FLAG_IMMUTABLE
        );

        NotificationCompat.Builder notificationBuilder =
            new NotificationCompat.Builder(this, channelId)
                .setSmallIcon(iconRes)
                .setContentTitle(title)
                .setContentText(body)
                .setAutoCancel(true)
                .setColor(ContextCompat.getColor(this, R.color.eco_green))
                .setContentIntent(pendingIntent);

        NotificationManager notificationManager =
            (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);

        int notificationId = (int) System.currentTimeMillis();
        notificationManager.notify(notificationId, notificationBuilder.build());
    }

    @Override
    public void onNewToken(String token) {
        Log.d(TAG, "Refreshed token: " + token);
        // Send token to server
        sendTokenToServer(token);
    }

    private void sendTokenToServer(String token) {
        // Update the token on your server
        // Call /api/android/register with the new token
    }
}
```

## Device Registration Format

When registering your Android device with the backend, use this JSON format:

```json
{
  "fcmToken": "your_fcm_registration_token",
  "deviceId": "unique_device_identifier",
  "deviceName": "User's Device Name",
  "deviceModel": "Samsung Galaxy S21",
  "appVersion": "1.0.0",
  "notificationTime": "09:00",
  "timezone": "America/New_York"
}
```

## Notification Settings Update Format

To update notification preferences:

```json
{
  "deviceId": "unique_device_identifier",
  "notificationTime": "10:30",
  "dailyReminders": true,
  "communityNotifications": false,
  "achievementNotifications": true,
  "timezone": "America/Los_Angeles"
}
```

## Error Handling

Handle these common FCM errors in your Android app:

```java
@Override
public void onMessageReceived(RemoteMessage remoteMessage) {
    try {
        // Process notification
        handleNotification(remoteMessage);
    } catch (Exception e) {
        Log.e(TAG, "Error processing notification", e);
        // Send error report to server if needed
    }
}

// Handle token refresh failures
@Override
public void onNewToken(String token) {
    try {
        sendTokenToServer(token);
    } catch (Exception e) {
        Log.e(TAG, "Failed to send token to server", e);
        // Retry logic here
    }
}
```

## Testing Notifications

Use the test endpoint to verify your notification handling:

```bash
curl -X POST http://localhost:8000/api/android/test-notification \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d '{"deviceId": "your_device_id"}'
```

## Best Practices

1. **Always handle token refresh** - FCM tokens can change
2. **Create appropriate notification channels** - Required for Android 8.0+
3. **Handle notification permissions** - Required for Android 13+
4. **Process notifications in background** - Don't block the main thread
5. **Implement retry logic** - For network failures during token updates
6. **Log notification events** - For debugging and analytics
7. **Respect user preferences** - Allow users to disable specific notification types
