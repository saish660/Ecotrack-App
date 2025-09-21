#!/usr/bin/env python
"""
Generate VAPID keys for Web Push notifications
"""
from py_vapid import Vapid
import base64

# Generate VAPID key pair
vapid_instance = Vapid()
vapid_instance.generate_keys()

# Get the keys
private_key = vapid_instance.private_pem()

# Get public key in correct format
public_key_raw = vapid_instance.public_key.public_numbers().x.to_bytes(32, 'big') + vapid_instance.public_key.public_numbers().y.to_bytes(32, 'big')
public_key_b64 = base64.urlsafe_b64encode(b'\x04' + public_key_raw).decode().rstrip('=')

print("VAPID Keys Generated:")
print("=" * 50)
print("VAPID_PRIVATE_KEY = '''")
print(private_key.decode() if isinstance(private_key, bytes) else private_key)
print("'''")
print()
print(f"VAPID_PUBLIC_KEY = '{public_key_b64}'")
print("=" * 50)
print("Add these to your settings.py")