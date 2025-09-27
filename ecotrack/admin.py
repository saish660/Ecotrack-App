from django.contrib import admin
from .models import User, Community, CommunityMembership, CommunityMessage, CommunityTask, TaskParticipation, AndroidDevice


@admin.register(Community)
class CommunityAdmin(admin.ModelAdmin):
    list_display = ['name', 'creator', 'member_count', 'is_private', 'created_at']
    list_filter = ['is_private', 'created_at']
    search_fields = ['name', 'description', 'creator__username']
    readonly_fields = ['join_code', 'member_count', 'created_at', 'updated_at']
    
    def get_readonly_fields(self, request, obj=None):
        if obj:  # editing an existing object
            return self.readonly_fields + ['creator']
        return self.readonly_fields


@admin.register(CommunityMembership)
class CommunityMembershipAdmin(admin.ModelAdmin):
    list_display = ['user', 'community', 'role', 'joined_at', 'is_active']
    list_filter = ['role', 'is_active', 'joined_at']
    search_fields = ['user__username', 'community__name']


@admin.register(CommunityMessage)
class CommunityMessageAdmin(admin.ModelAdmin):
    list_display = ['sender', 'community', 'message_type', 'content_preview', 'created_at', 'is_pinned']
    list_filter = ['message_type', 'is_pinned', 'created_at']
    search_fields = ['sender__username', 'community__name', 'content']
    
    def content_preview(self, obj):
        return obj.content[:50] + "..." if len(obj.content) > 50 else obj.content
    content_preview.short_description = "Content Preview"


@admin.register(CommunityTask)
class CommunityTaskAdmin(admin.ModelAdmin):
    list_display = ['title', 'community', 'creator', 'status', 'current_participants', 'target_participants', 'created_at']
    list_filter = ['status', 'created_at']
    search_fields = ['title', 'description', 'community__name', 'creator__username']


@admin.register(TaskParticipation)
class TaskParticipationAdmin(admin.ModelAdmin):
    list_display = ['user', 'task', 'status', 'joined_at', 'completed_at']
    list_filter = ['status', 'joined_at', 'completed_at']
    search_fields = ['user__username', 'task__title']


@admin.register(AndroidDevice)
class AndroidDeviceAdmin(admin.ModelAdmin):
    list_display = ['user', 'device_name', 'device_model', 'app_version', 'is_active', 'notification_time', 'last_seen']
    list_filter = ['is_active', 'daily_reminders_enabled', 'community_notifications_enabled', 'achievement_notifications_enabled', 'created_at']
    search_fields = ['user__username', 'device_name', 'device_model', 'device_id']
    readonly_fields = ['fcm_token', 'device_id', 'created_at', 'updated_at', 'last_seen']
    
    fieldsets = (
        ('Device Info', {
            'fields': ('user', 'device_id', 'device_name', 'device_model', 'app_version', 'fcm_token')
        }),
        ('Notification Settings', {
            'fields': ('notification_time', 'timezone', 'is_active', 'daily_reminders_enabled', 
                      'community_notifications_enabled', 'achievement_notifications_enabled')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at', 'last_seen', 'last_sent_date', 'last_sent_time')
        }),
    )


# Register your models here.
admin.site.register(User)