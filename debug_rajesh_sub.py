#!/usr/bin/env python3
import requests
import json

BASE_URL = "https://saltwell-arch.preview.emergentagent.com/api"
ADMIN_EMAIL = "admin@saltworld.in"
ADMIN_PASSWORD = "SaltWorld@2025"
CUSTOMER_ID = "cb51fc79-fd77-4ddb-bf0d-3ce74396188f"

# Login as admin
resp = requests.post(f"{BASE_URL}/admin/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
admin_cookie = resp.cookies.get("sw_admin")

# Get the Salt Cave subscription for Rajesh
resp = requests.get(f"{BASE_URL}/admin/memberships/subs", cookies={"sw_admin": admin_cookie})
subs = resp.json()

for sub in subs:
    if sub.get("customerId") == CUSTOMER_ID and "Salt Cave" in sub.get("planName", ""):
        print("Rajesh's Salt Cave Subscription:")
        print(json.dumps(sub, indent=2))
        
        # Check usage
        sub_id = sub.get("id")
        resp = requests.get(f"{BASE_URL}/admin/memberships/subs/{sub_id}/usage", cookies={"sw_admin": admin_cookie})
        usage = resp.json()
        print(f"\nUsage records: {len(usage)}")
        if usage:
            print("Recent usage:")
            for u in usage[:3]:
                print(f"  - {u.get('consumedAt')}: {u.get('therapySlug')}")
        break
