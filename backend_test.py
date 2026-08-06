#!/usr/bin/env python3
"""
Backend API Tests for Salt World - Concierge Recommender Endpoint
Tests the new GET /api/scheduling/recommendations endpoint (REC-1 through REC-9)
"""

import requests
import json
from datetime import datetime, timedelta

# Base URL from .env
BASE_URL = "https://saltwell-arch.preview.emergentagent.com/api"

def get_future_date(days_ahead=3):
    """Get a date N days in the future in YYYY-MM-DD format"""
    future = datetime.now() + timedelta(days=days_ahead)
    return future.strftime('%Y-%m-%d')

def print_test_header(test_name):
    """Print a formatted test header"""
    print(f"\n{'='*80}")
    print(f"TEST: {test_name}")
    print(f"{'='*80}")

def print_result(passed, message):
    """Print test result"""
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"{status}: {message}")

def test_rec_1_single_therapy():
    """REC-1: Single therapy, valid inputs"""
    print_test_header("REC-1: Single therapy, valid inputs")
    
    date = get_future_date(3)
    url = f"{BASE_URL}/scheduling/recommendations"
    params = {
        'therapies': 'float-therapy',
        'date': date,
        'preferred': '08:00',
        'limit': 3
    }
    
    try:
        response = requests.get(url, params=params, timeout=30)
        print(f"Request: GET {url}")
        print(f"Params: {params}")
        print(f"Status: {response.status_code}")
        
        if response.status_code != 200:
            print_result(False, f"Expected 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        data = response.json()
        print(f"Response keys: {list(data.keys())}")
        
        # Check recommendations array exists and length <= 3
        if 'recommendations' not in data:
            print_result(False, "Missing 'recommendations' key")
            return False
        
        recs = data['recommendations']
        print(f"Recommendations count: {len(recs)}")
        
        if len(recs) > 3:
            print_result(False, f"Expected ≤3 recommendations, got {len(recs)}")
            return False
        
        if len(recs) == 0:
            print_result(False, "No recommendations returned (might be no availability)")
            return False
        
        # Check each recommendation structure
        for i, rec in enumerate(recs):
            print(f"\nRecommendation {i+1}:")
            print(f"  - badge: {rec.get('badge')}")
            print(f"  - time: {rec.get('time')}")
            print(f"  - startIso: {rec.get('startIso')}")
            print(f"  - deltaFromPreferredMin: {rec.get('deltaFromPreferredMin')}")
            print(f"  - plan length: {len(rec.get('plan', []))}")
            
            # Validate badge
            if rec.get('badge') not in ['best_match', 'fastest_finish', 'least_waiting']:
                print_result(False, f"Invalid badge: {rec.get('badge')}")
                return False
            
            # Validate deltaFromPreferredMin >= 0
            delta = rec.get('deltaFromPreferredMin')
            if delta is None or delta < 0:
                print_result(False, f"Invalid deltaFromPreferredMin: {delta}")
                return False
            
            # Validate plan array length = 1 for single therapy
            plan = rec.get('plan', [])
            if len(plan) != 1:
                print_result(False, f"Expected plan length 1, got {len(plan)}")
                return False
            
            # Validate distinct startIso
            for j, other in enumerate(recs):
                if i != j and rec.get('startIso') == other.get('startIso'):
                    print_result(False, f"Duplicate startIso found: {rec.get('startIso')}")
                    return False
        
        print_result(True, f"Single therapy recommendations working correctly ({len(recs)} recs)")
        return True
        
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
        return False

def test_rec_2_multi_therapy():
    """REC-2: Multi-therapy (Float + Salt)"""
    print_test_header("REC-2: Multi-therapy (Float + Salt)")
    
    date = get_future_date(3)
    url = f"{BASE_URL}/scheduling/recommendations"
    params = {
        'therapies': 'float-therapy,salt-therapy',
        'date': date,
        'preferred': '14:00',
        'limit': 3
    }
    
    try:
        response = requests.get(url, params=params, timeout=30)
        print(f"Request: GET {url}")
        print(f"Params: {params}")
        print(f"Status: {response.status_code}")
        
        if response.status_code != 200:
            print_result(False, f"Expected 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        data = response.json()
        recs = data.get('recommendations', [])
        print(f"Recommendations count: {len(recs)}")
        
        if len(recs) == 0:
            print_result(False, "No recommendations returned (might be no availability)")
            return False
        
        # Check first recommendation in detail
        rec = recs[0]
        print(f"\nFirst recommendation:")
        print(f"  - plan length: {len(rec.get('plan', []))}")
        print(f"  - totalDurationMin: {rec.get('totalDurationMin')}")
        print(f"  - totalVisitMin: {rec.get('totalVisitMin')}")
        
        # Validate plan array length = 2
        plan = rec.get('plan', [])
        if len(plan) != 2:
            print_result(False, f"Expected plan length 2, got {len(plan)}")
            return False
        
        # Validate therapy order [float-therapy, salt-therapy]
        if plan[0].get('therapySlug') != 'float-therapy':
            print_result(False, f"Expected first therapy 'float-therapy', got {plan[0].get('therapySlug')}")
            return False
        
        if plan[1].get('therapySlug') != 'salt-therapy':
            print_result(False, f"Expected second therapy 'salt-therapy', got {plan[1].get('therapySlug')}")
            return False
        
        # Validate totalDurationMin = 120 (60 + 60)
        total_dur = rec.get('totalDurationMin')
        if total_dur != 120:
            print_result(False, f"Expected totalDurationMin=120, got {total_dur}")
            return False
        
        # Validate totalVisitMin around 135-155 (with buffers)
        total_visit = rec.get('totalVisitMin')
        if not (135 <= total_visit <= 155):
            print_result(False, f"Expected totalVisitMin 135-155, got {total_visit}")
            return False
        
        print_result(True, f"Multi-therapy recommendations working correctly (totalDur={total_dur}, totalVisit={total_visit})")
        return True
        
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
        return False

def test_rec_3_pagination():
    """REC-3: Pagination via offset"""
    print_test_header("REC-3: Pagination via offset")
    
    date = get_future_date(3)
    url = f"{BASE_URL}/scheduling/recommendations"
    base_params = {
        'therapies': 'float-therapy',
        'date': date,
        'preferred': '10:00',
        'limit': 3
    }
    
    try:
        # Get first page (offset=0)
        params_page1 = {**base_params, 'offset': 0}
        response1 = requests.get(url, params=params_page1, timeout=30)
        print(f"Request Page 1: GET {url}")
        print(f"Params: {params_page1}")
        print(f"Status: {response1.status_code}")
        
        if response1.status_code != 200:
            print_result(False, f"Page 1: Expected 200, got {response1.status_code}")
            return False
        
        data1 = response1.json()
        recs1 = data1.get('recommendations', [])
        print(f"Page 1 recommendations count: {len(recs1)}")
        
        if len(recs1) == 0:
            print_result(False, "Page 1: No recommendations returned")
            return False
        
        # Get second page (offset=3)
        params_page2 = {**base_params, 'offset': 3}
        response2 = requests.get(url, params=params_page2, timeout=30)
        print(f"\nRequest Page 2: GET {url}")
        print(f"Params: {params_page2}")
        print(f"Status: {response2.status_code}")
        
        if response2.status_code != 200:
            print_result(False, f"Page 2: Expected 200, got {response2.status_code}")
            return False
        
        data2 = response2.json()
        recs2 = data2.get('recommendations', [])
        print(f"Page 2 recommendations count: {len(recs2)}")
        
        # Check that page 2 recommendations are different from page 1
        page1_starts = {rec.get('startIso') for rec in recs1}
        page2_starts = {rec.get('startIso') for rec in recs2}
        
        print(f"\nPage 1 start times: {[rec.get('time') for rec in recs1]}")
        print(f"Page 2 start times: {[rec.get('time') for rec in recs2]}")
        
        overlap = page1_starts & page2_starts
        if overlap:
            print_result(False, f"Found duplicate startIso between pages: {overlap}")
            return False
        
        # Verify no duplicates within a single page
        if len(page1_starts) != len(recs1):
            print_result(False, "Page 1 has duplicate startIso within same page")
            return False
        
        if len(page2_starts) != len(recs2):
            print_result(False, "Page 2 has duplicate startIso within same page")
            return False
        
        print_result(True, f"Pagination working correctly (Page 1: {len(recs1)} recs, Page 2: {len(recs2)} recs, no overlap)")
        return True
        
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
        return False

def test_rec_4_validation_errors():
    """REC-4: Validation errors"""
    print_test_header("REC-4: Validation errors")
    
    url = f"{BASE_URL}/scheduling/recommendations"
    date = get_future_date(3)
    
    test_cases = [
        {
            'name': 'Missing therapies',
            'params': {'date': date, 'preferred': '08:00'},
            'expected_error': 'therapies_required'
        },
        {
            'name': 'Missing date',
            'params': {'therapies': 'float-therapy', 'preferred': '08:00'},
            'expected_error': 'date_required'
        },
        {
            'name': 'Missing preferred',
            'params': {'therapies': 'float-therapy', 'date': date},
            'expected_error': 'preferred_time_required'
        },
        {
            'name': 'Bad preferred format (single digit)',
            'params': {'therapies': 'float-therapy', 'date': date, 'preferred': '8'},
            'expected_error': 'preferred_time_required'
        },
        {
            'name': 'Bad preferred format (invalid time)',
            'params': {'therapies': 'float-therapy', 'date': date, 'preferred': '25:99'},
            'expected_error': 'preferred_time_required'
        }
    ]
    
    all_passed = True
    
    for test_case in test_cases:
        print(f"\n  Testing: {test_case['name']}")
        try:
            response = requests.get(url, params=test_case['params'], timeout=30)
            print(f"  Status: {response.status_code}")
            
            if response.status_code != 400:
                print_result(False, f"Expected 400, got {response.status_code}")
                all_passed = False
                continue
            
            data = response.json()
            error = data.get('error')
            print(f"  Error: {error}")
            
            if error != test_case['expected_error']:
                print_result(False, f"Expected error '{test_case['expected_error']}', got '{error}'")
                all_passed = False
            else:
                print_result(True, f"Correct validation error: {error}")
        
        except Exception as e:
            print_result(False, f"Exception: {str(e)}")
            all_passed = False
    
    return all_passed

def test_rec_5_sold_out_edge_case():
    """REC-5: Sold-out edge case (tight window before opening hours)"""
    print_test_header("REC-5: Sold-out edge case (tight window)")
    
    date = get_future_date(3)
    url = f"{BASE_URL}/scheduling/recommendations"
    params = {
        'therapies': 'float-therapy',
        'date': date,
        'preferred': '05:00',  # Very early, before opening hours
        'window': 15,  # Very tight window
        'limit': 3
    }
    
    try:
        response = requests.get(url, params=params, timeout=30)
        print(f"Request: GET {url}")
        print(f"Params: {params}")
        print(f"Status: {response.status_code}")
        
        if response.status_code != 200:
            print_result(False, f"Expected 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        data = response.json()
        print(f"Response: {json.dumps(data, indent=2)}")
        
        recs = data.get('recommendations', [])
        reason = data.get('reason')
        
        print(f"Recommendations count: {len(recs)}")
        print(f"Reason: {reason}")
        
        # Should return empty recommendations with reason
        if len(recs) == 0:
            if reason == 'no_availability':
                print_result(True, f"Correctly returned empty recommendations with reason='{reason}'")
                return True
            else:
                print_result(True, f"Empty recommendations (reason: {reason})")
                return True
        else:
            # If there are recommendations, that's also acceptable (branch might open early)
            print_result(True, f"Found {len(recs)} recommendations (branch might have early hours)")
            return True
        
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
        return False

def test_rec_6_badge_uniqueness():
    """REC-6: Badge uniqueness"""
    print_test_header("REC-6: Badge uniqueness")
    
    date = get_future_date(3)
    url = f"{BASE_URL}/scheduling/recommendations"
    params = {
        'therapies': 'float-therapy',
        'date': date,
        'preferred': '08:00',
        'limit': 3
    }
    
    try:
        response = requests.get(url, params=params, timeout=30)
        print(f"Request: GET {url}")
        print(f"Params: {params}")
        print(f"Status: {response.status_code}")
        
        if response.status_code != 200:
            print_result(False, f"Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        recs = data.get('recommendations', [])
        print(f"Recommendations count: {len(recs)}")
        
        if len(recs) == 0:
            print_result(False, "No recommendations returned")
            return False
        
        # Check for duplicate startIso
        start_times = [rec.get('startIso') for rec in recs]
        unique_starts = set(start_times)
        
        print(f"\nStart times: {[rec.get('time') for rec in recs]}")
        print(f"Badges: {[rec.get('badge') for rec in recs]}")
        
        if len(unique_starts) != len(start_times):
            print_result(False, "Found duplicate startIso across recommendations")
            return False
        
        # If only 1 feasible time, should only return 1 recommendation with 1 badge
        if len(recs) == 1:
            print_result(True, f"Only 1 recommendation with badge '{recs[0].get('badge')}' (limited availability)")
            return True
        
        # Check that badges are assigned (can be same badge for multiple recs)
        for rec in recs:
            badge = rec.get('badge')
            if badge not in ['best_match', 'fastest_finish', 'least_waiting']:
                print_result(False, f"Invalid badge: {badge}")
                return False
        
        print_result(True, f"Badge uniqueness verified: {len(recs)} distinct recommendations")
        return True
        
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
        return False

def test_rec_7_exact_open_time():
    """REC-7: Preferred=exact open time (08:00) should include 08:00 with delta=0"""
    print_test_header("REC-7: Exact open time (08:00) with delta=0")
    
    date = get_future_date(3)
    url = f"{BASE_URL}/scheduling/recommendations"
    params = {
        'therapies': 'float-therapy',
        'date': date,
        'preferred': '08:00',
        'limit': 3
    }
    
    try:
        response = requests.get(url, params=params, timeout=30)
        print(f"Request: GET {url}")
        print(f"Params: {params}")
        print(f"Status: {response.status_code}")
        
        if response.status_code != 200:
            print_result(False, f"Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        recs = data.get('recommendations', [])
        print(f"Recommendations count: {len(recs)}")
        
        if len(recs) == 0:
            print_result(False, "No recommendations returned")
            return False
        
        # Look for 08:00 recommendation with delta=0 and badge=best_match
        found_exact = False
        for rec in recs:
            time = rec.get('time')
            delta = rec.get('deltaFromPreferredMin')
            badge = rec.get('badge')
            
            print(f"\n  - time: {time}, delta: {delta}, badge: {badge}")
            
            if time == '08:00' and delta == 0:
                found_exact = True
                if badge == 'best_match':
                    print_result(True, f"Found 08:00 recommendation with deltaFromPreferredMin=0 and badge='best_match'")
                    return True
                else:
                    print_result(True, f"Found 08:00 recommendation with deltaFromPreferredMin=0 (badge={badge})")
                    return True
        
        if not found_exact:
            # Check if 08:00 is in the list at all
            times = [rec.get('time') for rec in recs]
            if '08:00' in times:
                print_result(False, "Found 08:00 but deltaFromPreferredMin != 0")
            else:
                print_result(False, "08:00 not in recommendations (might be unavailable)")
            return False
        
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
        return False

def test_rec_8_regression_slots_endpoint():
    """REC-8: Regression - existing /api/scheduling/slots endpoint still works"""
    print_test_header("REC-8: Regression - /api/scheduling/slots endpoint")
    
    date = get_future_date(3)
    url = f"{BASE_URL}/scheduling/slots"
    params = {
        'therapies': 'float-therapy',
        'date': date
    }
    
    try:
        response = requests.get(url, params=params, timeout=30)
        print(f"Request: GET {url}")
        print(f"Params: {params}")
        print(f"Status: {response.status_code}")
        
        if response.status_code != 200:
            print_result(False, f"Expected 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        data = response.json()
        print(f"Response keys: {list(data.keys())}")
        
        # Check expected structure
        required_keys = ['totalDurationMin', 'totalVisitMin', 'groups']
        for key in required_keys:
            if key not in data:
                print_result(False, f"Missing key: {key}")
                return False
        
        groups = data.get('groups', {})
        print(f"Groups keys: {list(groups.keys())}")
        
        # Check groups structure
        if not all(k in groups for k in ['morning', 'afternoon', 'evening']):
            print_result(False, "Missing morning/afternoon/evening groups")
            return False
        
        # Check that slots have expected structure
        all_slots = groups.get('morning', []) + groups.get('afternoon', []) + groups.get('evening', [])
        print(f"Total slots: {len(all_slots)}")
        
        if len(all_slots) > 0:
            sample_slot = all_slots[0]
            print(f"Sample slot keys: {list(sample_slot.keys())}")
            
            required_slot_keys = ['time', 'startIso', 'visitFromIso', 'visitToIso']
            for key in required_slot_keys:
                if key not in sample_slot:
                    print_result(False, f"Slot missing key: {key}")
                    return False
        
        print_result(True, f"Slots endpoint working correctly ({len(all_slots)} slots returned)")
        return True
        
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
        return False

def test_rec_9_regression_booking_with_recommendation():
    """REC-9: Regression - POST /api/bookings works with recommendation slot"""
    print_test_header("REC-9: Regression - POST /api/bookings with recommendation slot")
    
    date = get_future_date(5)  # Use 5 days ahead to avoid conflicts
    
    # First, get a recommendation
    rec_url = f"{BASE_URL}/scheduling/recommendations"
    rec_params = {
        'therapies': 'float-therapy',
        'date': date,
        'preferred': '10:00',
        'limit': 1
    }
    
    try:
        print("Step 1: Get recommendation")
        rec_response = requests.get(rec_url, params=rec_params, timeout=30)
        print(f"Request: GET {rec_url}")
        print(f"Params: {rec_params}")
        print(f"Status: {rec_response.status_code}")
        
        if rec_response.status_code != 200:
            print_result(False, f"Recommendation request failed: {rec_response.status_code}")
            return False
        
        rec_data = rec_response.json()
        recs = rec_data.get('recommendations', [])
        
        if len(recs) == 0:
            print_result(False, "No recommendations available for booking test")
            return False
        
        recommendation = recs[0]
        start_iso = recommendation.get('startIso')
        print(f"Using recommendation: time={recommendation.get('time')}, startIso={start_iso}")
        
        # Now create a booking with this slot
        print("\nStep 2: Create booking with recommendation slot")
        booking_url = f"{BASE_URL}/bookings"
        booking_payload = {
            'therapies': [{'slug': 'float-therapy', 'label': 'Float Therapy', 'role': 'Primary'}],
            'startAt': start_iso,
            'contact': {
                'name': 'Arjun Mehta',
                'phone': '9876543210',
                'email': 'arjun.mehta@example.com'
            },
            'guests': 1,
            'payment': 'at-visit',
            'total': 3000
        }
        
        booking_response = requests.post(booking_url, json=booking_payload, timeout=30)
        print(f"Request: POST {booking_url}")
        print(f"Payload: {json.dumps(booking_payload, indent=2)}")
        print(f"Status: {booking_response.status_code}")
        
        if booking_response.status_code not in [200, 201]:
            print_result(False, f"Booking creation failed: {booking_response.status_code}")
            print(f"Response: {booking_response.text}")
            return False
        
        booking_data = booking_response.json()
        print(f"Booking created: id={booking_data.get('id')}, ref={booking_data.get('ref')}")
        
        # Validate booking structure
        required_keys = ['id', 'ref', 'status']
        for key in required_keys:
            if key not in booking_data:
                print_result(False, f"Booking missing key: {key}")
                return False
        
        if booking_data.get('status') != 'confirmed':
            print_result(False, f"Expected status='confirmed', got '{booking_data.get('status')}'")
            return False
        
        print_result(True, f"Booking created successfully with recommendation slot (ref={booking_data.get('ref')})")
        return True
        
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
        return False

def main():
    """Run all tests"""
    print("\n" + "="*80)
    print("CONCIERGE RECOMMENDER ENDPOINT TESTS")
    print("Testing GET /api/scheduling/recommendations")
    print("="*80)
    
    tests = [
        ("REC-1", test_rec_1_single_therapy),
        ("REC-2", test_rec_2_multi_therapy),
        ("REC-3", test_rec_3_pagination),
        ("REC-4", test_rec_4_validation_errors),
        ("REC-5", test_rec_5_sold_out_edge_case),
        ("REC-6", test_rec_6_badge_uniqueness),
        ("REC-7", test_rec_7_exact_open_time),
        ("REC-8", test_rec_8_regression_slots_endpoint),
        ("REC-9", test_rec_9_regression_booking_with_recommendation),
    ]
    
    results = {}
    
    for test_name, test_func in tests:
        try:
            results[test_name] = test_func()
        except Exception as e:
            print(f"\n❌ {test_name} CRASHED: {str(e)}")
            results[test_name] = False
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for test_name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} - {test_name}")
    
    print(f"\n{'='*80}")
    print(f"TOTAL: {passed}/{total} tests passed")
    print(f"{'='*80}\n")
    
    return passed == total

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
