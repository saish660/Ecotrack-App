"""
Firebase Cloud Messaging (FCM) service for EcoTrack push notifications.
This module handles sending push notifications using Firebase Admin SDK.
"""

import firebase_admin
from firebase_admin import credentials, messaging
from django.conf import settings
import logging
from typing import List, Dict, Optional
import json

logger = logging.getLogger(__name__)


class FCMService:
    """Firebase Cloud Messaging service for sending push notifications."""
    
    _app = None
    
    @classmethod
    def initialize(cls):
        """Initialize Firebase Admin SDK."""
        if cls._app is None:
            try:
                # Initialize with service account key
                cred = credentials.Certificate(settings.FIREBASE_SERVICE_ACCOUNT_KEY)
                cls._app = firebase_admin.initialize_app(cred)
                logger.info("Firebase Admin SDK initialized successfully")
            except Exception as e:
                logger.error(f"Failed to initialize Firebase Admin SDK: {e}")
                raise
    
    @classmethod
    def send_notification(cls, token: str, title: str, body: str, data: Optional[Dict] = None) -> bool:
        """
        Send a single FCM notification.
        
        Args:
            token: FCM registration token
            title: Notification title
            body: Notification body
            data: Optional data payload
        
        Returns:
            bool: True if sent successfully, False otherwise
        """
        cls.initialize()
        
        try:
            # Validate token format first
            if not token or len(token.strip()) == 0:
                logger.error("Empty or invalid FCM token provided")
                return False
            
            # Create notification
            notification = messaging.Notification(
                title=title,
                body=body
            )
            
            # Create data payload if provided
            data_payload = data if data else {}
            
            # Create message
            message = messaging.Message(
                notification=notification,
                data=data_payload,
                token=token,
                # Android-specific configuration
                android=messaging.AndroidConfig(
                    ttl=3600,  # Time to live in seconds
                    priority='high',
                    notification=messaging.AndroidNotification(
                        title=title,
                        body=body,
                        icon='ic_notification',  # Use app's notification icon
                        color='#4CAF50',  # Green color for eco theme
                        sound='default',
                        click_action='FLUTTER_NOTIFICATION_CLICK',  # For Flutter apps
                        channel_id='ecotrack_notifications'  # Notification channel
                    ),
                    collapse_key='ecotrack_reminder',  # Collapse similar notifications
                )
            )
            
            # Send message
            response = messaging.send(message)
            logger.info(f"FCM notification sent successfully. Response: {response}")
            return True
            
        except messaging.UnregisteredError as e:
            logger.warning(f"FCM token is unregistered: {token[:20]}... - {e}")
            return False
        except messaging.SenderIdMismatchError as e:
            logger.error(f"Sender ID mismatch for token {token[:20]}... - {e}")
            return False
        except messaging.QuotaExceededError as e:
            logger.error(f"FCM quota exceeded: {e}")
            return False
        except messaging.ThirdPartyAuthError as e:
            logger.error(f"Third party auth error: {e}")
            return False
        except ValueError as e:
            logger.error(f"Invalid message format: {e}")
            return False
        except Exception as e:
            logger.error(f"Failed to send FCM notification to token {token[:20]}...: {type(e).__name__} - {e}")
            return False
    
    @classmethod
    def send_multicast(cls, tokens: List[str], title: str, body: str, data: Optional[Dict] = None) -> Dict:
        """
        Send FCM notification to multiple tokens.
        
        Args:
            tokens: List of FCM registration tokens
            title: Notification title
            body: Notification body
            data: Optional data payload
        
        Returns:
            dict: Results with success_count, failure_count, and failed_tokens
        """
        cls.initialize()
        
        if not tokens:
            return {'success_count': 0, 'failure_count': 0, 'failed_tokens': []}
        
        try:
            # Create notification
            notification = messaging.Notification(
                title=title,
                body=body
            )
            
            # Create data payload if provided
            data_payload = data if data else {}
            
            # Create multicast message
            message = messaging.MulticastMessage(
                notification=notification,
                data=data_payload,
                tokens=tokens,
                android=messaging.AndroidConfig(
                    ttl=3600,
                    priority='high',
                    notification=messaging.AndroidNotification(
                        title=title,
                        body=body,
                        icon='ic_notification',
                        color='#4CAF50',
                        sound='default',
                        click_action='FLUTTER_NOTIFICATION_CLICK',
                        channel_id='ecotrack_notifications'
                    ),
                    collapse_key='ecotrack_reminder',
                )
            )
            
            # Send multicast message
            response = messaging.send_multicast(message)
            
            # Process response
            failed_tokens = []
            for i, resp in enumerate(response.responses):
                if not resp.success:
                    failed_tokens.append(tokens[i])
                    logger.warning(f"Failed to send to token {tokens[i][:20]}...: {resp.exception}")
            
            result = {
                'success_count': response.success_count,
                'failure_count': response.failure_count,
                'failed_tokens': failed_tokens
            }
            
            logger.info(f"Multicast FCM sent. Success: {result['success_count']}, Failed: {result['failure_count']}")
            return result
            
        except Exception as e:
            logger.error(f"Failed to send multicast FCM notification: {e}")
            return {'success_count': 0, 'failure_count': len(tokens), 'failed_tokens': tokens}
    
    @classmethod
    def send_to_topic(cls, topic: str, title: str, body: str, data: Optional[Dict] = None) -> bool:
        """
        Send FCM notification to a topic.
        
        Args:
            topic: Topic name
            title: Notification title
            body: Notification body
            data: Optional data payload
        
        Returns:
            bool: True if sent successfully, False otherwise
        """
        cls.initialize()
        
        try:
            # Create notification
            notification = messaging.Notification(
                title=title,
                body=body
            )
            
            # Create data payload if provided
            data_payload = data if data else {}
            
            # Create message
            message = messaging.Message(
                notification=notification,
                data=data_payload,
                topic=topic,
                android=messaging.AndroidConfig(
                    ttl=3600,
                    priority='high',
                    notification=messaging.AndroidNotification(
                        title=title,
                        body=body,
                        icon='ic_notification',
                        color='#4CAF50',
                        sound='default',
                        click_action='FLUTTER_NOTIFICATION_CLICK',
                        channel_id='ecotrack_notifications'
                    )
                )
            )
            
            # Send message
            response = messaging.send(message)
            logger.info(f"FCM topic notification sent successfully. Response: {response}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send FCM topic notification: {e}")
            return False
    
    @classmethod
    def validate_token(cls, token: str) -> bool:
        """
        Validate an FCM token by sending a test message.
        
        Args:
            token: FCM registration token
        
        Returns:
            bool: True if token is valid, False otherwise
        """
        try:
            cls.initialize()
            # Send a test message with dry_run=True
            message = messaging.Message(
                data={'test': 'true'},
                token=token,
                android=messaging.AndroidConfig(
                    ttl=3600,
                    priority='normal'
                )
            )
            
            # This will validate the token without actually sending
            messaging.send(message, dry_run=True)
            return True
        except messaging.UnregisteredError:
            logger.warning("validate_token: Unregistered token")
            return False
        except Exception as e:
            logger.error(f"validate_token: Exception during token validation: {type(e).__name__} - {e}")
            return False
    
    @classmethod
    def send_data_message(cls, token: str, data: Dict) -> bool:
        """
        Send a data-only message (silent notification) to Android.
        
        Args:
            token: FCM registration token
            data: Data payload
        
        Returns:
            bool: True if sent successfully, False otherwise
        """
        cls.initialize()
        
        try:
            # Create data-only message for Android
            message = messaging.Message(
                data=data,
                token=token,
                android=messaging.AndroidConfig(
                    ttl=3600,
                    priority='high',
                    collapse_key='ecotrack_data',
                )
            )
            
            response = messaging.send(message)
            logger.info(f"FCM data message sent successfully. Response: {response}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send FCM data message: {e}")
            return False
    
    @classmethod
    def subscribe_to_topic(cls, tokens: List[str], topic: str) -> Dict:
        """
        Subscribe devices to a topic for targeted messaging.
        
        Args:
            tokens: List of FCM registration tokens
            topic: Topic name
        
        Returns:
            dict: Results with success_count and failure_count
        """
        cls.initialize()
        
        try:
            response = messaging.subscribe_to_topic(tokens, topic)
            logger.info(f"Subscribed {response.success_count} devices to topic '{topic}'")
            return {
                'success_count': response.success_count,
                'failure_count': response.failure_count
            }
        except Exception as e:
            logger.error(f"Failed to subscribe to topic '{topic}': {e}")
            return {'success_count': 0, 'failure_count': len(tokens)}
    
    @classmethod
    def unsubscribe_from_topic(cls, tokens: List[str], topic: str) -> Dict:
        """
        Unsubscribe devices from a topic.
        
        Args:
            tokens: List of FCM registration tokens
            topic: Topic name
        
        Returns:
            dict: Results with success_count and failure_count
        """
        cls.initialize()
        
        try:
            response = messaging.unsubscribe_from_topic(tokens, topic)
            logger.info(f"Unsubscribed {response.success_count} devices from topic '{topic}'")
            return {
                'success_count': response.success_count,
                'failure_count': response.failure_count
            }
        except Exception as e:
            logger.error(f"Failed to unsubscribe from topic '{topic}': {e}")
            return {'success_count': 0, 'failure_count': len(tokens)}