from django.urls import path
from . import views

urlpatterns = [
    path("", views.index, name="index"),
    path("accounts", views.accounts, name="accounts"),
    path("login", views.login_view, name="login"),
    path("logout", views.logout_view, name="logout"),
    path("signup", views.signup, name="signup"),
    path("survey", views.survey, name="survey"),
    path("get_user_data", views.get_user_data, name="get_user_data"),
    path("save_habit", views.save_habit, name="save_habit"),
    path("update_habit", views.update_habit, name="update_habit"),
    path("delete_habit", views.delete_habit, name="delete_habit"),
    path("get_habit_category_suggestions", views.get_habit_category_suggestions, name="get_habit_category_suggestions"),
    path("submit_questionnaire", views.submit_questionnaire, name="submit_questionnaire"),
    path("get_suggestions", views.get_suggestions, name="get_suggestions"),
    path("get_questions", views.get_questions, name="get_questions"),
    path("android-guide", views.android_guide, name="android_guide"),
    
    # Android device and notification endpoints
    # Support both with and without trailing slashes to avoid POST 404s with APPEND_SLASH
    path("api/android/register", views.register_android_device, name="register_android_device"),
    path("api/android/register/", views.register_android_device),
    path("api/android/unregister", views.unregister_android_device, name="unregister_android_device"),
    path("api/android/unregister/", views.unregister_android_device),
    path("api/android/update-settings", views.update_notification_settings, name="update_notification_settings"),
    path("api/android/update-settings/", views.update_notification_settings),
    path("api/android/test-notification", views.test_notification, name="test_notification"),
    path("api/android/test-notification/", views.test_notification),
    path("api/android/devices", views.get_android_devices, name="get_android_devices"),
    path("api/android/devices/", views.get_android_devices),
    path("api/android/send-achievement", views.send_achievement_notification, name="send_achievement_notification"),
    # Cron dispatcher (external scheduler calls this every minute)
    path("api/cron/dispatch", views.cron_dispatch, name="cron_dispatch"),
    
    # Community endpoints
    path("api/communities/create", views.create_community, name="create_community"),
    path("api/communities/join", views.join_community, name="join_community"),
    path("api/communities/leave", views.leave_community, name="leave_community"),
    path("api/communities/my-communities", views.get_user_communities, name="get_user_communities"),
    path("api/communities/public", views.get_public_communities, name="get_public_communities"),
    path("api/communities/send-message", views.send_message, name="send_message"),
    path("api/communities/<int:community_id>/messages", views.get_community_messages, name="get_community_messages"),

]