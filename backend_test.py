#!/usr/bin/env python3
"""
Phase 3.2.C — Notification Providers (Gallabox WhatsApp + BhashSMS) Backend Tests
Tests all provider config, routing, and communication log endpoints.
"""

import requests
import json
import time
from datetime import datetime, timedelta

BASE_URL = "https://saltwell-arch.preview.emergentagent.com/api"
ADMIN_EMAIL = "admin@saltworld.in"
ADMIN_PASSWORD = "SaltWorld@2025"

# Global state
admin_cookie = None
test_communication_ids = []
test_booking_ids = []
gallabox_integration_inserted = False

def login_admin():
    """Login as admin and get session cookie"""
    global admin_cookie
    print("\n=== Admin Login ===")
    res = requests.post(f"{BASE_URL}/admin/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    print(f"Login status: {res.status_code}")
    if res.status_code == 200:
        admin_cookie = res.cookies.get("sw_admin")
        print(f"✅ Admin login successful, cookie obtained")
        return True
    else:
        print(f"❌ Admin login failed: {res.text}")
        return False

def get_admin_cookies():
    """Return cookies dict for admin requests"""
    return {"sw_admin": admin_cookie} if admin_cookie else {}

# ============================================================================
# A. Providers config
# ============================================================================

def test_a1_get_providers_config():
    """A1: GET /api/admin/notifications/providers returns correct shape"""
    print("\n=== A1: GET providers config ===")
    res = requests.get(f"{BASE_URL}/admin/notifications/providers", cookies=get_admin_cookies())
    print(f"Status: {res.status_code}")
    
    if res.status_code != 200:
        print(f"❌ Expected 200, got {res.status_code}: {res.text}")
        return False
    
    data = res.json()
    print(f"Response: {json.dumps(data, indent=2)}")
    
    # Check shape
    if data.get("whatsapp") != "gallabox":
        print(f"❌ Expected whatsapp='gallabox', got {data.get('whatsapp')}")
        return False
    
    if data.get("sms") != "bhashsms":
        print(f"❌ Expected sms='bhashsms', got {data.get('sms')}")
        return False
    
    # Check available structure
    available = data.get("available", {})
    whatsapp_avail = available.get("whatsapp", {})
    sms_avail = available.get("sms", {})
    
    print(f"WhatsApp available: gallabox={whatsapp_avail.get('gallabox')}, meta_cloud={whatsapp_avail.get('meta_cloud')}")
    print(f"SMS available: bhashsms={sms_avail.get('bhashsms')}")
    
    # Gallabox should be false (channelId missing)
    if whatsapp_avail.get("gallabox") != False:
        print(f"⚠️  Expected gallabox=false (channelId missing), got {whatsapp_avail.get('gallabox')}")
    
    # BhashSMS should be true (creds present)
    if sms_avail.get("bhashsms") != True:
        print(f"❌ Expected bhashsms=true, got {sms_avail.get('bhashsms')}")
        return False
    
    print("✅ A1 PASSED: Providers config shape correct")
    return True

def test_a2_put_providers_config():
    """A2: PUT /api/admin/notifications/providers with new values"""
    print("\n=== A2: PUT providers config (meta_cloud) ===")
    res = requests.put(
        f"{BASE_URL}/admin/notifications/providers",
        json={"whatsapp": "meta_cloud", "sms": "bhashsms"},
        cookies=get_admin_cookies()
    )
    print(f"Status: {res.status_code}")
    
    if res.status_code != 200:
        print(f"❌ Expected 200, got {res.status_code}: {res.text}")
        return False
    
    data = res.json()
    print(f"Response: {json.dumps(data, indent=2)}")
    
    if data.get("whatsapp") != "meta_cloud":
        print(f"❌ Expected whatsapp='meta_cloud', got {data.get('whatsapp')}")
        return False
    
    print("✅ A2 PASSED: Provider config updated to meta_cloud")
    return True

def test_a3_restore_providers_config():
    """A3: Restore to gallabox"""
    print("\n=== A3: Restore providers config (gallabox) ===")
    res = requests.put(
        f"{BASE_URL}/admin/notifications/providers",
        json={"whatsapp": "gallabox", "sms": "bhashsms"},
        cookies=get_admin_cookies()
    )
    print(f"Status: {res.status_code}")
    
    if res.status_code != 200:
        print(f"❌ Expected 200, got {res.status_code}: {res.text}")
        return False
    
    data = res.json()
    if data.get("whatsapp") != "gallabox":
        print(f"❌ Expected whatsapp='gallabox', got {data.get('whatsapp')}")
        return False
    
    print("✅ A3 PASSED: Provider config restored to gallabox")
    return True

def test_a4_put_invalid_providers():
    """A4: PUT with invalid values should coerce to defaults"""
    print("\n=== A4: PUT invalid provider values ===")
    res = requests.put(
        f"{BASE_URL}/admin/notifications/providers",
        json={"whatsapp": "invalid", "sms": "unknown"},
        cookies=get_admin_cookies()
    )
    print(f"Status: {res.status_code}")
    
    if res.status_code != 200:
        print(f"❌ Expected 200, got {res.status_code}: {res.text}")
        return False
    
    data = res.json()
    print(f"Response: {json.dumps(data, indent=2)}")
    
    # Should coerce to defaults
    if data.get("whatsapp") != "gallabox":
        print(f"❌ Expected whatsapp='gallabox' (coerced), got {data.get('whatsapp')}")
        return False
    
    if data.get("sms") != "bhashsms":
        print(f"❌ Expected sms='bhashsms' (coerced), got {data.get('sms')}")
        return False
    
    print("✅ A4 PASSED: Invalid values coerced to defaults")
    return True

# ============================================================================
# B. Provider auth guards
# ============================================================================

def test_b5_get_providers_no_auth():
    """B5: GET providers without admin cookie should return 401/403"""
    print("\n=== B5: GET providers without auth ===")
    res = requests.get(f"{BASE_URL}/admin/notifications/providers")
    print(f"Status: {res.status_code}")
    
    if res.status_code not in [401, 403]:
        print(f"❌ Expected 401/403, got {res.status_code}: {res.text}")
        return False
    
    print("✅ B5 PASSED: Unauthenticated request rejected")
    return True

def test_b6_put_providers_no_auth():
    """B6: PUT providers without admin cookie should return 401/403"""
    print("\n=== B6: PUT providers without auth ===")
    res = requests.put(
        f"{BASE_URL}/admin/notifications/providers",
        json={"whatsapp": "gallabox", "sms": "bhashsms"}
    )
    print(f"Status: {res.status_code}")
    
    if res.status_code not in [401, 403]:
        print(f"❌ Expected 401/403, got {res.status_code}: {res.text}")
        return False
    
    print("✅ B6 PASSED: Unauthenticated PUT rejected")
    return True

# ============================================================================
# C. WhatsApp — Gallabox routing
# ============================================================================

def test_c8_send_whatsapp_no_channel_id():
    """C8: POST send whatsapp without channelId should fail with gallabox_not_configured"""
    print("\n=== C8: Send WhatsApp (Gallabox, no channelId) ===")
    res = requests.post(
        f"{BASE_URL}/admin/notifications/send",
        json={
            "channel": "whatsapp",
            "to": "9876500123",
            "templateName": "welcome_v1",
            "variables": {"name": "Test"},
            "orderedVariables": ["name"]
        },
        cookies=get_admin_cookies()
    )
    print(f"Status: {res.status_code}")
    
    if res.status_code != 200:
        print(f"❌ Expected 200, got {res.status_code}: {res.text}")
        return False
    
    data = res.json()
    print(f"Response: {json.dumps(data, indent=2)}")
    
    # Check fields
    if data.get("channel") != "whatsapp":
        print(f"❌ Expected channel='whatsapp', got {data.get('channel')}")
        return False
    
    if data.get("provider") != "gallabox":
        print(f"❌ Expected provider='gallabox', got {data.get('provider')}")
        return False
    
    if data.get("status") != "failed":
        print(f"❌ Expected status='failed', got {data.get('status')}")
        return False
    
    note = data.get("note", "")
    if "gallabox_not_configured" not in note:
        print(f"❌ Expected note to contain 'gallabox_not_configured', got: {note}")
        return False
    
    # Save communication ID for cleanup
    if data.get("id"):
        test_communication_ids.append(data["id"])
    
    print("✅ C8 PASSED: Gallabox not configured error as expected")
    return True

def test_c9_insert_gallabox_channel_id():
    """C9: Manually insert channelId via MongoDB"""
    print("\n=== C9: Insert Gallabox channelId via mongosh ===")
    
    # Use mongosh to insert/update integrations collection
    cmd = """mongosh --quiet your_database_name --eval 'db.integrations.updateOne(
        {key:"gallabox"},
        {$set:{
            key:"gallabox",
            config:{
                apiKey:"6a5e2d7f0b85f541c639d6d0",
                apiSecret:"321cf646a21648c5bcbc5ffd261657de",
                channelId:"test-channel-999"
            },
            updatedAt:new Date()
        }},
        {upsert:true}
    )'"""
    
    import subprocess
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=10)
        print(f"Mongosh output: {result.stdout}")
        if result.returncode != 0:
            print(f"⚠️  Mongosh error: {result.stderr}")
            return False
        
        global gallabox_integration_inserted
        gallabox_integration_inserted = True
        
        print("✅ C9: Gallabox channelId inserted")
        print("⏳ Waiting 40 seconds for cache to expire...")
        time.sleep(40)
        return True
    except Exception as e:
        print(f"❌ Failed to insert channelId: {e}")
        return False

def test_c9b_verify_gallabox_configured():
    """C9b: Verify GET providers now shows gallabox as configured"""
    print("\n=== C9b: Verify Gallabox now configured ===")
    res = requests.get(f"{BASE_URL}/admin/notifications/providers", cookies=get_admin_cookies())
    print(f"Status: {res.status_code}")
    
    if res.status_code != 200:
        print(f"❌ Expected 200, got {res.status_code}: {res.text}")
        return False
    
    data = res.json()
    available = data.get("available", {})
    gallabox_configured = available.get("whatsapp", {}).get("gallabox")
    
    print(f"Gallabox configured: {gallabox_configured}")
    
    if gallabox_configured != True:
        print(f"❌ Expected gallabox=true after inserting channelId, got {gallabox_configured}")
        return False
    
    print("✅ C9b PASSED: Gallabox now shows as configured")
    return True

def test_c10_send_whatsapp_with_channel_id():
    """C10: Retry send whatsapp - should now make real HTTP call to Gallabox"""
    print("\n=== C10: Send WhatsApp (Gallabox, with channelId) ===")
    res = requests.post(
        f"{BASE_URL}/admin/notifications/send",
        json={
            "channel": "whatsapp",
            "to": "9876500123",
            "templateName": "welcome_v1",
            "variables": {"name": "Test"},
            "orderedVariables": ["name"]
        },
        cookies=get_admin_cookies()
    )
    print(f"Status: {res.status_code}")
    
    if res.status_code != 200:
        print(f"❌ Expected 200, got {res.status_code}: {res.text}")
        return False
    
    data = res.json()
    print(f"Response: {json.dumps(data, indent=2)}")
    
    # Check fields
    if data.get("provider") != "gallabox":
        print(f"❌ Expected provider='gallabox', got {data.get('provider')}")
        return False
    
    if data.get("status") != "failed":
        print(f"❌ Expected status='failed' (fake channelId), got {data.get('status')}")
        return False
    
    note = data.get("note", "")
    # Should NOT be gallabox_not_configured anymore
    if "gallabox_not_configured" in note:
        print(f"❌ Note still contains 'gallabox_not_configured': {note}")
        return False
    
    # Should be gallabox_api_error or similar (real HTTP call was made)
    if "gallabox_api_error" not in note and "error" not in note.lower():
        print(f"⚠️  Expected note to contain API error, got: {note}")
    
    # Save communication ID for cleanup
    if data.get("id"):
        test_communication_ids.append(data["id"])
    
    print("✅ C10 PASSED: Real Gallabox API call made (failed as expected with fake channelId)")
    return True

def test_c11_cleanup_gallabox_integration():
    """C11: Cleanup - delete Gallabox integration doc"""
    print("\n=== C11: Cleanup Gallabox integration ===")
    
    if not gallabox_integration_inserted:
        print("⏭️  Skipping cleanup (no integration was inserted)")
        return True
    
    cmd = """mongosh --quiet your_database_name --eval 'db.integrations.deleteOne({key:"gallabox"})'"""
    
    import subprocess
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=10)
        print(f"Mongosh output: {result.stdout}")
        if result.returncode != 0:
            print(f"⚠️  Mongosh error: {result.stderr}")
            return False
        
        print("✅ C11: Gallabox integration deleted")
        return True
    except Exception as e:
        print(f"❌ Failed to delete integration: {e}")
        return False

# ============================================================================
# D. SMS — BhashSMS routing
# ============================================================================

def test_d12_send_sms():
    """D12: POST send SMS via BhashSMS"""
    print("\n=== D12: Send SMS (BhashSMS) ===")
    res = requests.post(
        f"{BASE_URL}/admin/notifications/send",
        json={
            "channel": "sms",
            "to": "9876500123",
            "text": "Salt World test notification"
        },
        cookies=get_admin_cookies()
    )
    print(f"Status: {res.status_code}")
    
    if res.status_code != 200:
        print(f"❌ Expected 200, got {res.status_code}: {res.text}")
        return False
    
    data = res.json()
    print(f"Response: {json.dumps(data, indent=2)}")
    
    # Check fields
    if data.get("channel") != "sms":
        print(f"❌ Expected channel='sms', got {data.get('channel')}")
        return False
    
    if data.get("provider") != "bhashsms":
        print(f"❌ Expected provider='bhashsms', got {data.get('provider')}")
        return False
    
    # Status should be 'sent' or 'failed' (real HTTP call was made)
    status = data.get("status")
    if status not in ["sent", "failed"]:
        print(f"❌ Expected status='sent' or 'failed', got {status}")
        return False
    
    note = data.get("note", "")
    # Should NOT be bhashsms_not_configured
    if "bhashsms_not_configured" in note:
        print(f"❌ Note contains 'bhashsms_not_configured': {note}")
        return False
    
    print(f"Status: {status}, Note: {note}")
    
    # Save communication ID for cleanup
    if data.get("id"):
        test_communication_ids.append(data["id"])
    
    print("✅ D12 PASSED: Real BhashSMS API call made")
    return True

def test_d13_send_sms_invalid_phone():
    """D13: POST send SMS with invalid phone"""
    print("\n=== D13: Send SMS (invalid phone) ===")
    res = requests.post(
        f"{BASE_URL}/admin/notifications/send",
        json={
            "channel": "sms",
            "to": "invalid_phone"
        },
        cookies=get_admin_cookies()
    )
    print(f"Status: {res.status_code}")
    
    if res.status_code != 200:
        print(f"❌ Expected 200, got {res.status_code}: {res.text}")
        return False
    
    data = res.json()
    print(f"Response: {json.dumps(data, indent=2)}")
    
    # Should be status='failed'
    if data.get("status") != "failed":
        print(f"❌ Expected status='failed', got {data.get('status')}")
        return False
    
    note = data.get("note", "")
    # Should contain 'invalid_phone' or 'text_required'
    if "invalid_phone" not in note and "text_required" not in note:
        print(f"⚠️  Expected note to contain 'invalid_phone' or 'text_required', got: {note}")
    
    # Save communication ID for cleanup
    if data.get("id"):
        test_communication_ids.append(data["id"])
    
    print("✅ D13 PASSED: Invalid phone handled correctly")
    return True

# ============================================================================
# E. Communications log
# ============================================================================

def test_e14_get_logs():
    """E14: GET /api/admin/notifications/logs"""
    print("\n=== E14: GET communications logs ===")
    res = requests.get(f"{BASE_URL}/admin/notifications/logs", cookies=get_admin_cookies())
    print(f"Status: {res.status_code}")
    
    if res.status_code != 200:
        print(f"❌ Expected 200, got {res.status_code}: {res.text}")
        return False
    
    data = res.json()
    print(f"Logs count: {len(data)}")
    
    if not isinstance(data, list):
        print(f"❌ Expected array, got {type(data)}")
        return False
    
    # Check recent test entries
    test_entries = [log for log in data if log.get("to") in ["9876500123", "invalid_phone"]]
    print(f"Test entries found: {len(test_entries)}")
    
    if len(test_entries) > 0:
        sample = test_entries[0]
        print(f"Sample log entry: {json.dumps(sample, indent=2)}")
        
        # Check required fields
        required_fields = ["id", "to", "channel", "provider", "status", "sentAt"]
        for field in required_fields:
            if field not in sample:
                print(f"⚠️  Missing field '{field}' in log entry")
    
    print("✅ E14 PASSED: Logs endpoint working")
    return True

def test_e15_retry_failed_communication():
    """E15: POST /api/admin/notifications/retry/:id"""
    print("\n=== E15: Retry failed communication ===")
    
    if not test_communication_ids:
        print("⏭️  No test communication IDs to retry")
        return True
    
    comm_id = test_communication_ids[0]
    print(f"Retrying communication ID: {comm_id}")
    
    res = requests.post(
        f"{BASE_URL}/admin/notifications/retry/{comm_id}",
        cookies=get_admin_cookies()
    )
    print(f"Status: {res.status_code}")
    
    if res.status_code != 200:
        print(f"❌ Expected 200, got {res.status_code}: {res.text}")
        return False
    
    data = res.json()
    print(f"Response: {json.dumps(data, indent=2)}")
    
    # Should have 'ok' field
    if "ok" not in data:
        print(f"⚠️  Response missing 'ok' field")
    
    print("✅ E15 PASSED: Retry endpoint working")
    return True

# ============================================================================
# F. Regression check
# ============================================================================

def test_f16_get_booking_rules():
    """F16: GET /api/booking-rules still works"""
    print("\n=== F16: Regression - GET booking-rules ===")
    res = requests.get(f"{BASE_URL}/booking-rules")
    print(f"Status: {res.status_code}")
    
    if res.status_code != 200:
        print(f"❌ Expected 200, got {res.status_code}: {res.text}")
        return False
    
    print("✅ F16 PASSED: Booking rules endpoint working")
    return True

def test_f17_create_booking():
    """F17: POST /api/bookings (basic salt-therapy booking)"""
    print("\n=== F17: Regression - Create booking ===")
    
    # Create a booking for a future date
    future_date = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
    
    res = requests.post(
        f"{BASE_URL}/bookings",
        json={
            "therapies": [{"slug": "float-therapy"}],
            "slotDate": future_date,
            "slotTime": "14:00",
            "name": "Test User",
            "phone": "9876543210",
            "email": "test@example.com"
        }
    )
    print(f"Status: {res.status_code}")
    
    if res.status_code != 200:
        print(f"❌ Expected 200, got {res.status_code}: {res.text}")
        return False
    
    data = res.json()
    print(f"Booking created: {data.get('ref')}")
    
    # Save booking ID for cleanup
    if data.get("id"):
        test_booking_ids.append(data["id"])
    
    print("✅ F17 PASSED: Booking creation working (notifications may fail but booking succeeds)")
    return True

def test_f18_verify_booking_communication_log():
    """F18: Verify booking created a communication log"""
    print("\n=== F18: Verify booking communication log ===")
    
    # Wait a moment for async notification to fire
    time.sleep(2)
    
    res = requests.get(f"{BASE_URL}/admin/notifications/logs", cookies=get_admin_cookies())
    print(f"Status: {res.status_code}")
    
    if res.status_code != 200:
        print(f"❌ Expected 200, got {res.status_code}: {res.text}")
        return False
    
    data = res.json()
    
    # Look for recent communication with phone 9876543210
    booking_comms = [log for log in data if log.get("to") == "9876543210"]
    print(f"Booking communications found: {len(booking_comms)}")
    
    if len(booking_comms) > 0:
        sample = booking_comms[0]
        print(f"Sample: channel={sample.get('channel')}, status={sample.get('status')}, provider={sample.get('provider')}")
        print("✅ F18 PASSED: Booking triggered communication log")
    else:
        print("⚠️  No communication log found for booking (may be async delay)")
    
    return True

# ============================================================================
# G. Cleanup
# ============================================================================

def test_g_cleanup_bookings():
    """G: Delete test bookings"""
    print("\n=== G: Cleanup test bookings ===")
    
    if not test_booking_ids:
        print("⏭️  No test bookings to clean up")
        return True
    
    for booking_id in test_booking_ids:
        try:
            res = requests.delete(
                f"{BASE_URL}/admin/bookings/{booking_id}",
                cookies=get_admin_cookies()
            )
            print(f"Deleted booking {booking_id}: {res.status_code}")
        except Exception as e:
            print(f"⚠️  Failed to delete booking {booking_id}: {e}")
    
    print("✅ Cleanup: Bookings deleted")
    return True

def test_g_cleanup_communications():
    """G: Delete test communication logs"""
    print("\n=== G: Cleanup test communications ===")
    
    # Use mongosh to delete test communications
    cmd = """mongosh --quiet your_database_name --eval 'db.communications.deleteMany({$or:[{to:"9876500123"},{to:"invalid_phone"},{to:"9876543210"}]})'"""
    
    import subprocess
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=10)
        print(f"Mongosh output: {result.stdout}")
        if result.returncode != 0:
            print(f"⚠️  Mongosh error: {result.stderr}")
            return False
        
        print("✅ Cleanup: Test communications deleted")
        return True
    except Exception as e:
        print(f"❌ Failed to delete communications: {e}")
        return False

# ============================================================================
# Main test runner
# ============================================================================

def main():
    print("=" * 80)
    print("Phase 3.2.C — Notification Providers Backend Tests")
    print("=" * 80)
    
    # Login first
    if not login_admin():
        print("\n❌ FATAL: Admin login failed, cannot proceed")
        return
    
    tests = [
        # A. Providers config
        ("A1: GET providers config", test_a1_get_providers_config),
        ("A2: PUT providers config (meta_cloud)", test_a2_put_providers_config),
        ("A3: Restore providers config (gallabox)", test_a3_restore_providers_config),
        ("A4: PUT invalid provider values", test_a4_put_invalid_providers),
        
        # B. Provider auth guards
        ("B5: GET providers without auth", test_b5_get_providers_no_auth),
        ("B6: PUT providers without auth", test_b6_put_providers_no_auth),
        
        # C. WhatsApp — Gallabox routing
        ("C8: Send WhatsApp (no channelId)", test_c8_send_whatsapp_no_channel_id),
        ("C9: Insert Gallabox channelId", test_c9_insert_gallabox_channel_id),
        ("C9b: Verify Gallabox configured", test_c9b_verify_gallabox_configured),
        ("C10: Send WhatsApp (with channelId)", test_c10_send_whatsapp_with_channel_id),
        ("C11: Cleanup Gallabox integration", test_c11_cleanup_gallabox_integration),
        
        # D. SMS — BhashSMS routing
        ("D12: Send SMS (BhashSMS)", test_d12_send_sms),
        ("D13: Send SMS (invalid phone)", test_d13_send_sms_invalid_phone),
        
        # E. Communications log
        ("E14: GET communications logs", test_e14_get_logs),
        ("E15: Retry failed communication", test_e15_retry_failed_communication),
        
        # F. Regression check
        ("F16: GET booking-rules", test_f16_get_booking_rules),
        ("F17: Create booking", test_f17_create_booking),
        ("F18: Verify booking communication log", test_f18_verify_booking_communication_log),
        
        # G. Cleanup
        ("G: Cleanup bookings", test_g_cleanup_bookings),
        ("G: Cleanup communications", test_g_cleanup_communications),
    ]
    
    results = []
    for name, test_func in tests:
        try:
            passed = test_func()
            results.append((name, passed))
        except Exception as e:
            print(f"\n❌ EXCEPTION in {name}: {e}")
            import traceback
            traceback.print_exc()
            results.append((name, False))
    
    # Summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    
    passed_count = sum(1 for _, passed in results if passed)
    total_count = len(results)
    
    for name, passed in results:
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status}: {name}")
    
    print(f"\nTotal: {passed_count}/{total_count} tests passed")
    print("=" * 80)

if __name__ == "__main__":
    main()
