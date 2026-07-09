#!/usr/bin/env python3
"""
Backend API tests for /api/leads endpoint (Homepage CRO pass)
Tests the new corporate leads capture functionality
"""

import requests
import json
import sys
from datetime import datetime

# Read base URL from .env
BASE_URL = "https://saltwell-arch.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

# Track created leads
created_lead_ids = []

def log_test(test_num, description, passed, details=""):
    """Log test results"""
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"\n{'='*80}")
    print(f"Test {test_num}: {description}")
    print(f"Status: {status}")
    if details:
        print(f"Details: {details}")
    print('='*80)
    return passed

def test_1_post_leads_valid():
    """Test 1: POST /api/leads with full valid JSON body"""
    try:
        payload = {
            "name": "Test Lead",
            "email": "test@example.com",
            "company": "Acme",
            "teamSize": "16–50",
            "notes": "Interested in sleep cohort",
            "source": "corporate-band"
        }
        
        response = requests.post(
            f"{API_BASE}/leads",
            json=payload,
            timeout=10
        )
        
        if response.status_code != 200:
            return log_test(1, "POST /api/leads with valid body", False, 
                          f"Expected status 200, got {response.status_code}. Response: {response.text}")
        
        lead = response.json()
        
        # Check for id field (UUID)
        if 'id' not in lead:
            return log_test(1, "POST /api/leads with valid body", False, 
                          "Response missing 'id' field")
        
        lead_id = lead.get('id')
        if not isinstance(lead_id, str) or len(lead_id) < 32:
            return log_test(1, "POST /api/leads with valid body", False, 
                          f"'id' is not a valid UUID: {lead_id}")
        
        created_lead_ids.append(lead_id)
        
        # Check status='new'
        if lead.get('status') != 'new':
            return log_test(1, "POST /api/leads with valid body", False, 
                          f"Expected status='new', got '{lead.get('status')}'")
        
        # Check createdAt is valid ISO string
        created_at = lead.get('createdAt')
        if not created_at:
            return log_test(1, "POST /api/leads with valid body", False, 
                          "Response missing 'createdAt' field")
        
        try:
            datetime.fromisoformat(created_at.replace('Z', '+00:00'))
        except:
            return log_test(1, "POST /api/leads with valid body", False, 
                          f"'createdAt' is not a valid ISO timestamp: {created_at}")
        
        # Check all submitted fields are echoed back
        for key in ['name', 'email', 'company', 'teamSize', 'notes', 'source']:
            if lead.get(key) != payload[key]:
                return log_test(1, "POST /api/leads with valid body", False, 
                              f"Field '{key}' not echoed correctly. Expected '{payload[key]}', got '{lead.get(key)}'")
        
        # Check NO _id field
        if '_id' in lead:
            return log_test(1, "POST /api/leads with valid body", False, 
                          "Response contains MongoDB '_id' field (should be removed)")
        
        return log_test(1, "POST /api/leads with valid body", True, 
                       f"Lead created with id={lead_id}, status='new', createdAt={created_at}, all fields present, no _id")
        
    except Exception as e:
        return log_test(1, "POST /api/leads with valid body", False, f"Exception: {str(e)}")

def test_2_post_leads_missing_email():
    """Test 2: POST /api/leads with missing email (only name)"""
    try:
        payload = {"name": "No Email"}
        
        response = requests.post(
            f"{API_BASE}/leads",
            json=payload,
            timeout=10
        )
        
        if response.status_code != 400:
            return log_test(2, "POST /api/leads missing email", False, 
                          f"Expected status 400, got {response.status_code}")
        
        error_response = response.json()
        
        if error_response.get('error') != 'name_email_required':
            return log_test(2, "POST /api/leads missing email", False, 
                          f"Expected error='name_email_required', got '{error_response.get('error')}'")
        
        return log_test(2, "POST /api/leads missing email", True, 
                       "Correctly returns 400 with error='name_email_required'")
        
    except Exception as e:
        return log_test(2, "POST /api/leads missing email", False, f"Exception: {str(e)}")

def test_3_post_leads_missing_name():
    """Test 3: POST /api/leads with missing name (only email)"""
    try:
        payload = {"email": "noname@example.com"}
        
        response = requests.post(
            f"{API_BASE}/leads",
            json=payload,
            timeout=10
        )
        
        if response.status_code != 400:
            return log_test(3, "POST /api/leads missing name", False, 
                          f"Expected status 400, got {response.status_code}")
        
        error_response = response.json()
        
        if error_response.get('error') != 'name_email_required':
            return log_test(3, "POST /api/leads missing name", False, 
                          f"Expected error='name_email_required', got '{error_response.get('error')}'")
        
        return log_test(3, "POST /api/leads missing name", True, 
                       "Correctly returns 400 with error='name_email_required'")
        
    except Exception as e:
        return log_test(3, "POST /api/leads missing name", False, f"Exception: {str(e)}")

def test_4_post_leads_empty_body():
    """Test 4: POST /api/leads with empty body {}"""
    try:
        payload = {}
        
        response = requests.post(
            f"{API_BASE}/leads",
            json=payload,
            timeout=10
        )
        
        if response.status_code != 400:
            return log_test(4, "POST /api/leads empty body", False, 
                          f"Expected status 400, got {response.status_code}")
        
        error_response = response.json()
        
        if error_response.get('error') != 'name_email_required':
            return log_test(4, "POST /api/leads empty body", False, 
                          f"Expected error='name_email_required', got '{error_response.get('error')}'")
        
        return log_test(4, "POST /api/leads empty body", True, 
                       "Correctly returns 400 with error='name_email_required'")
        
    except Exception as e:
        return log_test(4, "POST /api/leads empty body", False, f"Exception: {str(e)}")

def test_5_get_leads():
    """Test 5: GET /api/leads returns array with created lead"""
    try:
        response = requests.get(f"{API_BASE}/leads", timeout=10)
        
        if response.status_code != 200:
            return log_test(5, "GET /api/leads", False, 
                          f"Expected status 200, got {response.status_code}")
        
        leads = response.json()
        
        if not isinstance(leads, list):
            return log_test(5, "GET /api/leads", False, 
                          f"Expected array, got {type(leads)}")
        
        # Check that our created lead is in the list
        if not created_lead_ids:
            return log_test(5, "GET /api/leads", False, 
                          "No leads were created in previous tests")
        
        created_id = created_lead_ids[0]
        lead_ids = [l.get('id') for l in leads]
        
        if created_id not in lead_ids:
            return log_test(5, "GET /api/leads", False, 
                          f"Created lead {created_id} not found in list. Found {len(leads)} leads")
        
        # Find our lead and verify it
        our_lead = next((l for l in leads if l.get('id') == created_id), None)
        
        if not our_lead:
            return log_test(5, "GET /api/leads", False, 
                          f"Could not find lead with id={created_id}")
        
        # Check NO _id field in any lead
        for lead in leads:
            if '_id' in lead:
                return log_test(5, "GET /api/leads", False, 
                              f"Lead contains MongoDB '_id' field (should be removed)")
        
        # Verify our lead has expected fields
        if our_lead.get('email') != 'test@example.com':
            return log_test(5, "GET /api/leads", False, 
                          f"Lead email mismatch. Expected 'test@example.com', got '{our_lead.get('email')}'")
        
        if our_lead.get('name') != 'Test Lead':
            return log_test(5, "GET /api/leads", False, 
                          f"Lead name mismatch. Expected 'Test Lead', got '{our_lead.get('name')}'")
        
        return log_test(5, "GET /api/leads", True, 
                       f"Retrieved {len(leads)} leads, created lead present with correct data, no _id fields")
        
    except Exception as e:
        return log_test(5, "GET /api/leads", False, f"Exception: {str(e)}")

def test_6_health_regression():
    """Test 6: Regression - GET /api/health returns {ok: true}"""
    try:
        response = requests.get(f"{API_BASE}/health", timeout=10)
        
        if response.status_code != 200:
            return log_test(6, "Regression: GET /api/health", False, 
                          f"Expected status 200, got {response.status_code}")
        
        result = response.json()
        
        if not result.get('ok'):
            return log_test(6, "Regression: GET /api/health", False, 
                          f"Expected {{ok: true}}, got {result}")
        
        return log_test(6, "Regression: GET /api/health", True, 
                       f"Health endpoint working: {result}")
        
    except Exception as e:
        return log_test(6, "Regression: GET /api/health", False, f"Exception: {str(e)}")

def test_7_templates_regression():
    """Test 7: Regression - GET /api/templates returns 6 templates"""
    try:
        response = requests.get(f"{API_BASE}/templates", timeout=10)
        
        if response.status_code != 200:
            return log_test(7, "Regression: GET /api/templates", False, 
                          f"Expected status 200, got {response.status_code}")
        
        templates = response.json()
        
        if not isinstance(templates, list):
            return log_test(7, "Regression: GET /api/templates", False, 
                          f"Expected array, got {type(templates)}")
        
        if len(templates) != 6:
            return log_test(7, "Regression: GET /api/templates", False, 
                          f"Expected 6 templates, got {len(templates)}")
        
        return log_test(7, "Regression: GET /api/templates", True, 
                       f"Templates endpoint working: {len(templates)} templates returned")
        
    except Exception as e:
        return log_test(7, "Regression: GET /api/templates", False, f"Exception: {str(e)}")

def main():
    """Run all tests"""
    print(f"\n{'='*80}")
    print("LEADS ENDPOINT TESTS - Homepage CRO Pass")
    print(f"Base URL: {BASE_URL}")
    print(f"API Base: {API_BASE}")
    print('='*80)
    
    results = []
    
    # Run tests in order
    results.append(test_1_post_leads_valid())
    results.append(test_2_post_leads_missing_email())
    results.append(test_3_post_leads_missing_name())
    results.append(test_4_post_leads_empty_body())
    results.append(test_5_get_leads())
    results.append(test_6_health_regression())
    results.append(test_7_templates_regression())
    
    # Summary
    print(f"\n{'='*80}")
    print("TEST SUMMARY")
    print('='*80)
    passed = sum(results)
    total = len(results)
    print(f"Passed: {passed}/{total}")
    print(f"Failed: {total - passed}/{total}")
    
    # Report on created leads (no DELETE endpoint available)
    if created_lead_ids:
        print(f"\nNote: {len(created_lead_ids)} lead(s) created during testing (no DELETE endpoint available for cleanup)")
        print(f"Lead IDs: {', '.join(created_lead_ids)}")
    
    if passed == total:
        print("\n✅ ALL TESTS PASSED")
        return 0
    else:
        print(f"\n❌ {total - passed} TEST(S) FAILED")
        return 1

if __name__ == "__main__":
    sys.exit(main())
