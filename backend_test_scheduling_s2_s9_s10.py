#!/usr/bin/env python3
"""
Backend test for Salt World scheduling endpoints S2, S9, S10.
Tests ONLY the new/updated scheduling endpoints as requested.
"""

import requests
import sys
from datetime import datetime, timedelta

# Base URL from .env
BASE_URL = "https://saltwell-arch.preview.emergentagent.com/api"

def test_s2_slots_with_plan_array():
    """
    S2 — Updated /api/scheduling/slots MUST include plan[] per slot
    GET /api/scheduling/slots?therapies=float-therapy,infrared-sauna,cold-plunge&date=2027-03-15
    
    Expect 200 with:
    - totalDurationMin === 100
    - totalVisitMin between 130 and 145
    - groups.morning is non-empty
    - groups.morning[0].plan is an array of 3 items, each with:
        • therapySlug (float-therapy → infrared-sauna → cold-plunge in that order)
        • name (non-empty string)
        • from + to (ISO strings, sequential: plan[0].to <= plan[1].from <= plan[2].to)
        • durationMin (60, 35, 5 respectively)
    """
    print("\n" + "="*80)
    print("S2 — Testing /api/scheduling/slots with plan[] array")
    print("="*80)
    
    url = f"{BASE_URL}/scheduling/slots"
    params = {
        "therapies": "float-therapy,infrared-sauna,cold-plunge",
        "date": "2027-03-15"
    }
    
    try:
        print(f"\n→ GET {url}")
        print(f"  Params: {params}")
        r = requests.get(url, params=params, timeout=10)
        print(f"← {r.status_code}")
        
        if r.status_code != 200:
            print(f"❌ FAILED: Expected 200, got {r.status_code}")
            print(f"Response: {r.text}")
            return False
        
        data = r.json()
        print(f"Response keys: {list(data.keys())}")
        
        # Check totalDurationMin
        if data.get("totalDurationMin") != 100:
            print(f"❌ FAILED: totalDurationMin expected 100, got {data.get('totalDurationMin')}")
            return False
        print(f"✅ totalDurationMin === 100")
        
        # Check totalVisitMin
        total_visit = data.get("totalVisitMin", 0)
        if not (130 <= total_visit <= 145):
            print(f"❌ FAILED: totalVisitMin expected between 130-145, got {total_visit}")
            return False
        print(f"✅ totalVisitMin === {total_visit} (within 130-145 range)")
        
        # Check groups.morning is non-empty
        groups = data.get("groups", {})
        morning = groups.get("morning", [])
        if len(morning) == 0:
            print(f"❌ FAILED: groups.morning is empty")
            return False
        print(f"✅ groups.morning is non-empty (has {len(morning)} slots)")
        
        # Check first morning slot has plan[] array
        first_slot = morning[0]
        print(f"\nFirst morning slot keys: {list(first_slot.keys())}")
        
        if "plan" not in first_slot:
            print(f"❌ FAILED: First slot missing 'plan' array")
            return False
        
        plan = first_slot["plan"]
        if not isinstance(plan, list):
            print(f"❌ FAILED: plan is not an array, got {type(plan)}")
            return False
        
        if len(plan) != 3:
            print(f"❌ FAILED: plan array expected 3 items, got {len(plan)}")
            return False
        print(f"✅ groups.morning[0].plan is an array of 3 items")
        
        # Check each plan item
        expected_slugs = ["float-therapy", "infrared-sauna", "cold-plunge"]
        expected_durations = [60, 35, 5]
        
        for i, item in enumerate(plan):
            print(f"\n  Plan item {i}: {item}")
            
            # Check therapySlug
            if item.get("therapySlug") != expected_slugs[i]:
                print(f"  ❌ FAILED: therapySlug expected '{expected_slugs[i]}', got '{item.get('therapySlug')}'")
                return False
            print(f"  ✅ therapySlug === '{expected_slugs[i]}'")
            
            # Check name is non-empty
            if not item.get("name"):
                print(f"  ❌ FAILED: name is empty")
                return False
            print(f"  ✅ name === '{item.get('name')}'")
            
            # Check from and to are ISO strings
            if not item.get("from") or not item.get("to"):
                print(f"  ❌ FAILED: from or to is missing")
                return False
            
            try:
                from_dt = datetime.fromisoformat(item["from"].replace("Z", "+00:00"))
                to_dt = datetime.fromisoformat(item["to"].replace("Z", "+00:00"))
                print(f"  ✅ from and to are valid ISO strings")
            except Exception as e:
                print(f"  ❌ FAILED: Invalid ISO format: {e}")
                return False
            
            # Check durationMin
            if item.get("durationMin") != expected_durations[i]:
                print(f"  ❌ FAILED: durationMin expected {expected_durations[i]}, got {item.get('durationMin')}")
                return False
            print(f"  ✅ durationMin === {expected_durations[i]}")
        
        # Check sequential times: plan[0].to <= plan[1].from <= plan[2].to
        plan0_to = datetime.fromisoformat(plan[0]["to"].replace("Z", "+00:00"))
        plan1_from = datetime.fromisoformat(plan[1]["from"].replace("Z", "+00:00"))
        plan1_to = datetime.fromisoformat(plan[1]["to"].replace("Z", "+00:00"))
        plan2_from = datetime.fromisoformat(plan[2]["from"].replace("Z", "+00:00"))
        
        if not (plan0_to <= plan1_from):
            print(f"❌ FAILED: plan[0].to ({plan0_to}) > plan[1].from ({plan1_from})")
            return False
        
        if not (plan1_to <= plan2_from):
            print(f"❌ FAILED: plan[1].to ({plan1_to}) > plan[2].from ({plan2_from})")
            return False
        
        print(f"\n✅ Times are sequential: plan[0].to <= plan[1].from <= plan[2].to")
        
        print("\n✅ S2 TEST PASSED")
        return True
        
    except Exception as e:
        print(f"❌ EXCEPTION: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_s9_therapy_slots_no_after():
    """
    S9 Test A — no `after` filter:
    GET /api/scheduling/therapy-slots?therapy=infrared-sauna&date=2027-03-15
    Expect 200 with the same shape as /api/scheduling/slots (groups.morning/afternoon/evening arrays),
    covering the full working hours.
    """
    print("\n" + "="*80)
    print("S9 Test A — /api/scheduling/therapy-slots without 'after' filter")
    print("="*80)
    
    url = f"{BASE_URL}/scheduling/therapy-slots"
    params = {
        "therapy": "infrared-sauna",
        "date": "2027-03-15"
    }
    
    try:
        print(f"\n→ GET {url}")
        print(f"  Params: {params}")
        r = requests.get(url, params=params, timeout=10)
        print(f"← {r.status_code}")
        
        if r.status_code != 200:
            print(f"❌ FAILED: Expected 200, got {r.status_code}")
            print(f"Response: {r.text}")
            return False
        
        data = r.json()
        print(f"Response keys: {list(data.keys())}")
        
        # Check groups structure
        groups = data.get("groups", {})
        if not isinstance(groups, dict):
            print(f"❌ FAILED: groups is not a dict")
            return False
        
        required_keys = ["morning", "afternoon", "evening"]
        for key in required_keys:
            if key not in groups:
                print(f"❌ FAILED: groups missing '{key}' key")
                return False
            if not isinstance(groups[key], list):
                print(f"❌ FAILED: groups.{key} is not an array")
                return False
        
        print(f"✅ groups has correct structure (morning/afternoon/evening arrays)")
        
        # Check that we have slots (should cover full working hours)
        total_slots = len(groups["morning"]) + len(groups["afternoon"]) + len(groups["evening"])
        print(f"✅ Total slots: {total_slots} (morning: {len(groups['morning'])}, afternoon: {len(groups['afternoon'])}, evening: {len(groups['evening'])})")
        
        if total_slots == 0:
            print(f"❌ FAILED: No slots returned (expected slots covering full working hours)")
            return False
        
        # Check first slot has expected fields
        all_slots = groups["morning"] + groups["afternoon"] + groups["evening"]
        if len(all_slots) > 0:
            first_slot = all_slots[0]
            print(f"\nFirst slot: {first_slot}")
            required_slot_keys = ["time", "startIso", "visitFromIso", "visitToIso"]
            for key in required_slot_keys:
                if key not in first_slot:
                    print(f"❌ FAILED: First slot missing '{key}' key")
                    return False
            print(f"✅ Slots have correct structure")
        
        print("\n✅ S9 TEST A PASSED")
        return True
        
    except Exception as e:
        print(f"❌ EXCEPTION: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_s9_therapy_slots_with_after():
    """
    S9 Test B — with `after` cutoff:
    GET /api/scheduling/therapy-slots?therapy=infrared-sauna&date=2027-03-15&after=11:20
    Expect 200 with **every** returned slot's `time` >= '11:20'. Nothing before 11:20.
    """
    print("\n" + "="*80)
    print("S9 Test B — /api/scheduling/therapy-slots with 'after=11:20' filter")
    print("="*80)
    
    url = f"{BASE_URL}/scheduling/therapy-slots"
    params = {
        "therapy": "infrared-sauna",
        "date": "2027-03-15",
        "after": "11:20"
    }
    
    try:
        print(f"\n→ GET {url}")
        print(f"  Params: {params}")
        r = requests.get(url, params=params, timeout=10)
        print(f"← {r.status_code}")
        
        if r.status_code != 200:
            print(f"❌ FAILED: Expected 200, got {r.status_code}")
            print(f"Response: {r.text}")
            return False
        
        data = r.json()
        groups = data.get("groups", {})
        
        # Collect all slots
        all_slots = groups.get("morning", []) + groups.get("afternoon", []) + groups.get("evening", [])
        print(f"Total slots returned: {len(all_slots)}")
        
        if len(all_slots) == 0:
            print(f"❌ FAILED: No slots returned (expected slots >= 11:20)")
            return False
        
        # Check every slot's time >= '11:20'
        cutoff = "11:20"
        for i, slot in enumerate(all_slots):
            slot_time = slot.get("time", "")
            if slot_time < cutoff:
                print(f"❌ FAILED: Slot {i} has time '{slot_time}' which is < '{cutoff}'")
                return False
            if i < 5:  # Print first 5 for verification
                print(f"  Slot {i}: time = '{slot_time}' (>= '{cutoff}') ✓")
        
        print(f"✅ All {len(all_slots)} slots have time >= '{cutoff}'")
        
        # Verify first slot time
        first_time = all_slots[0].get("time", "")
        print(f"✅ First slot time: '{first_time}' (>= '{cutoff}')")
        
        print("\n✅ S9 TEST B PASSED")
        return True
        
    except Exception as e:
        print(f"❌ EXCEPTION: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_s9_therapy_slots_after_close():
    """
    S9 Test C — cutoff after close:
    GET /api/scheduling/therapy-slots?therapy=infrared-sauna&date=2027-03-15&after=22:00
    Expect 200 with all groups empty (no slots after branch closes at 20:00).
    """
    print("\n" + "="*80)
    print("S9 Test C — /api/scheduling/therapy-slots with 'after=22:00' (after close)")
    print("="*80)
    
    url = f"{BASE_URL}/scheduling/therapy-slots"
    params = {
        "therapy": "infrared-sauna",
        "date": "2027-03-15",
        "after": "22:00"
    }
    
    try:
        print(f"\n→ GET {url}")
        print(f"  Params: {params}")
        r = requests.get(url, params=params, timeout=10)
        print(f"← {r.status_code}")
        
        if r.status_code != 200:
            print(f"❌ FAILED: Expected 200, got {r.status_code}")
            print(f"Response: {r.text}")
            return False
        
        data = r.json()
        groups = data.get("groups", {})
        
        # Check all groups are empty
        morning = groups.get("morning", [])
        afternoon = groups.get("afternoon", [])
        evening = groups.get("evening", [])
        
        total_slots = len(morning) + len(afternoon) + len(evening)
        
        if total_slots != 0:
            print(f"❌ FAILED: Expected all groups empty, but got {total_slots} slots")
            print(f"  morning: {len(morning)}, afternoon: {len(afternoon)}, evening: {len(evening)}")
            return False
        
        print(f"✅ All groups are empty (morning: {len(morning)}, afternoon: {len(afternoon)}, evening: {len(evening)})")
        
        print("\n✅ S9 TEST C PASSED")
        return True
        
    except Exception as e:
        print(f"❌ EXCEPTION: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_s10_validation_missing_therapy():
    """
    S10 — Validation on therapy-slots
    GET /api/scheduling/therapy-slots?date=2027-03-15  (no therapy)
    Expect 400 {error: 'therapy_required'}.
    """
    print("\n" + "="*80)
    print("S10 Test A — Validation: missing 'therapy' parameter")
    print("="*80)
    
    url = f"{BASE_URL}/scheduling/therapy-slots"
    params = {
        "date": "2027-03-15"
    }
    
    try:
        print(f"\n→ GET {url}")
        print(f"  Params: {params}")
        r = requests.get(url, params=params, timeout=10)
        print(f"← {r.status_code}")
        
        if r.status_code != 400:
            print(f"❌ FAILED: Expected 400, got {r.status_code}")
            print(f"Response: {r.text}")
            return False
        
        data = r.json()
        error = data.get("error", "")
        
        if error != "therapy_required":
            print(f"❌ FAILED: Expected error='therapy_required', got error='{error}'")
            return False
        
        print(f"✅ Returns 400 with error='therapy_required'")
        
        print("\n✅ S10 TEST A PASSED")
        return True
        
    except Exception as e:
        print(f"❌ EXCEPTION: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_s10_validation_missing_date():
    """
    S10 — Validation on therapy-slots
    GET /api/scheduling/therapy-slots?therapy=float-therapy  (no date)
    Expect 400 {error: 'date_required'}.
    """
    print("\n" + "="*80)
    print("S10 Test B — Validation: missing 'date' parameter")
    print("="*80)
    
    url = f"{BASE_URL}/scheduling/therapy-slots"
    params = {
        "therapy": "float-therapy"
    }
    
    try:
        print(f"\n→ GET {url}")
        print(f"  Params: {params}")
        r = requests.get(url, params=params, timeout=10)
        print(f"← {r.status_code}")
        
        if r.status_code != 400:
            print(f"❌ FAILED: Expected 400, got {r.status_code}")
            print(f"Response: {r.text}")
            return False
        
        data = r.json()
        error = data.get("error", "")
        
        if error != "date_required":
            print(f"❌ FAILED: Expected error='date_required', got error='{error}'")
            return False
        
        print(f"✅ Returns 400 with error='date_required'")
        
        print("\n✅ S10 TEST B PASSED")
        return True
        
    except Exception as e:
        print(f"❌ EXCEPTION: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    print("\n" + "="*80)
    print("SCHEDULING ENDPOINTS TEST SUITE (S2, S9, S10)")
    print("Testing ONLY the new/updated scheduling endpoints")
    print("="*80)
    
    results = []
    
    # S2 — Updated /api/scheduling/slots with plan[] array
    results.append(("S2 — /api/scheduling/slots with plan[]", test_s2_slots_with_plan_array()))
    
    # S9 — New /api/scheduling/therapy-slots endpoint
    results.append(("S9 Test A — therapy-slots without 'after'", test_s9_therapy_slots_no_after()))
    results.append(("S9 Test B — therapy-slots with 'after=11:20'", test_s9_therapy_slots_with_after()))
    results.append(("S9 Test C — therapy-slots with 'after=22:00'", test_s9_therapy_slots_after_close()))
    
    # S10 — Validation on therapy-slots
    results.append(("S10 Test A — missing 'therapy' param", test_s10_validation_missing_therapy()))
    results.append(("S10 Test B — missing 'date' param", test_s10_validation_missing_date()))
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for name, result in results:
        status = "✅ PASSED" if result else "❌ FAILED"
        print(f"{status}: {name}")
    
    print(f"\n{passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED!")
        sys.exit(0)
    else:
        print(f"\n❌ {total - passed} test(s) failed")
        sys.exit(1)


if __name__ == "__main__":
    main()
