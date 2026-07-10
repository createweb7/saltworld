#!/usr/bin/env python3
"""
Salt World BOS Admin API - Phase 3.1 + 3.2 Test Suite
Tests all admin endpoints with authentication and proper cookie handling.
"""

import requests
import json
import re
from datetime import datetime, timedelta

# Base URL from .env
BASE_URL = "https://saltwell-arch.preview.emergentagent.com/api"

# Admin credentials
ADMIN_EMAIL = "admin@saltworld.in"
ADMIN_PASSWORD = "SaltWorld@2025"

# Session to maintain cookies
session = requests.Session()

# Test results tracking
tests_passed = 0
tests_failed = 0
test_results = []

def log_test(name, passed, details=""):
    global tests_passed, tests_failed
    if passed:
        tests_passed += 1
        print(f"✅ {name}")
    else:
        tests_failed += 1
        print(f"❌ {name}")
        if details:
            print(f"   Details: {details}")
    test_results.append({"name": name, "passed": passed, "details": details})

def test_phase_3_1_auth():
    """Test Phase 3.1: Authentication & Middleware"""
    print("\n=== PHASE 3.1: AUTH & MIDDLEWARE ===\n")
    
    # Test 1: Login with correct credentials
    try:
        resp = session.post(f"{BASE_URL}/admin/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if resp.status_code == 200:
            data = resp.json()
            if "user" in data and data["user"]["email"] == ADMIN_EMAIL and data["user"]["role"] == "super_admin":
                if "_id" not in data["user"] and "passwordHash" not in data["user"]:
                    log_test("Auth: Login with correct credentials", True)
                    # Check cookie is set
                    if "sw_admin" in session.cookies:
                        log_test("Auth: Session cookie 'sw_admin' set", True)
                    else:
                        log_test("Auth: Session cookie 'sw_admin' set", False, "Cookie not found in session")
                else:
                    log_test("Auth: Login with correct credentials", False, "Response contains _id or passwordHash")
            else:
                log_test("Auth: Login with correct credentials", False, f"Invalid user data: {data}")
        else:
            log_test("Auth: Login with correct credentials", False, f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        log_test("Auth: Login with correct credentials", False, str(e))
    
    # Test 2: Login with wrong password
    try:
        temp_session = requests.Session()
        resp = temp_session.post(f"{BASE_URL}/admin/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": "WrongPassword123"
        })
        if resp.status_code == 401:
            data = resp.json()
            if data.get("error") == "invalid_credentials":
                log_test("Auth: Login with wrong password returns 401", True)
            else:
                log_test("Auth: Login with wrong password returns 401", False, f"Wrong error: {data}")
        else:
            log_test("Auth: Login with wrong password returns 401", False, f"Status {resp.status_code}")
    except Exception as e:
        log_test("Auth: Login with wrong password returns 401", False, str(e))
    
    # Test 3: GET /me without cookie
    try:
        temp_session = requests.Session()
        resp = temp_session.get(f"{BASE_URL}/admin/auth/me")
        if resp.status_code == 401:
            log_test("Auth: GET /me without cookie returns 401", True)
        else:
            log_test("Auth: GET /me without cookie returns 401", False, f"Status {resp.status_code}")
    except Exception as e:
        log_test("Auth: GET /me without cookie returns 401", False, str(e))
    
    # Test 4: GET /me with cookie
    try:
        resp = session.get(f"{BASE_URL}/admin/auth/me")
        if resp.status_code == 200:
            data = resp.json()
            if "user" in data and data["user"]["email"] == ADMIN_EMAIL:
                log_test("Auth: GET /me with cookie returns user", True)
            else:
                log_test("Auth: GET /me with cookie returns user", False, f"Invalid data: {data}")
        else:
            log_test("Auth: GET /me with cookie returns user", False, f"Status {resp.status_code}")
    except Exception as e:
        log_test("Auth: GET /me with cookie returns user", False, str(e))
    
    # Test 5: Forgot password flow
    try:
        resp = session.post(f"{BASE_URL}/admin/auth/forgot", json={
            "email": ADMIN_EMAIL
        })
        if resp.status_code == 200:
            data = resp.json()
            if data.get("ok") and "devLink" in data:
                # Extract token from devLink
                token_match = re.search(r'/admin/reset/([a-f0-9]+)', data["devLink"])
                if token_match:
                    reset_token = token_match.group(1)
                    log_test("Auth: Forgot password returns devLink", True)
                    
                    # Test 6: Reset password
                    new_password = "Reset@123"
                    resp2 = session.post(f"{BASE_URL}/admin/auth/reset", json={
                        "token": reset_token,
                        "password": new_password
                    })
                    if resp2.status_code == 200:
                        log_test("Auth: Reset password with token", True)
                        
                        # Test 7: Login with new password
                        temp_session = requests.Session()
                        resp3 = temp_session.post(f"{BASE_URL}/admin/auth/login", json={
                            "email": ADMIN_EMAIL,
                            "password": new_password
                        })
                        if resp3.status_code == 200:
                            log_test("Auth: Login with new password works", True)
                            
                            # Reset back to original password
                            resp4 = temp_session.post(f"{BASE_URL}/admin/auth/forgot", json={"email": ADMIN_EMAIL})
                            if resp4.status_code == 200:
                                data4 = resp4.json()
                                token_match2 = re.search(r'/admin/reset/([a-f0-9]+)', data4.get("devLink", ""))
                                if token_match2:
                                    reset_token2 = token_match2.group(1)
                                    resp5 = temp_session.post(f"{BASE_URL}/admin/auth/reset", json={
                                        "token": reset_token2,
                                        "password": ADMIN_PASSWORD
                                    })
                                    if resp5.status_code == 200:
                                        log_test("Auth: Reset back to original password", True)
                                    else:
                                        log_test("Auth: Reset back to original password", False, f"Status {resp5.status_code}")
                        else:
                            log_test("Auth: Login with new password works", False, f"Status {resp3.status_code}")
                    else:
                        log_test("Auth: Reset password with token", False, f"Status {resp2.status_code}")
                else:
                    log_test("Auth: Forgot password returns devLink", False, "Token not found in devLink")
            else:
                log_test("Auth: Forgot password returns devLink", False, f"Invalid response: {data}")
        else:
            log_test("Auth: Forgot password returns devLink", False, f"Status {resp.status_code}")
    except Exception as e:
        log_test("Auth: Forgot password returns devLink", False, str(e))
    
    # Test 8: Middleware - unauthenticated request
    try:
        temp_session = requests.Session()
        resp = temp_session.get(f"{BASE_URL}/admin/customers")
        if resp.status_code == 401:
            data = resp.json()
            if data.get("error") == "unauthenticated":
                log_test("Middleware: GET /admin/customers without cookie returns 401", True)
            else:
                log_test("Middleware: GET /admin/customers without cookie returns 401", False, f"Wrong error: {data}")
        else:
            log_test("Middleware: GET /admin/customers without cookie returns 401", False, f"Status {resp.status_code}")
    except Exception as e:
        log_test("Middleware: GET /admin/customers without cookie returns 401", False, str(e))

def test_phase_3_1_dashboard():
    """Test Phase 3.1: Dashboard"""
    print("\n=== PHASE 3.1: DASHBOARD ===\n")
    
    try:
        resp = session.get(f"{BASE_URL}/admin/dashboard")
        if resp.status_code == 200:
            data = resp.json()
            required_keys = ["kpis", "trend7d", "upcoming"]
            kpi_keys = ["todayRevenue", "bookingsToday", "walkIns", "pendingPayments", 
                       "giftcardsToday", "membersActive", "leadsToday", "customersTotal"]
            
            if all(k in data for k in required_keys):
                if all(k in data["kpis"] for k in kpi_keys):
                    if isinstance(data["trend7d"], list) and len(data["trend7d"]) == 7:
                        log_test("Dashboard: Returns correct structure with KPIs and 7-day trend", True)
                    else:
                        log_test("Dashboard: Returns correct structure with KPIs and 7-day trend", False, 
                                f"trend7d length: {len(data.get('trend7d', []))}")
                else:
                    log_test("Dashboard: Returns correct structure with KPIs and 7-day trend", False, 
                            f"Missing KPI keys: {[k for k in kpi_keys if k not in data.get('kpis', {})]}")
            else:
                log_test("Dashboard: Returns correct structure with KPIs and 7-day trend", False, 
                        f"Missing keys: {[k for k in required_keys if k not in data]}")
        else:
            log_test("Dashboard: Returns correct structure with KPIs and 7-day trend", False, 
                    f"Status {resp.status_code}")
    except Exception as e:
        log_test("Dashboard: Returns correct structure with KPIs and 7-day trend", False, str(e))

def test_phase_3_1_customers():
    """Test Phase 3.1: Customers CRUD + Notes"""
    print("\n=== PHASE 3.1: CUSTOMERS CRUD + NOTES ===\n")
    
    customer_id = None
    
    # Test 1: Create customer
    try:
        resp = session.post(f"{BASE_URL}/admin/customers", json={
            "name": "Priya Sharma",
            "email": "priya.sharma@example.com",
            "phone": "+919876543210",
            "tags": ["vip", "float-therapy"]
        })
        if resp.status_code == 200:
            data = resp.json()
            if "id" in data and data["name"] == "Priya Sharma" and data["status"] == "active":
                if "_id" not in data:
                    customer_id = data["id"]
                    log_test("Customers: Create customer", True)
                else:
                    log_test("Customers: Create customer", False, "Response contains _id")
            else:
                log_test("Customers: Create customer", False, f"Invalid data: {data}")
        else:
            log_test("Customers: Create customer", False, f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        log_test("Customers: Create customer", False, str(e))
    
    # Test 2: Create customer without name
    try:
        resp = session.post(f"{BASE_URL}/admin/customers", json={
            "email": "test@example.com"
        })
        if resp.status_code == 400:
            data = resp.json()
            if data.get("error") == "name_required":
                log_test("Customers: Create without name returns 400", True)
            else:
                log_test("Customers: Create without name returns 400", False, f"Wrong error: {data}")
        else:
            log_test("Customers: Create without name returns 400", False, f"Status {resp.status_code}")
    except Exception as e:
        log_test("Customers: Create without name returns 400", False, str(e))
    
    # Test 3: List customers
    try:
        resp = session.get(f"{BASE_URL}/admin/customers")
        if resp.status_code == 200:
            data = resp.json()
            if isinstance(data, list):
                found = any(c.get("id") == customer_id for c in data)
                if found:
                    log_test("Customers: List customers includes created", True)
                else:
                    log_test("Customers: List customers includes created", False, "Created customer not found")
            else:
                log_test("Customers: List customers includes created", False, "Response not a list")
        else:
            log_test("Customers: List customers includes created", False, f"Status {resp.status_code}")
    except Exception as e:
        log_test("Customers: List customers includes created", False, str(e))
    
    # Test 4: Filter customers with ?q=
    try:
        resp = session.get(f"{BASE_URL}/admin/customers?q=Priya")
        if resp.status_code == 200:
            data = resp.json()
            if isinstance(data, list) and len(data) > 0:
                found = any("Priya" in c.get("name", "") for c in data)
                if found:
                    log_test("Customers: Filter with ?q= parameter", True)
                else:
                    log_test("Customers: Filter with ?q= parameter", False, "No matching results")
            else:
                log_test("Customers: Filter with ?q= parameter", False, "Empty or invalid response")
        else:
            log_test("Customers: Filter with ?q= parameter", False, f"Status {resp.status_code}")
    except Exception as e:
        log_test("Customers: Filter with ?q= parameter", False, str(e))
    
    # Test 5: Get customer by ID
    if customer_id:
        try:
            resp = session.get(f"{BASE_URL}/admin/customers/{customer_id}")
            if resp.status_code == 200:
                data = resp.json()
                required_keys = ["customer", "visits", "invoices", "giftcards", "subscriptions", "communications", "notes"]
                if all(k in data for k in required_keys):
                    if data["customer"]["id"] == customer_id:
                        log_test("Customers: Get by ID returns full profile", True)
                    else:
                        log_test("Customers: Get by ID returns full profile", False, "Wrong customer ID")
                else:
                    log_test("Customers: Get by ID returns full profile", False, 
                            f"Missing keys: {[k for k in required_keys if k not in data]}")
            else:
                log_test("Customers: Get by ID returns full profile", False, f"Status {resp.status_code}")
        except Exception as e:
            log_test("Customers: Get by ID returns full profile", False, str(e))
    
    # Test 6: Update customer
    if customer_id:
        try:
            resp = session.patch(f"{BASE_URL}/admin/customers/{customer_id}", json={
                "name": "Priya Sharma Updated"
            })
            if resp.status_code == 200:
                data = resp.json()
                if data.get("name") == "Priya Sharma Updated":
                    log_test("Customers: Update customer", True)
                else:
                    log_test("Customers: Update customer", False, f"Name not updated: {data.get('name')}")
            else:
                log_test("Customers: Update customer", False, f"Status {resp.status_code}")
        except Exception as e:
            log_test("Customers: Update customer", False, str(e))
    
    # Test 7: Add note to customer
    if customer_id:
        try:
            resp = session.post(f"{BASE_URL}/admin/customers/{customer_id}/notes", json={
                "body": "Customer prefers morning slots for float therapy sessions."
            })
            if resp.status_code == 200:
                data = resp.json()
                if "id" in data and data.get("body") == "Customer prefers morning slots for float therapy sessions.":
                    log_test("Customers: Add note", True)
                else:
                    log_test("Customers: Add note", False, f"Invalid note data: {data}")
            else:
                log_test("Customers: Add note", False, f"Status {resp.status_code}")
        except Exception as e:
            log_test("Customers: Add note", False, str(e))
    
    # Test 8: Delete customer
    if customer_id:
        try:
            resp = session.delete(f"{BASE_URL}/admin/customers/{customer_id}")
            if resp.status_code == 200:
                data = resp.json()
                if data.get("ok"):
                    # Verify deletion
                    resp2 = session.get(f"{BASE_URL}/admin/customers/{customer_id}")
                    if resp2.status_code == 404:
                        log_test("Customers: Delete customer", True)
                    else:
                        log_test("Customers: Delete customer", False, "Customer still exists after delete")
                else:
                    log_test("Customers: Delete customer", False, "Response not ok")
            else:
                log_test("Customers: Delete customer", False, f"Status {resp.status_code}")
        except Exception as e:
            log_test("Customers: Delete customer", False, str(e))

def test_phase_3_1_bookings():
    """Test Phase 3.1: Bookings"""
    print("\n=== PHASE 3.1: BOOKINGS ===\n")
    
    booking_id = None
    
    # Test 1: Create a booking via public endpoint
    try:
        today = datetime.now()
        tomorrow = today + timedelta(days=1)
        resp = requests.post(f"{BASE_URL}/bookings", json={
            "outcome": "float-therapy",
            "therapy": "Float Therapy",
            "slotDate": tomorrow.strftime("%Y-%m-%d"),
            "slotTime": "14:00",
            "guests": 2,
            "contact": {
                "name": "Rahul Verma",
                "email": "rahul.verma@example.com",
                "phone": "+919876543211"
            },
            "payment": "at-visit",
            "total": 3998
        })
        if resp.status_code == 200:
            data = resp.json()
            if "id" in data and "ref" in data:
                booking_id = data["id"]
                log_test("Bookings: Create booking via public endpoint", True)
            else:
                log_test("Bookings: Create booking via public endpoint", False, f"Invalid data: {data}")
        else:
            log_test("Bookings: Create booking via public endpoint", False, f"Status {resp.status_code}")
    except Exception as e:
        log_test("Bookings: Create booking via public endpoint", False, str(e))
    
    # Test 2: List bookings
    try:
        resp = session.get(f"{BASE_URL}/admin/bookings")
        if resp.status_code == 200:
            data = resp.json()
            if isinstance(data, list):
                log_test("Bookings: List bookings", True)
            else:
                log_test("Bookings: List bookings", False, "Response not a list")
        else:
            log_test("Bookings: List bookings", False, f"Status {resp.status_code}")
    except Exception as e:
        log_test("Bookings: List bookings", False, str(e))
    
    # Test 3: Filter by status
    try:
        resp = session.get(f"{BASE_URL}/admin/bookings?status=confirmed")
        if resp.status_code == 200:
            data = resp.json()
            if isinstance(data, list):
                log_test("Bookings: Filter by status", True)
            else:
                log_test("Bookings: Filter by status", False, "Response not a list")
        else:
            log_test("Bookings: Filter by status", False, f"Status {resp.status_code}")
    except Exception as e:
        log_test("Bookings: Filter by status", False, str(e))
    
    # Test 4: Calendar view
    try:
        today = datetime.now()
        tomorrow = today + timedelta(days=1)
        resp = session.get(f"{BASE_URL}/admin/bookings/calendar?from={today.isoformat()}&to={tomorrow.isoformat()}")
        if resp.status_code == 200:
            data = resp.json()
            if isinstance(data, list):
                log_test("Bookings: Calendar view with date range", True)
            else:
                log_test("Bookings: Calendar view with date range", False, "Response not a list")
        else:
            log_test("Bookings: Calendar view with date range", False, f"Status {resp.status_code}")
    except Exception as e:
        log_test("Bookings: Calendar view with date range", False, str(e))
    
    # Test 5-8: Status transitions
    if booking_id:
        transitions = [
            ("check-in", "checked_in"),
            ("start", "in_session"),
            ("complete", "completed")
        ]
        
        for action, expected_status in transitions:
            try:
                resp = session.post(f"{BASE_URL}/admin/bookings/{booking_id}/{action}")
                if resp.status_code == 200:
                    data = resp.json()
                    if data.get("status") == expected_status:
                        log_test(f"Bookings: Status transition {action} -> {expected_status}", True)
                    else:
                        log_test(f"Bookings: Status transition {action} -> {expected_status}", False, 
                                f"Status is {data.get('status')}")
                else:
                    log_test(f"Bookings: Status transition {action} -> {expected_status}", False, 
                            f"Status {resp.status_code}")
            except Exception as e:
                log_test(f"Bookings: Status transition {action} -> {expected_status}", False, str(e))

def test_phase_3_1_search_activity():
    """Test Phase 3.1: Universal Search & Activity Log"""
    print("\n=== PHASE 3.1: SEARCH & ACTIVITY ===\n")
    
    # Test 1: Universal search
    try:
        resp = session.get(f"{BASE_URL}/admin/search?q=test")
        if resp.status_code == 200:
            data = resp.json()
            required_keys = ["customers", "bookings", "pages"]
            if all(k in data for k in required_keys):
                if all(isinstance(data[k], list) for k in required_keys):
                    log_test("Search: Universal search returns correct structure", True)
                else:
                    log_test("Search: Universal search returns correct structure", False, "Values not lists")
            else:
                log_test("Search: Universal search returns correct structure", False, 
                        f"Missing keys: {[k for k in required_keys if k not in data]}")
        else:
            log_test("Search: Universal search returns correct structure", False, f"Status {resp.status_code}")
    except Exception as e:
        log_test("Search: Universal search returns correct structure", False, str(e))
    
    # Test 2: Activity log
    try:
        resp = session.get(f"{BASE_URL}/admin/activity")
        if resp.status_code == 200:
            data = resp.json()
            if isinstance(data, list):
                if len(data) > 0:
                    # Check if recent activities are present
                    log_test("Activity: Returns recent activity log", True)
                else:
                    log_test("Activity: Returns recent activity log", True, "Empty log (no activities yet)")
            else:
                log_test("Activity: Returns recent activity log", False, "Response not a list")
        else:
            log_test("Activity: Returns recent activity log", False, f"Status {resp.status_code}")
    except Exception as e:
        log_test("Activity: Returns recent activity log", False, str(e))

def test_phase_3_2_services():
    """Test Phase 3.2: Services CRUD (therapies, journeys, packages)"""
    print("\n=== PHASE 3.2: SERVICES CRUD ===\n")
    
    service_ids = {}
    
    # Test therapies
    service_types = [
        ("therapies", {"name": "Float Therapy", "durationMin": 60, "defaultPrice": 1999}),
        ("journeys", {"name": "Wellness Journey", "durationMin": 120, "defaultPrice": 4999}),
        ("packages", {"name": "Monthly Wellness Package", "durationMin": 60, "defaultPrice": 9999, "validityDays": 30})
    ]
    
    for service_type, create_data in service_types:
        # Test 1: Create service
        try:
            resp = session.post(f"{BASE_URL}/admin/services/{service_type}", json=create_data)
            if resp.status_code == 200:
                data = resp.json()
                if "id" in data and data["name"] == create_data["name"] and data["active"] == True:
                    if "_id" not in data:
                        service_ids[service_type] = data["id"]
                        log_test(f"Services: Create {service_type}", True)
                    else:
                        log_test(f"Services: Create {service_type}", False, "Response contains _id")
                else:
                    log_test(f"Services: Create {service_type}", False, f"Invalid data: {data}")
            else:
                log_test(f"Services: Create {service_type}", False, f"Status {resp.status_code}: {resp.text}")
        except Exception as e:
            log_test(f"Services: Create {service_type}", False, str(e))
        
        # Test 2: Create without name
        try:
            resp = session.post(f"{BASE_URL}/admin/services/{service_type}", json={"durationMin": 60})
            if resp.status_code == 400:
                data = resp.json()
                if data.get("error") == "name_required":
                    log_test(f"Services: Create {service_type} without name returns 400", True)
                else:
                    log_test(f"Services: Create {service_type} without name returns 400", False, f"Wrong error: {data}")
            else:
                log_test(f"Services: Create {service_type} without name returns 400", False, f"Status {resp.status_code}")
        except Exception as e:
            log_test(f"Services: Create {service_type} without name returns 400", False, str(e))
        
        # Test 3: List services
        try:
            resp = session.get(f"{BASE_URL}/admin/services/{service_type}")
            if resp.status_code == 200:
                data = resp.json()
                if isinstance(data, list):
                    found = any(s.get("id") == service_ids.get(service_type) for s in data)
                    if found:
                        log_test(f"Services: List {service_type}", True)
                    else:
                        log_test(f"Services: List {service_type}", False, "Created service not found")
                else:
                    log_test(f"Services: List {service_type}", False, "Response not a list")
            else:
                log_test(f"Services: List {service_type}", False, f"Status {resp.status_code}")
        except Exception as e:
            log_test(f"Services: List {service_type}", False, str(e))
        
        # Test 4: Update service
        if service_type in service_ids:
            try:
                new_price = create_data["defaultPrice"] + 200
                resp = session.patch(f"{BASE_URL}/admin/services/{service_type}/{service_ids[service_type]}", 
                                    json={"defaultPrice": new_price})
                if resp.status_code == 200:
                    data = resp.json()
                    if data.get("defaultPrice") == new_price:
                        log_test(f"Services: Update {service_type}", True)
                    else:
                        log_test(f"Services: Update {service_type}", False, f"Price not updated: {data.get('defaultPrice')}")
                else:
                    log_test(f"Services: Update {service_type}", False, f"Status {resp.status_code}")
            except Exception as e:
                log_test(f"Services: Update {service_type}", False, str(e))
        
        # Test 5: Delete service
        if service_type in service_ids:
            try:
                resp = session.delete(f"{BASE_URL}/admin/services/{service_type}/{service_ids[service_type]}")
                if resp.status_code == 200:
                    data = resp.json()
                    if data.get("ok"):
                        # Verify deletion
                        resp2 = session.get(f"{BASE_URL}/admin/services/{service_type}/{service_ids[service_type]}")
                        if resp2.status_code == 404:
                            log_test(f"Services: Delete {service_type}", True)
                        else:
                            log_test(f"Services: Delete {service_type}", False, "Service still exists after delete")
                    else:
                        log_test(f"Services: Delete {service_type}", False, "Response not ok")
                else:
                    log_test(f"Services: Delete {service_type}", False, f"Status {resp.status_code}")
            except Exception as e:
                log_test(f"Services: Delete {service_type}", False, str(e))

def test_phase_3_2_memberships():
    """Test Phase 3.2: Memberships (plans + subscriptions)"""
    print("\n=== PHASE 3.2: MEMBERSHIPS ===\n")
    
    plan_id = None
    customer_id = None
    subscription_id = None
    
    # Create a customer first
    try:
        resp = session.post(f"{BASE_URL}/admin/customers", json={
            "name": "Membership Test Customer",
            "email": "membership@example.com",
            "phone": "+919876543212"
        })
        if resp.status_code == 200:
            customer_id = resp.json()["id"]
    except:
        pass
    
    # Test 1: Create membership plan
    try:
        resp = session.post(f"{BASE_URL}/admin/memberships", json={
            "name": "Wellness Membership",
            "price": 3499,
            "sessionsIncluded": 8,
            "validityDays": 30
        })
        if resp.status_code == 200:
            data = resp.json()
            if "id" in data and data["name"] == "Wellness Membership":
                plan_id = data["id"]
                log_test("Memberships: Create plan", True)
            else:
                log_test("Memberships: Create plan", False, f"Invalid data: {data}")
        else:
            log_test("Memberships: Create plan", False, f"Status {resp.status_code}")
    except Exception as e:
        log_test("Memberships: Create plan", False, str(e))
    
    # Test 2: List plans
    try:
        resp = session.get(f"{BASE_URL}/admin/memberships")
        if resp.status_code == 200:
            data = resp.json()
            if isinstance(data, list):
                found = any(p.get("id") == plan_id for p in data)
                if found:
                    log_test("Memberships: List plans", True)
                else:
                    log_test("Memberships: List plans", False, "Created plan not found")
            else:
                log_test("Memberships: List plans", False, "Response not a list")
        else:
            log_test("Memberships: List plans", False, f"Status {resp.status_code}")
    except Exception as e:
        log_test("Memberships: List plans", False, str(e))
    
    # Test 3: Update plan
    if plan_id:
        try:
            resp = session.patch(f"{BASE_URL}/admin/memberships/{plan_id}", json={"price": 3999})
            if resp.status_code == 200:
                data = resp.json()
                if data.get("price") == 3999:
                    log_test("Memberships: Update plan", True)
                else:
                    log_test("Memberships: Update plan", False, f"Price not updated: {data.get('price')}")
            else:
                log_test("Memberships: Update plan", False, f"Status {resp.status_code}")
        except Exception as e:
            log_test("Memberships: Update plan", False, str(e))
    
    # Test 4: Create subscription
    if plan_id and customer_id:
        try:
            resp = session.post(f"{BASE_URL}/admin/memberships/subs", json={
                "customerId": customer_id,
                "membershipId": plan_id
            })
            if resp.status_code == 200:
                data = resp.json()
                if "id" in data and data["status"] == "active" and data["sessionsRemaining"] == 8:
                    subscription_id = data["id"]
                    log_test("Memberships: Create subscription", True)
                else:
                    log_test("Memberships: Create subscription", False, f"Invalid data: {data}")
            else:
                log_test("Memberships: Create subscription", False, f"Status {resp.status_code}")
        except Exception as e:
            log_test("Memberships: Create subscription", False, str(e))
    
    # Test 5: Freeze subscription
    if subscription_id:
        try:
            resp = session.post(f"{BASE_URL}/admin/memberships/subs/{subscription_id}/freeze")
            if resp.status_code == 200:
                data = resp.json()
                if data.get("status") == "frozen":
                    log_test("Memberships: Freeze subscription", True)
                else:
                    log_test("Memberships: Freeze subscription", False, f"Status is {data.get('status')}")
            else:
                log_test("Memberships: Freeze subscription", False, f"Status {resp.status_code}")
        except Exception as e:
            log_test("Memberships: Freeze subscription", False, str(e))
    
    # Test 6: Unfreeze subscription
    if subscription_id:
        try:
            resp = session.post(f"{BASE_URL}/admin/memberships/subs/{subscription_id}/unfreeze")
            if resp.status_code == 200:
                data = resp.json()
                if data.get("status") == "active":
                    log_test("Memberships: Unfreeze subscription", True)
                else:
                    log_test("Memberships: Unfreeze subscription", False, f"Status is {data.get('status')}")
            else:
                log_test("Memberships: Unfreeze subscription", False, f"Status {resp.status_code}")
        except Exception as e:
            log_test("Memberships: Unfreeze subscription", False, str(e))
    
    # Test 7: Renew subscription
    if subscription_id:
        try:
            resp = session.post(f"{BASE_URL}/admin/memberships/subs/{subscription_id}/renew")
            if resp.status_code == 200:
                data = resp.json()
                if data.get("sessionsRemaining") == 16:  # 8 + 8
                    log_test("Memberships: Renew subscription", True)
                else:
                    log_test("Memberships: Renew subscription", False, 
                            f"Sessions remaining: {data.get('sessionsRemaining')}")
            else:
                log_test("Memberships: Renew subscription", False, f"Status {resp.status_code}")
        except Exception as e:
            log_test("Memberships: Renew subscription", False, str(e))

def test_phase_3_2_giftcards():
    """Test Phase 3.2: Gift Cards"""
    print("\n=== PHASE 3.2: GIFT CARDS ===\n")
    
    giftcard_id = None
    giftcard_code = None
    
    # Test 1: Issue gift card
    try:
        resp = session.post(f"{BASE_URL}/admin/giftcards", json={
            "amount": 5000,
            "designId": "halite",
            "from": {"name": "Amit Kumar", "email": "amit@example.com"},
            "to": {"name": "Neha Patel", "email": "neha@example.com", "phone": "+919876543213"},
            "message": "Happy Birthday! Enjoy a relaxing session at Salt World."
        })
        if resp.status_code == 200:
            data = resp.json()
            # Verify code format: SW-XXXX-XXXX
            code_pattern = r'^SW-[A-Z0-9]{4}-[A-Z0-9]{4}$'
            if "id" in data and "code" in data:
                if re.match(code_pattern, data["code"]):
                    if data["balance"] == 5000 and data["status"] == "active":
                        giftcard_id = data["id"]
                        giftcard_code = data["code"]
                        log_test("Gift Cards: Issue card with correct code format", True)
                    else:
                        log_test("Gift Cards: Issue card with correct code format", False, 
                                f"Balance: {data.get('balance')}, Status: {data.get('status')}")
                else:
                    log_test("Gift Cards: Issue card with correct code format", False, 
                            f"Code format invalid: {data['code']}")
            else:
                log_test("Gift Cards: Issue card with correct code format", False, f"Missing id or code: {data}")
        else:
            log_test("Gift Cards: Issue card with correct code format", False, f"Status {resp.status_code}")
    except Exception as e:
        log_test("Gift Cards: Issue card with correct code format", False, str(e))
    
    # Test 2: Issue with amount < 100
    try:
        resp = session.post(f"{BASE_URL}/admin/giftcards", json={
            "amount": 50,
            "designId": "halite"
        })
        if resp.status_code == 400:
            data = resp.json()
            if data.get("error") == "amount_required":
                log_test("Gift Cards: Issue with amount < 100 returns 400", True)
            else:
                log_test("Gift Cards: Issue with amount < 100 returns 400", False, f"Wrong error: {data}")
        else:
            log_test("Gift Cards: Issue with amount < 100 returns 400", False, f"Status {resp.status_code}")
    except Exception as e:
        log_test("Gift Cards: Issue with amount < 100 returns 400", False, str(e))
    
    # Test 3: List gift cards
    try:
        resp = session.get(f"{BASE_URL}/admin/giftcards")
        if resp.status_code == 200:
            data = resp.json()
            if isinstance(data, list):
                log_test("Gift Cards: List all cards", True)
            else:
                log_test("Gift Cards: List all cards", False, "Response not a list")
        else:
            log_test("Gift Cards: List all cards", False, f"Status {resp.status_code}")
    except Exception as e:
        log_test("Gift Cards: List all cards", False, str(e))
    
    # Test 4: Filter by status
    try:
        resp = session.get(f"{BASE_URL}/admin/giftcards?status=active")
        if resp.status_code == 200:
            data = resp.json()
            if isinstance(data, list):
                log_test("Gift Cards: Filter by status", True)
            else:
                log_test("Gift Cards: Filter by status", False, "Response not a list")
        else:
            log_test("Gift Cards: Filter by status", False, f"Status {resp.status_code}")
    except Exception as e:
        log_test("Gift Cards: Filter by status", False, str(e))
    
    # Test 5: Get by code
    if giftcard_code:
        try:
            resp = session.get(f"{BASE_URL}/admin/giftcards/by-code/{giftcard_code}")
            if resp.status_code == 200:
                data = resp.json()
                if data.get("code") == giftcard_code:
                    log_test("Gift Cards: Get by code", True)
                else:
                    log_test("Gift Cards: Get by code", False, f"Wrong code: {data.get('code')}")
            else:
                log_test("Gift Cards: Get by code", False, f"Status {resp.status_code}")
        except Exception as e:
            log_test("Gift Cards: Get by code", False, str(e))
    
    # Test 6: Partial redeem
    if giftcard_id:
        try:
            resp = session.post(f"{BASE_URL}/admin/giftcards/{giftcard_id}/redeem", json={"amount": 1000})
            if resp.status_code == 200:
                data = resp.json()
                if data.get("balance") == 4000 and data.get("status") == "active":
                    log_test("Gift Cards: Partial redeem keeps status active", True)
                else:
                    log_test("Gift Cards: Partial redeem keeps status active", False, 
                            f"Balance: {data.get('balance')}, Status: {data.get('status')}")
            else:
                log_test("Gift Cards: Partial redeem keeps status active", False, f"Status {resp.status_code}")
        except Exception as e:
            log_test("Gift Cards: Partial redeem keeps status active", False, str(e))
    
    # Test 7: Redeem to zero
    if giftcard_id:
        try:
            resp = session.post(f"{BASE_URL}/admin/giftcards/{giftcard_id}/redeem", json={"amount": 4000})
            if resp.status_code == 200:
                data = resp.json()
                if data.get("balance") == 0 and data.get("status") == "redeemed":
                    log_test("Gift Cards: Redeem to zero flips status to redeemed", True)
                else:
                    log_test("Gift Cards: Redeem to zero flips status to redeemed", False, 
                            f"Balance: {data.get('balance')}, Status: {data.get('status')}")
            else:
                log_test("Gift Cards: Redeem to zero flips status to redeemed", False, f"Status {resp.status_code}")
        except Exception as e:
            log_test("Gift Cards: Redeem to zero flips status to redeemed", False, str(e))

def test_phase_3_2_products():
    """Test Phase 3.2: Products & Categories"""
    print("\n=== PHASE 3.2: PRODUCTS & CATEGORIES ===\n")
    
    category_id = None
    product_id = None
    
    # Test 1: Create category
    try:
        resp = session.post(f"{BASE_URL}/admin/product-categories", json={
            "name": "Salt Lamps"
        })
        if resp.status_code == 200:
            data = resp.json()
            if "id" in data and data["name"] == "Salt Lamps":
                category_id = data["id"]
                log_test("Products: Create category", True)
            else:
                log_test("Products: Create category", False, f"Invalid data: {data}")
        else:
            log_test("Products: Create category", False, f"Status {resp.status_code}")
    except Exception as e:
        log_test("Products: Create category", False, str(e))
    
    # Test 2: Create product
    if category_id:
        try:
            resp = session.post(f"{BASE_URL}/admin/products", json={
                "name": "Himalayan Salt Lamp",
                "price": 1499,
                "categoryId": category_id,
                "stock": 5
            })
            if resp.status_code == 200:
                data = resp.json()
                if "id" in data and "sku" in data and data["tax"] == 18:
                    product_id = data["id"]
                    log_test("Products: Create product with SKU and default tax", True)
                else:
                    log_test("Products: Create product with SKU and default tax", False, f"Invalid data: {data}")
            else:
                log_test("Products: Create product with SKU and default tax", False, f"Status {resp.status_code}")
        except Exception as e:
            log_test("Products: Create product with SKU and default tax", False, str(e))
    
    # Test 3: List products
    try:
        resp = session.get(f"{BASE_URL}/admin/products")
        if resp.status_code == 200:
            data = resp.json()
            if isinstance(data, list):
                found = any(p.get("id") == product_id for p in data)
                if found:
                    log_test("Products: List products", True)
                else:
                    log_test("Products: List products", False, "Created product not found")
            else:
                log_test("Products: List products", False, "Response not a list")
        else:
            log_test("Products: List products", False, f"Status {resp.status_code}")
    except Exception as e:
        log_test("Products: List products", False, str(e))
    
    # Test 4: Adjust stock (atomic)
    if product_id:
        try:
            resp = session.post(f"{BASE_URL}/admin/products/{product_id}/stock", json={"delta": -2})
            if resp.status_code == 200:
                data = resp.json()
                if data.get("stock") == 3:
                    log_test("Products: Atomic stock adjustment", True)
                else:
                    log_test("Products: Atomic stock adjustment", False, f"Stock is {data.get('stock')}")
            else:
                log_test("Products: Atomic stock adjustment", False, f"Status {resp.status_code}")
        except Exception as e:
            log_test("Products: Atomic stock adjustment", False, str(e))
    
    # Test 5: Delete product
    if product_id:
        try:
            resp = session.delete(f"{BASE_URL}/admin/products/{product_id}")
            if resp.status_code == 200:
                data = resp.json()
                if data.get("ok"):
                    log_test("Products: Delete product", True)
                else:
                    log_test("Products: Delete product", False, "Response not ok")
            else:
                log_test("Products: Delete product", False, f"Status {resp.status_code}")
        except Exception as e:
            log_test("Products: Delete product", False, str(e))
    
    # Test 6: Delete category
    if category_id:
        try:
            resp = session.delete(f"{BASE_URL}/admin/product-categories/{category_id}")
            if resp.status_code == 200:
                data = resp.json()
                if data.get("ok"):
                    log_test("Products: Delete category", True)
                else:
                    log_test("Products: Delete category", False, "Response not ok")
            else:
                log_test("Products: Delete category", False, f"Status {resp.status_code}")
        except Exception as e:
            log_test("Products: Delete category", False, str(e))

def test_phase_3_2_payments_invoices():
    """Test Phase 3.2: Payments & Invoices (CRITICAL)"""
    print("\n=== PHASE 3.2: PAYMENTS & INVOICES (CRITICAL) ===\n")
    
    payment_ids = []
    invoice_numbers = []
    
    # Test 1: Create payment with GST calculation
    try:
        resp = session.post(f"{BASE_URL}/admin/payments", json={
            "total": 1180,
            "method": "cash",
            "customerName": "Rohan Mehta"
        })
        if resp.status_code == 200:
            data = resp.json()
            if "payment" in data and "invoice" in data:
                payment = data["payment"]
                invoice = data["invoice"]
                
                # Verify invoice number format
                inv_pattern = r'^INV-\d{6}$'
                if not re.match(inv_pattern, invoice.get("number", "")):
                    log_test("Payments: Invoice number format INV-NNNNNN", False, 
                            f"Invalid format: {invoice.get('number')}")
                else:
                    # Verify GST math (18% inclusive)
                    # total = 1180, subtotal should be 1000, cgst = 90, sgst = 90
                    if (invoice.get("subtotal") == 1000 and 
                        invoice.get("cgst") == 90 and 
                        invoice.get("sgst") == 90 and 
                        invoice.get("total") == 1180):
                        payment_ids.append(payment["id"])
                        invoice_numbers.append(invoice["number"])
                        log_test("Payments: Create payment with correct GST math (18%)", True)
                        log_test("Payments: Invoice number format INV-NNNNNN", True)
                    else:
                        log_test("Payments: Create payment with correct GST math (18%)", False, 
                                f"Subtotal: {invoice.get('subtotal')}, CGST: {invoice.get('cgst')}, "
                                f"SGST: {invoice.get('sgst')}, Total: {invoice.get('total')}")
            else:
                log_test("Payments: Create payment with correct GST math (18%)", False, 
                        "Missing payment or invoice in response")
        else:
            log_test("Payments: Create payment with correct GST math (18%)", False, f"Status {resp.status_code}")
    except Exception as e:
        log_test("Payments: Create payment with correct GST math (18%)", False, str(e))
    
    # Test 2 & 3: Create two more payments to verify sequential invoice numbers
    for i in range(2):
        try:
            resp = session.post(f"{BASE_URL}/admin/payments", json={
                "total": 2360,  # Different amount
                "method": "upi",
                "customerName": f"Test Customer {i+2}"
            })
            if resp.status_code == 200:
                data = resp.json()
                if "payment" in data and "invoice" in data:
                    payment_ids.append(data["payment"]["id"])
                    invoice_numbers.append(data["invoice"]["number"])
                    log_test(f"Payments: Create payment #{i+2}", True)
                else:
                    log_test(f"Payments: Create payment #{i+2}", False, "Missing payment or invoice")
            else:
                log_test(f"Payments: Create payment #{i+2}", False, f"Status {resp.status_code}")
        except Exception as e:
            log_test(f"Payments: Create payment #{i+2}", False, str(e))
    
    # Test 4: Verify invoice numbers are sequential
    if len(invoice_numbers) >= 3:
        try:
            # Extract numbers from invoice numbers
            nums = [int(inv.split('-')[1]) for inv in invoice_numbers]
            is_sequential = all(nums[i+1] == nums[i] + 1 for i in range(len(nums)-1))
            if is_sequential:
                log_test("Payments: Invoice numbers are strictly sequential", True)
            else:
                log_test("Payments: Invoice numbers are strictly sequential", False, 
                        f"Numbers: {nums} (not sequential)")
        except Exception as e:
            log_test("Payments: Invoice numbers are strictly sequential", False, str(e))
    
    # Test 5: List payments
    try:
        resp = session.get(f"{BASE_URL}/admin/payments")
        if resp.status_code == 200:
            data = resp.json()
            if isinstance(data, list):
                log_test("Payments: List payments", True)
            else:
                log_test("Payments: List payments", False, "Response not a list")
        else:
            log_test("Payments: List payments", False, f"Status {resp.status_code}")
    except Exception as e:
        log_test("Payments: List payments", False, str(e))
    
    # Test 6: List invoices
    try:
        resp = session.get(f"{BASE_URL}/admin/invoices")
        if resp.status_code == 200:
            data = resp.json()
            if isinstance(data, list):
                log_test("Invoices: List invoices", True)
            else:
                log_test("Invoices: List invoices", False, "Response not a list")
        else:
            log_test("Invoices: List invoices", False, f"Status {resp.status_code}")
    except Exception as e:
        log_test("Invoices: List invoices", False, str(e))
    
    # Test 7: Get invoice by ID
    if len(invoice_numbers) > 0:
        try:
            # Get the first invoice
            resp = session.get(f"{BASE_URL}/admin/invoices")
            if resp.status_code == 200:
                invoices = resp.json()
                if len(invoices) > 0:
                    invoice_id = invoices[0]["id"]
                    resp2 = session.get(f"{BASE_URL}/admin/invoices/{invoice_id}")
                    if resp2.status_code == 200:
                        log_test("Invoices: Get invoice by ID", True)
                    else:
                        log_test("Invoices: Get invoice by ID", False, f"Status {resp2.status_code}")
        except Exception as e:
            log_test("Invoices: Get invoice by ID", False, str(e))
    
    # Test 8: Refund payment
    if len(payment_ids) > 0:
        try:
            resp = session.post(f"{BASE_URL}/admin/payments/{payment_ids[0]}/refund", json={
                "amount": 1180,
                "reason": "Test refund"
            })
            if resp.status_code == 200:
                data = resp.json()
                if "id" in data and data.get("status") == "refunded":
                    # Verify original payment status
                    resp2 = session.get(f"{BASE_URL}/admin/payments")
                    if resp2.status_code == 200:
                        payments = resp2.json()
                        original = next((p for p in payments if p["id"] == payment_ids[0]), None)
                        if original and original.get("status") == "refunded":
                            log_test("Payments: Refund payment updates status", True)
                        else:
                            log_test("Payments: Refund payment updates status", False, 
                                    f"Original payment status: {original.get('status') if original else 'not found'}")
                    else:
                        log_test("Payments: Refund payment updates status", False, "Could not verify original payment")
                else:
                    log_test("Payments: Refund payment updates status", False, f"Invalid refund data: {data}")
            else:
                log_test("Payments: Refund payment updates status", False, f"Status {resp.status_code}")
        except Exception as e:
            log_test("Payments: Refund payment updates status", False, str(e))

def test_phase_3_2_reports():
    """Test Phase 3.2: Reports"""
    print("\n=== PHASE 3.2: REPORTS ===\n")
    
    # Test 1: Revenue report
    try:
        resp = session.get(f"{BASE_URL}/admin/reports/revenue?days=30")
        if resp.status_code == 200:
            data = resp.json()
            required_keys = ["total", "count", "daily", "byMethod"]
            if all(k in data for k in required_keys):
                if isinstance(data["daily"], list) and len(data["daily"]) == 30:
                    log_test("Reports: Revenue report with 30-day data", True)
                else:
                    log_test("Reports: Revenue report with 30-day data", False, 
                            f"Daily length: {len(data.get('daily', []))}")
            else:
                log_test("Reports: Revenue report with 30-day data", False, 
                        f"Missing keys: {[k for k in required_keys if k not in data]}")
        else:
            log_test("Reports: Revenue report with 30-day data", False, f"Status {resp.status_code}")
    except Exception as e:
        log_test("Reports: Revenue report with 30-day data", False, str(e))
    
    # Test 2: Bookings report
    try:
        resp = session.get(f"{BASE_URL}/admin/reports/bookings?days=30")
        if resp.status_code == 200:
            data = resp.json()
            required_keys = ["total", "daily", "byStatus"]
            if all(k in data for k in required_keys):
                if isinstance(data["daily"], list) and len(data["daily"]) == 30:
                    log_test("Reports: Bookings report with status breakdown", True)
                else:
                    log_test("Reports: Bookings report with status breakdown", False, 
                            f"Daily length: {len(data.get('daily', []))}")
            else:
                log_test("Reports: Bookings report with status breakdown", False, 
                        f"Missing keys: {[k for k in required_keys if k not in data]}")
        else:
            log_test("Reports: Bookings report with status breakdown", False, f"Status {resp.status_code}")
    except Exception as e:
        log_test("Reports: Bookings report with status breakdown", False, str(e))
    
    # Test 3: Occupancy report
    try:
        resp = session.get(f"{BASE_URL}/admin/reports/occupancy?days=30")
        if resp.status_code == 200:
            data = resp.json()
            required_keys = ["byResource", "total"]
            if all(k in data for k in required_keys):
                log_test("Reports: Occupancy report by resource", True)
            else:
                log_test("Reports: Occupancy report by resource", False, 
                        f"Missing keys: {[k for k in required_keys if k not in data]}")
        else:
            log_test("Reports: Occupancy report by resource", False, f"Status {resp.status_code}")
    except Exception as e:
        log_test("Reports: Occupancy report by resource", False, str(e))

def test_regression():
    """Test Regression: Old customer-facing endpoints"""
    print("\n=== REGRESSION TESTS ===\n")
    
    # Test 1: Health check
    try:
        resp = requests.get(f"{BASE_URL}/health")
        if resp.status_code == 200:
            data = resp.json()
            if data.get("ok") and data.get("service") == "salt-world-builder":
                log_test("Regression: GET /api/health", True)
            else:
                log_test("Regression: GET /api/health", False, f"Invalid response: {data}")
        else:
            log_test("Regression: GET /api/health", False, f"Status {resp.status_code}")
    except Exception as e:
        log_test("Regression: GET /api/health", False, str(e))
    
    # Test 2: Templates
    try:
        resp = requests.get(f"{BASE_URL}/templates")
        if resp.status_code == 200:
            data = resp.json()
            if isinstance(data, list) and len(data) == 6:
                log_test("Regression: GET /api/templates", True)
            else:
                log_test("Regression: GET /api/templates", False, f"Expected 6 templates, got {len(data)}")
        else:
            log_test("Regression: GET /api/templates", False, f"Status {resp.status_code}")
    except Exception as e:
        log_test("Regression: GET /api/templates", False, str(e))
    
    # Test 3: Leads
    try:
        resp = requests.post(f"{BASE_URL}/leads", json={
            "name": "Corporate Test Lead",
            "email": "corporate@example.com",
            "company": "Test Corp",
            "teamSize": "50-100",
            "notes": "Interested in corporate wellness program",
            "source": "website"
        })
        if resp.status_code == 200:
            data = resp.json()
            if "id" in data and data.get("status") == "new":
                log_test("Regression: POST /api/leads", True)
            else:
                log_test("Regression: POST /api/leads", False, f"Invalid response: {data}")
        else:
            log_test("Regression: POST /api/leads", False, f"Status {resp.status_code}")
    except Exception as e:
        log_test("Regression: POST /api/leads", False, str(e))
    
    # Test 4: Bookings
    try:
        today = datetime.now()
        tomorrow = today + timedelta(days=2)
        resp = requests.post(f"{BASE_URL}/bookings", json={
            "outcome": "salt-therapy",
            "therapy": "Salt Therapy",
            "slotDate": tomorrow.strftime("%Y-%m-%d"),
            "slotTime": "16:00",
            "guests": 1,
            "contact": {
                "name": "Regression Test User",
                "email": "regression@example.com",
                "phone": "+919876543299"
            },
            "payment": "at-visit",
            "total": 1999
        })
        if resp.status_code == 200:
            data = resp.json()
            if "id" in data and "ref" in data and data.get("status") == "confirmed":
                log_test("Regression: POST /api/bookings", True)
            else:
                log_test("Regression: POST /api/bookings", False, f"Invalid response: {data}")
        else:
            log_test("Regression: POST /api/bookings", False, f"Status {resp.status_code}")
    except Exception as e:
        log_test("Regression: POST /api/bookings", False, str(e))

def main():
    print("=" * 80)
    print("SALT WORLD BOS ADMIN API - PHASE 3.1 + 3.2 TEST SUITE")
    print("=" * 80)
    
    # Run all test suites
    test_phase_3_1_auth()
    test_phase_3_1_dashboard()
    test_phase_3_1_customers()
    test_phase_3_1_bookings()
    test_phase_3_1_search_activity()
    
    test_phase_3_2_services()
    test_phase_3_2_memberships()
    test_phase_3_2_giftcards()
    test_phase_3_2_products()
    test_phase_3_2_payments_invoices()
    test_phase_3_2_reports()
    
    test_regression()
    
    # Print summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    print(f"✅ Passed: {tests_passed}")
    print(f"❌ Failed: {tests_failed}")
    print(f"Total: {tests_passed + tests_failed}")
    print(f"Success Rate: {(tests_passed / (tests_passed + tests_failed) * 100):.1f}%")
    print("=" * 80)
    
    return tests_failed == 0

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
