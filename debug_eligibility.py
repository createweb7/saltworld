#!/usr/bin/env python3
import requests
import json

BASE_URL = "https://saltwell-arch.preview.emergentagent.com/api"
ADMIN_EMAIL = "admin@saltworld.in"
ADMIN_PASSWORD = "SaltWorld@2025"

# Login as admin
resp = requests.post(f"{BASE_URL}/admin/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
admin_cookie = resp.cookies.get("sw_admin")

# Get the Salt Cave subscription details
resp = requests.get(f"{BASE_URL}/admin/memberships/subs", cookies={"sw_admin": admin_cookie})
subs = resp.json()

for sub in subs:
    if "Salt Cave" in sub.get("planName", ""):
        print("Salt Cave Subscription:")
        print(json.dumps(sub, indent=2))
        break
