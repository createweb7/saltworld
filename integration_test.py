#!/usr/bin/env python3
"""
Salt World - Razorpay + WhatsApp Integration Test Suite
Tests payment and notification integration endpoints with placeholder keys.
"""

import requests
import json
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

def login_admin():
    """Login as admin and maintain session"""
    try:
        resp = session.post(f"{BASE_URL}/admin/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if resp.status_code == 200:
            print("✓ Admin login successful")
            return True
        else:
            print(f"✗ Admin login failed: {resp.status_code}")
            return False
    except Exception as e:
        print(f"✗ Admin login error: {e}")
        return False

def test_razorpay_integration():
    """Test Razorpay payment integration endpoints"""
    print("\n=== RAZORPAY INTEGRATION TESTS ===\n")
    
    booking_id = None
    
    # RP1: GET /api/payments/status
    try:
        resp = requests.get(f"{BASE_URL}/payments/status")
        if resp.status_code == 200:
            data = resp.json()
            if data.get("configured") == False and data.get("keyId") is None:
                log_test("RP1: GET /payments/status returns configured=false, keyId=null", True)
            else:
                log_test("RP1: GET /payments/status returns configured=false, keyId=null", False, 
                        f"configured={data.get('configured')}, keyId={data.get('keyId')}")
        else:
            log_test("RP1: GET /payments/status returns configured=false, keyId=null", False, 
                    f"Status {resp.status_code}")
    except Exception as e:
        log_test("RP1: GET /payments/status returns configured=false, keyId=null", False, str(e))
    
    # Create a booking first for subsequent tests
    try:
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        resp = requests.post(f"{BASE_URL}/bookings", json={
            "outcome": "float-therapy",
            "therapy": "60-min Float Session",
            "slotDate": tomorrow,
            "slotTime": "14:00",
            "contact": {
                "name": "Arjun Kapoor",
                "phone": "9916019755",
                "email": "arjun.kapoor@example.com"
            },
            "total": 1499
        })
        if resp.status_code == 200:
            data = resp.json()
            booking_id = data.get("id")
            print(f"✓ Created test booking: {booking_id}")
        else:
            print(f"✗ Failed to create booking: {resp.status_code}")
    except Exception as e:
        print(f"✗ Booking creation error: {e}")
    
    # RP2: POST /api/payments/create-order with valid booking (should fail - not configured)
    if booking_id:
        try:
            resp = requests.post(f"{BASE_URL}/payments/create-order", json={
                "bookingId": booking_id,
                "amountPaise": 149900
            })
            if resp.status_code == 503:
                data = resp.json()
                if data.get("error") == "razorpay_not_configured":
                    log_test("RP2: POST /payments/create-order returns 503 razorpay_not_configured", True)
                else:
                    log_test("RP2: POST /payments/create-order returns 503 razorpay_not_configured", False, 
                            f"Wrong error: {data.get('error')}")
            else:
                log_test("RP2: POST /payments/create-order returns 503 razorpay_not_configured", False, 
                        f"Status {resp.status_code}: {resp.text}")
        except Exception as e:
            log_test("RP2: POST /payments/create-order returns 503 razorpay_not_configured", False, str(e))
    
    # RP3: POST /payments/create-order without bookingId
    try:
        resp = requests.post(f"{BASE_URL}/payments/create-order", json={})
        if resp.status_code == 400:
            data = resp.json()
            if data.get("error") == "bookingId_required":
                log_test("RP3: POST /payments/create-order {} returns 400 bookingId_required", True)
            else:
                log_test("RP3: POST /payments/create-order {} returns 400 bookingId_required", False, 
                        f"Wrong error: {data.get('error')}")
        else:
            log_test("RP3: POST /payments/create-order {} returns 400 bookingId_required", False, 
                    f"Status {resp.status_code}")
    except Exception as e:
        log_test("RP3: POST /payments/create-order {} returns 400 bookingId_required", False, str(e))
    
    # RP4: POST /payments/create-order with invalid amount (negative)
    if booking_id:
        try:
            resp = requests.post(f"{BASE_URL}/payments/create-order", json={
                "bookingId": booking_id,
                "amountPaise": -1
            })
            if resp.status_code == 400:
                data = resp.json()
                if data.get("error") == "invalid_amount":
                    log_test("RP4: POST /payments/create-order with amountPaise=-1 returns 400 invalid_amount", True)
                else:
                    log_test("RP4: POST /payments/create-order with amountPaise=-1 returns 400 invalid_amount", False, 
                            f"Wrong error: {data.get('error')}")
            else:
                log_test("RP4: POST /payments/create-order with amountPaise=-1 returns 400 invalid_amount", False, 
                        f"Status {resp.status_code}")
        except Exception as e:
            log_test("RP4: POST /payments/create-order with amountPaise=-1 returns 400 invalid_amount", False, str(e))
    
    # RP4b: POST /payments/create-order with invalid amount (string)
    if booking_id:
        try:
            resp = requests.post(f"{BASE_URL}/payments/create-order", json={
                "bookingId": booking_id,
                "amountPaise": "abc"
            })
            if resp.status_code == 400:
                data = resp.json()
                if data.get("error") == "invalid_amount":
                    log_test("RP4b: POST /payments/create-order with amountPaise='abc' returns 400 invalid_amount", True)
                else:
                    log_test("RP4b: POST /payments/create-order with amountPaise='abc' returns 400 invalid_amount", False, 
                            f"Wrong error: {data.get('error')}")
            else:
                log_test("RP4b: POST /payments/create-order with amountPaise='abc' returns 400 invalid_amount", False, 
                        f"Status {resp.status_code}")
        except Exception as e:
            log_test("RP4b: POST /payments/create-order with amountPaise='abc' returns 400 invalid_amount", False, str(e))
    
    # RP5: POST /payments/create-order with nonexistent bookingId
    try:
        resp = requests.post(f"{BASE_URL}/payments/create-order", json={
            "bookingId": "nonexistent-booking-id-12345",
            "amountPaise": 100
        })
        if resp.status_code == 404:
            data = resp.json()
            if data.get("error") == "booking_not_found":
                log_test("RP5: POST /payments/create-order with nonexistent bookingId returns 404 booking_not_found", True)
            else:
                log_test("RP5: POST /payments/create-order with nonexistent bookingId returns 404 booking_not_found", False, 
                        f"Wrong error: {data.get('error')}")
        else:
            log_test("RP5: POST /payments/create-order with nonexistent bookingId returns 404 booking_not_found", False, 
                    f"Status {resp.status_code}")
    except Exception as e:
        log_test("RP5: POST /payments/create-order with nonexistent bookingId returns 404 booking_not_found", False, str(e))
    
    # RP6: POST /payments/verify-signature with empty body
    try:
        resp = requests.post(f"{BASE_URL}/payments/verify-signature", json={})
        if resp.status_code == 400:
            data = resp.json()
            if data.get("success") == False and data.get("error") == "missing_fields":
                log_test("RP6: POST /payments/verify-signature {} returns 400 missing_fields", True)
            else:
                log_test("RP6: POST /payments/verify-signature {} returns 400 missing_fields", False, 
                        f"Response: {data}")
        else:
            log_test("RP6: POST /payments/verify-signature {} returns 400 missing_fields", False, 
                    f"Status {resp.status_code}")
    except Exception as e:
        log_test("RP6: POST /payments/verify-signature {} returns 400 missing_fields", False, str(e))
    
    # RP7: POST /payments/verify-signature with bookingId that has no payment record
    if booking_id:
        try:
            resp = requests.post(f"{BASE_URL}/payments/verify-signature", json={
                "bookingId": booking_id,
                "razorpay_order_id": "order_fake123",
                "razorpay_payment_id": "pay_fake123",
                "razorpay_signature": "fake_signature"
            })
            if resp.status_code == 404:
                data = resp.json()
                if data.get("success") == False and data.get("error") == "payment_record_not_found":
                    log_test("RP7: POST /payments/verify-signature with no payment record returns 404 payment_record_not_found", True)
                else:
                    log_test("RP7: POST /payments/verify-signature with no payment record returns 404 payment_record_not_found", False, 
                            f"Response: {data}")
            else:
                log_test("RP7: POST /payments/verify-signature with no payment record returns 404 payment_record_not_found", False, 
                        f"Status {resp.status_code}")
        except Exception as e:
            log_test("RP7: POST /payments/verify-signature with no payment record returns 404 payment_record_not_found", False, str(e))
    
    # RP8: POST /payments/webhook without X-Razorpay-Signature header
    try:
        resp = requests.post(f"{BASE_URL}/payments/webhook", 
                           data='{"event":"payment.captured"}',
                           headers={"Content-Type": "application/json"})
        if resp.status_code == 400:
            data = resp.json()
            if data.get("ok") == False and data.get("error") == "missing_signature":
                log_test("RP8: POST /payments/webhook without signature header returns 400 missing_signature", True)
            else:
                log_test("RP8: POST /payments/webhook without signature header returns 400 missing_signature", False, 
                        f"Response: {data}")
        else:
            log_test("RP8: POST /payments/webhook without signature header returns 400 missing_signature", False, 
                    f"Status {resp.status_code}")
    except Exception as e:
        log_test("RP8: POST /payments/webhook without signature header returns 400 missing_signature", False, str(e))
    
    # RP9: POST /payments/webhook with bogus signature
    try:
        resp = requests.post(f"{BASE_URL}/payments/webhook", 
                           data='{"event":"payment.captured"}',
                           headers={
                               "Content-Type": "application/json",
                               "X-Razorpay-Signature": "bogus_signature_12345"
                           })
        if resp.status_code == 400:
            data = resp.json()
            if data.get("ok") == False and data.get("error") == "invalid_signature":
                log_test("RP9: POST /payments/webhook with bogus signature returns 400 invalid_signature", True)
            else:
                log_test("RP9: POST /payments/webhook with bogus signature returns 400 invalid_signature", False, 
                        f"Response: {data}")
        else:
            log_test("RP9: POST /payments/webhook with bogus signature returns 400 invalid_signature", False, 
                    f"Status {resp.status_code}")
    except Exception as e:
        log_test("RP9: POST /payments/webhook with bogus signature returns 400 invalid_signature", False, str(e))

def test_whatsapp_integration():
    """Test WhatsApp Cloud API integration endpoints"""
    print("\n=== WHATSAPP INTEGRATION TESTS ===\n")
    
    # WA1: POST /admin/notifications/send with WhatsApp channel
    try:
        resp = session.post(f"{BASE_URL}/admin/notifications/send", json={
            "channel": "whatsapp",
            "to": "919916019755",
            "templateKey": "booking_confirmation",
            "variables": {"name": "Test User"}
        })
        if resp.status_code == 200:
            data = resp.json()
            if data.get("status") == "failed" and "whatsapp_not_configured" in data.get("note", "").lower():
                log_test("WA1: POST /admin/notifications/send WhatsApp returns status='failed' with whatsapp_not_configured note", True)
            else:
                log_test("WA1: POST /admin/notifications/send WhatsApp returns status='failed' with whatsapp_not_configured note", False, 
                        f"status={data.get('status')}, note={data.get('note')}")
        else:
            log_test("WA1: POST /admin/notifications/send WhatsApp returns status='failed' with whatsapp_not_configured note", False, 
                    f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        log_test("WA1: POST /admin/notifications/send WhatsApp returns status='failed' with whatsapp_not_configured note", False, str(e))
    
    # WA2: GET /admin/notifications/logs to verify communication was recorded
    try:
        resp = session.get(f"{BASE_URL}/admin/notifications/logs")
        if resp.status_code == 200:
            data = resp.json()
            if isinstance(data, list):
                # Look for the WhatsApp communication we just sent
                whatsapp_log = None
                for log in data:
                    if log.get("channel") == "whatsapp" and log.get("to") == "919916019755":
                        whatsapp_log = log
                        break
                
                if whatsapp_log:
                    if whatsapp_log.get("status") == "failed":
                        log_test("WA2: GET /admin/notifications/logs contains WhatsApp failed communication", True)
                    else:
                        log_test("WA2: GET /admin/notifications/logs contains WhatsApp failed communication", False, 
                                f"Found log but status={whatsapp_log.get('status')}")
                else:
                    log_test("WA2: GET /admin/notifications/logs contains WhatsApp failed communication", False, 
                            "WhatsApp log not found in communications")
            else:
                log_test("WA2: GET /admin/notifications/logs contains WhatsApp failed communication", False, 
                        "Response not a list")
        else:
            log_test("WA2: GET /admin/notifications/logs contains WhatsApp failed communication", False, 
                    f"Status {resp.status_code}")
    except Exception as e:
        log_test("WA2: GET /admin/notifications/logs contains WhatsApp failed communication", False, str(e))
    
    # WA3: POST /admin/notifications/send with email channel (deferred provider)
    try:
        resp = session.post(f"{BASE_URL}/admin/notifications/send", json={
            "channel": "email",
            "to": "test@example.com",
            "templateId": "booking_confirmation",
            "payload": {"name": "Test User"}
        })
        if resp.status_code == 200:
            data = resp.json()
            if data.get("status") == "queued" and "provider not configured" in data.get("note", "").lower():
                log_test("WA3: POST /admin/notifications/send email returns status='queued' with provider not configured note", True)
            else:
                log_test("WA3: POST /admin/notifications/send email returns status='queued' with provider not configured note", False, 
                        f"status={data.get('status')}, note={data.get('note')}")
        else:
            log_test("WA3: POST /admin/notifications/send email returns status='queued' with provider not configured note", False, 
                    f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        log_test("WA3: POST /admin/notifications/send email returns status='queued' with provider not configured note", False, str(e))

def test_regression():
    """Test regression - booking creation should not be blocked by WhatsApp"""
    print("\n=== REGRESSION TESTS ===\n")
    
    # REG1: POST /bookings with phone should return 200 quickly (WhatsApp is fire-and-forget)
    try:
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        resp = requests.post(f"{BASE_URL}/bookings", json={
            "outcome": "salt-therapy",
            "therapy": "Salt Cave Session",
            "slotDate": tomorrow,
            "slotTime": "15:00",
            "contact": {
                "name": "Priya Sharma",
                "phone": "9916019755",
                "email": "priya.sharma@example.com"
            },
            "total": 1299
        })
        if resp.status_code == 200:
            data = resp.json()
            if "id" in data and "ref" in data:
                log_test("REG1: POST /bookings with phone returns 200 quickly (WhatsApp fire-and-forget)", True)
            else:
                log_test("REG1: POST /bookings with phone returns 200 quickly (WhatsApp fire-and-forget)", False, 
                        f"Missing id or ref: {data}")
        else:
            log_test("REG1: POST /bookings with phone returns 200 quickly (WhatsApp fire-and-forget)", False, 
                    f"Status {resp.status_code}")
    except Exception as e:
        log_test("REG1: POST /bookings with phone returns 200 quickly (WhatsApp fire-and-forget)", False, str(e))
    
    # REG2: GET /health
    try:
        resp = requests.get(f"{BASE_URL}/health")
        if resp.status_code == 200:
            data = resp.json()
            if data.get("ok") and data.get("service") == "salt-world-builder":
                log_test("REG2: GET /health returns 200", True)
            else:
                log_test("REG2: GET /health returns 200", False, f"Invalid response: {data}")
        else:
            log_test("REG2: GET /health returns 200", False, f"Status {resp.status_code}")
    except Exception as e:
        log_test("REG2: GET /health returns 200", False, str(e))
    
    # REG3: GET /templates
    try:
        resp = requests.get(f"{BASE_URL}/templates")
        if resp.status_code == 200:
            data = resp.json()
            if isinstance(data, list) and len(data) == 6:
                log_test("REG3: GET /templates returns 6 templates", True)
            else:
                log_test("REG3: GET /templates returns 6 templates", False, 
                        f"Expected 6 templates, got {len(data) if isinstance(data, list) else 'not a list'}")
        else:
            log_test("REG3: GET /templates returns 6 templates", False, f"Status {resp.status_code}")
    except Exception as e:
        log_test("REG3: GET /templates returns 6 templates", False, str(e))

def main():
    print("=" * 80)
    print("SALT WORLD - RAZORPAY + WHATSAPP INTEGRATION TEST SUITE")
    print("=" * 80)
    
    # Test Razorpay (public endpoints - no auth needed)
    test_razorpay_integration()
    
    # Login for WhatsApp tests (admin endpoints)
    if login_admin():
        test_whatsapp_integration()
    else:
        print("\n⚠️  Skipping WhatsApp tests - admin login failed")
    
    # Regression tests
    test_regression()
    
    # Print summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    print(f"✅ Passed: {tests_passed}")
    print(f"❌ Failed: {tests_failed}")
    print(f"Total: {tests_passed + tests_failed}")
    if tests_passed + tests_failed > 0:
        print(f"Success Rate: {(tests_passed / (tests_passed + tests_failed) * 100):.1f}%")
    print("=" * 80)
    
    return tests_failed == 0

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
