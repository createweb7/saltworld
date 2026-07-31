#!/usr/bin/env python3
import requests
import json

BASE_URL = "https://saltwell-arch.preview.emergentagent.com/api"
PHONE = "9986388678"

# Login as customer
resp = requests.post(f"{BASE_URL}/customer/auth/request-otp", json={"phone": PHONE})
otp = resp.json().get("devOtp")
resp = requests.post(f"{BASE_URL}/customer/auth/verify-otp", json={"phone": PHONE, "otp": otp})
customer_cookie = resp.cookies.get("sw_customer")

# Check eligibility
resp = requests.get(
    f"{BASE_URL}/customer/subscriptions/eligible?therapies=salt-therapy",
    cookies={"sw_customer": customer_cookie}
)

print("Status:", resp.status_code)
print("Response:", json.dumps(resp.json(), indent=2))
