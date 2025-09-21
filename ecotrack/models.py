from django.contrib.auth.models import AbstractUser
from django.db import models
from datetime import datetime, timedelta
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


class PushSubscription(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='push_subscription')
    endpoint = models.TextField()
    p256dh_key = models.TextField()  
    auth_key = models.TextField()
    # FCM token for Firebase Cloud Messaging
    fcm_token = models.TextField(blank=True, null=True)
    # Device/platform information for better targeting
    device_type = models.CharField(max_length=50, default='web', blank=True, null=True)  # 'web', 'android', 'ios'
    notification_time = models.TimeField(default=datetime.strptime('09:00', '%H:%M').time())  # Default to 9:00 AM
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    # De-duplication tracking to avoid multiple sends in the same day for the same scheduled time
    last_sent_date = models.DateField(null=True, blank=True)
    last_sent_time = models.TimeField(null=True, blank=True)
    
    def __str__(self):
        return f"{self.user.username} - Push Subscription"
    
    def get_subscription_info(self):
        """Return subscription info in the format expected by pywebpush"""
        return {
            'endpoint': self.endpoint,
            'keys': {
                'p256dh': self.p256dh_key,
                'auth': self.auth_key
            }
        }
    
    def get_fcm_token(self):
        """Return FCM token for Firebase messaging"""
        return self.fcm_token or ''
    
    def has_valid_fcm_token(self):
        """Check if subscription has a valid FCM token"""
        token = self.get_fcm_token()
        return bool(token and token.strip())


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