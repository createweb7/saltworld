#!/usr/bin/env python3
"""
31-AUG-2026 Bug Fix Verification — Backend Testing
===================================================

Tests the three critical bug fixes:
1. Early-morning cutoff rule (extended)
2. Cross-service buffer for INDEPENDENT bookings
3. Regression tests for all previous fixes

Test Groups:
- GROUP A: Early-morning cutoff (A1-A7)
- GROUP B: Cross-service buffer (B1-B7)
- GROUP C: Regression from all previous fixes (C1-C8)
- GROUP D: Order-independence + multi-therapy (D1-D2)
"""

import requests
import json
from datetime import datetime, timedelta
import sys

BASE_URL = "https://saltwell-arch.preview.emergentagent.com/api"
ADMIN_EMAIL = "admin@saltworld.in"
ADMIN_PASSWORD = "SaltWorld@2025"

# Test state
admin_cookie = None
test_bookings = []
test_customer_phone = "919777888999"
test_customer_cookie = None

def log(msg):
    print(f"[TEST] {msg}")

def log_pass(test_id, msg):
    print(f"✅ {test_id}: {msg}")

def log_fail(test_id, msg):
    print(f"❌ {test_id}: {msg}")
    
def log_info(msg):
    print(f"ℹ️  {msg}")

# ============================================================================
# SETUP: Admin Login
# ============================================================================
def admin_login():
    global admin_cookie
    log("Logging in as admin...")
    r = requests.post(f"{BASE_URL}/admin/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if r.status_code != 200:
        log_fail("SETUP", f"Admin login failed: {r.status_code} {r.text}")
        sys.exit(1)
    admin_cookie = r.cookies.get("sw_admin")
    if not admin_cookie:
        log_fail("SETUP", "No sw_admin cookie returned")
        sys.exit(1)
    log_pass("SETUP", f"Admin logged in successfully")

# ============================================================================
# SETUP: Customer OTP Login
# ============================================================================
def customer_login():
    global test_customer_cookie
    log(f"Logging in as customer with phone {test_customer_phone}...")
    
    # Request OTP
    r1 = requests.post(f"{BASE_URL}/customer/auth/request-otp", json={
        "phone": test_customer_phone
    })
    if r1.status_code != 200:
        log_fail("SETUP", f"OTP request failed: {r1.status_code} {r1.text}")
        sys.exit(1)
    
    data = r1.json()
    otp = data.get("devOtp") or data.get("otp")
    if not otp:
        log_fail("SETUP", "No OTP returned in dev mode")
        sys.exit(1)
    
    log_info(f"OTP received: {otp}")
    
    # Verify OTP
    r2 = requests.post(f"{BASE_URL}/customer/auth/verify-otp", json={
        "phone": test_customer_phone,
        "otp": otp
    })
    if r2.status_code != 200:
        log_fail("SETUP", f"OTP verify failed: {r2.status_code} {r2.text}")
        sys.exit(1)
    
    test_customer_cookie = r2.cookies.get("sw_customer")
    if not test_customer_cookie:
        log_fail("SETUP", "No sw_customer cookie returned")
        sys.exit(1)
    
    log_pass("SETUP", f"Customer logged in successfully")

# ============================================================================
# HELPER: Get IST time string
# ============================================================================
def get_ist_time(dt):
    """Convert UTC datetime to IST time string (HH:MM)"""
    ist_dt = dt + timedelta(hours=5, minutes=30)
    return ist_dt.strftime("%H:%M")

def get_ist_date(dt):
    """Convert UTC datetime to IST date string (YYYY-MM-DD)"""
    ist_dt = dt + timedelta(hours=5, minutes=30)
    return ist_dt.strftime("%Y-%m-%d")

# ============================================================================
# GROUP A: Early-morning cutoff (extended)
# ============================================================================
def test_group_a():
    log("\n" + "="*80)
    log("GROUP A: Early-morning cutoff (extended)")
    log("="*80)
    
    # A1: Import assertCanBook and pass nowIso=<today 07:26 IST>, startIso=<today 08:00 IST>, therapies=['salt-therapy']
    # Expect ok:false, code:'next_day_early_cutoff'
    log("\nA1: Early morning booking (07:26 AM) for 08:00 slot (salt-therapy)")
    now_utc = datetime.utcnow()
    # Set now to 07:26 IST (01:56 UTC)
    now_ist_726 = now_utc.replace(hour=1, minute=56, second=0, microsecond=0)
    # Set start to 08:00 IST (02:30 UTC) same day
    start_ist_800 = now_utc.replace(hour=2, minute=30, second=0, microsecond=0)
    
    # Use today's date for the slot
    today_date = get_ist_date(now_utc)
    
    r = requests.post(f"{BASE_URL}/bookings", json={
        "therapies": [{"slug": "salt-therapy"}],
        "slotDate": today_date,
        "slotTime": "08:00",
        "contact": {
            "name": "Test User A1",
            "phone": "919777888991",
            "email": "testa1@test.com"
        },
        "total": 1600,
        "_testNowIso": now_ist_726.isoformat() + "Z"  # Override now for testing
    })
    
    if r.status_code == 400:
        data = r.json()
        if data.get("error") == "next_day_early_cutoff":
            log_pass("A1", "Early morning cutoff enforced correctly (07:26 AM → 08:00 slot rejected)")
        else:
            log_fail("A1", f"Wrong error: {data.get('error')}")
    else:
        log_fail("A1", f"Expected 400, got {r.status_code}")
    
    # A2: Same but startIso=<today 09:00 IST> → expect ok:true (past bucket cutoff time)
    log("\nA2: Early morning booking (07:26 AM) for 09:00 slot (salt-therapy)")
    r = requests.post(f"{BASE_URL}/bookings", json={
        "therapies": [{"slug": "salt-therapy"}],
        "slotDate": today_date,
        "slotTime": "09:00",
        "contact": {
            "name": "Test User A2",
            "phone": "919777888992",
            "email": "testa2@test.com"
        },
        "total": 1600,
        "_testNowIso": now_ist_726.isoformat() + "Z"
    })
    
    if r.status_code in [200, 409]:  # 200 = success, 409 = slot taken (both acceptable)
        log_pass("A2", f"09:00 slot allowed (past bucket cutoff) - status {r.status_code}")
    else:
        log_fail("A2", f"Expected 200/409, got {r.status_code}: {r.text}")
    
    # A3: nowIso=<today 15:00 IST>, startIso=<tomorrow 08:00> → expect ok:true (deadline = today 21:00 not yet passed)
    log("\nA3: Afternoon booking (15:00) for tomorrow 08:00 slot (salt-therapy)")
    tomorrow_date = get_ist_date(now_utc + timedelta(days=1))
    now_ist_1500 = now_utc.replace(hour=9, minute=30, second=0, microsecond=0)  # 15:00 IST = 09:30 UTC
    
    r = requests.post(f"{BASE_URL}/bookings", json={
        "therapies": [{"slug": "salt-therapy"}],
        "slotDate": tomorrow_date,
        "slotTime": "08:00",
        "contact": {
            "name": "Test User A3",
            "phone": "919777888993",
            "email": "testa3@test.com"
        },
        "total": 1600,
        "_testNowIso": now_ist_1500.isoformat() + "Z"
    })
    
    if r.status_code in [200, 409]:
        log_pass("A3", f"Tomorrow 08:00 slot allowed at 15:00 today - status {r.status_code}")
        if r.status_code == 200:
            test_bookings.append(r.json().get("id"))
    else:
        log_fail("A3", f"Expected 200/409, got {r.status_code}: {r.text}")
    
    # A4: nowIso=<today 21:30 IST>, startIso=<tomorrow 08:00> → expect ok:false, code:'next_day_early_cutoff'
    log("\nA4: Late evening booking (21:30) for tomorrow 08:00 slot (salt-therapy)")
    now_ist_2130 = now_utc.replace(hour=16, minute=0, second=0, microsecond=0)  # 21:30 IST = 16:00 UTC
    
    r = requests.post(f"{BASE_URL}/bookings", json={
        "therapies": [{"slug": "salt-therapy"}],
        "slotDate": tomorrow_date,
        "slotTime": "08:00",
        "contact": {
            "name": "Test User A4",
            "phone": "919777888994",
            "email": "testa4@test.com"
        },
        "total": 1600,
        "_testNowIso": now_ist_2130.isoformat() + "Z"
    })
    
    if r.status_code == 400:
        data = r.json()
        if data.get("error") == "next_day_early_cutoff":
            log_pass("A4", "Late evening cutoff enforced correctly (21:30 → tomorrow 08:00 rejected)")
        else:
            log_fail("A4", f"Wrong error: {data.get('error')}")
    else:
        log_fail("A4", f"Expected 400, got {r.status_code}")
    
    # A5: nowIso=<today 21:30 IST>, startIso=<tomorrow 09:00> → expect ok:true for salt (past 08:30 bucket cutoff)
    log("\nA5: Late evening booking (21:30) for tomorrow 09:00 slot (salt-therapy)")
    r = requests.post(f"{BASE_URL}/bookings", json={
        "therapies": [{"slug": "salt-therapy"}],
        "slotDate": tomorrow_date,
        "slotTime": "09:00",
        "contact": {
            "name": "Test User A5",
            "phone": "919777888995",
            "email": "testa5@test.com"
        },
        "total": 1600,
        "_testNowIso": now_ist_2130.isoformat() + "Z"
    })
    
    if r.status_code in [200, 409]:
        log_pass("A5", f"Tomorrow 09:00 slot allowed at 21:30 (past bucket cutoff) - status {r.status_code}")
        if r.status_code == 200:
            test_bookings.append(r.json().get("id"))
    else:
        log_fail("A5", f"Expected 200/409, got {r.status_code}: {r.text}")
    
    # A6: Float rule: nowIso=<today 21:30 IST>, startIso=<tomorrow 09:00> for FLOAT → expect ok:false (float bucket cutoff = 09:00)
    log("\nA6: Late evening booking (21:30) for tomorrow 09:00 slot (float-therapy)")
    r = requests.post(f"{BASE_URL}/bookings", json={
        "therapies": [{"slug": "float-therapy"}],
        "slotDate": tomorrow_date,
        "slotTime": "09:00",
        "contact": {
            "name": "Test User A6",
            "phone": "919777888996",
            "email": "testa6@test.com"
        },
        "total": 3000,
        "_testNowIso": now_ist_2130.isoformat() + "Z"
    })
    
    if r.status_code == 400:
        data = r.json()
        if data.get("error") == "next_day_early_cutoff":
            log_pass("A6", "Float cutoff enforced correctly (21:30 → tomorrow 09:00 rejected)")
        else:
            log_fail("A6", f"Wrong error: {data.get('error')}")
    else:
        log_fail("A6", f"Expected 400, got {r.status_code}")
    
    # A7: Float: startIso=<tomorrow 09:15> → expect ok:true for float
    log("\nA7: Late evening booking (21:30) for tomorrow 09:15 slot (float-therapy)")
    r = requests.post(f"{BASE_URL}/bookings", json={
        "therapies": [{"slug": "float-therapy"}],
        "slotDate": tomorrow_date,
        "slotTime": "09:15",
        "contact": {
            "name": "Test User A7",
            "phone": "919777888997",
            "email": "testa7@test.com"
        },
        "total": 3000,
        "_testNowIso": now_ist_2130.isoformat() + "Z"
    })
    
    if r.status_code in [200, 409]:
        log_pass("A7", f"Tomorrow 09:15 float slot allowed at 21:30 (past bucket cutoff) - status {r.status_code}")
        if r.status_code == 200:
            test_bookings.append(r.json().get("id"))
    else:
        log_fail("A7", f"Expected 200/409, got {r.status_code}: {r.text}")

# ============================================================================
# GROUP B: Cross-service buffer
# ============================================================================
def test_group_b():
    log("\n" + "="*80)
    log("GROUP B: Cross-service buffer")
    log("="*80)
    
    # Use fresh customer phone and future date (today + 6 days)
    future_date = get_ist_date(datetime.utcnow() + timedelta(days=6))
    customer_phone = test_customer_phone
    
    # B1: Book salt-therapy at 10:00 IST. Verify 200.
    log("\nB1: Book salt-therapy at 10:00 IST")
    r = requests.post(f"{BASE_URL}/bookings", json={
        "therapies": [{"slug": "salt-therapy"}],
        "slotDate": future_date,
        "slotTime": "10:00",
        "contact": {
            "name": "Test User B",
            "phone": customer_phone,
            "email": "testb@test.com"
        },
        "total": 1600
    }, cookies={"sw_customer": test_customer_cookie} if test_customer_cookie else None)
    
    if r.status_code == 200:
        booking_id = r.json().get("id")
        test_bookings.append(booking_id)
        log_pass("B1", f"Salt-therapy booked at 10:00 - ID: {booking_id}")
    else:
        log_fail("B1", f"Expected 200, got {r.status_code}: {r.text}")
        return
    
    # B2: IR at 11:15 (15-min gap from salt end 11:00) → expect 400 cross_service_buffer (needs 20-min max)
    log("\nB2: Book infrared-sauna at 11:15 (15-min gap from salt end)")
    r = requests.post(f"{BASE_URL}/bookings", json={
        "therapies": [{"slug": "infrared-sauna"}],
        "slotDate": future_date,
        "slotTime": "11:15",
        "contact": {
            "name": "Test User B",
            "phone": customer_phone,
            "email": "testb@test.com"
        },
        "total": 1500
    }, cookies={"sw_customer": test_customer_cookie} if test_customer_cookie else None)
    
    if r.status_code == 400:
        data = r.json()
        if data.get("error") == "cross_service_buffer":
            log_pass("B2", "Cross-service buffer enforced (15-min gap insufficient, needs 20-min)")
        else:
            log_fail("B2", f"Wrong error: {data.get('error')}")
    else:
        log_fail("B2", f"Expected 400, got {r.status_code}")
    
    # B3: IR at 11:20 (20-min gap) → expect 200
    log("\nB3: Book infrared-sauna at 11:20 (20-min gap from salt end)")
    r = requests.post(f"{BASE_URL}/bookings", json={
        "therapies": [{"slug": "infrared-sauna"}],
        "slotDate": future_date,
        "slotTime": "11:20",
        "contact": {
            "name": "Test User B",
            "phone": customer_phone,
            "email": "testb@test.com"
        },
        "total": 1500
    }, cookies={"sw_customer": test_customer_cookie} if test_customer_cookie else None)
    
    if r.status_code == 200:
        booking_id = r.json().get("id")
        test_bookings.append(booking_id)
        log_pass("B3", f"Infrared-sauna booked at 11:20 (20-min gap satisfied) - ID: {booking_id}")
    else:
        log_fail("B3", f"Expected 200, got {r.status_code}: {r.text}")
    
    # B4: Same customer books cold-plunge at 12:20 (IR ends 11:50, needs max(IR=20, CP=30)=30 gap → 12:20 is exactly 30 min after IR end) → expect 200
    log("\nB4: Book cold-plunge at 12:20 (30-min gap from IR end)")
    r = requests.post(f"{BASE_URL}/bookings", json={
        "therapies": [{"slug": "cold-plunge"}],
        "slotDate": future_date,
        "slotTime": "12:20",
        "contact": {
            "name": "Test User B",
            "phone": customer_phone,
            "email": "testb@test.com"
        },
        "total": 1000
    }, cookies={"sw_customer": test_customer_cookie} if test_customer_cookie else None)
    
    if r.status_code == 200:
        booking_id = r.json().get("id")
        test_bookings.append(booking_id)
        log_pass("B4", f"Cold-plunge booked at 12:20 (30-min gap satisfied) - ID: {booking_id}")
    else:
        log_fail("B4", f"Expected 200, got {r.status_code}: {r.text}")
    
    # B5: Same customer books cold-plunge at 12:15 (25-min gap) → expect 400 cross_service_buffer
    log("\nB5: Book cold-plunge at 12:15 (25-min gap from IR end)")
    r = requests.post(f"{BASE_URL}/bookings", json={
        "therapies": [{"slug": "cold-plunge"}],
        "slotDate": future_date,
        "slotTime": "12:15",
        "contact": {
            "name": "Test User B",
            "phone": customer_phone,
            "email": "testb@test.com"
        },
        "total": 1000
    }, cookies={"sw_customer": test_customer_cookie} if test_customer_cookie else None)
    
    if r.status_code == 400:
        data = r.json()
        if data.get("error") == "cross_service_buffer":
            log_pass("B5", "Cross-service buffer enforced (25-min gap insufficient, needs 30-min)")
        else:
            log_fail("B5", f"Wrong error: {data.get('error')}")
    else:
        log_fail("B5", f"Expected 400, got {r.status_code}")
    
    # B6: Different customer books salt at 10:00 same date → should succeed (or fail only on capacity, not cross-buffer)
    log("\nB6: Different customer books salt-therapy at 10:00 (same time as B1)")
    r = requests.post(f"{BASE_URL}/bookings", json={
        "therapies": [{"slug": "salt-therapy"}],
        "slotDate": future_date,
        "slotTime": "10:00",
        "contact": {
            "name": "Test User B6",
            "phone": "919777888998",
            "email": "testb6@test.com"
        },
        "total": 1600
    })
    
    if r.status_code in [200, 409]:
        if r.status_code == 200:
            booking_id = r.json().get("id")
            test_bookings.append(booking_id)
            log_pass("B6", f"Different customer booked salt at 10:00 (no cross-buffer conflict) - ID: {booking_id}")
        else:
            log_pass("B6", "Different customer booking failed on capacity (acceptable, not cross-buffer)")
    else:
        log_fail("B6", f"Expected 200/409, got {r.status_code}: {r.text}")
    
    # B7: Same customer books ANOTHER salt-therapy at 12:30 (buffer already satisfied) → expect 200 (multi-session same therapy allowed)
    log("\nB7: Same customer books another salt-therapy at 12:30")
    r = requests.post(f"{BASE_URL}/bookings", json={
        "therapies": [{"slug": "salt-therapy"}],
        "slotDate": future_date,
        "slotTime": "12:30",
        "contact": {
            "name": "Test User B",
            "phone": customer_phone,
            "email": "testb@test.com"
        },
        "total": 1600
    }, cookies={"sw_customer": test_customer_cookie} if test_customer_cookie else None)
    
    if r.status_code == 200:
        booking_id = r.json().get("id")
        test_bookings.append(booking_id)
        log_pass("B7", f"Same customer booked another salt at 12:30 (same therapy allowed) - ID: {booking_id}")
    else:
        log_fail("B7", f"Expected 200, got {r.status_code}: {r.text}")

# ============================================================================
# GROUP C: Regression from all previous fixes
# ============================================================================
def test_group_c():
    log("\n" + "="*80)
    log("GROUP C: Regression from all previous fixes")
    log("="*80)
    
    # C1: GET /api/therapies returns 7 rows with master config
    log("\nC1: GET /api/therapies returns 7 therapies with master config")
    r = requests.get(f"{BASE_URL}/therapies")
    if r.status_code == 200:
        therapies = r.json()
        if len(therapies) >= 7:
            # Check for expected therapies
            slugs = [t.get("slug") for t in therapies]
            expected = ["salt-therapy", "kids-salt-therapy", "float-therapy", "red-light-therapy", 
                       "infrared-sauna", "cold-plunge", "hot-cold-contrast"]
            found = [s for s in expected if s in slugs]
            if len(found) == 7:
                log_pass("C1", f"All 7 therapies found with correct config")
            else:
                log_fail("C1", f"Missing therapies: {set(expected) - set(found)}")
        else:
            log_fail("C1", f"Expected 7+ therapies, got {len(therapies)}")
    else:
        log_fail("C1", f"Expected 200, got {r.status_code}")
    
    # C2: GET /api/scheduling/recommendations returns 3 badged recs
    log("\nC2: GET /api/scheduling/recommendations for float-therapy")
    future_date = get_ist_date(datetime.utcnow() + timedelta(days=2))
    r = requests.get(f"{BASE_URL}/scheduling/recommendations", params={
        "therapies": "float-therapy",
        "date": future_date,
        "preferred": "10:00"
    })
    if r.status_code == 200:
        data = r.json()
        recs = data.get("recommendations", [])
        if len(recs) == 3:
            badges = [rec.get("badge") for rec in recs]
            if "best_match" in badges and "fastest_finish" in badges and "least_waiting" in badges:
                log_pass("C2", "3 badged recommendations returned correctly")
            else:
                log_fail("C2", f"Missing badges: {badges}")
        else:
            log_fail("C2", f"Expected 3 recommendations, got {len(recs)}")
    else:
        log_fail("C2", f"Expected 200, got {r.status_code}")
    
    # C3: POST /api/bookings with valid slot + valid email → 200
    log("\nC3: POST /api/bookings with valid email")
    future_date = get_ist_date(datetime.utcnow() + timedelta(days=3))
    r = requests.post(f"{BASE_URL}/bookings", json={
        "therapies": [{"slug": "salt-therapy"}],
        "slotDate": future_date,
        "slotTime": "10:00",
        "contact": {
            "name": "Test User C3",
            "phone": "919777889001",
            "email": "valid@example.com"
        },
        "total": 1600
    })
    if r.status_code in [200, 409]:
        if r.status_code == 200:
            test_bookings.append(r.json().get("id"))
        log_pass("C3", f"Valid email accepted - status {r.status_code}")
    else:
        log_fail("C3", f"Expected 200/409, got {r.status_code}")
    
    # C4: POST /api/bookings with foo@bar email → 400 invalid_email
    log("\nC4: POST /api/bookings with invalid email (foo@bar)")
    r = requests.post(f"{BASE_URL}/bookings", json={
        "therapies": [{"slug": "salt-therapy"}],
        "slotDate": future_date,
        "slotTime": "10:15",
        "contact": {
            "name": "Test User C4",
            "phone": "919777889002",
            "email": "foo@bar"
        },
        "total": 1600
    })
    if r.status_code == 400:
        data = r.json()
        if data.get("error") == "invalid_email":
            log_pass("C4", "Invalid email rejected correctly")
        else:
            log_fail("C4", f"Wrong error: {data.get('error')}")
    else:
        log_fail("C4", f"Expected 400, got {r.status_code}")
    
    # C5: POST /api/bookings for salt-therapy 5 min ahead → 400 below_min_lead_time (needs 30)
    log("\nC5: POST /api/bookings 5 min ahead (below min lead time)")
    now = datetime.utcnow()
    near_future = now + timedelta(minutes=5)
    near_date = get_ist_date(near_future)
    near_time = get_ist_time(near_future)
    
    r = requests.post(f"{BASE_URL}/bookings", json={
        "therapies": [{"slug": "salt-therapy"}],
        "slotDate": near_date,
        "slotTime": near_time,
        "contact": {
            "name": "Test User C5",
            "phone": "919777889003",
            "email": "testc5@test.com"
        },
        "total": 1600
    })
    if r.status_code == 400:
        data = r.json()
        if data.get("error") == "below_min_lead_time":
            log_pass("C5", "Min lead time enforced (5 min < 30 min required)")
        else:
            log_fail("C5", f"Wrong error: {data.get('error')}")
    else:
        log_fail("C5", f"Expected 400, got {r.status_code}")
    
    # C6: Admin login → all 6 admin endpoints respond 200
    log("\nC6: Admin endpoints verification")
    if not admin_cookie:
        log_fail("C6", "Admin not logged in")
        return
    
    endpoints = [
        "/admin/dashboard",
        "/admin/bookings",
        "/admin/memberships/subs",
        "/admin/customers",
        "/admin/settings/booking-rules",
        "/admin/services/therapies"
    ]
    
    all_ok = True
    for endpoint in endpoints:
        r = requests.get(f"{BASE_URL}{endpoint}", cookies={"sw_admin": admin_cookie})
        if r.status_code != 200:
            log_fail("C6", f"{endpoint} returned {r.status_code}")
            all_ok = False
    
    if all_ok:
        log_pass("C6", "All 6 admin endpoints respond 200")
    
    # C7: Paid membership cancel → 403 with cannot_cancel_paid_subscription
    log("\nC7: Paid membership cancel (should be blocked)")
    # First create a paid subscription
    r1 = requests.post(f"{BASE_URL}/admin/customers", json={
        "name": "Test Customer C7",
        "phone": "919777889004",
        "email": "testc7@test.com"
    }, cookies={"sw_admin": admin_cookie})
    
    if r1.status_code == 200:
        customer_id = r1.json().get("id")
        
        # Get a membership plan
        r2 = requests.get(f"{BASE_URL}/admin/memberships/plans", cookies={"sw_admin": admin_cookie})
        if r2.status_code == 200 and len(r2.json()) > 0:
            plan_id = r2.json()[0].get("id")
            
            # Create subscription with offline payment (will be active/paid)
            r3 = requests.post(f"{BASE_URL}/admin/memberships/subs", json={
                "customerId": customer_id,
                "membershipId": plan_id,
                "paymentMethod": "offline",
                "paymentRef": "TEST-C7"
            }, cookies={"sw_admin": admin_cookie})
            
            if r3.status_code == 200:
                sub_id = r3.json().get("id")
                
                # Try to cancel
                r4 = requests.post(f"{BASE_URL}/admin/memberships/subs/{sub_id}/cancel", json={
                    "reason": "test"
                }, cookies={"sw_admin": admin_cookie})
                
                if r4.status_code == 403:
                    data = r4.json()
                    if data.get("error") == "cannot_cancel_paid_subscription":
                        log_pass("C7", "Paid subscription cancel blocked correctly")
                    else:
                        log_fail("C7", f"Wrong error: {data.get('error')}")
                else:
                    log_fail("C7", f"Expected 403, got {r4.status_code}")
            else:
                log_fail("C7", f"Failed to create subscription: {r3.status_code}")
        else:
            log_fail("C7", "No membership plans found")
    else:
        log_fail("C7", f"Failed to create customer: {r1.status_code}")
    
    # C8: Pending membership cancel → 200
    log("\nC8: Pending membership cancel (should succeed)")
    # Create subscription with online payment (will be pending_payment)
    r1 = requests.post(f"{BASE_URL}/admin/customers", json={
        "name": "Test Customer C8",
        "phone": "919777889005",
        "email": "testc8@test.com"
    }, cookies={"sw_admin": admin_cookie})
    
    if r1.status_code == 200:
        customer_id = r1.json().get("id")
        
        # Get a membership plan
        r2 = requests.get(f"{BASE_URL}/admin/memberships/plans", cookies={"sw_admin": admin_cookie})
        if r2.status_code == 200 and len(r2.json()) > 0:
            plan_id = r2.json()[0].get("id")
            
            # Create subscription with online payment (will be pending_payment)
            r3 = requests.post(f"{BASE_URL}/admin/memberships/subs", json={
                "customerId": customer_id,
                "membershipId": plan_id,
                "paymentMethod": "online"
            }, cookies={"sw_admin": admin_cookie})
            
            if r3.status_code == 200:
                sub_id = r3.json().get("id")
                
                # Try to cancel
                r4 = requests.post(f"{BASE_URL}/admin/memberships/subs/{sub_id}/cancel", json={
                    "reason": "test"
                }, cookies={"sw_admin": admin_cookie})
                
                if r4.status_code == 200:
                    log_pass("C8", "Pending subscription cancelled successfully")
                else:
                    log_fail("C8", f"Expected 200, got {r4.status_code}: {r4.text}")
            else:
                log_fail("C8", f"Failed to create subscription: {r3.status_code}")
        else:
            log_fail("C8", "No membership plans found")
    else:
        log_fail("C8", f"Failed to create customer: {r1.status_code}")

# ============================================================================
# GROUP D: Order-independence + multi-therapy
# ============================================================================
def test_group_d():
    log("\n" + "="*80)
    log("GROUP D: Order-independence + multi-therapy")
    log("="*80)
    
    future_date = get_ist_date(datetime.utcnow() + timedelta(days=2))
    
    # D1: GET /api/scheduling/recommendations?therapies=cold-plunge,infrared-sauna vs reverse
    log("\nD1: Order independence test (cold-plunge,infrared-sauna vs reverse)")
    r1 = requests.get(f"{BASE_URL}/scheduling/recommendations", params={
        "therapies": "cold-plunge,infrared-sauna",
        "date": future_date,
        "preferred": "10:00"
    })
    
    r2 = requests.get(f"{BASE_URL}/scheduling/recommendations", params={
        "therapies": "infrared-sauna,cold-plunge",
        "date": future_date,
        "preferred": "10:00"
    })
    
    if r1.status_code == 200 and r2.status_code == 200:
        count1 = len(r1.json().get("recommendations", []))
        count2 = len(r2.json().get("recommendations", []))
        if count1 == count2 and count1 > 0:
            log_pass("D1", f"Order independence verified (both return {count1} recommendations)")
        else:
            log_fail("D1", f"Different counts: {count1} vs {count2}")
    else:
        log_fail("D1", f"Status codes: {r1.status_code}, {r2.status_code}")
    
    # D2: POST /api/bookings for multi-therapy [salt-therapy, red-light-therapy]
    log("\nD2: Multi-therapy booking (salt + red-light)")
    r = requests.post(f"{BASE_URL}/bookings", json={
        "therapies": [
            {"slug": "salt-therapy"},
            {"slug": "red-light-therapy"}
        ],
        "slotDate": future_date,
        "slotTime": "14:00",
        "contact": {
            "name": "Test User D2",
            "phone": "919777889006",
            "email": "testd2@test.com"
        },
        "total": 3100
    })
    
    if r.status_code in [200, 409]:
        if r.status_code == 200:
            data = r.json()
            schedule = data.get("schedule", [])
            if len(schedule) == 2:
                log_pass("D2", f"Multi-therapy booking created with 2-step schedule - ID: {data.get('id')}")
                test_bookings.append(data.get("id"))
            else:
                log_fail("D2", f"Expected 2 schedule steps, got {len(schedule)}")
        else:
            log_pass("D2", "Multi-therapy booking validation passed (slot taken)")
    else:
        log_fail("D2", f"Expected 200/409, got {r.status_code}: {r.text}")

# ============================================================================
# MAIN
# ============================================================================
def main():
    log("="*80)
    log("31-AUG-2026 BUG FIX VERIFICATION — BACKEND TESTING")
    log("="*80)
    
    # Setup
    admin_login()
    customer_login()
    
    # Run test groups
    test_group_a()
    test_group_b()
    test_group_c()
    test_group_d()
    
    # Summary
    log("\n" + "="*80)
    log("TEST SUMMARY")
    log("="*80)
    log_info(f"Total bookings created: {len(test_bookings)}")
    log_info("Review test output above for PASS/FAIL status")
    log("="*80)

if __name__ == "__main__":
    main()
