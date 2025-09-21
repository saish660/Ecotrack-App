#!/usr/bin/env python3
"""
Simple test script to verify community functionality
"""
import os
import sys
import django

# Setup Django environment
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'DjangoProject.settings')
django.setup()

from ecotrack.models import User, Community, CommunityMembership, CommunityMessage


def test_community_creation():
    """Test creating a community and adding members"""
    print("Testing community functionality...")
    
    # Create a test user if it doesn't exist
    user, created = User.objects.get_or_create(
        username='testuser',
        defaults={
            'email': 'test@example.com',
            'first_name': 'Test',
            'last_name': 'User'
        }
    )
    if created:
        user.set_password('testpassword123')
        user.save()
        print(f"Created test user: {user.username}")
    else:
        print(f"Using existing test user: {user.username}")
    
    # Create a test community
    community, created = Community.objects.get_or_create(
        name='Test Eco Community',
        defaults={
            'description': 'A test community for eco-friendly activities',
            'creator': user,
            'is_private': False
        }
    )
    if created:
        print(f"Created test community: {community.name} (Join code: {community.join_code})")
    else:
        print(f"Using existing test community: {community.name} (Join code: {community.join_code})")
    
    # Create membership for the creator
    membership, created = CommunityMembership.objects.get_or_create(
        community=community,
        user=user,
        defaults={'role': 'admin'}
    )
    if created:
        print(f"Created membership for {user.username} as {membership.role}")
    else:
        print(f"Membership already exists for {user.username} as {membership.role}")
    
    # Update member count
    community.member_count = community.memberships.filter(is_active=True).count()
    community.save()
    
    # Create a test message
    message, created = CommunityMessage.objects.get_or_create(
        community=community,
        sender=user,
        content='Welcome to our eco-friendly community! 🌱',
        defaults={'message_type': 'announcement'}
    )
    if created:
        print(f"Created test message: {message.content}")
    else:
        print(f"Test message already exists: {message.content}")
    
    print(f"\nCommunity Summary:")
    print(f"- Name: {community.name}")
    print(f"- Members: {community.member_count}")
    print(f"- Messages: {community.messages.count()}")
    print(f"- Join Code: {community.join_code}")
    print(f"- Is Private: {community.is_private}")
    
    print("\nTest completed successfully! ✅")


if __name__ == '__main__':
    test_community_creation()