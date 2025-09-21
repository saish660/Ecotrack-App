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
                # Web-specific configuration
                webpush=messaging.WebpushConfig(
                    notification=messaging.WebpushNotification(
                        title=title,
                        body=body,
                        icon='/static/icons/ecotrack_logo.png',
                        badge='/static/icons/favicon-32x32.png',
                        tag='daily-reminder',
                        actions=[
                            messaging.WebpushNotificationAction(
                                action='open_app',
                                title='Open EcoTrack'
                            )
                        ]
                    ),
                    headers={
                        'TTL': '3600'  # Time to live in seconds
                    }
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
                webpush=messaging.WebpushConfig(
                    notification=messaging.WebpushNotification(
                        title=title,
                        body=body,
                        icon='/static/icons/ecotrack_logo.png',
                        badge='/static/icons/favicon-32x32.png',
                        tag='daily-reminder',
                        actions=[
                            messaging.WebpushNotificationAction(
                                action='open_app',
                                title='Open EcoTrack'
                            )
                        ]
                    ),
                    headers={
                        'TTL': '3600'
                    }
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
                webpush=messaging.WebpushConfig(
                    notification=messaging.WebpushNotification(
                        title=title,
                        body=body,
                        icon='/static/icons/ecotrack_logo.png',
                        badge='/static/icons/favicon-32x32.png',
                        tag='daily-reminder'
                    ),
                    headers={
                        'TTL': '3600'
                    }
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
                token=token
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