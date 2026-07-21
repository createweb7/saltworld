#!/usr/bin/env python3
"""
Salt World — Calendar Block Bug Fix Verification
Test suite for verifying the fix where branch-scoped calendar blocks were being
ignored when customers had no branch context (branchId=null in query).

Bug: Admin creates branch-wide block, but customers still see available slots.
Root cause: Block query used query's branchId (null) instead of resource's branchId.
Fix: Refactored checkJourneyAvailability to use resource's branchId when checking blocks.

Test Scenarios:
A. Bug-fix verification (branch block honored without branchId context)
B. New block scenarios (create, verify, delete)
C. Therapy-scope block
D. Multi-therapy journey
E. Regression check (allocation for un-blocked cases)
F. Cleanup
"""

import requests
import json
from datetime import datetime, timedelta

BASE_URL = "https://saltwell-arch.preview.emergentagent.com/api"
ADMIN_EMAIL = "admin@saltworld.in"
ADMIN_PASSWORD = "SaltWorld@2025"

# Branch IDs from review request
HSR_BRANCH_ID = "52184896-4b25-4b78-b9cf-53b98bb0be02"
HYDERABAD_BRANCH_ID = "75aff00b-f9ed-445a-b75d-0881c78cc088"

# Existing block: 2026-07-22 (all day IST) for HSR Layout branch
BLOCKED_DATE = "2026-07-22"
UNBLOCKED_DATE = "2026-07-23"

# Test data tracking
created_blocks = []
created_bookings = []
admin_cookie = None

def login_admin():
    """Login as admin and get session cookie"""
    global admin_cookie
    print("\n🔐 Logging in as admin...")
    resp = requests.post(f"{BASE_URL}/admin/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if resp.status_code == 200:
        admin_cookie = resp.cookies.get("sw_admin")
        print(f"✅ Admin login successful")
        return True
    else:
        print(f"❌ Admin login failed: {resp.status_code} {resp.text}")
        return False

def get_admin_cookies():
    """Return cookies dict for admin requests"""
    return {"sw_admin": admin_cookie} if admin_cookie else {}

def get_resource_by_name(name):
    """Get resource ID by name"""
    cookies = get_admin_cookies()
    resp = requests.get(f"{BASE_URL}/admin/resources", cookies=cookies)
    if resp.status_code == 200:
        resources = resp.json()
        for r in resources:
            if r.get("name") == name:
                return r
    return None

# ============================================================================
# A. BUG-FIX VERIFICATION (branch block honored without branchId context)
# ============================================================================

def test_a1_slots_without_branch_context():
    """A1: GET /api/scheduling/slots?therapies=salt-therapy&date=2026-07-22 (NO branchId)
    Expected: 200 with 0 total slots (all groups empty) due to branch block"""
    print("\n" + "="*80)
    print("TEST A1: Slots without branch context on blocked date")
    print("="*80)
    
    try:
        resp = requests.get(f"{BASE_URL}/scheduling/slots", params={
            "therapies": "salt-therapy",
            "date": BLOCKED_DATE
        })
        
        print(f"Status: {resp.status_code}")
        data = resp.json()
        print(f"Response: {json.dumps(data, indent=2)}")
        
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        
        groups = data.get("groups", {})
        morning = groups.get("morning", [])
        afternoon = groups.get("afternoon", [])
        evening = groups.get("evening", [])
        total_slots = len(morning) + len(afternoon) + len(evening)
        
        print(f"Morning slots: {len(morning)}")
        print(f"Afternoon slots: {len(afternoon)}")
        print(f"Evening slots: {len(evening)}")
        print(f"Total slots: {total_slots}")
        
        assert total_slots == 0, f"Expected 0 slots (blocked), got {total_slots}"
        print("✅ A1 PASSED: Branch block correctly blocks slots even without branchId in query")
        return True
        
    except Exception as e:
        print(f"❌ A1 FAILED: {str(e)}")
        return False

def test_a2_slots_with_explicit_hsr_branch():
    """A2: Same with &branchId=HSR → 200 with 0 slots"""
    print("\n" + "="*80)
    print("TEST A2: Slots with explicit HSR branchId on blocked date")
    print("="*80)
    
    try:
        resp = requests.get(f"{BASE_URL}/scheduling/slots", params={
            "therapies": "salt-therapy",
            "date": BLOCKED_DATE,
            "branchId": HSR_BRANCH_ID
        })
        
        print(f"Status: {resp.status_code}")
        data = resp.json()
        
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        
        groups = data.get("groups", {})
        total_slots = len(groups.get("morning", [])) + len(groups.get("afternoon", [])) + len(groups.get("evening", []))
        
        print(f"Total slots: {total_slots}")
        
        assert total_slots == 0, f"Expected 0 slots (blocked), got {total_slots}"
        print("✅ A2 PASSED: Branch block correctly blocks slots with explicit branchId")
        return True
        
    except Exception as e:
        print(f"❌ A2 FAILED: {str(e)}")
        return False

def test_a3_slots_on_unblocked_date():
    """A3: Same with &date=2026-07-23 (day after block) → 200 with slots > 0 (control)"""
    print("\n" + "="*80)
    print("TEST A3: Slots on unblocked date (control test)")
    print("="*80)
    
    try:
        resp = requests.get(f"{BASE_URL}/scheduling/slots", params={
            "therapies": "salt-therapy",
            "date": UNBLOCKED_DATE
        })
        
        print(f"Status: {resp.status_code}")
        data = resp.json()
        
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        
        groups = data.get("groups", {})
        total_slots = len(groups.get("morning", [])) + len(groups.get("afternoon", [])) + len(groups.get("evening", []))
        
        print(f"Total slots: {total_slots}")
        
        assert total_slots > 0, f"Expected slots > 0 (unblocked), got {total_slots}"
        print(f"✅ A3 PASSED: Unblocked date has {total_slots} available slots")
        return True
        
    except Exception as e:
        print(f"❌ A3 FAILED: {str(e)}")
        return False

def test_a4_booking_on_blocked_date():
    """A4: POST /api/bookings on 2026-07-22, salt-therapy, slotTime=10:00
    Expected: 409 with error='slot_unavailable', reason contains 'calendar_block', suggestions array"""
    print("\n" + "="*80)
    print("TEST A4: Attempt booking on blocked date")
    print("="*80)
    
    try:
        resp = requests.post(f"{BASE_URL}/bookings", json={
            "therapies": [{"slug": "salt-therapy"}],
            "slotDate": BLOCKED_DATE,
            "slotTime": "10:00",
            "name": "Test Customer",
            "email": "test@example.com",
            "phone": "9999999999",
            "total": 1500
        })
        
        print(f"Status: {resp.status_code}")
        data = resp.json()
        print(f"Response: {json.dumps(data, indent=2)}")
        
        assert resp.status_code == 409, f"Expected 409, got {resp.status_code}"
        assert data.get("error") == "slot_unavailable", f"Expected error='slot_unavailable', got {data.get('error')}"
        
        reason = data.get("reason", "")
        assert "calendar_block" in reason, f"Expected reason to contain 'calendar_block', got '{reason}'"
        
        suggestions = data.get("suggestions", [])
        assert isinstance(suggestions, list), "Expected suggestions to be an array"
        assert len(suggestions) > 0, "Expected at least one suggestion"
        
        print(f"Reason: {reason}")
        print(f"Suggestions count: {len(suggestions)}")
        print(f"First suggestion: {suggestions[0] if suggestions else 'None'}")
        
        print("✅ A4 PASSED: Booking correctly blocked with 409 and suggestions")
        return True
        
    except Exception as e:
        print(f"❌ A4 FAILED: {str(e)}")
        return False

# ============================================================================
# B. NEW BLOCK SCENARIOS (create, verify, delete)
# ============================================================================

def test_b5_create_resource_block():
    """B5: Create resource-scope block for Salt Cave for 2026-08-05 (12:00-14:00 IST)"""
    print("\n" + "="*80)
    print("TEST B5: Create resource-scope block")
    print("="*80)
    
    try:
        # Get Salt Cave resource
        salt_cave = get_resource_by_name("Salt Cave")
        if not salt_cave:
            print("❌ B5 FAILED: Salt Cave resource not found")
            return False
        
        resource_id = salt_cave.get("id")
        print(f"Salt Cave resource ID: {resource_id}")
        
        # Create block for 2026-08-05 12:00-14:00 IST
        # IST = UTC+5:30, so 12:00 IST = 06:30 UTC, 14:00 IST = 08:30 UTC
        cookies = get_admin_cookies()
        resp = requests.post(f"{BASE_URL}/admin/calendar-blocks", 
            cookies=cookies,
            json={
                "scope": "resource",
                "resourceId": resource_id,
                "startAt": "2026-08-05T06:30:00.000Z",
                "endAt": "2026-08-05T08:30:00.000Z",
                "reason": "maintenance",
                "reasonNote": "Test resource block"
            }
        )
        
        print(f"Status: {resp.status_code}")
        data = resp.json()
        print(f"Response: {json.dumps(data, indent=2)}")
        
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        assert data.get("id"), "Expected block to have an id"
        assert data.get("scope") == "resource", f"Expected scope='resource', got {data.get('scope')}"
        assert data.get("reason") == "maintenance", f"Expected reason='maintenance', got {data.get('reason')}"
        
        block_id = data.get("id")
        created_blocks.append(block_id)
        
        print(f"✅ B5 PASSED: Resource block created with id={block_id}")
        return block_id
        
    except Exception as e:
        print(f"❌ B5 FAILED: {str(e)}")
        return None

def test_b6_verify_resource_block_slots(block_id):
    """B6: Verify slots for 2026-08-05 salt-therapy: 12:00-14:00 IST excluded, 10:00 and 15:00 present"""
    print("\n" + "="*80)
    print("TEST B6: Verify resource block affects slot availability")
    print("="*80)
    
    try:
        resp = requests.get(f"{BASE_URL}/scheduling/slots", params={
            "therapies": "salt-therapy",
            "date": "2026-08-05"
        })
        
        print(f"Status: {resp.status_code}")
        data = resp.json()
        
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        
        groups = data.get("groups", {})
        all_slots = groups.get("morning", []) + groups.get("afternoon", []) + groups.get("evening", [])
        slot_times = [s.get("time") for s in all_slots]
        
        print(f"Total slots: {len(all_slots)}")
        print(f"Sample slot times: {slot_times[:10]}")
        
        # Check that 10:00 is present (before block)
        has_10_00 = "10:00" in slot_times
        print(f"Has 10:00 slot: {has_10_00}")
        
        # Check that 12:00-14:00 slots are excluded
        blocked_times = ["12:00", "12:15", "12:30", "12:45", "13:00", "13:15", "13:30", "13:45"]
        blocked_present = [t for t in blocked_times if t in slot_times]
        print(f"Blocked times present: {blocked_present}")
        
        # Check that 15:00 is present (after block)
        has_15_00 = "15:00" in slot_times
        print(f"Has 15:00 slot: {has_15_00}")
        
        assert has_10_00, "Expected 10:00 slot to be present (before block)"
        assert len(blocked_present) == 0, f"Expected no slots in 12:00-14:00 range, but found: {blocked_present}"
        assert has_15_00, "Expected 15:00 slot to be present (after block)"
        
        print("✅ B6 PASSED: Resource block correctly excludes 12:00-14:00 slots")
        return True
        
    except Exception as e:
        print(f"❌ B6 FAILED: {str(e)}")
        return False

def test_b7_booking_during_resource_block():
    """B7: Attempt booking at 2026-08-05 12:30 → 409 with calendar_block_resource_maintenance"""
    print("\n" + "="*80)
    print("TEST B7: Attempt booking during resource block")
    print("="*80)
    
    try:
        resp = requests.post(f"{BASE_URL}/bookings", json={
            "therapies": [{"slug": "salt-therapy"}],
            "slotDate": "2026-08-05",
            "slotTime": "12:30",
            "name": "Test Customer",
            "email": "test@example.com",
            "phone": "9999999998",
            "total": 1500
        })
        
        print(f"Status: {resp.status_code}")
        data = resp.json()
        print(f"Response: {json.dumps(data, indent=2)}")
        
        assert resp.status_code == 409, f"Expected 409, got {resp.status_code}"
        
        reason = data.get("reason", "")
        assert "calendar_block_resource_maintenance" in reason, f"Expected reason to contain 'calendar_block_resource_maintenance', got '{reason}'"
        
        print(f"✅ B7 PASSED: Booking correctly blocked with reason: {reason}")
        return True
        
    except Exception as e:
        print(f"❌ B7 FAILED: {str(e)}")
        return False

def test_b8_delete_resource_block(block_id):
    """B8: Delete the resource block"""
    print("\n" + "="*80)
    print("TEST B8: Delete resource block")
    print("="*80)
    
    try:
        cookies = get_admin_cookies()
        resp = requests.delete(f"{BASE_URL}/admin/calendar-blocks/{block_id}", cookies=cookies)
        
        print(f"Status: {resp.status_code}")
        data = resp.json()
        print(f"Response: {json.dumps(data, indent=2)}")
        
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        assert data.get("ok") == True, "Expected ok=true"
        
        if block_id in created_blocks:
            created_blocks.remove(block_id)
        
        print("✅ B8 PASSED: Resource block deleted successfully")
        return True
        
    except Exception as e:
        print(f"❌ B8 FAILED: {str(e)}")
        return False

def test_b9_verify_slots_after_delete():
    """B9: Re-check 2026-08-05: slots at 12:00-14:00 return"""
    print("\n" + "="*80)
    print("TEST B9: Verify slots return after block deletion")
    print("="*80)
    
    try:
        resp = requests.get(f"{BASE_URL}/scheduling/slots", params={
            "therapies": "salt-therapy",
            "date": "2026-08-05"
        })
        
        print(f"Status: {resp.status_code}")
        data = resp.json()
        
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        
        groups = data.get("groups", {})
        all_slots = groups.get("morning", []) + groups.get("afternoon", []) + groups.get("evening", [])
        slot_times = [s.get("time") for s in all_slots]
        
        # Check that 12:00-14:00 slots are now present
        blocked_times = ["12:00", "12:15", "12:30", "12:45", "13:00", "13:15", "13:30", "13:45"]
        blocked_present = [t for t in blocked_times if t in slot_times]
        print(f"Previously blocked times now present: {blocked_present}")
        
        assert len(blocked_present) > 0, f"Expected some slots in 12:00-14:00 range to return, but found none"
        
        print(f"✅ B9 PASSED: {len(blocked_present)} slots returned after block deletion")
        return True
        
    except Exception as e:
        print(f"❌ B9 FAILED: {str(e)}")
        return False

# ============================================================================
# C. THERAPY-SCOPE BLOCK
# ============================================================================

def test_c10_create_therapy_block():
    """C10: Create therapy-scope block: float-therapy at HSR for 2026-08-10 (10:00-13:00 IST)"""
    print("\n" + "="*80)
    print("TEST C10: Create therapy-scope block")
    print("="*80)
    
    try:
        # 10:00 IST = 04:30 UTC, 13:00 IST = 07:30 UTC
        cookies = get_admin_cookies()
        resp = requests.post(f"{BASE_URL}/admin/calendar-blocks", 
            cookies=cookies,
            json={
                "scope": "therapy",
                "therapySlug": "float-therapy",
                "branchId": HSR_BRANCH_ID,
                "startAt": "2026-08-10T04:30:00.000Z",
                "endAt": "2026-08-10T07:30:00.000Z",
                "reason": "staff_leave",
                "reasonNote": "Test therapy block"
            }
        )
        
        print(f"Status: {resp.status_code}")
        data = resp.json()
        print(f"Response: {json.dumps(data, indent=2)}")
        
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        assert data.get("scope") == "therapy", f"Expected scope='therapy', got {data.get('scope')}"
        
        block_id = data.get("id")
        created_blocks.append(block_id)
        
        print(f"✅ C10 PASSED: Therapy block created with id={block_id}")
        return block_id
        
    except Exception as e:
        print(f"❌ C10 FAILED: {str(e)}")
        return None

def test_c11_verify_therapy_block_affects_float():
    """C11: GET /api/scheduling/slots?therapies=float-therapy&date=2026-08-10 → 10:00-13:00 excluded"""
    print("\n" + "="*80)
    print("TEST C11: Verify therapy block affects float-therapy slots")
    print("="*80)
    
    try:
        resp = requests.get(f"{BASE_URL}/scheduling/slots", params={
            "therapies": "float-therapy",
            "date": "2026-08-10"
        })
        
        print(f"Status: {resp.status_code}")
        data = resp.json()
        
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        
        groups = data.get("groups", {})
        all_slots = groups.get("morning", []) + groups.get("afternoon", []) + groups.get("evening", [])
        slot_times = [s.get("time") for s in all_slots]
        
        # Check that 10:00-13:00 slots are excluded
        blocked_times = ["10:00", "10:15", "10:30", "10:45", "11:00", "11:15", "11:30", "11:45", "12:00", "12:15", "12:30", "12:45"]
        blocked_present = [t for t in blocked_times if t in slot_times]
        print(f"Blocked times present: {blocked_present}")
        
        assert len(blocked_present) == 0, f"Expected no slots in 10:00-13:00 range, but found: {blocked_present}"
        
        print("✅ C11 PASSED: Therapy block correctly excludes 10:00-13:00 float-therapy slots")
        return True
        
    except Exception as e:
        print(f"❌ C11 FAILED: {str(e)}")
        return False

def test_c12_verify_therapy_block_not_affects_salt():
    """C12: GET /api/scheduling/slots?therapies=salt-therapy&date=2026-08-10 → all slots present"""
    print("\n" + "="*80)
    print("TEST C12: Verify therapy block does NOT affect salt-therapy")
    print("="*80)
    
    try:
        resp = requests.get(f"{BASE_URL}/scheduling/slots", params={
            "therapies": "salt-therapy",
            "date": "2026-08-10"
        })
        
        print(f"Status: {resp.status_code}")
        data = resp.json()
        
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        
        groups = data.get("groups", {})
        all_slots = groups.get("morning", []) + groups.get("afternoon", []) + groups.get("evening", [])
        slot_times = [s.get("time") for s in all_slots]
        
        # Check that 10:00-13:00 slots ARE present for salt-therapy
        blocked_times = ["10:00", "10:15", "10:30", "10:45", "11:00", "11:15", "11:30", "11:45", "12:00", "12:15", "12:30", "12:45"]
        blocked_present = [t for t in blocked_times if t in slot_times]
        print(f"Times in 10:00-13:00 range present: {len(blocked_present)}/{len(blocked_times)}")
        
        assert len(blocked_present) > 0, f"Expected some slots in 10:00-13:00 range for salt-therapy, but found none"
        
        print(f"✅ C12 PASSED: Therapy block does NOT affect salt-therapy ({len(blocked_present)} slots present)")
        return True
        
    except Exception as e:
        print(f"❌ C12 FAILED: {str(e)}")
        return False

def test_c13_delete_therapy_block(block_id):
    """C13: Delete the therapy block"""
    print("\n" + "="*80)
    print("TEST C13: Delete therapy block")
    print("="*80)
    
    try:
        cookies = get_admin_cookies()
        resp = requests.delete(f"{BASE_URL}/admin/calendar-blocks/{block_id}", cookies=cookies)
        
        print(f"Status: {resp.status_code}")
        
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        
        if block_id in created_blocks:
            created_blocks.remove(block_id)
        
        print("✅ C13 PASSED: Therapy block deleted successfully")
        return True
        
    except Exception as e:
        print(f"❌ C13 FAILED: {str(e)}")
        return False

# ============================================================================
# D. MULTI-THERAPY JOURNEY
# ============================================================================

def test_d14_multi_therapy_on_blocked_date():
    """D14: GET /api/scheduling/slots?therapies=salt-therapy,float-therapy&date=2026-07-22 → 0 slots"""
    print("\n" + "="*80)
    print("TEST D14: Multi-therapy journey on blocked date")
    print("="*80)
    
    try:
        resp = requests.get(f"{BASE_URL}/scheduling/slots", params={
            "therapies": "salt-therapy,float-therapy",
            "date": BLOCKED_DATE
        })
        
        print(f"Status: {resp.status_code}")
        data = resp.json()
        
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        
        groups = data.get("groups", {})
        total_slots = len(groups.get("morning", [])) + len(groups.get("afternoon", [])) + len(groups.get("evening", []))
        
        print(f"Total slots: {total_slots}")
        
        assert total_slots == 0, f"Expected 0 slots (branch block affects all therapies), got {total_slots}"
        
        print("✅ D14 PASSED: Branch block correctly blocks multi-therapy journey")
        return True
        
    except Exception as e:
        print(f"❌ D14 FAILED: {str(e)}")
        return False

# ============================================================================
# E. REGRESSION CHECK (allocation for un-blocked cases)
# ============================================================================

def test_e15_booking_on_unblocked_date():
    """E15: POST /api/bookings for 2026-07-23 10:00 salt-therapy → 200 (creates booking)"""
    print("\n" + "="*80)
    print("TEST E15: Booking on unblocked date (regression check)")
    print("="*80)
    
    try:
        resp = requests.post(f"{BASE_URL}/bookings", json={
            "therapies": [{"slug": "salt-therapy"}],
            "slotDate": UNBLOCKED_DATE,
            "slotTime": "10:00",
            "name": "Test Customer E15",
            "email": "test.e15@example.com",
            "phone": "9999999997",
            "total": 1500
        })
        
        print(f"Status: {resp.status_code}")
        data = resp.json()
        print(f"Response: {json.dumps(data, indent=2)}")
        
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        assert data.get("id"), "Expected booking to have an id"
        assert data.get("ref"), "Expected booking to have a ref"
        
        booking_id = data.get("id")
        created_bookings.append(booking_id)
        
        print(f"✅ E15 PASSED: Booking created successfully with id={booking_id}")
        return booking_id
        
    except Exception as e:
        print(f"❌ E15 FAILED: {str(e)}")
        return None

def test_e16_double_booking_guard(booking_id):
    """E16: Verify subsequent booking at same time → 409 (double-booking guard)"""
    print("\n" + "="*80)
    print("TEST E16: Double-booking guard (regression check)")
    print("="*80)
    
    try:
        resp = requests.post(f"{BASE_URL}/bookings", json={
            "therapies": [{"slug": "salt-therapy"}],
            "slotDate": UNBLOCKED_DATE,
            "slotTime": "10:00",
            "name": "Test Customer E16",
            "email": "test.e16@example.com",
            "phone": "9999999996",
            "total": 1500
        })
        
        print(f"Status: {resp.status_code}")
        data = resp.json()
        print(f"Response: {json.dumps(data, indent=2)}")
        
        assert resp.status_code == 409, f"Expected 409 (double-booking guard), got {resp.status_code}"
        assert data.get("error") == "slot_unavailable", f"Expected error='slot_unavailable', got {data.get('error')}"
        
        print("✅ E16 PASSED: Double-booking guard working correctly")
        return True
        
    except Exception as e:
        print(f"❌ E16 FAILED: {str(e)}")
        return False

# ============================================================================
# F. CLEANUP
# ============================================================================

def cleanup_test_data():
    """F17: Cleanup test bookings and blocks"""
    print("\n" + "="*80)
    print("CLEANUP: Removing test data")
    print("="*80)
    
    # Note: The review request says to NOT delete the pre-existing 2026-07-22 block
    # We only clean up blocks we created during testing
    
    success_count = 0
    fail_count = 0
    
    # Delete test blocks
    if created_blocks:
        print(f"\nDeleting {len(created_blocks)} test blocks...")
        cookies = get_admin_cookies()
        for block_id in created_blocks[:]:
            try:
                resp = requests.delete(f"{BASE_URL}/admin/calendar-blocks/{block_id}", cookies=cookies)
                if resp.status_code == 200:
                    print(f"  ✅ Deleted block {block_id}")
                    created_blocks.remove(block_id)
                    success_count += 1
                else:
                    print(f"  ⚠️ Failed to delete block {block_id}: {resp.status_code}")
                    fail_count += 1
            except Exception as e:
                print(f"  ⚠️ Error deleting block {block_id}: {str(e)}")
                fail_count += 1
    
    # Delete test bookings from MongoDB (no DELETE endpoint available)
    if created_bookings:
        print(f"\nDeleting {len(created_bookings)} test bookings from MongoDB...")
        try:
            import subprocess
            booking_ids = "','".join(created_bookings)
            cmd = f"""cd /app && node -e "
const {{ MongoClient }} = require('mongodb');
(async () => {{
  const client = new MongoClient('mongodb://localhost:27017');
  await client.connect();
  const db = client.db('your_database_name');
  const result = await db.collection('bookings').deleteMany({{
    id: {{ \\$in: ['{booking_ids}'] }}
  }});
  console.log('Deleted', result.deletedCount, 'bookings');
  await client.close();
}})();
"
"""
            result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
            print(f"  {result.stdout.strip()}")
            if "Deleted" in result.stdout:
                success_count += len(created_bookings)
                created_bookings.clear()
        except Exception as e:
            print(f"  ⚠️ Error deleting bookings: {str(e)}")
            fail_count += len(created_bookings)
    
    print(f"\n✅ Cleanup complete: {success_count} items removed, {fail_count} failures")
    return fail_count == 0

# ============================================================================
# MAIN TEST RUNNER
# ============================================================================

def main():
    print("\n" + "="*80)
    print("SALT WORLD — CALENDAR BLOCK BUG FIX VERIFICATION")
    print("="*80)
    print("\nBug: Branch-scoped calendar blocks ignored when customer has no branch context")
    print("Fix: Refactored checkJourneyAvailability to use resource's branchId")
    print("\nExisting state: Branch block for HSR Layout on 2026-07-22 (all day IST)")
    print("="*80)
    
    # Login
    if not login_admin():
        print("\n❌ FATAL: Admin login failed. Cannot proceed with tests.")
        return
    
    results = {
        "passed": 0,
        "failed": 0,
        "total": 0
    }
    
    # A. Bug-fix verification
    print("\n" + "="*80)
    print("SECTION A: BUG-FIX VERIFICATION")
    print("="*80)
    
    tests_a = [
        ("A1", test_a1_slots_without_branch_context),
        ("A2", test_a2_slots_with_explicit_hsr_branch),
        ("A3", test_a3_slots_on_unblocked_date),
        ("A4", test_a4_booking_on_blocked_date),
    ]
    
    for test_name, test_func in tests_a:
        results["total"] += 1
        if test_func():
            results["passed"] += 1
        else:
            results["failed"] += 1
    
    # B. New block scenarios
    print("\n" + "="*80)
    print("SECTION B: NEW BLOCK SCENARIOS")
    print("="*80)
    
    block_id_b = test_b5_create_resource_block()
    results["total"] += 1
    if block_id_b:
        results["passed"] += 1
        
        results["total"] += 1
        if test_b6_verify_resource_block_slots(block_id_b):
            results["passed"] += 1
        else:
            results["failed"] += 1
        
        results["total"] += 1
        if test_b7_booking_during_resource_block():
            results["passed"] += 1
        else:
            results["failed"] += 1
        
        results["total"] += 1
        if test_b8_delete_resource_block(block_id_b):
            results["passed"] += 1
        else:
            results["failed"] += 1
        
        results["total"] += 1
        if test_b9_verify_slots_after_delete():
            results["passed"] += 1
        else:
            results["failed"] += 1
    else:
        results["failed"] += 5  # All B tests failed
        results["total"] += 4
    
    # C. Therapy-scope block
    print("\n" + "="*80)
    print("SECTION C: THERAPY-SCOPE BLOCK")
    print("="*80)
    
    block_id_c = test_c10_create_therapy_block()
    results["total"] += 1
    if block_id_c:
        results["passed"] += 1
        
        results["total"] += 1
        if test_c11_verify_therapy_block_affects_float():
            results["passed"] += 1
        else:
            results["failed"] += 1
        
        results["total"] += 1
        if test_c12_verify_therapy_block_not_affects_salt():
            results["passed"] += 1
        else:
            results["failed"] += 1
        
        results["total"] += 1
        if test_c13_delete_therapy_block(block_id_c):
            results["passed"] += 1
        else:
            results["failed"] += 1
    else:
        results["failed"] += 4
        results["total"] += 3
    
    # D. Multi-therapy journey
    print("\n" + "="*80)
    print("SECTION D: MULTI-THERAPY JOURNEY")
    print("="*80)
    
    results["total"] += 1
    if test_d14_multi_therapy_on_blocked_date():
        results["passed"] += 1
    else:
        results["failed"] += 1
    
    # E. Regression check
    print("\n" + "="*80)
    print("SECTION E: REGRESSION CHECK")
    print("="*80)
    
    booking_id_e = test_e15_booking_on_unblocked_date()
    results["total"] += 1
    if booking_id_e:
        results["passed"] += 1
        
        results["total"] += 1
        if test_e16_double_booking_guard(booking_id_e):
            results["passed"] += 1
        else:
            results["failed"] += 1
    else:
        results["failed"] += 2
        results["total"] += 1
    
    # F. Cleanup
    print("\n" + "="*80)
    print("SECTION F: CLEANUP")
    print("="*80)
    cleanup_test_data()
    
    # Final summary
    print("\n" + "="*80)
    print("FINAL SUMMARY")
    print("="*80)
    print(f"Total tests: {results['total']}")
    print(f"Passed: {results['passed']} ✅")
    print(f"Failed: {results['failed']} ❌")
    print(f"Success rate: {results['passed']}/{results['total']} ({100*results['passed']//results['total']}%)")
    
    if results['failed'] == 0:
        print("\n🎉 ALL TESTS PASSED! Calendar block bug fix is working correctly.")
    else:
        print(f"\n⚠️ {results['failed']} test(s) failed. Please review the output above.")
    
    print("="*80)

if __name__ == "__main__":
    main()
