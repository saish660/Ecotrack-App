from datetime import datetime, timedelta, time, date
from django.contrib.auth.decorators import login_required
from django.shortcuts import render
from django.http import JsonResponse, HttpResponseRedirect
from django.views.decorators.csrf import csrf_protect, csrf_exempt
from django.views.decorators.http import require_http_methods
from .models import User, Community, CommunityMembership, CommunityMessage, CommunityTask, TaskParticipation, AndroidDevice
from django.db import IntegrityError
from django.contrib.auth import login, authenticate, logout
from django.urls import reverse
from .utils import *
from uuid import uuid4
from google import genai
from django.db.models import Q, Count
from django.core.paginator import Paginator
from django.views.decorators.http import require_GET
from django.conf import settings
from django.utils import timezone
from .firebase_service import FCMService
import pytz
import logging
from django.utils import timezone

logger = logging.getLogger(__name__)


def _safe_float(value, default=None):
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _shift_month(date_obj: date, offset: int) -> date:
    month = date_obj.month - 1 + offset
    year = date_obj.year + month // 12
    month = month % 12 + 1
    return date(year, month, 1)


def _normalize_footprint_entry(entry):
    if isinstance(entry, dict):
        value = entry.get("value")
        recorded_at = entry.get("recorded_at")
    else:
        value = entry
        recorded_at = None

    normalized_value = round(_safe_float(value, 0.0) or 0.0, 2)

    normalized_recorded_at = None
    if recorded_at:
        if isinstance(recorded_at, (datetime, date)):
            normalized_recorded_at = recorded_at.isoformat()
        else:
            try:
                normalized_recorded_at = (
                    datetime.fromisoformat(str(recorded_at)).date().isoformat()
                )
            except ValueError:
                normalized_recorded_at = None

    return {
        "value": normalized_value,
        "recorded_at": normalized_recorded_at,
    }


def _coerce_to_date(value):
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date()
    return value


def _streak_has_lapsed(last_checkin_date, today=None):
    if today is None:
        today = timezone.localdate()
    if not last_checkin_date:
        return False
    return last_checkin_date < (today - timedelta(days=1))


def get_carbon_footprint_history(user):
    raw_history = user.last_8_footprint_measurements or []
    normalized_history = [
        _normalize_footprint_entry(entry) for entry in raw_history if entry is not None
    ]
    normalized_history = normalized_history[-8:]

    if normalized_history:
        if len(normalized_history) == 1:
            entry = normalized_history[0]
            if entry.get("recorded_at"):
                try:
                    base_date = datetime.fromisoformat(entry["recorded_at"]).date()
                except ValueError:
                    base_date = timezone.localdate().replace(day=1)
            else:
                base_date = timezone.localdate().replace(day=1)
            synthetic_month = _shift_month(base_date, -1)
            normalized_history.insert(
                0,
                {
                    "value": entry["value"],
                    "recorded_at": synthetic_month.isoformat(),
                },
            )
        return normalized_history

    baseline = _safe_float(user.carbon_footprint, None)
    if baseline is None or baseline <= 0:
        return []

    today = timezone.localdate().replace(day=1)
    seed_months = 4
    seeded_history = []
    for offset in range(-(seed_months - 1), 1):
        month_date = _shift_month(today, offset)
        seeded_history.append(
            {
                "value": round(baseline, 2),
                "recorded_at": month_date.isoformat(),
            }
        )

    return seeded_history


def update_latest_values(user, new_value, recorded_at=None):
    history = [
        _normalize_footprint_entry(entry)
        for entry in (user.last_8_footprint_measurements or [])
    ]
    history.append(
        _normalize_footprint_entry(
            {
                "value": new_value,
                "recorded_at": recorded_at or timezone.localdate().isoformat(),
            }
        )
    )
    return history[-8:]

@login_required
def index(request):
    if not request.user.survey_answered or request.user.days_since_last_survey > 7:
        if request.user.days_since_last_survey > 7:
            request.user.days_since_last_survey = 0
            request.user.save()
        return HttpResponseRedirect(reverse('survey'))
    return render(request, "index.html")


def android_guide(request):
    """Display the Android app integration guide"""
    return render(request, "android_guide.html")


def accounts(request):
    return render(request, "accounts.html")


@csrf_protect
@require_http_methods(["POST"])
def signup(request):
    try:
        data = json.loads(request.body)
        email = data.get('email')
        password = data.get('password')

        if not email or not password:
            return JsonResponse({
                'status': 'error',
                'message': 'Email and password are required'
            }, status=400)

        username = email.split('@')[0]

        try:
            user = User.objects.create_user(
                username=username,
                email=email,
                password=password
            )

            user.sustainability_score = 0
            user.carbon_footprint = 0
            user.streak = 0
            user.survey_answered = False
            user.save()

            login(request, user)

            # The view now returns a simple success status.
            # The redirect logic is handled entirely by the frontend.
            return JsonResponse({
                'status': 'success',
                'message': 'User created successfully'
            })

        except IntegrityError:
            return JsonResponse({
                'status': 'error',
                'message': 'A user with this email already exists'
            }, status=400)

    except json.JSONDecodeError:
        return JsonResponse({
            'status': 'error',
            'message': 'Invalid JSON data'
        }, status=400)
    except Exception as e:
        return JsonResponse({
            'status': 'error',
            'message': str(e)
        }, status=500)


@csrf_protect
@require_http_methods(["POST"])
def login_view(request):
    try:
        data = json.loads(request.body)
        email = data.get('email')
        password = data.get('password')

        if not email or not password:
            return JsonResponse({'status': 'error', 'message': 'Email and password are required'}, status=400)

        # Since you use email to log in, we first find the user by their email
        # to get their username, which is what Django's authenticate function uses.
        try:
            user_obj = User.objects.get(email=email)
            user = authenticate(request, username=user_obj.username, password=password)
        except User.DoesNotExist:
            user = None

        if user is not None:
            login(request, user)
            return JsonResponse({
                'status': 'success',
                'message': 'Logged in successfully',
                'redirect_url': reverse('index')  # Redirect to the main page on success
            })
        else:
            return JsonResponse({'status': 'error', 'message': 'Invalid email or password'})

    except json.JSONDecodeError:
        return JsonResponse({'status': 'error', 'message': 'Invalid JSON data'}, status=400)
    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)}, status=500)


@login_required
def logout_view(request):
    logout(request)
    return HttpResponseRedirect(reverse('accounts'))


@login_required
def survey(request):
    if request.method == 'POST':
        user = request.user
        data = json.loads(request.body)
        if data.get('skip'):
            user.user_data = {}
            user.survey_answered = True
            user.survey_skipped = True
            user.carbon_footprint = []
            user.sustainability_score = 0
            user.last_8_footprint_measurements = []
            user.save(update_fields=[
                'user_data',
                'survey_answered',
                'survey_skipped',
                'carbon_footprint',
                'sustainability_score',
                'last_8_footprint_measurements',
            ])
            return JsonResponse({'status': 'success', 'message': 'Survey skipped successfully'}, status=200)

        user.user_data = data
        user.survey_answered = True
        user.survey_skipped = False
        footprint_value = calculate_personal_carbon_footprint(data)['summary']['personal_monthly_co2e_kg']
        user.carbon_footprint = footprint_value
        user.sustainability_score = calculate_initial_sustainability_score(user.user_data)[
            'initial_sustainability_score']
        user.last_8_footprint_measurements = update_latest_values(user, footprint_value)
        user.save()
        return JsonResponse({'status': 'success', 'message': 'Survey submitted successfully'}, status=200)

    if request.user.survey_answered and not request.user.survey_skipped:
        return HttpResponseRedirect(reverse('index'))
    return render(request, "survey_form.html")


@login_required
def get_user_data(request):
    today = timezone.localdate()
    last_checkin_date = _coerce_to_date(request.user.last_checkin)
    fields_to_update = []

    if _streak_has_lapsed(last_checkin_date, today) and request.user.streak != 0:
        request.user.streak = 0
        fields_to_update.append('streak')

    if not last_checkin_date or last_checkin_date < today:
        if request.user.habits_today != 0:
            request.user.habits_today = 0
            fields_to_update.append('habits_today')

    if fields_to_update:
        request.user.save(update_fields=fields_to_update)

    requires_survey = (not request.user.survey_answered) or request.user.survey_skipped
    survey_prompt = "submit survey"

    return JsonResponse({'status': 'success', 'data': {
        "username": request.user.username,
        "streak": request.user.streak,
        "carbon_footprint": request.user.carbon_footprint,
        "sustainability_score": request.user.sustainability_score,
        "habits": request.user.habits,
        "last_checkin_date": request.user.last_checkin,
        "habits_today": request.user.habits_today,
        "achievements": request.user.achievements,
        "last_8_footprints": get_carbon_footprint_history(request.user),
        "requires_survey": requires_survey,
        "survey_prompt": survey_prompt,
        "survey_skipped": request.user.survey_skipped,
    }})


@login_required
def save_habit(request):
    data = json.loads(request.body)
    habit_id = uuid4()
    habit = {
        "id": str(habit_id.int)[:5],
        "text": data.get('habit_text')
    }
    request.user.habits.append(habit)
    request.user.save()
    return JsonResponse({'status': 'success', 'message': 'Habit saved successfully'})


@login_required
def update_habit(request):
    data = json.loads(request.body)
    habit_id_to_update = str(data.get('habit_id'))  # This is the 'id' within the habit dictionary
    new_habit_text = data.get('habit_text')

    # Find the habit by its 'id' in the list
    found = False
    for habit in request.user.habits:
        if habit.get('id') == habit_id_to_update:
            habit['text'] = new_habit_text
            found = True
            break  # Exit loop once the habit is found and updated

    if found:
        request.user.save()  # Save the user object to persist changes to the habits list
        return JsonResponse({'status': 'success', 'message': 'Habit updated successfully'})
    else:
        return JsonResponse({'status': 'error', 'message': 'Habit not found'}, status=500)


@login_required
def delete_habit(request):
    data = json.loads(request.body)
    habit_id_to_delete = str(data.get('habit_id'))  # Ensure it's a string for comparison

    # Create a new list excluding the habit to be deleted
    # This is a common and safe way to remove items from a list while iterating
    initial_habits_count = len(request.user.habits)
    request.user.habits = [
        habit for habit in request.user.habits
        if habit.get('id') != habit_id_to_delete
    ]

    if len(request.user.habits) < initial_habits_count:
        request.user.save()  # Save changes if a habit was actually removed
        return JsonResponse({'status': 'success', 'message': 'Habit deleted successfully'})
    else:
        return JsonResponse({'status': 'error', 'message': 'Habit not found'}, status=404)


@login_required
def get_questions(request):
    if request.method != "POST":
        return HttpResponseRedirect(reverse('index'))

    sample_questions = [
        {
            "id": "q1",
            "question": "How did you commute today?",
            "options": [
                {"text": "🚶 Walk/Cycle", "value": "Walk/Cycle"},
                {"text": "🚌 Public Transport", "value": "Public Transport"},
                {"text": "🚗 Car (single)", "value": "Car (single)"},
                {"text": "👥 Car (carpool)", "value": "Car (carpool)"},
            ],
        },
        {
            "id": "q2",
            "question": "Did you consume meat today?",
            "options": [
                {"text": "🥩 Yes", "value": "Yes"},
                {"text": "🥬 No (or Plant-based)", "value": "No"},
            ],
        },
        {
            "id": "q3",
            "question": "Did you unplug unused electronics?",
            "options": [
                {"text": "✅ Yes, all", "value": "Yes, all"},
                {"text": "⚡ Some", "value": "Some"},
                {"text": "❌ No", "value": "No"},
            ],
        },
    ]

    client = genai.Client()

    prompt = f"""
    Give me a few questions based on user's habits to access their habits which they created to reduce carbon footprint.
     **Do not include any explanations, formatting, double quotes or backticks and make sure there is atleast one question related to each habit.
      Only provide a raw RFC8259 compliant JSON array.
     ** Here is an output example: {sample_questions}
     ** Here is the list of user's habits: {request.user.habits}
    """

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
    )

    return JsonResponse({'status': 'success', 'data': json.loads(response.text)})

@login_required
def submit_questionnaire(request):
    if request.method != "POST":
        return HttpResponseRedirect(reverse('index'))

    data = json.loads(request.body)
    client = genai.Client()

    sample_output = {
        "score": 5
    }

    prompt = f"""
    Given data of survey conducted on a user's habits to access their habits which they created to reduce carbon footprint.
    Give each response to question a score of 1 if the response helps their goal(reduce carbon footprint) and 0 if it does not.
    Return the total score of the survey in JSON format
     **Do not include any explanations, formatting, or backticks and make sure there is atleast one question related to each habit.
      Only provide a raw RFC8259 compliant JSON array.
      ** Here is the data: {data}
     ** Here is an output example: {sample_output}
    """

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
    )

    score = int(json.loads(response.text)['score'])

    if score:
        request.user.sustainability_score += score
    else:
        request.user.sustainability_score += 1

    today = timezone.localdate()
    last_checkin_date = _coerce_to_date(request.user.last_checkin)

    if last_checkin_date == today:
        pass  # duplicate submission in one day shouldn't change streak
    elif _streak_has_lapsed(last_checkin_date, today) or not last_checkin_date:
        request.user.streak = 1
    else:
        request.user.streak += 1

    request.user.last_checkin = timezone.now()
    request.user.days_since_last_survey += 1
    request.user.habits_today = score
    request.user.achievements += check_achievements(request.user)
    request.user.achievements = list(set(request.user.achievements))
    request.user.save()

    return JsonResponse({'status': 'success', 'message': 'Questionnaire submitted successfully'})


@login_required
def get_suggestions(request):
    sample_suggestions = [
        {
            "title": "Reduce Meat Consumption",
            "reason":
                "Producing meat requires significant resources. Opting for plant-based meals reduces your environmental impact.",
            "carbonReduction": "5-10 kg CO2e/month",
        },
        {
            "title": "Switch to LED Light Bulbs",
            "reason":
                "LEDs consume up to 85% less electricity than incandescent bulbs, lowering your carbon emissions and energy bills.",
            "carbonReduction": "3-5 kg CO2e/month",
        },
        {
            "title": "Compost Food Waste",
            "reason":
                "Composting diverts food from landfills, where it produces methane, a potent greenhouse gas.",
            "carbonReduction": "2-4 kg CO2e/month",
        },
    ]

    # return JsonResponse({'status': 'success', 'data': "Hello, world"})
    client = genai.Client()

    prompt = f"""
    Give me a few suggestions of habits to perform to reduce carbon footprint.
     **Do not include any explanations, formatting, or backticks. Only provide a raw RFC8259 compliant JSON array.
     ** Here is an output example: {sample_suggestions}
** Here are the user's existing habits: {request.user.habits}
    """

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
    )

    return JsonResponse({'status': 'success', 'data': json.loads(response.text)})

# Android Device and Push Notification Views
import json
from django.conf import settings
from django.utils import timezone
from .firebase_service import FCMService
from datetime import datetime, time


# Cron-job.org dispatcher: call this every minute to send scheduled notifications
@require_GET
@csrf_exempt  # This is a server-to-server endpoint; we'll protect with a secret instead of CSRF
def cron_dispatch(request):
    """Send scheduled push notifications to Android devices"""
    # Simple bearer-like secret check: /api/cron/dispatch?token=... or Authorization: Bearer ...
    token = request.GET.get('token') or request.headers.get('Authorization', '').replace('Bearer ', '').strip()
    expected = getattr(settings, 'CRON_SECRET', '')
    if not expected or token != expected:
        return JsonResponse({'status': 'error', 'message': 'Unauthorized'}, status=401)

    # Use Django timezone utilities so we honor settings.TIME_ZONE
    now = timezone.localtime(timezone.now())
    current_time = time(hour=now.hour, minute=now.minute)
    today = now.date()

    # Pick Android devices scheduled for this minute, active, and not already sent for this exact minute today
    qs = AndroidDevice.objects.filter(
        is_active=True,
        daily_reminders_enabled=True,
        notification_time__hour=current_time.hour,
        notification_time__minute=current_time.minute,
    ).exclude(
        last_sent_date=today,
        last_sent_time=current_time,
    ).select_related('user')

    total = qs.count()
    sent = 0
    failed = 0
    failed_ids = []

    # Collect valid FCM tokens
    tokens = []
    devices_by_token = {}
    for device in qs:
        if device.has_valid_fcm_token():
            token = device.get_fcm_token()
            tokens.append(token)
            devices_by_token[token] = device
        else:
            failed += 1
            failed_ids.append(device.id)
            
            
    client = genai.Client()

    prompt = f"""
                Generate 1 single short, catchy, and engaging notification message strictly to encourage users to fill out the EcoTrack check-in form.
                EcoTrack is an app that helps users track their sustainability habits and promotes eco-friendly behavior. It includes features like:
                - Daily surveys to track eco actions 🌱
                - Personalized sustainability score 📊
                - AI chatbot to guide users 🤖
                - Personalized suggestions for greener living 💡
                - Achievements for completing surveys and taking eco-friendly actions 🎁
                - Daily streaks kept alive by submitting check-in everyday
                 Ensure the notifications are:
                - under 60 characters
                - Friendly, heartwarming, motivating, and aligned with EcoTrack's eco-conscious mission
                - Include clear call-to-actions like "Share your thoughts", "fill now", "complete now"
                - Include relevant emojis for engagement
                - Highlight rewards or benefits if possible
                Give the message a human touch, with some warmth, inviting gesture and showing that you care for the user.
            """

    if tokens:
        try:
            response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
        ).text
        except:
            response = f"Hey user!, time to track your footprints 🌱"

        title = 'EcoTrack Reminder'
        body = response
        
        # Send per token to avoid environments where FCM batch (/batch) is blocked or returns 404
        for t in tokens:
            ok = FCMService.send_notification(t, title, body, data={'type': 'daily_reminder'})
            device = devices_by_token.get(t)
            if ok:
                sent += 1
                if device:
                    # Use enhanced AndroidDevice methods for better tracking
                    device.increment_notification_count()
                    device.last_sent_date = today
                    device.last_sent_time = current_time
                    device.save(update_fields=['last_sent_date', 'last_sent_time'])
            else:
                failed += 1
                if device:
                    failed_ids.append(device.id)

    return JsonResponse({
        'status': 'success',
        'time': current_time.strftime('%H:%M'),
        'date': today.isoformat(),
        'total_candidates': total,
        'sent': sent,
        'failed': failed,
        'failed_ids': failed_ids,
    })


@login_required
@csrf_protect
@require_http_methods(["POST"])
def register_android_device(request):
    """
    Register an Android device for push notifications using FCM.
    Stores all subscription details on the server - no device-side subscription loading.
    """
    try:
        data = json.loads(request.body)

        # Required fields
        fcm_token = data.get('fcmToken')
        device_id = data.get('deviceId')

        # Optional fields with safe defaults
        raw_device_name = data.get('deviceName')
        device_name = raw_device_name if raw_device_name else (f"Android Device {device_id[:8]}" if device_id else "Android Device")
        device_model = data.get('deviceModel', 'Unknown Android Device')
        app_version = data.get('appVersion', '1.0.0')
        notification_time = data.get('notificationTime', '09:00')
        timezone_str = data.get('timezone', 'UTC')

        # Notification preferences (all enabled by default)
        daily_reminders = data.get('dailyRemindersEnabled', True)
        community_notifications = data.get('communityNotificationsEnabled', True)
        achievement_notifications = data.get('achievementNotificationsEnabled', True)

        # Additional device metadata for better management
        android_version = data.get('androidVersion', 'Unknown')
        manufacturer = data.get('manufacturer', 'Unknown')
        screen_density = data.get('screenDensity', 'Unknown')
        language = data.get('language', 'en')

        if not fcm_token or not device_id:
            return JsonResponse({
                'status': 'error',
                'message': 'FCM token and device ID are required'
            }, status=400)

        # Parse and validate notification time
        try:
            time_obj = datetime.strptime(notification_time, '%H:%M').time()
        except ValueError:
            time_obj = datetime.strptime('09:00', '%H:%M').time()
            logger.warning(f"Invalid notification time format: {notification_time}, using default 09:00")

        # Validate timezone
        try:
            pytz.timezone(timezone_str)
        except pytz.exceptions.UnknownTimeZoneError:
            timezone_str = 'UTC'
            logger.warning(f"Invalid timezone: {data.get('timezone')}, using UTC")

        # Validate FCM token with Firebase
        token_validation_result = FCMService.validate_token(fcm_token)
        if not token_validation_result:
            return JsonResponse({
                'status': 'error',
                'message': 'Invalid FCM token. Please check your Firebase configuration.'
            }, status=400)

        # Get existing device to check for FCM token changes
        existing_device = AndroidDevice.objects.filter(
            user=request.user,
            device_id=device_id
        ).first()

        fcm_token_changed = False
        if existing_device and existing_device.fcm_token != fcm_token:
            fcm_token_changed = True

        # Store ALL device and subscription details on server - comprehensive server-side storage
        android_device, created = AndroidDevice.objects.update_or_create(
            user=request.user,
            device_id=device_id,
            defaults={
                'fcm_token': fcm_token,
                'device_name': device_name,
                'device_model': device_model,
                'manufacturer': manufacturer,
                'android_version': android_version,
                'app_version': app_version,
                'screen_density': screen_density,
                'language': language,
                'notification_time': time_obj,
                'timezone': timezone_str,
                'is_active': True,
                'daily_reminders_enabled': daily_reminders,
                'community_notifications_enabled': community_notifications,
                'achievement_notifications_enabled': achievement_notifications,
                'system_notifications_enabled': data.get('systemNotificationsEnabled', True),
            }
        )

        # Update token tracking fields AFTER knowing 'created'
        token_fields_to_update = []
        if created:
            android_device.token_last_updated = timezone.now()
            android_device.token_refresh_count = 0
            token_fields_to_update = ['token_last_updated', 'token_refresh_count']
        elif fcm_token_changed:
            android_device.token_last_updated = timezone.now()
            # prefer existing_device if available, else increment current
            current_refresh = (existing_device.token_refresh_count if existing_device else android_device.token_refresh_count) or 0
            android_device.token_refresh_count = current_refresh + 1
            token_fields_to_update = ['token_last_updated', 'token_refresh_count']
        if token_fields_to_update:
            android_device.save(update_fields=token_fields_to_update)

        # Update last seen timestamp
        android_device.update_last_seen()

        # Log registration for monitoring
        action = 'registered' if created else 'updated'
        logger.info(
            f"Android device {action}: User {request.user.username}, Device {device_id[:8]}..., Model {device_model}"
        )

        # Send welcome notification for new registrations
        if created:
            try:
                FCMService.send_notification(
                    token=fcm_token,
                    title="Welcome to EcoTrack! 🌱",
                    body="Your device is now registered for push notifications. Start tracking your eco-friendly habits!",
                    data={
                        'type': 'welcome',
                        'action': 'open_app',
                        'screen': 'dashboard'
                    }
                )
                logger.info(f"Welcome notification sent to new device: {device_id[:8]}...")
            except Exception as e:
                logger.warning(f"Failed to send welcome notification: {e}")

        # Return complete device information - all server-stored data
        return JsonResponse({
            'status': 'success',
            'message': f'Android device {action} successfully',
            'fcm_token_updated': fcm_token_changed,
            'data': {
                'device_id': android_device.device_id,
                'database_id': android_device.id,
                'device_info': android_device.get_device_info(),
                'notification_preferences': android_device.get_notification_preferences(),
                'is_active': android_device.is_active,
                'registration_date': android_device.created_at.isoformat(),
                'last_updated': android_device.updated_at.isoformat(),
                'last_seen': android_device.last_seen.isoformat(),
                'statistics': {
                    'total_notifications_sent': android_device.total_notifications_sent,
                    'token_refresh_count': android_device.token_refresh_count,
                    'token_last_updated': android_device.token_last_updated.isoformat() if android_device.token_last_updated else None,
                },
            },
            'note': 'All device and subscription data stored server-side. No device-side subscription loading required.'
        })

    except json.JSONDecodeError:
        return JsonResponse({
            'status': 'error',
            'message': 'Invalid JSON data format'
        }, status=400)
    except Exception as e:
        logger.error(f"Error registering Android device: {e}")
        return JsonResponse({
            'status': 'error',
            'message': f'Registration failed: {str(e)}'
        }, status=500)


@login_required
@csrf_protect
@require_http_methods(["POST"])
def unregister_android_device(request):
    """Unregister an Android device from push notifications"""
    try:
        data = json.loads(request.body)
        device_id = data.get('deviceId')
        
        if device_id:
            # Deactivate specific device
            android_device = AndroidDevice.objects.get(user=request.user, device_id=device_id)
            android_device.is_active = False
            android_device.save()
            message = 'Android device unregistered successfully'
        else:
            # Deactivate all user's devices
            updated = AndroidDevice.objects.filter(user=request.user).update(is_active=False)
            message = 'All Android devices unregistered successfully' if updated else 'No devices to unregister'
        
        return JsonResponse({
            'status': 'success',
            'message': message
        })
        
    except AndroidDevice.DoesNotExist:
        # Make this endpoint idempotent for simplified UI: succeed even if device isn't present
        return JsonResponse({
            'status': 'success',
            'message': 'No active device found; nothing to unregister'
        })
    except json.JSONDecodeError:
        return JsonResponse({
            'status': 'error',
            'message': 'Invalid JSON data'
        }, status=400)
    except Exception as e:
        return JsonResponse({
            'status': 'error',
            'message': str(e)
        }, status=500)


@login_required
@csrf_protect
@require_http_methods(["POST"])
def update_notification_settings(request):
    """Update Android device notification settings"""
    try:
        data = json.loads(request.body)
        device_id = data.get('deviceId')
        notification_time = data.get('notificationTime')
        daily_reminders = data.get('dailyReminders')
        community_notifications = data.get('communityNotifications')
        achievement_notifications = data.get('achievementNotifications')
        timezone_str = data.get('timezone')
        
        if not device_id:
            return JsonResponse({
                'status': 'error',
                'message': 'Device ID is required'
            }, status=400)
        
        # Get the device
        try:
            android_device = AndroidDevice.objects.get(user=request.user, device_id=device_id)
        except AndroidDevice.DoesNotExist:
            return JsonResponse({
                'status': 'error',
                'message': 'Device not found. Please register first.'
            }, status=404)
        
        # Update notification time if provided
        if notification_time:
            try:
                time_obj = datetime.strptime(notification_time, '%H:%M').time()
                android_device.notification_time = time_obj
            except ValueError:
                return JsonResponse({
                    'status': 'error',
                    'message': 'Invalid time format. Use HH:MM format'
                }, status=400)
        
        # Update notification preferences
        if daily_reminders is not None:
            android_device.daily_reminders_enabled = bool(daily_reminders)
        if community_notifications is not None:
            android_device.community_notifications_enabled = bool(community_notifications)
        if achievement_notifications is not None:
            android_device.achievement_notifications_enabled = bool(achievement_notifications)
        
        # Update timezone if provided
        if timezone_str:
            try:
                pytz.timezone(timezone_str)
                android_device.timezone = timezone_str
            except pytz.exceptions.UnknownTimeZoneError:
                pass  # Keep existing timezone
        
        android_device.save()
        android_device.update_last_seen()
        
        return JsonResponse({
            'status': 'success',
            'message': 'Notification settings updated successfully'
        })
        
    except json.JSONDecodeError:
        return JsonResponse({
            'status': 'error',
            'message': 'Invalid JSON data'
        }, status=400)
    except Exception as e:
        return JsonResponse({
            'status': 'error',
            'message': str(e)
        }, status=500)


@login_required
@csrf_protect
@require_http_methods(["POST"])
def test_notification(request):
    """Send a test push notification to Android device using FCM"""
    try:
        data = json.loads(request.body)
        device_id = data.get('deviceId')
        
        if device_id:
            # Send to specific device
            android_device = AndroidDevice.objects.get(user=request.user, device_id=device_id, is_active=True)
            devices = [android_device]
        else:
            # Send to all active devices
            devices = AndroidDevice.objects.filter(user=request.user, is_active=True)
            
        if not devices:
            return JsonResponse({
                'status': 'error',
                'message': 'No active Android devices found. Please register a device first.'
            }, status=404)

        success_count = 0
        failed_count = 0
        
        for device in devices:
            token = device.get_fcm_token()
            if not token:
                failed_count += 1
                continue

            # Send FCM notification
            success = FCMService.send_notification(
                token=token,
                title='EcoTrack Test Notification',
                body='This is a test notification from EcoTrack! 🌱',
                data={
                    'action': 'open_app',
                    'screen': 'dashboard',
                    'timestamp': str(timezone.now().isoformat()),
                    'type': 'test'
                }
            )
            
            if success:
                success_count += 1
                device.update_last_seen()
            else:
                failed_count += 1
        
        if success_count > 0:
            return JsonResponse({
                'status': 'success',
                'message': f'Test notification sent to {success_count} device(s) successfully!',
                'sent_to': success_count,
                'failed': failed_count
            })
        else:
            return JsonResponse({
                'status': 'error',
                'message': 'Failed to send test notification to any device.'
            }, status=500)
        
    except AndroidDevice.DoesNotExist:
        return JsonResponse({
            'status': 'error',
            'message': 'Device not found. Please register first.'
        }, status=404)
    except json.JSONDecodeError:
        return JsonResponse({
            'status': 'error',
            'message': 'Invalid JSON data'
        }, status=400)
    except Exception as e:
        return JsonResponse({
            'status': 'error',
            'message': str(e)
        }, status=500)


@login_required
def get_android_devices(request):
    """Get user's registered Android devices and notification settings"""
    try:
        devices = AndroidDevice.objects.filter(user=request.user).order_by('-last_seen')
        
        devices_data = []
        for device in devices:
            # Use enhanced AndroidDevice methods for comprehensive server-side data
            device_data = {
                'deviceId': device.device_id,
                'databaseId': device.id,
                'isActive': device.is_active,
                'deviceInfo': device.get_device_info(),
                'notificationPreferences': device.get_notification_preferences(),
                'statistics': {
                    'totalNotificationsSent': device.total_notifications_sent,
                    'tokenRefreshCount': device.token_refresh_count,
                    'registrationDate': device.created_at.isoformat(),
                    'lastUpdated': device.updated_at.isoformat(),
                    'lastSeen': device.last_seen.isoformat() if device.last_seen else None,
                    'tokenLastUpdated': device.token_last_updated.isoformat() if device.token_last_updated else None,
                    'lastNotificationSent': device.last_notification_sent.isoformat() if device.last_notification_sent else None,
                },
                'scheduling': {
                    'lastSentDate': device.last_sent_date.isoformat() if device.last_sent_date else None,
                    'lastSentTime': device.last_sent_time.strftime('%H:%M') if device.last_sent_time else None,
                },
                'hasValidToken': device.has_valid_fcm_token(),
            }
            devices_data.append(device_data)
        
        return JsonResponse({
            'status': 'success',
            'data': {
                'devices': devices_data,
                'totalDevices': len(devices_data),
                'activeDevices': sum(1 for d in devices_data if d['isActive']),
                'firebaseConfig': {
                    'apiKey': getattr(settings, 'FIREBASE_API_KEY', ''),
                    'authDomain': getattr(settings, 'FIREBASE_AUTH_DOMAIN', ''),
                    'projectId': getattr(settings, 'FIREBASE_PROJECT_ID', ''),
                    'storageBucket': getattr(settings, 'FIREBASE_STORAGE_BUCKET', ''),
                    'messagingSenderId': getattr(settings, 'FIREBASE_MESSAGING_SENDER_ID', ''),
                    'appId': getattr(settings, 'FIREBASE_APP_ID', ''),
                }
            },
            'serverSideStorage': True,
            'note': 'All device data and subscription details are stored server-side. No device-side subscription loading required.'
        })
            
    except Exception as e:
        return JsonResponse({
            'status': 'error',
            'message': str(e)
        }, status=500)


@login_required
@csrf_protect 
@require_http_methods(["POST"])
def send_achievement_notification(request):
    """Send achievement notification to user's Android devices"""
    try:
        data = json.loads(request.body)
        achievement_type = data.get('achievementType', 'general')
        achievement_title = data.get('title', 'Achievement Unlocked!')
        achievement_message = data.get('message', 'Congratulations on your eco-friendly achievement!')
        
        # Get user's active Android devices that allow achievement notifications
        devices = AndroidDevice.objects.filter(
            user=request.user,
            is_active=True,
            achievement_notifications_enabled=True
        )
        
        if not devices:
            return JsonResponse({
                'status': 'error',
                'message': 'No active devices found with achievement notifications enabled'
            }, status=404)
        
        success_count = 0
        failed_count = 0
        
        for device in devices:
            token = device.get_fcm_token()
            if not token:
                failed_count += 1
                continue
            
            success = FCMService.send_notification(
                token=token,
                title=achievement_title,
                body=achievement_message,
                data={
                    'action': 'open_achievements',
                    'achievement_type': achievement_type,
                    'screen': 'achievements',
                    'type': 'achievement'
                }
            )
            
            if success:
                success_count += 1
                device.update_last_seen()
            else:
                failed_count += 1
        
        return JsonResponse({
            'status': 'success',
            'message': f'Achievement notification sent to {success_count} device(s)',
            'sent_to': success_count,
            'failed': failed_count
        })
        
    except json.JSONDecodeError:
        return JsonResponse({
            'status': 'error',
            'message': 'Invalid JSON data'
        }, status=400)
    except Exception as e:
        return JsonResponse({
            'status': 'error',
            'message': str(e)
        }, status=500)


def send_community_notification_to_members(community_id, title, message, sender_id=None, data_extra=None):
    """Helper function to send notifications to community members"""
    try:
        # Get all active Android devices for community members (except sender)
        query = AndroidDevice.objects.filter(
            user__community_memberships__community_id=community_id,
            user__community_memberships__is_active=True,
            is_active=True,
            community_notifications_enabled=True
        )
        
        if sender_id:
            query = query.exclude(user_id=sender_id)
        
        devices = query.distinct()
        
        if not devices:
            return {'success_count': 0, 'failure_count': 0}
        
        tokens = []
        for device in devices:
            if device.has_valid_fcm_token():
                tokens.append(device.get_fcm_token())
        
        if not tokens:
            return {'success_count': 0, 'failure_count': 0}
        
        # Prepare notification data
        notification_data = {
            'action': 'open_community',
            'community_id': str(community_id),
            'screen': 'community_detail',
            'type': 'community'
        }
        
        if data_extra:
            notification_data.update(data_extra)
        
        # Send multicast notification
        result = FCMService.send_multicast(
            tokens=tokens,
            title=title,
            body=message,
            data=notification_data
        )
        
        return result
        
    except Exception as e:
        logger.error(f"Failed to send community notification: {e}")
        return {'success_count': 0, 'failure_count': len(tokens) if 'tokens' in locals() else 0}


# Community Views
@login_required
@csrf_protect
@require_http_methods(["POST"])
def create_community(request):
    """Create a new community"""
    try:
        import json
        data = json.loads(request.body)
        name = data.get('name', '').strip()
        description = data.get('description', '').strip()
        is_private = data.get('is_private', False)
        
        if not name:
            return JsonResponse({
                'status': 'error',
                'message': 'Community name is required'
            }, status=400)
            
        if Community.objects.filter(name=name).exists():
            return JsonResponse({
                'status': 'error',
                'message': 'A community with this name already exists'
            }, status=400)
            
        # Create community
        community = Community.objects.create(
            name=name,
            description=description,
            creator=request.user,
            is_private=is_private
        )
        
        # Auto-join creator as a regular member (no special admin role)
        CommunityMembership.objects.create(
            community=community,
            user=request.user,
            role='member'
        )
        
        return JsonResponse({
            'status': 'success',
            'message': 'Community created successfully',
            'data': {
                'id': community.id,
                'name': community.name,
                'description': community.description,
                'join_code': community.join_code,
                'member_count': 1
            }
        })
        
    except Exception as e:
        return JsonResponse({
            'status': 'error',
            'message': str(e)
        }, status=500)


@login_required
@csrf_protect
@require_http_methods(["POST"])
def join_community(request):
    """Join a community by join code or community ID"""
    try:
        import json
        data = json.loads(request.body)
        join_code = data.get('join_code', '').strip().upper()
        community_id = data.get('community_id')
        
        community = None
        if join_code:
            try:
                community = Community.objects.get(join_code=join_code)
            except Community.DoesNotExist:
                return JsonResponse({
                    'status': 'error',
                    'message': 'Invalid join code'
                }, status=400)
        elif community_id:
            try:
                community = Community.objects.get(id=community_id, is_private=False)
            except Community.DoesNotExist:
                return JsonResponse({
                    'status': 'error',
                    'message': 'Community not found or is private'
                }, status=400)
        else:
            return JsonResponse({
                'status': 'error',
                'message': 'Join code or community ID is required'
            }, status=400)
            
        # Check if user is already a member
        if CommunityMembership.objects.filter(community=community, user=request.user, is_active=True).exists():
            return JsonResponse({
                'status': 'error',
                'message': 'You are already a member of this community'
            }, status=400)
            
        # Join community
        membership, created = CommunityMembership.objects.get_or_create(
            community=community,
            user=request.user,
            defaults={'is_active': True}
        )
        
        if not created:
            membership.is_active = True
            membership.save()
            
        # Update member count
        community.member_count = community.memberships.filter(is_active=True).count()
        community.save()
        
        return JsonResponse({
            'status': 'success',
            'message': f'Successfully joined {community.name}',
            'data': {
                'id': community.id,
                'name': community.name,
                'description': community.description,
                'member_count': community.member_count
            }
        })
        
    except Exception as e:
        return JsonResponse({
            'status': 'error',
            'message': str(e)
        }, status=500)


@login_required
@require_http_methods(["GET"])
def get_user_communities(request):
    """Get all communities the user is a member of"""
    try:
        memberships = CommunityMembership.objects.filter(
            user=request.user, 
            is_active=True
        ).select_related('community')
        
        communities = []
        for membership in memberships:
            community = membership.community
            communities.append({
                'id': community.id,
                'name': community.name,
                'description': community.description,
                'member_count': community.member_count,
                'role': membership.role,
                'joined_at': membership.joined_at.isoformat(),
                'is_creator': community.creator == request.user,
                'join_code': community.join_code,  # Include join code for members
                'is_private': community.is_private
            })
            
        return JsonResponse({
            'status': 'success',
            'data': communities
        })
        
    except Exception as e:
        return JsonResponse({
            'status': 'error',
            'message': str(e)
        }, status=500)


@login_required
@require_http_methods(["GET"])
def get_public_communities(request):
    """Get public communities that user can join"""
    try:
        # Get communities user is not already a member of
        user_community_ids = CommunityMembership.objects.filter(
            user=request.user, 
            is_active=True
        ).values_list('community_id', flat=True)
        
        communities = Community.objects.filter(
            is_private=False
        ).exclude(
            id__in=user_community_ids
        ).annotate(
            actual_member_count=Count('memberships', filter=Q(memberships__is_active=True))
        )[:20]  # Limit to 20 communities
        
        result = []
        for community in communities:
            result.append({
                'id': community.id,
                'name': community.name,
                'description': community.description,
                'member_count': community.actual_member_count,
                'created_at': community.created_at.isoformat()
            })
            
        return JsonResponse({
            'status': 'success',
            'data': result
        })
        
    except Exception as e:
        return JsonResponse({
            'status': 'error',
            'message': str(e)
        }, status=500)


@login_required
@csrf_protect
@require_http_methods(["POST"])
def send_message(request):
    """Send a message to a community"""
    try:
        import json
        data = json.loads(request.body)
        community_id = data.get('community_id')
        content = data.get('content', '').strip()
        message_type = data.get('message_type', 'text')
        metadata = data.get('metadata', {})
        
        if not community_id or not content:
            return JsonResponse({
                'status': 'error',
                'message': 'Community ID and content are required'
            }, status=400)
            
        # Verify user is a member of the community
        try:
            membership = CommunityMembership.objects.get(
                community_id=community_id,
                user=request.user,
                is_active=True
            )
        except CommunityMembership.DoesNotExist:
            return JsonResponse({
                'status': 'error',
                'message': 'You are not a member of this community'
            }, status=403)
            
        # Create message
        message = CommunityMessage.objects.create(
            community_id=community_id,
            sender=request.user,
            content=content,
            message_type=message_type,
            metadata=metadata
        )
        
        # Send push notifications to community members
        try:
            community = Community.objects.get(id=community_id)
            notification_title = f"New message in {community.name}"
            notification_body = f"{request.user.username}: {content[:50]}{'...' if len(content) > 50 else ''}"
            
            send_community_notification_to_members(
                community_id=community_id,
                title=notification_title,
                message=notification_body,
                sender_id=request.user.id,
                data_extra={
                    'message_id': str(message.id),
                    'message_type': message_type,
                    'sender': request.user.username
                }
            )
        except Exception as e:
            logger.warning(f"Failed to send community notification: {e}")
        
        return JsonResponse({
            'status': 'success',
            'message': 'Message sent successfully',
            'data': {
                'id': message.id,
                'content': message.content,
                'message_type': message.message_type,
                'created_at': message.created_at.isoformat(),
                'sender': request.user.username
            }
        })
        
    except Exception as e:
        return JsonResponse({
            'status': 'error',
            'message': str(e)
        }, status=500)


@login_required
@require_http_methods(["GET"])
def get_community_messages(request, community_id):
    """Get messages from a community"""
    try:
        # Verify user is a member of the community
        try:
            CommunityMembership.objects.get(
                community_id=community_id,
                user=request.user,
                is_active=True
            )
        except CommunityMembership.DoesNotExist:
            return JsonResponse({
                'status': 'error',
                'message': 'You are not a member of this community'
            }, status=403)
            
        # Get messages with pagination
        page = int(request.GET.get('page', 1))
        messages = CommunityMessage.objects.filter(
            community_id=community_id
        ).select_related('sender').order_by('-created_at')
        
        paginator = Paginator(messages, 50)  # 50 messages per page
        page_obj = paginator.get_page(page)
        
        result = []
        for message in page_obj:
            result.append({
                'id': message.id,
                'content': message.content,
                'message_type': message.message_type,
                'metadata': message.metadata,
                'sender': message.sender.username,
                'sender_id': message.sender.id,
                'created_at': message.created_at.isoformat(),
                'is_pinned': message.is_pinned
            })
            
        return JsonResponse({
            'status': 'success',
            'data': {
                'messages': result,
                'has_next': page_obj.has_next(),
                'has_previous': page_obj.has_previous(),
                'current_page': page,
                'total_pages': paginator.num_pages
            }
        })
        
    except Exception as e:
        return JsonResponse({
            'status': 'error',
            'message': str(e)
        }, status=500)


@login_required
@csrf_protect
@require_http_methods(["POST"])
def leave_community(request):
    """Leave a community"""
    try:
        import json
        data = json.loads(request.body)
        community_id = data.get('community_id')
        
        if not community_id:
            return JsonResponse({
                'status': 'error',
                'message': 'Community ID is required'
            }, status=400)
            
        try:
            membership = CommunityMembership.objects.get(
                community_id=community_id,
                user=request.user,
                is_active=True
            )
        except CommunityMembership.DoesNotExist:
            return JsonResponse({
                'status': 'error',
                'message': 'You are not a member of this community'
            }, status=400)
            
        community = membership.community
        
        # Leave community
        membership.is_active = False
        membership.save()
        
        # Update member count
        community.member_count = community.memberships.filter(is_active=True).count()
        community.save()
        
        return JsonResponse({
            'status': 'success',
            'message': f'Successfully left {community.name}'
        })
        
    except Exception as e:
        return JsonResponse({
            'status': 'error',
            'message': str(e)
        }, status=500)

