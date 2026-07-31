#!/usr/bin/env python3
import requests

BASE_URL = "https://saltwell-arch.preview.emergentagent.com/api"
ADMIN_EMAIL = "admin@saltworld.in"
ADMIN_PASSWORD = "SaltWorld@2025"
CUSTOMER_ID = "cb51fc79-fd77-4ddb-bf0d-3ce74396188f"

# Login as admin
resp = requests.post(f"{BASE_URL}/admin/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
admin_cookie = resp.cookies.get("sw_admin")

# Get customer's subscriptions
resp = requests.get(f"{BASE_URL}/admin/memberships/subs", cookies={"sw_admin": admin_cookie})
subs = resp.json()

print("Subscriptions for customer", CUSTOMER_ID)
print("="*80)
for sub in subs:
    if sub.get("customerId") == CUSTOMER_ID:
        print(f"\nID: {sub.get('id')}")
        print(f"Plan Name: {sub.get('planName')}")
        print(f"Status: {sub.get('status')}")
        print(f"Type: {sub.get('planSnapshot', {}).get('type')}")
        print(f"Sessions Remaining: {sub.get('sessionsRemaining')}")
        print(f"Applicable Therapies: {sub.get('planSnapshot', {}).get('applicableTherapies')}")
        print(f"Start: {sub.get('startAt')}")
        print(f"End: {sub.get('endAt')}")
        print("-"*80)
