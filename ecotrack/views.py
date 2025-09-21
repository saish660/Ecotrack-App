from datetime import datetime, timedelta, time
from django.contrib.auth.decorators import login_required
from django.shortcuts import render
from django.http import JsonResponse, HttpResponseRedirect
from django.views.decorators.csrf import csrf_protect, csrf_exempt
from django.views.decorators.http import require_http_methods
from .models import User, Community, CommunityMembership, CommunityMessage, CommunityTask, TaskParticipation
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
from .models import PushSubscription
from .firebase_service import FCMService



def update_latest_values(user, new_value):
    if not user.last_8_footprint_measurements:
        return [new_value] * 8
    global_data_list = user.last_8_footprint_measurements
    if len(global_data_list) >= 8:
        global_data_list.pop(0) # Removes the element at index 0

    global_data_list.append(new_value)

    return global_data_list

@login_required
def index(request):
    if not request.user.survey_answered or request.user.days_since_last_survey > 7:
        if request.user.days_since_last_survey > 7:
            request.user.days_since_last_survey = 0
            request.user.save()
        return HttpResponseRedirect(reverse('survey'))
    return render(request, "index.html")


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
            return JsonResponse({'status': 'error', 'message': 'Invalid email or password'}, status=401)

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
        user.user_data = data
        user.survey_answered = True
        user.carbon_footprint = calculate_personal_carbon_footprint(data)['summary']['personal_monthly_co2e_kg']
        user.sustainability_score = calculate_initial_sustainability_score(user.user_data)[
            'initial_sustainability_score']
        user.last_8_footprint_measurements = update_latest_values(user, calculate_personal_carbon_footprint(data)['summary']['personal_monthly_co2e_kg'])
        user.save()
        return JsonResponse({'status': 'success', 'message': 'Survey submitted successfully'}, status=200)

    if request.user.survey_answered:
        return HttpResponseRedirect(reverse('index'))
    return render(request, "survey_form.html")


@login_required
def get_user_data(request):
    if request.user.last_checkin < datetime.now().date():
        request.user.habits_today = 0
        request.user.save()

    return JsonResponse({'status': 'success', 'data': {
        "username": request.user.username,
        "streak": request.user.streak,
        "carbon_footprint": request.user.carbon_footprint,
        "sustainability_score": request.user.sustainability_score,
        "habits": request.user.habits,
        "last_checkin_date": request.user.last_checkin,
        "habits_today": request.user.habits_today,
        "achievements": request.user.achievements,
        "last_8_footprints": request.user.last_8_footprint_measurements,
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

    if request.user.last_checkin < (datetime.now() - timedelta(days=1)).date():
        request.user.streak = 1
    else:
        request.user.streak += 1

    request.user.last_checkin = datetime.now()
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

# Push Notification Views
import json
from django.conf import settings
from .models import PushSubscription
from .firebase_service import FCMService
from datetime import datetime, time


# Cron-job.org dispatcher: call this every minute to send scheduled notifications
@require_GET
@csrf_exempt  # This is a server-to-server endpoint; we'll protect with a secret instead of CSRF
def cron_dispatch(request):
    # Simple bearer-like secret check: /api/cron/dispatch?token=... or Authorization: Bearer ...
    token = request.GET.get('token') or request.headers.get('Authorization', '').replace('Bearer ', '').strip()
    expected = getattr(settings, 'CRON_SECRET', '')
    if not expected or token != expected:
        return JsonResponse({'status': 'error', 'message': 'Unauthorized'}, status=401)

    # Use Django timezone utilities so we honor settings.TIME_ZONE
    from django.utils import timezone
    now = timezone.localtime(timezone.now())
    current_time = time(hour=now.hour, minute=now.minute)
    today = now.date()

    # Pick subscriptions scheduled for this minute, active, and not already sent for this exact minute today
    qs = PushSubscription.objects.filter(
        is_active=True,
        notification_time__hour=current_time.hour,
        notification_time__minute=current_time.minute,
    ).exclude(
        last_sent_date=today,
        last_sent_time=current_time,
    )

    total = qs.count()
    sent = 0
    failed = 0
    failed_ids = []

    # Batch by device type/token validity, prefer multicast for efficiency
    tokens = []
    subs_by_token = {}
    for sub in qs:
        if sub.has_valid_fcm_token():
            token = sub.get_fcm_token()
            tokens.append(token)
            subs_by_token[token] = sub
        else:
            failed += 1
            failed_ids.append(sub.id)
            
            
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

    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
        ).text
    except:
        response = f"Hey user!, time to track your footprints 🌱"

    title = 'EcoTrack Reminder'
    body = response

    if tokens:
        # Send per token to avoid environments where FCM batch (/batch) is blocked or returns 404
        for t in tokens:
            ok = FCMService.send_notification(t, title, body, data={'type': 'daily_reminder'})
            sub = subs_by_token.get(t)
            if ok:
                sent += 1
                if sub:
                    sub.last_sent_date = today
                    sub.last_sent_time = current_time
                    sub.save(update_fields=['last_sent_date', 'last_sent_time', 'updated_at'])
            else:
                failed += 1
                if sub:
                    failed_ids.append(sub.id)

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
def subscribe_push(request):
    """Subscribe user for push notifications using FCM"""
    try:
        data = json.loads(request.body)
        
        fcm_token = data.get('fcmToken')
        device_type = data.get('deviceType', 'web')
        notification_time = data.get('notificationTime', '09:00')  # Default to 9:00 AM
        
        if not fcm_token:
            return JsonResponse({
                'status': 'error',
                'message': 'FCM token is required'
            }, status=400)
        
        # Parse notification time
        try:
            time_obj = datetime.strptime(notification_time, '%H:%M').time()
        except ValueError:
            time_obj = datetime.strptime('09:00', '%H:%M').time()
        
        # Validate FCM token
        if not FCMService.validate_token(fcm_token):
            return JsonResponse({
                'status': 'error',
                'message': 'Invalid FCM token'
            }, status=400)
        
        # Create or update push subscription
        push_subscription, created = PushSubscription.objects.update_or_create(
            user=request.user,
            defaults={
                'fcm_token': fcm_token,
                'device_type': device_type,
                'notification_time': time_obj,
                'is_active': True
            }
        )
        
        return JsonResponse({
            'status': 'success',
            'message': 'Successfully subscribed to push notifications'
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
def unsubscribe_push(request):
    """Unsubscribe user from push notifications"""
    try:
        push_subscription = PushSubscription.objects.get(user=request.user)
        push_subscription.is_active = False
        push_subscription.save()
        
        return JsonResponse({
            'status': 'success',
            'message': 'Successfully unsubscribed from push notifications'
        })
        
    except PushSubscription.DoesNotExist:
        return JsonResponse({
            'status': 'error',
            'message': 'No active subscription found'
        }, status=404)
    except Exception as e:
        return JsonResponse({
            'status': 'error',
            'message': str(e)
        }, status=500)


@login_required
@csrf_protect
@require_http_methods(["POST"])
def update_notification_time(request):
    """Update user's notification time preference"""
    try:
        data = json.loads(request.body)
        notification_time = data.get('notificationTime')
        
        if not notification_time:
            return JsonResponse({
                'status': 'error',
                'message': 'Notification time is required'
            }, status=400)
        
        # Parse and validate time
        try:
            time_obj = datetime.strptime(notification_time, '%H:%M').time()
        except ValueError:
            return JsonResponse({
                'status': 'error',
                'message': 'Invalid time format. Use HH:MM format'
            }, status=400)
        
        # Update subscription
        try:
            push_subscription = PushSubscription.objects.get(user=request.user)
            push_subscription.notification_time = time_obj
            push_subscription.save()
            
            return JsonResponse({
                'status': 'success',
                'message': 'Notification time updated successfully'
            })
            
        except PushSubscription.DoesNotExist:
            return JsonResponse({
                'status': 'error',
                'message': 'No active subscription found. Please subscribe first.'
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
@csrf_protect
@require_http_methods(["POST"])
def test_notification(request):
    """Send a test push notification to the user using FCM"""
    try:
        push_subscription = PushSubscription.objects.get(user=request.user, is_active=True)
        
        # Ensure we have a valid token
        token = push_subscription.get_fcm_token()
        if not token:
            return JsonResponse({
                'status': 'error',
                'message': 'No FCM token found. Please re-enable notifications to register your device.'
            }, status=400)

        # Send FCM notification
        success = FCMService.send_notification(
            token=token,
            title='EcoTrack Test Notification',
            body='This is a test notification from EcoTrack!',
            data={
                'url': '/',
                'timestamp': str(datetime.now()),
                'type': 'test'
            }
        )
        
        if success:
            return JsonResponse({
                'status': 'success',
                'message': 'Test notification sent successfully!'
            })
        else:
            return JsonResponse({
                'status': 'error',
                'message': 'Failed to send test notification. Please check your subscription.'
            }, status=500)
        
    except PushSubscription.DoesNotExist:
        return JsonResponse({
            'status': 'error',
            'message': 'No active push subscription found. Please subscribe first.'
        }, status=404)
    except Exception as e:
        return JsonResponse({
            'status': 'error',
            'message': str(e)
        }, status=500)


@login_required
def get_notification_settings(request):
    """Get user's current notification settings"""
    try:
        try:
            push_subscription = PushSubscription.objects.get(user=request.user)
            is_subscribed = push_subscription.is_active and push_subscription.has_valid_fcm_token()
            return JsonResponse({
                'status': 'success',
                'data': {
                    'isSubscribed': is_subscribed,
                    'notificationTime': push_subscription.notification_time.strftime('%H:%M'),
                    'deviceType': push_subscription.device_type,
                    'firebaseConfig': {
                        'apiKey': getattr(settings, 'FIREBASE_API_KEY', ''),
                        'authDomain': getattr(settings, 'FIREBASE_AUTH_DOMAIN', ''),
                        'projectId': getattr(settings, 'FIREBASE_PROJECT_ID', ''),
                        'storageBucket': getattr(settings, 'FIREBASE_STORAGE_BUCKET', ''),
                        'messagingSenderId': getattr(settings, 'FIREBASE_MESSAGING_SENDER_ID', ''),
                        'appId': getattr(settings, 'FIREBASE_APP_ID', ''),
                        'vapidKey': getattr(settings, 'FIREBASE_VAPID_KEY', '')
                    }
                }
            })
        except PushSubscription.DoesNotExist:
            return JsonResponse({
                'status': 'success',
                'data': {
                    'isSubscribed': False,
                    'notificationTime': '09:00',
                    'deviceType': 'web',
                    'firebaseConfig': {
                        'apiKey': getattr(settings, 'FIREBASE_API_KEY', ''),
                        'authDomain': getattr(settings, 'FIREBASE_AUTH_DOMAIN', ''),
                        'projectId': getattr(settings, 'FIREBASE_PROJECT_ID', ''),
                        'storageBucket': getattr(settings, 'FIREBASE_STORAGE_BUCKET', ''),
                        'messagingSenderId': getattr(settings, 'FIREBASE_MESSAGING_SENDER_ID', ''),
                        'appId': getattr(settings, 'FIREBASE_APP_ID', ''),
                        'vapidKey': getattr(settings, 'FIREBASE_VAPID_KEY', '')
                    }
                }
            })
            
    except Exception as e:
        return JsonResponse({
            'status': 'error',
            'message': str(e)
        }, status=500)


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
        
        # Auto-join creator as admin
        CommunityMembership.objects.create(
            community=community,
            user=request.user,
            role='admin'
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
        
        # Check if user is the creator and only admin
        if community.creator == request.user:
            admin_count = CommunityMembership.objects.filter(
                community=community,
                role='admin',
                is_active=True
            ).count()
            
            if admin_count <= 1:
                return JsonResponse({
                    'status': 'error',
                    'message': 'As the creator, you must assign another admin before leaving'
                }, status=400)
        
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

