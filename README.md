# EcoTrack - Android Native Sustainability Tracking Application

EcoTrack is a comprehensive Android native application backend designed to help users track their sustainability habits, reduce their carbon footprint, and connect with like-minded individuals in eco-friendly communities. This Django backend is specifically optimized for Android apps using Firebase Cloud Messaging (FCM) for push notifications.

## 🚀 Key Features

### 📱 Android Native Focus

- **Exclusive Android Support**: Optimized specifically for Android native applications
- **Firebase Cloud Messaging**: Native push notifications with advanced Android features
- **Device Management**: Support for multiple Android devices per user
- **Real-time Synchronization**: Seamless data sync across user's Android devices

### 🌱 Personal Sustainability Tracking

- Daily habit tracking with customizable eco-friendly activities
- Carbon footprint calculation and monitoring
- Personal sustainability score with detailed analytics
- Achievement system with push notifications for unlocked rewards
- Streak tracking to maintain daily engagement

### 🤖 AI-Powered Assistance

- Intelligent chatbot powered by Google's Gemini AI
- Personalized suggestions based on user behavior and preferences
- Dynamic survey questions that adapt to user responses
- Smart recommendations for improving sustainability practices

### 🔔 Advanced Android Notifications

- **Daily Reminders**: Scheduled notifications at user-defined times
- **Community Updates**: Real-time notifications for community messages
- **Achievement Alerts**: Instant notifications for unlocked achievements
- **Customizable Settings**: Per-device notification preferences
- **Timezone Support**: Intelligent scheduling based on device timezone

### 🏘️ Community Features

- Create and join eco-friendly communities
- Push notifications for new community messages
- Participate in community-wide sustainability challenges
- Real-time messaging with notification support
- Public and private community options

## 🏗️ Technology Stack

- **Backend**: Django 5.2.4 (Python web framework)
- **Database**: SQLite (default, easily configurable to PostgreSQL/MySQL)
- **Push Notifications**: Firebase Cloud Messaging (FCM) for Android
- **AI Integration**: Google Gemini AI for intelligent responses
- **Authentication**: Django's built-in authentication system
- **Device Management**: Custom AndroidDevice model for multi-device support

## 🛠️ Quick Start Guide

### Prerequisites

- Python 3.8 or higher
- Firebase project with FCM enabled
- Android development environment (for client app)

### Installation Steps

1. **Navigate to the project directory:**

   ```bash
   cd ecotrack
   ```

2. **Install dependencies:**

   ```bash
   pip install -r requirements.txt
   ```

3. **Set up Firebase (required for Android notifications):**

   - Create a Firebase project at [Firebase Console](https://console.firebase.google.com/)
   - Enable Cloud Messaging
   - Download the service account key JSON file
   - Place it as `ecotrack-fcm-firebase-adminsdk-*.json` in the project root

4. **Configure environment variables:**
   Create a `.env` file in the project root:

   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   FIREBASE_API_KEY=your_firebase_api_key
   FIREBASE_PROJECT_ID=your_project_id
   FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   FIREBASE_APP_ID=your_app_id
   CRON_SECRET=your_secure_random_token
   ```

5. **Set up the database:**

   ```bash
   python manage.py makemigrations
   python manage.py migrate
   ```

6. **Create a superuser (optional):**

   ```bash
   python manage.py createsuperuser
   ```

7. **Start the server:**

   ```bash
   python manage.py runserver
   ```

8. **Set up Android notifications (optional):**
   ```bash
   python android_notification_scheduler.py
   ```

### 🌐 Access Points

- **Main Application**: `http://localhost:8000`
- **Admin Panel**: `http://localhost:8000/admin`
- **Android Integration Guide**: `http://localhost:8000/android-guide`

## 📱 Android Integration

### API Endpoints for Android Apps

- `POST /api/android/register` - Register Android device
- `POST /api/android/update-settings` - Update notification preferences
- `POST /api/android/test-notification` - Send test notification
- `GET /api/android/devices` - Get registered devices

### Sample Android Integration

```java
// Register device with FCM token
JSONObject deviceData = new JSONObject();
deviceData.put("fcmToken", fcmToken);
deviceData.put("deviceId", deviceId);
deviceData.put("deviceName", "My Phone");
deviceData.put("notificationTime", "09:00");
deviceData.put("timezone", "America/New_York");

// Send POST request to /api/android/register
```

## 🔔 Notification System

### Automated Scheduling

For production deployment, set up automated notifications:

**Using Cron-Job.org (Recommended):**

1. Visit [cron-job.org](https://cron-job.org)
2. Create a cron job that calls:
   - **URL**: `https://yourdomain.com/api/cron/dispatch?token=YOUR_CRON_SECRET`
   - **Schedule**: Every minute

### Notification Types

- **Daily Reminders**: Personalized check-in reminders
- **Community Messages**: Real-time community notifications
- **Achievement Alerts**: Celebration of user milestones
- **System Updates**: Important announcements

## 🎯 Key Changes from Web Version

### ✅ Android-Focused Features

- Native FCM integration with Android-specific configuration
- Multi-device support for Android users
- Timezone-aware notification scheduling
- Device-specific notification preferences
- Android notification channels and priorities

### ❌ Removed Web Features

- Web push notifications (replaced with Android FCM)
- Browser-specific notification APIs
- Web app manifest and service workers
- Progressive Web App (PWA) features

## 📊 Database Models

### AndroidDevice Model

- **User Association**: Links to Django User model
- **Device Info**: FCM token, device ID, model, app version
- **Notification Preferences**: Time, timezone, channel preferences
- **Activity Tracking**: Last seen, registration date

## 🔧 Development Notes

### Firebase Configuration

All notifications are optimized for Android with:

- High priority delivery
- Custom notification channels (`ecotrack_notifications`)
- Rich notification content with icons and colors
- Action buttons for user interaction
- Collapse keys for message grouping

### AI Integration

- **Note**: Due to high demand of the Gemini API, AI features might be rate-limited during peak hours
- Consider implementing API key rotation for production use
- Monitor API usage and implement fallback responses

## 🚀 Deployment

### Production Checklist

- [ ] Configure Firebase production project
- [ ] Set secure environment variables
- [ ] Set up automated notification cron job
- [ ] Configure proper domain and SSL
- [ ] Monitor FCM delivery rates
- [ ] Implement error logging and monitoring

## 📞 Support

For Android integration support:

1. Visit `/android-guide` for detailed integration instructions
2. Check the admin panel at `/admin` for device management
3. Test notifications using the test endpoint
4. Monitor logs for FCM delivery issues

## 🤝 Contributing

This project is specifically focused on Android native applications. When contributing:

- Ensure changes maintain Android compatibility
- Test with actual Android devices and FCM
- Follow Android notification best practices
- Update documentation for Android-specific features
