# EcoTrack App

## Android app

Download the Android app using this Google Drive link:

[EcoTrack.apk](https://drive.google.com/file/d/1uIUgvnXMGl8LPZDOL1cv2e0vcn6fQNv7/view?usp=sharing)

## Setting up the WebApp locally

#### _The webapp version doesn't support notifications and is designed for mobile screens only._

_EcoTrack is best used as a mobile app_

## Prerequisites

- Python 3.10+ & pip

## Installation

1. Install dependencies: `pip install -r requirements.txt`

2. Create and apply database migrations:

   - `python manage.py makemigrations`
   - `python manage.py migrate`

3. Create an admin user (optional but recommended): `python manage.py createsuperuser`

4. Create a .env file and store the firebase, gemini and cron keys (optional): `GEMINI_API_KEY, FIREBASE_API_KEY,FIREBASE_AUTH_DOMAIN, FIREBASE_PROJECT_ID, FIREBASE_STORAGE_BUCKET, FIREBASE_MESSAGING_SENDER_ID, FIREBASE_APP_ID, FIREBASE_VAPID_KEY, CRON_SECRET`

5. Start the development server: `python manage.py runserver 8000`

```
AI features and notifications will not work without the required keys.
```

## Next Steps

- Visit `http://127.0.0.1:8000/` to verify the app loads.

## Completing the setup

- Keep environment variables (Firebase, web push keys, etc.) in a `.env` file and update `DjangoProject/settings.py` to load them if needed.
- For push notifications, ensure the Firebase credential JSON and VAPID keys in `DjangoProject/` are correctly configured.
