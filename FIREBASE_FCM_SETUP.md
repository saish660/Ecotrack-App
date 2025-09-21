# Firebase FCM Setup Guide for EcoTrack

This guide walks you through setting up Firebase Cloud Messaging (FCM) for EcoTrack.

## Prerequisites

1. Google account
2. Access to Firebase Console (https://console.firebase.google.com)

## Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click "Create a project" or "Add project"
3. Enter project name: `ecotrack-push-notifications`
4. Enable/disable Google Analytics as needed
5. Click "Create project"

## Step 2: Enable Cloud Messaging

1. In your Firebase project console, click on "Cloud Messaging" in the left sidebar
2. If prompted, click "Get started"

## Step 3: Get Firebase Configuration

1. In Project Settings (gear icon), go to "General" tab
2. Scroll down to "Your apps" section
3. Click "Web app" icon (</>)
4. Enter app nickname: `ecotrack-web`
5. Check "Also set up Firebase Hosting for this app" (optional)
6. Click "Register app"
7. Copy the Firebase configuration object - you'll need this for the frontend

Example configuration (you'll get your own):

```javascript
const firebaseConfig = {
  apiKey: "your-api-key",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "your-app-id",
};
```

## Step 4: Generate Service Account Key

1. In Project Settings, go to "Service accounts" tab
2. Click "Generate new private key"
3. Click "Generate key" - this will download a JSON file
4. Save this JSON file as `firebase-service-account.json` in your Django project root
5. **Important**: Add this file to your `.gitignore` to keep it secure

## Step 5: Add Firebase Service Account to Django

1. Place the `firebase-service-account.json` file in your Django project root directory
2. Update your Django settings.py to include the Firebase configuration
3. Add these environment variables to your `.env` file:

```env
# Firebase configuration for web frontend
FIREBASE_API_KEY=your-api-key-here
FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_STORAGE_BUCKET=your-project.appspot.com
FIREBASE_MESSAGING_SENDER_ID=123456789
FIREBASE_APP_ID=your-app-id
FIREBASE_VAPID_KEY=your-vapid-key-here
```

4. To get the VAPID key for your project:
   - Go to Project Settings → Cloud Messaging
   - In the "Web configuration" section, generate or find your Web Push certificates
   - Copy the "Key pair" value - this is your VAPID key

## Security Notes

- Never commit your service account key to version control
- Keep your Firebase configuration secure
- Consider using environment variables for production
- Restrict API keys in Firebase Console for production use

## Next Steps

After completing these steps, you can proceed with updating the Django code to use Firebase FCM instead of the current web push implementation.
