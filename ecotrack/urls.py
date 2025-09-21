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
    path("submit_questionnaire", views.submit_questionnaire, name="submit_questionnaire"),
    path("get_suggestions", views.get_suggestions, name="get_suggestions"),
    path("get_questions", views.get_questions, name="get_questions"),
    
    # Push notification endpoints
    path("api/notifications/subscribe", views.subscribe_push, name="subscribe_push"),
    path("api/notifications/unsubscribe", views.unsubscribe_push, name="unsubscribe_push"),
    path("api/notifications/update-time", views.update_notification_time, name="update_notification_time"),
    path("api/notifications/test", views.test_notification, name="test_notification"),
    path("api/notifications/settings", views.get_notification_settings, name="get_notification_settings"),
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