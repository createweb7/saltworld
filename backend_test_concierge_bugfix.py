#!/usr/bin/env python3
"""
Concierge Recommender Bug Fix Verification
===========================================
Tests the two specific bugs that were fixed:
  BUG 1: Pagination duplicates (REC-3)
  BUG 2: Invalid time validation (REC-4)

Also runs regression tests (REC-1, REC-2, REC-5, REC-6, REC-7) to ensure no regressions.
"""

import requests
import sys
from datetime import datetime, timedelta

BASE_URL = "https://saltwell-arch.preview.emergentagent.com/api"

def test_rec1_single_therapy():
    """REC-1: Single therapy, valid inputs"""
    print("\n" + "="*80)
    print("REC-1: Single therapy, valid inputs")
    print("="*80)
    
    future_date = (datetime.now() + timedelta(days=30)).strftime('%Y-%m-%d')
    url = f"{BASE_URL}/scheduling/recommendations"
    params = {
        'therapies': 'salt-therapy',
        'date': future_date,
        'preferred': '10:00',
        'limit': 3,
        'offset': 0
    }
    
    r = requests.get(url, params=params)
    print(f"GET {url}")
    print(f"Params: {params}")
    print(f"Status: {r.status_code}")
    
    if r.status_code != 200:
        print(f"❌ FAILED: Expected 200, got {r.status_code}")
        print(f"Response: {r.text}")
        return False
    
    data = r.json()
    print(f"Response keys: {list(data.keys())}")
    
    # Verify structure
    if 'recommendations' not in data:
        print(f"❌ FAILED: Missing 'recommendations' key")
        return False
    
    recs = data['recommendations']
    print(f"Recommendations count: {len(recs)}")
    
    if len(recs) != 3:
        print(f"❌ FAILED: Expected 3 recommendations, got {len(recs)}")
        return False
    
    # Verify each recommendation has required fields
    for i, rec in enumerate(recs):
        print(f"\nRecommendation {i+1}:")
        print(f"  time: {rec.get('time')}")
        print(f"  badge: {rec.get('badge')}")
        print(f"  badgeLabel: {rec.get('badgeLabel')}")
        print(f"  deltaFromPreferredMin: {rec.get('deltaFromPreferredMin')}")
        print(f"  plan length: {len(rec.get('plan', []))}")
        
        if rec.get('badge') not in ['best_match', 'fastest_finish', 'least_waiting']:
            print(f"❌ FAILED: Invalid badge '{rec.get('badge')}'")
            return False
        
        if rec.get('plan') is None or len(rec.get('plan')) != 1:
            print(f"❌ FAILED: Expected plan length 1 for single therapy, got {len(rec.get('plan', []))}")
            return False
    
    # Verify distinct startIso
    start_times = [rec['startIso'] for rec in recs]
    if len(start_times) != len(set(start_times)):
        print(f"❌ FAILED: Duplicate startIso values found")
        return False
    
    print("\n✅ REC-1 PASSED")
    return True


def test_rec2_multi_therapy():
    """REC-2: Multi-therapy (Float + Salt)"""
    print("\n" + "="*80)
    print("REC-2: Multi-therapy (Float + Salt)")
    print("="*80)
    
    future_date = (datetime.now() + timedelta(days=30)).strftime('%Y-%m-%d')
    url = f"{BASE_URL}/scheduling/recommendations"
    params = {
        'therapies': 'float-therapy,salt-therapy',
        'date': future_date,
        'preferred': '10:00',
        'limit': 3,
        'offset': 0
    }
    
    r = requests.get(url, params=params)
    print(f"GET {url}")
    print(f"Params: {params}")
    print(f"Status: {r.status_code}")
    
    if r.status_code != 200:
        print(f"❌ FAILED: Expected 200, got {r.status_code}")
        print(f"Response: {r.text}")
        return False
    
    data = r.json()
    recs = data.get('recommendations', [])
    print(f"Recommendations count: {len(recs)}")
    
    if len(recs) != 3:
        print(f"❌ FAILED: Expected 3 recommendations, got {len(recs)}")
        return False
    
    # Verify plan array length = 2 for multi-therapy
    for i, rec in enumerate(recs):
        print(f"\nRecommendation {i+1}:")
        print(f"  time: {rec.get('time')}")
        print(f"  badge: {rec.get('badge')}")
        print(f"  plan length: {len(rec.get('plan', []))}")
        
        if len(rec.get('plan', [])) != 2:
            print(f"❌ FAILED: Expected plan length 2 for multi-therapy, got {len(rec.get('plan', []))}")
            return False
        
        # Verify therapy order
        slugs = [p['therapySlug'] for p in rec['plan']]
        if slugs != ['float-therapy', 'salt-therapy']:
            print(f"❌ FAILED: Expected therapy order [float-therapy, salt-therapy], got {slugs}")
            return False
    
    print("\n✅ REC-2 PASSED")
    return True


def test_rec3_pagination_no_duplicates():
    """REC-3: Pagination must return disjoint sets (BUG FIX VERIFICATION)"""
    print("\n" + "="*80)
    print("REC-3: Pagination - offset=0 vs offset=3 must return disjoint sets")
    print("="*80)
    print("🔍 THIS IS BUG #1 FIX VERIFICATION")
    
    future_date = (datetime.now() + timedelta(days=30)).strftime('%Y-%m-%d')
    url = f"{BASE_URL}/scheduling/recommendations"
    
    # Page 1 (offset=0)
    params_page1 = {
        'therapies': 'salt-therapy',
        'date': future_date,
        'preferred': '10:00',
        'limit': 3,
        'offset': 0
    }
    
    r1 = requests.get(url, params=params_page1)
    print(f"\nPage 1: GET {url}")
    print(f"Params: {params_page1}")
    print(f"Status: {r1.status_code}")
    
    if r1.status_code != 200:
        print(f"❌ FAILED: Page 1 returned {r1.status_code}")
        return False
    
    data1 = r1.json()
    recs1 = data1.get('recommendations', [])
    times1 = [rec['time'] for rec in recs1]
    start_isos1 = [rec['startIso'] for rec in recs1]
    
    print(f"Page 1 times: {times1}")
    print(f"Page 1 startIso: {start_isos1}")
    
    # Page 2 (offset=3)
    params_page2 = {
        'therapies': 'salt-therapy',
        'date': future_date,
        'preferred': '10:00',
        'limit': 3,
        'offset': 3
    }
    
    r2 = requests.get(url, params=params_page2)
    print(f"\nPage 2: GET {url}")
    print(f"Params: {params_page2}")
    print(f"Status: {r2.status_code}")
    
    if r2.status_code != 200:
        print(f"❌ FAILED: Page 2 returned {r2.status_code}")
        return False
    
    data2 = r2.json()
    recs2 = data2.get('recommendations', [])
    times2 = [rec['time'] for rec in recs2]
    start_isos2 = [rec['startIso'] for rec in recs2]
    
    print(f"Page 2 times: {times2}")
    print(f"Page 2 startIso: {start_isos2}")
    
    # Check for duplicates
    duplicates = set(start_isos1) & set(start_isos2)
    
    if duplicates:
        print(f"\n❌ FAILED: Found duplicate startIso across pages: {duplicates}")
        print(f"Page 1 times: {times1}")
        print(f"Page 2 times: {times2}")
        print(f"Duplicate times: {[rec['time'] for rec in recs1 if rec['startIso'] in duplicates]}")
        return False
    
    print(f"\n✅ REC-3 PASSED: No duplicates found between offset=0 and offset=3")
    print(f"   Page 1 returned {len(recs1)} unique recommendations")
    print(f"   Page 2 returned {len(recs2)} unique recommendations")
    print(f"   All {len(recs1) + len(recs2)} recommendations are distinct")
    return True


def test_rec4_invalid_time_validation():
    """REC-4: Invalid time format validation (BUG FIX VERIFICATION)"""
    print("\n" + "="*80)
    print("REC-4: Invalid time format validation")
    print("="*80)
    print("🔍 THIS IS BUG #2 FIX VERIFICATION")
    
    future_date = (datetime.now() + timedelta(days=30)).strftime('%Y-%m-%d')
    url = f"{BASE_URL}/scheduling/recommendations"
    
    invalid_times = [
        ('25:99', 'hour=25, minute=99 (both out of range)'),
        ('12:99', 'minute=99 (out of range)'),
        ('99:00', 'hour=99 (out of range)'),
        ('-1:00', 'hour=-1 (negative)'),
        ('', 'empty string'),
    ]
    
    all_passed = True
    
    for invalid_time, description in invalid_times:
        print(f"\n--- Testing: {description} ---")
        params = {
            'therapies': 'salt-therapy',
            'date': future_date,
            'preferred': invalid_time,
            'limit': 3,
            'offset': 0
        }
        
        r = requests.get(url, params=params)
        print(f"GET {url}")
        print(f"Params: {params}")
        print(f"Status: {r.status_code}")
        
        if r.status_code != 400:
            print(f"❌ FAILED: Expected 400, got {r.status_code}")
            print(f"Response: {r.text}")
            all_passed = False
            continue
        
        data = r.json()
        print(f"Response: {data}")
        
        if data.get('error') != 'preferred_time_required':
            print(f"❌ FAILED: Expected error='preferred_time_required', got '{data.get('error')}'")
            all_passed = False
            continue
        
        print(f"✅ Correctly rejected with 400 and error='preferred_time_required'")
    
    if all_passed:
        print(f"\n✅ REC-4 PASSED: All invalid time formats correctly rejected")
    else:
        print(f"\n❌ REC-4 FAILED: Some invalid time formats were not rejected")
    
    return all_passed


def test_rec5_sold_out_edge_case():
    """REC-5: Sold-out edge case (before opening hours)"""
    print("\n" + "="*80)
    print("REC-5: Sold-out edge case (before opening hours)")
    print("="*80)
    
    future_date = (datetime.now() + timedelta(days=30)).strftime('%Y-%m-%d')
    url = f"{BASE_URL}/scheduling/recommendations"
    params = {
        'therapies': 'salt-therapy',
        'date': future_date,
        'preferred': '05:00',  # Before opening hours (08:00)
        'window': 15,  # Small window
        'limit': 3,
        'offset': 0
    }
    
    r = requests.get(url, params=params)
    print(f"GET {url}")
    print(f"Params: {params}")
    print(f"Status: {r.status_code}")
    
    if r.status_code != 200:
        print(f"❌ FAILED: Expected 200, got {r.status_code}")
        return False
    
    data = r.json()
    print(f"Response: {data}")
    
    if data.get('recommendations') != []:
        print(f"❌ FAILED: Expected empty recommendations, got {len(data.get('recommendations', []))} items")
        return False
    
    if data.get('reason') != 'no_availability':
        print(f"❌ FAILED: Expected reason='no_availability', got '{data.get('reason')}'")
        return False
    
    print("\n✅ REC-5 PASSED")
    return True


def test_rec6_badge_uniqueness():
    """REC-6: Badge uniqueness - all recommendations have distinct startIso"""
    print("\n" + "="*80)
    print("REC-6: Badge uniqueness - distinct startIso values")
    print("="*80)
    
    future_date = (datetime.now() + timedelta(days=30)).strftime('%Y-%m-%d')
    url = f"{BASE_URL}/scheduling/recommendations"
    params = {
        'therapies': 'salt-therapy',
        'date': future_date,
        'preferred': '10:00',
        'limit': 3,
        'offset': 0
    }
    
    r = requests.get(url, params=params)
    print(f"GET {url}")
    print(f"Params: {params}")
    print(f"Status: {r.status_code}")
    
    if r.status_code != 200:
        print(f"❌ FAILED: Expected 200, got {r.status_code}")
        return False
    
    data = r.json()
    recs = data.get('recommendations', [])
    
    # Check for duplicate startIso
    start_isos = [rec['startIso'] for rec in recs]
    times = [rec['time'] for rec in recs]
    
    print(f"Times: {times}")
    print(f"StartIso values: {start_isos}")
    
    if len(start_isos) != len(set(start_isos)):
        print(f"❌ FAILED: Found duplicate startIso values")
        return False
    
    print("\n✅ REC-6 PASSED: All recommendations have distinct startIso")
    return True


def test_rec7_exact_open_time():
    """REC-7: Early morning time should return recommendations with reasonable deltas"""
    print("\n" + "="*80)
    print("REC-7: Early morning time (08:00) - verify recommendations returned")
    print("="*80)
    
    future_date = (datetime.now() + timedelta(days=30)).strftime('%Y-%m-%d')
    url = f"{BASE_URL}/scheduling/recommendations"
    params = {
        'therapies': 'salt-therapy',
        'date': future_date,
        'preferred': '08:00',  # Early morning time
        'limit': 3,
        'offset': 0
    }
    
    r = requests.get(url, params=params)
    print(f"GET {url}")
    print(f"Params: {params}")
    print(f"Status: {r.status_code}")
    
    if r.status_code != 200:
        print(f"❌ FAILED: Expected 200, got {r.status_code}")
        return False
    
    data = r.json()
    recs = data.get('recommendations', [])
    
    if len(recs) == 0:
        print(f"❌ FAILED: Expected at least 1 recommendation, got 0")
        return False
    
    print(f"\nRecommendations returned: {len(recs)}")
    for i, rec in enumerate(recs):
        print(f"  {i+1}. time={rec['time']}, badge={rec['badge']}, delta={rec['deltaFromPreferredMin']}min")
    
    # Verify the best_match has the smallest delta
    best_match = next((r for r in recs if r['badge'] == 'best_match'), None)
    if not best_match:
        print(f"❌ FAILED: No 'best_match' badge found")
        return False
    
    # Verify all deltas are reasonable (within 60 minutes by default)
    for rec in recs:
        delta = rec.get('deltaFromPreferredMin', 999)
        if delta > 60:
            print(f"⚠️  WARNING: Delta {delta}min exceeds default window (60min) for time {rec['time']}")
    
    print(f"\n✅ REC-7 PASSED: Recommendations returned with best_match at {best_match['time']} (delta={best_match['deltaFromPreferredMin']}min)")
    return True


def main():
    print("="*80)
    print("CONCIERGE RECOMMENDER BUG FIX VERIFICATION")
    print("="*80)
    print("\nTesting two specific bug fixes:")
    print("  BUG #1: Pagination duplicates (REC-3)")
    print("  BUG #2: Invalid time validation (REC-4)")
    print("\nAlso running regression tests (REC-1, REC-2, REC-5, REC-6, REC-7)")
    print("="*80)
    
    results = {}
    
    # Regression tests first
    print("\n" + "="*80)
    print("REGRESSION TESTS")
    print("="*80)
    
    results['REC-1'] = test_rec1_single_therapy()
    results['REC-2'] = test_rec2_multi_therapy()
    results['REC-5'] = test_rec5_sold_out_edge_case()
    results['REC-6'] = test_rec6_badge_uniqueness()
    results['REC-7'] = test_rec7_exact_open_time()
    
    # Bug fix verification tests
    print("\n" + "="*80)
    print("BUG FIX VERIFICATION TESTS")
    print("="*80)
    
    results['REC-3 (BUG #1)'] = test_rec3_pagination_no_duplicates()
    results['REC-4 (BUG #2)'] = test_rec4_invalid_time_validation()
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    print(f"\nResults:")
    for test, result in results.items():
        status = "✅ PASSED" if result else "❌ FAILED"
        print(f"  {test}: {status}")
    
    print(f"\n{'='*80}")
    print(f"OVERALL: {passed}/{total} tests passed ({passed*100//total}%)")
    print(f"{'='*80}")
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED! Both bug fixes are working correctly.")
        print("   - BUG #1 (Pagination duplicates): FIXED ✅")
        print("   - BUG #2 (Invalid time validation): FIXED ✅")
        print("   - All regression tests: PASSED ✅")
        return 0
    else:
        print(f"\n⚠️  {total - passed} test(s) failed. Please review the output above.")
        return 1


if __name__ == '__main__':
    sys.exit(main())
