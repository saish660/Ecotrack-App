from django.contrib.auth.models import AbstractUser
from django.db import models
from datetime import datetime, timedelta
from django.utils import timezone
import json


def get_default_dict():
    return {}


class User(AbstractUser):
    days_since_last_survey = models.PositiveIntegerField(default=0)
    streak = models.PositiveIntegerField(default=0)
    sustainability_score = models.PositiveIntegerField(default=0)
    carbon_footprint = models.JSONField(default=list, blank=True)
    habits = models.JSONField(default=list, blank=True)
    user_data = models.JSONField(default=get_default_dict, blank=True)
    survey_answered = models.BooleanField(default=False)
    achievements = models.JSONField(default=list, blank=True)
    last_checkin = models.DateField(null=True, blank=True, default=datetime.now() - timedelta(days=1))
    habits_today = models.PositiveIntegerField(default=0)
    last_8_footprint_measurements = models.JSONField(default=list, blank=True)

    # By inheriting from AbstractUser, you get these fields automatically:
    # username
    # first_name
    # last_name
    # email
    # password
    # groups
    # user_permissions
    # is_staff
    # is_active
    # is_superuser
    # last_login
    # date_joined

    def __str__(self):
        return self.username


class AndroidDevice(models.Model):
    """
    Model representing an Android device registered for push notifications.
    Stores all subscription and device details server-side - no device-side subscription loading.
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='android_devices')
    fcm_token = models.TextField(unique=True)  # FCM registration token
    device_id = models.CharField(max_length=255, unique=True)  # Android device identifier
    
    # Device information
    device_name = models.CharField(max_length=100, blank=True, null=True)  # User-friendly device name
    device_model = models.CharField(max_length=100, blank=True, null=True)  # Device model info
    manufacturer = models.CharField(max_length=50, blank=True, null=True)  # Device manufacturer
    android_version = models.CharField(max_length=20, blank=True, null=True)  # Android OS version
    app_version = models.CharField(max_length=50, blank=True, null=True)  # EcoTrack app version
    screen_density = models.CharField(max_length=20, blank=True, null=True)  # Screen density (hdpi, xhdpi, etc.)
    language = models.CharField(max_length=10, default='en')  # Device language
    
    # Notification configuration - all stored server-side
    notification_time = models.TimeField(default=datetime.strptime('09:00', '%H:%M').time())
    timezone = models.CharField(max_length=50, default='UTC')  # User's timezone
    is_active = models.BooleanField(default=True)
    
    # Granular notification preferences - stored on server
    daily_reminders_enabled = models.BooleanField(default=True)
    community_notifications_enabled = models.BooleanField(default=True)
    achievement_notifications_enabled = models.BooleanField(default=True)
    system_notifications_enabled = models.BooleanField(default=True)  # App updates, maintenance, etc.
    
    # Activity tracking
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    last_seen = models.DateTimeField(auto_now=True)
    
    # Notification delivery tracking - for analytics and debugging
    total_notifications_sent = models.PositiveIntegerField(default=0)
    last_notification_sent = models.DateTimeField(null=True, blank=True)
    last_sent_date = models.DateField(null=True, blank=True)  # For daily reminder deduplication
    last_sent_time = models.TimeField(null=True, blank=True)  # For daily reminder deduplication
    
    # FCM token management
    token_last_updated = models.DateTimeField(null=True, blank=True)
    token_refresh_count = models.PositiveIntegerField(default=0)
    
    class Meta:
        ordering = ['-last_seen']
        unique_together = ['user', 'device_id']
        indexes = [
            models.Index(fields=['user', 'is_active']),
            models.Index(fields=['fcm_token']),
            models.Index(fields=['notification_time', 'timezone']),
            models.Index(fields=['last_sent_date', 'last_sent_time']),
        ]
    
    def __str__(self):
        device_name = self.device_name or self.device_model or f'Device {self.device_id[:8]}...'
        return f"{self.user.username} - {device_name}"
    
    def get_fcm_token(self):
        """Return FCM token for Firebase messaging"""
        return self.fcm_token
    
    def has_valid_fcm_token(self):
        """Check if device has a valid FCM token"""
        return bool(self.fcm_token and self.fcm_token.strip())
    
    def update_last_seen(self):
        """Update last seen timestamp"""
        self.last_seen = timezone.now()
        self.save(update_fields=['last_seen'])
    
    def update_fcm_token(self, new_token):
        """Update FCM token and track refresh"""
        self.fcm_token = new_token
        self.token_last_updated = timezone.now()
        self.token_refresh_count += 1
        self.save(update_fields=['fcm_token', 'token_last_updated', 'token_refresh_count'])
    
    def increment_notification_count(self):
        """Increment notification counter and update last sent timestamp"""
        self.total_notifications_sent += 1
        self.last_notification_sent = timezone.now()
        self.save(update_fields=['total_notifications_sent', 'last_notification_sent'])
    
    def get_device_info(self):
        """Return comprehensive device information dictionary"""
        return {
            'device_id': self.device_id,
            'device_name': self.device_name,
            'device_model': self.device_model,
            'manufacturer': self.manufacturer,
            'android_version': self.android_version,
            'app_version': self.app_version,
            'language': self.language,
            'screen_density': self.screen_density,
        }
    
    def get_notification_preferences(self):
        """Return notification preferences dictionary"""
        return {
            'daily_reminders': self.daily_reminders_enabled,
            'community_notifications': self.community_notifications_enabled,
            'achievement_notifications': self.achievement_notifications_enabled,
            'system_notifications': self.system_notifications_enabled,
            'notification_time': self.notification_time.strftime('%H:%M'),
            'timezone': self.timezone,
        }
    
    def is_scheduled_for_notification(self, current_time, current_date):
        """
        Check if device is scheduled to receive notification at current time.
        All scheduling logic is server-side.
        """
        if not self.is_active or not self.daily_reminders_enabled:
            return False
        
        # Check if already sent today at this exact time
        if (self.last_sent_date == current_date and 
            self.last_sent_time == current_time):
            return False
        
        # Check if notification time matches
        return (self.notification_time.hour == current_time.hour and 
                self.notification_time.minute == current_time.minute)


class Community(models.Model):
    """Model representing an eco-friendly community"""
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    creator = models.ForeignKey(User, on_delete=models.CASCADE, related_name='created_communities')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_private = models.BooleanField(default=False)
    join_code = models.CharField(max_length=8, unique=True, blank=True)
    member_count = models.PositiveIntegerField(default=1)
    
    class Meta:
        verbose_name_plural = "Communities"
        ordering = ['-created_at']
    
    def __str__(self):
        return self.name
    
    def save(self, *args, **kwargs):
        if not self.join_code:
            self.join_code = self.generate_join_code()
        super().save(*args, **kwargs)
    
    def generate_join_code(self):
        """Generate a unique 8-character join code"""
        import random
        import string
        while True:
            code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))
            if not Community.objects.filter(join_code=code).exists():
                return code


class CommunityMembership(models.Model):
    """Model representing membership in a community"""
    ROLE_CHOICES = [
        ('admin', 'Admin'),
        ('moderator', 'Moderator'),
        ('member', 'Member'),
    ]
    
    community = models.ForeignKey(Community, on_delete=models.CASCADE, related_name='memberships')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='community_memberships')
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='member')
    joined_at = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)
    
    class Meta:
        unique_together = ['community', 'user']
        ordering = ['joined_at']
    
    def __str__(self):
        return f"{self.user.username} - {self.community.name} ({self.role})"


class CommunityMessage(models.Model):
    """Model representing messages in a community"""
    MESSAGE_TYPE_CHOICES = [
        ('text', 'Text Message'),
        ('task', 'Eco Task'),
        ('achievement', 'Achievement Share'),
        ('announcement', 'Announcement'),
    ]
    
    community = models.ForeignKey(Community, on_delete=models.CASCADE, related_name='messages')
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sent_messages')
    message_type = models.CharField(max_length=20, choices=MESSAGE_TYPE_CHOICES, default='text')
    content = models.TextField()
    metadata = models.JSONField(default=dict, blank=True)  # For additional data like task details
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_pinned = models.BooleanField(default=False)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.sender.username} in {self.community.name}: {self.content[:50]}..."


class CommunityTask(models.Model):
    """Model representing eco-friendly tasks within a community"""
    TASK_STATUS_CHOICES = [
        ('active', 'Active'),
        ('completed', 'Completed'),
        ('expired', 'Expired'),
    ]
    
    community = models.ForeignKey(Community, on_delete=models.CASCADE, related_name='tasks')
    creator = models.ForeignKey(User, on_delete=models.CASCADE, related_name='created_tasks')
    title = models.CharField(max_length=200)
    description = models.TextField()
    target_participants = models.PositiveIntegerField(default=1)
    current_participants = models.PositiveIntegerField(default=0)
    status = models.CharField(max_length=20, choices=TASK_STATUS_CHOICES, default='active')
    deadline = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.title} - {self.community.name}"


class TaskParticipation(models.Model):
    """Model representing user participation in community tasks"""
    PARTICIPATION_STATUS_CHOICES = [
        ('joined', 'Joined'),
        ('completed', 'Completed'),
        ('abandoned', 'Abandoned'),
    ]
    
    task = models.ForeignKey(CommunityTask, on_delete=models.CASCADE, related_name='participations')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='task_participations')
    status = models.CharField(max_length=20, choices=PARTICIPATION_STATUS_CHOICES, default='joined')
    joined_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    proof_text = models.TextField(blank=True)  # User's proof of completion
    
    class Meta:
        unique_together = ['task', 'user']
        ordering = ['joined_at']
    
    def __str__(self):
        return f"{self.user.username} - {self.task.title} ({self.status})"