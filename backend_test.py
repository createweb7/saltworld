#!/usr/bin/env python3
"""
Backend API tests for Salt World Landing Page Builder
Tests all endpoints under /api according to the 10-check plan
"""

import requests
import json
import sys
from typing import List, Dict, Any

# Read base URL from .env
BASE_URL = "https://saltwell-arch.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

# Track created pages for cleanup
created_page_ids: List[str] = []

def log_test(test_num: int, description: str, passed: bool, details: str = ""):
    """Log test results"""
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"\n{'='*80}")
    print(f"Test {test_num}: {description}")
    print(f"Status: {status}")
    if details:
        print(f"Details: {details}")
    print('='*80)
    return passed

def test_1_templates():
    """Test 1: GET /api/templates returns 6 templates with correct structure"""
    try:
        response = requests.get(f"{API_BASE}/templates", timeout=10)
        
        if response.status_code != 200:
            return log_test(1, "Templates listing", False, 
                          f"Expected status 200, got {response.status_code}")
        
        templates = response.json()
        
        if not isinstance(templates, list):
            return log_test(1, "Templates listing", False, 
                          f"Expected array, got {type(templates)}")
        
        if len(templates) != 6:
            return log_test(1, "Templates listing", False, 
                          f"Expected 6 templates, got {len(templates)}")
        
        expected_ids = ['couple-activities', 'experience-gifts', 'stress-relief', 
                       'better-sleep', 'athlete-recovery', 'float-therapy']
        actual_ids = [t.get('id') for t in templates]
        
        if set(actual_ids) != set(expected_ids):
            return log_test(1, "Templates listing", False, 
                          f"Expected ids {expected_ids}, got {actual_ids}")
        
        # Check each template has required fields
        for tmpl in templates:
            if not all(k in tmpl for k in ['id', 'name', 'description', 'accent']):
                return log_test(1, "Templates listing", False, 
                              f"Template missing required fields: {tmpl}")
        
        return log_test(1, "Templates listing", True, 
                       f"All 6 templates present with correct structure")
        
    except Exception as e:
        return log_test(1, "Templates listing", False, f"Exception: {str(e)}")

def test_2_create_page_with_template():
    """Test 2: POST /api/pages with templateId='float-therapy'"""
    try:
        response = requests.post(
            f"{API_BASE}/pages",
            json={"templateId": "float-therapy"},
            timeout=10
        )
        
        if response.status_code != 200:
            return log_test(2, "Create page with template", False, 
                          f"Expected status 200, got {response.status_code}")
        
        page = response.json()
        created_page_ids.append(page.get('id'))
        
        # Check required fields
        required_fields = ['id', 'slug', 'status', 'template', 'sections', 'seo']
        missing = [f for f in required_fields if f not in page]
        if missing:
            return log_test(2, "Create page with template", False, 
                          f"Missing fields: {missing}")
        
        # Check template
        if page.get('template') != 'float-therapy':
            return log_test(2, "Create page with template", False, 
                          f"Expected template='float-therapy', got '{page.get('template')}'")
        
        # Check status
        if page.get('status') != 'draft':
            return log_test(2, "Create page with template", False, 
                          f"Expected status='draft', got '{page.get('status')}'")
        
        # Check slug starts with float-therapy
        if not page.get('slug', '').startswith('float-therapy'):
            return log_test(2, "Create page with template", False, 
                          f"Expected slug to start with 'float-therapy', got '{page.get('slug')}'")
        
        # Check sections
        sections = page.get('sections', [])
        if len(sections) != 4:
            return log_test(2, "Create page with template", False, 
                          f"Expected 4 sections, got {len(sections)}")
        
        # Check each section has id (UUID), type, and props
        for i, section in enumerate(sections):
            if 'id' not in section:
                return log_test(2, "Create page with template", False, 
                              f"Section {i} missing 'id' field")
            if 'type' not in section:
                return log_test(2, "Create page with template", False, 
                              f"Section {i} missing 'type' field")
            if 'props' not in section:
                return log_test(2, "Create page with template", False, 
                              f"Section {i} missing 'props' field")
            # Check id is a UUID string
            if not isinstance(section['id'], str) or len(section['id']) < 32:
                return log_test(2, "Create page with template", False, 
                              f"Section {i} id is not a valid UUID: {section['id']}")
        
        # Check SEO
        seo = page.get('seo', {})
        if 'metaTitle' not in seo or 'metaDescription' not in seo:
            return log_test(2, "Create page with template", False, 
                          f"SEO missing required fields: {seo}")
        
        return log_test(2, "Create page with template", True, 
                       f"Page created with id={page['id']}, 4 sections with UUIDs")
        
    except Exception as e:
        return log_test(2, "Create page with template", False, f"Exception: {str(e)}")

def test_3_create_blank_page():
    """Test 3: POST /api/pages with empty body (blank template)"""
    try:
        response = requests.post(
            f"{API_BASE}/pages",
            json={},
            timeout=10
        )
        
        if response.status_code != 200:
            return log_test(3, "Create blank page", False, 
                          f"Expected status 200, got {response.status_code}")
        
        page = response.json()
        created_page_ids.append(page.get('id'))
        
        # Check sections count
        sections = page.get('sections', [])
        if len(sections) != 2:
            return log_test(3, "Create blank page", False, 
                          f"Expected 2 sections (hero + cta), got {len(sections)}")
        
        # Check template is null
        if page.get('template') is not None:
            return log_test(3, "Create blank page", False, 
                          f"Expected template=null, got '{page.get('template')}'")
        
        return log_test(3, "Create blank page", True, 
                       f"Blank page created with id={page['id']}, 2 sections")
        
    except Exception as e:
        return log_test(3, "Create blank page", False, f"Exception: {str(e)}")

def test_4_list_pages():
    """Test 4: GET /api/pages returns list including created pages"""
    try:
        response = requests.get(f"{API_BASE}/pages", timeout=10)
        
        if response.status_code != 200:
            return log_test(4, "List pages", False, 
                          f"Expected status 200, got {response.status_code}")
        
        pages = response.json()
        
        if not isinstance(pages, list):
            return log_test(4, "List pages", False, 
                          f"Expected array, got {type(pages)}")
        
        # Check that our created pages are in the list
        page_ids = [p.get('id') for p in pages]
        for created_id in created_page_ids:
            if created_id not in page_ids:
                return log_test(4, "List pages", False, 
                              f"Created page {created_id} not found in list")
        
        # Check sorting by updatedAt desc (most recent first)
        if len(pages) > 1:
            for i in range(len(pages) - 1):
                if 'updatedAt' in pages[i] and 'updatedAt' in pages[i+1]:
                    if pages[i]['updatedAt'] < pages[i+1]['updatedAt']:
                        return log_test(4, "List pages", False, 
                                      "Pages not sorted by updatedAt desc")
        
        return log_test(4, "List pages", True, 
                       f"Retrieved {len(pages)} pages, all created pages present")
        
    except Exception as e:
        return log_test(4, "List pages", False, f"Exception: {str(e)}")

def test_5_get_page_by_id():
    """Test 5: GET /api/pages/{id} - 200 for valid, 404 for invalid"""
    try:
        if not created_page_ids:
            return log_test(5, "Get page by ID", False, "No pages created yet")
        
        # Test valid ID
        valid_id = created_page_ids[0]
        response = requests.get(f"{API_BASE}/pages/{valid_id}", timeout=10)
        
        if response.status_code != 200:
            return log_test(5, "Get page by ID", False, 
                          f"Expected status 200 for valid id, got {response.status_code}")
        
        page = response.json()
        if page.get('id') != valid_id:
            return log_test(5, "Get page by ID", False, 
                          f"Expected id={valid_id}, got {page.get('id')}")
        
        # Test invalid ID (random UUID)
        invalid_id = "00000000-0000-0000-0000-000000000000"
        response = requests.get(f"{API_BASE}/pages/{invalid_id}", timeout=10)
        
        if response.status_code != 404:
            return log_test(5, "Get page by ID", False, 
                          f"Expected status 404 for invalid id, got {response.status_code}")
        
        return log_test(5, "Get page by ID", True, 
                       "Valid ID returns 200, invalid ID returns 404")
        
    except Exception as e:
        return log_test(5, "Get page by ID", False, f"Exception: {str(e)}")

def test_6_update_page():
    """Test 6: PATCH /api/pages/{id} updates fields"""
    try:
        if not created_page_ids:
            return log_test(6, "Update page", False, "No pages created yet")
        
        page_id = created_page_ids[0]
        
        # Get current page
        response = requests.get(f"{API_BASE}/pages/{page_id}", timeout=10)
        current_page = response.json()
        current_updated_at = current_page.get('updatedAt')
        
        # Update page
        update_data = {
            "title": "Float Therapy Updated",
            "sections": current_page.get('sections', []),
            "seo": {
                "metaTitle": "New Meta Title",
                "metaDescription": "New Meta Description"
            }
        }
        
        response = requests.patch(
            f"{API_BASE}/pages/{page_id}",
            json=update_data,
            timeout=10
        )
        
        if response.status_code != 200:
            return log_test(6, "Update page", False, 
                          f"Expected status 200, got {response.status_code}")
        
        updated_page = response.json()
        
        # Check title updated
        if updated_page.get('title') != "Float Therapy Updated":
            return log_test(6, "Update page", False, 
                          f"Title not updated: {updated_page.get('title')}")
        
        # Check SEO updated
        seo = updated_page.get('seo', {})
        if seo.get('metaTitle') != "New Meta Title":
            return log_test(6, "Update page", False, 
                          f"SEO metaTitle not updated: {seo.get('metaTitle')}")
        
        # Check updatedAt changed
        new_updated_at = updated_page.get('updatedAt')
        if new_updated_at == current_updated_at:
            return log_test(6, "Update page", False, 
                          "updatedAt not changed after update")
        
        return log_test(6, "Update page", True, 
                       "Page updated successfully, updatedAt bumped")
        
    except Exception as e:
        return log_test(6, "Update page", False, f"Exception: {str(e)}")

def test_7_duplicate_page():
    """Test 7: POST /api/pages/{id}/duplicate creates copy"""
    try:
        if not created_page_ids:
            return log_test(7, "Duplicate page", False, "No pages created yet")
        
        source_id = created_page_ids[0]
        
        # Get source page
        response = requests.get(f"{API_BASE}/pages/{source_id}", timeout=10)
        source_page = response.json()
        source_section_count = len(source_page.get('sections', []))
        
        # Duplicate page
        response = requests.post(
            f"{API_BASE}/pages/{source_id}/duplicate",
            timeout=10
        )
        
        if response.status_code != 200:
            return log_test(7, "Duplicate page", False, 
                          f"Expected status 200, got {response.status_code}")
        
        duplicate = response.json()
        created_page_ids.append(duplicate.get('id'))
        
        # Check new ID
        if duplicate.get('id') == source_id:
            return log_test(7, "Duplicate page", False, 
                          "Duplicate has same ID as source")
        
        # Check title ends with "(copy)"
        if not duplicate.get('title', '').endswith('(copy)'):
            return log_test(7, "Duplicate page", False, 
                          f"Title doesn't end with '(copy)': {duplicate.get('title')}")
        
        # Check status is draft
        if duplicate.get('status') != 'draft':
            return log_test(7, "Duplicate page", False, 
                          f"Expected status='draft', got '{duplicate.get('status')}'")
        
        # Check section count matches
        duplicate_section_count = len(duplicate.get('sections', []))
        if duplicate_section_count != source_section_count:
            return log_test(7, "Duplicate page", False, 
                          f"Section count mismatch: source={source_section_count}, duplicate={duplicate_section_count}")
        
        return log_test(7, "Duplicate page", True, 
                       f"Page duplicated with new id={duplicate['id']}, title ends with '(copy)', status=draft")
        
    except Exception as e:
        return log_test(7, "Duplicate page", False, f"Exception: {str(e)}")

def test_8_publish_page():
    """Test 8: POST /api/pages/{id}/publish sets status and publishedAt"""
    try:
        if not created_page_ids:
            return log_test(8, "Publish page", False, "No pages created yet")
        
        page_id = created_page_ids[0]
        
        # Publish page
        response = requests.post(
            f"{API_BASE}/pages/{page_id}/publish",
            timeout=10
        )
        
        if response.status_code != 200:
            return log_test(8, "Publish page", False, 
                          f"Expected status 200, got {response.status_code}")
        
        published_page = response.json()
        
        # Check status
        if published_page.get('status') != 'published':
            return log_test(8, "Publish page", False, 
                          f"Expected status='published', got '{published_page.get('status')}'")
        
        # Check publishedAt is set and valid ISO timestamp
        published_at = published_page.get('publishedAt')
        if not published_at:
            return log_test(8, "Publish page", False, 
                          "publishedAt not set")
        
        # Validate ISO timestamp format
        from datetime import datetime
        try:
            datetime.fromisoformat(published_at.replace('Z', '+00:00'))
        except:
            return log_test(8, "Publish page", False, 
                          f"publishedAt is not a valid ISO timestamp: {published_at}")
        
        return log_test(8, "Publish page", True, 
                       f"Page published, status='published', publishedAt={published_at}")
        
    except Exception as e:
        return log_test(8, "Publish page", False, f"Exception: {str(e)}")

def test_9_public_slug_and_unpublish():
    """Test 9: GET /api/pages/by-slug/{slug} for published, then unpublish and verify 404"""
    try:
        if not created_page_ids:
            return log_test(9, "Public slug & unpublish", False, "No pages created yet")
        
        page_id = created_page_ids[0]
        
        # Get page to find slug
        response = requests.get(f"{API_BASE}/pages/{page_id}", timeout=10)
        page = response.json()
        slug = page.get('slug')
        
        if not slug:
            return log_test(9, "Public slug & unpublish", False, "Page has no slug")
        
        # Ensure page is published (from test 8 it should be)
        if page.get('status') != 'published':
            # Publish it
            requests.post(f"{API_BASE}/pages/{page_id}/publish", timeout=10)
        
        # Test public slug endpoint - should return 200
        response = requests.get(f"{API_BASE}/pages/by-slug/{slug}", timeout=10)
        
        if response.status_code != 200:
            return log_test(9, "Public slug & unpublish", False, 
                          f"Expected status 200 for published page, got {response.status_code}")
        
        public_page = response.json()
        if public_page.get('id') != page_id:
            return log_test(9, "Public slug & unpublish", False, 
                          f"Public slug returned wrong page: expected {page_id}, got {public_page.get('id')}")
        
        # Unpublish page
        response = requests.post(
            f"{API_BASE}/pages/{page_id}/unpublish",
            timeout=10
        )
        
        if response.status_code != 200:
            return log_test(9, "Public slug & unpublish", False, 
                          f"Unpublish failed with status {response.status_code}")
        
        unpublished_page = response.json()
        if unpublished_page.get('status') != 'draft':
            return log_test(9, "Public slug & unpublish", False, 
                          f"Expected status='draft' after unpublish, got '{unpublished_page.get('status')}'")
        
        # Test public slug endpoint again - should return 404
        response = requests.get(f"{API_BASE}/pages/by-slug/{slug}", timeout=10)
        
        if response.status_code != 404:
            return log_test(9, "Public slug & unpublish", False, 
                          f"Expected status 404 for unpublished page, got {response.status_code}")
        
        return log_test(9, "Public slug & unpublish", True, 
                       f"Published page accessible at /by-slug/{slug}, 404 after unpublish")
        
    except Exception as e:
        return log_test(9, "Public slug & unpublish", False, f"Exception: {str(e)}")

def test_10_delete_page():
    """Test 10: DELETE /api/pages/{id} removes page"""
    try:
        if not created_page_ids:
            return log_test(10, "Delete page", False, "No pages created yet")
        
        # Use the last created page for deletion test
        page_id = created_page_ids[-1]
        
        # Delete page
        response = requests.delete(f"{API_BASE}/pages/{page_id}", timeout=10)
        
        if response.status_code != 200:
            return log_test(10, "Delete page", False, 
                          f"Expected status 200, got {response.status_code}")
        
        result = response.json()
        if not result.get('ok'):
            return log_test(10, "Delete page", False, 
                          f"Expected {{ok: true}}, got {result}")
        
        # Verify page is gone
        response = requests.get(f"{API_BASE}/pages/{page_id}", timeout=10)
        
        if response.status_code != 404:
            return log_test(10, "Delete page", False, 
                          f"Expected status 404 after deletion, got {response.status_code}")
        
        # Remove from tracking
        created_page_ids.remove(page_id)
        
        return log_test(10, "Delete page", True, 
                       f"Page {page_id} deleted, subsequent GET returns 404")
        
    except Exception as e:
        return log_test(10, "Delete page", False, f"Exception: {str(e)}")

def test_health():
    """Bonus: GET /api/health returns ok"""
    try:
        response = requests.get(f"{API_BASE}/health", timeout=10)
        
        if response.status_code != 200:
            return log_test(0, "Health check", False, 
                          f"Expected status 200, got {response.status_code}")
        
        result = response.json()
        if not result.get('ok'):
            return log_test(0, "Health check", False, 
                          f"Expected {{ok: true}}, got {result}")
        
        return log_test(0, "Health check", True, 
                       f"Health endpoint working: {result}")
        
    except Exception as e:
        return log_test(0, "Health check", False, f"Exception: {str(e)}")

def cleanup():
    """Delete all created pages"""
    print(f"\n{'='*80}")
    print("CLEANUP: Deleting created pages")
    print('='*80)
    
    for page_id in created_page_ids[:]:
        try:
            response = requests.delete(f"{API_BASE}/pages/{page_id}", timeout=10)
            if response.status_code == 200:
                print(f"✅ Deleted page {page_id}")
                created_page_ids.remove(page_id)
            else:
                print(f"⚠️  Failed to delete page {page_id}: status {response.status_code}")
        except Exception as e:
            print(f"⚠️  Error deleting page {page_id}: {str(e)}")
    
    if not created_page_ids:
        print("✅ All pages cleaned up")
    else:
        print(f"⚠️  {len(created_page_ids)} pages could not be deleted")

def main():
    """Run all tests"""
    print(f"\n{'='*80}")
    print("SALT WORLD LANDING PAGE BUILDER - BACKEND API TESTS")
    print(f"Base URL: {BASE_URL}")
    print(f"API Base: {API_BASE}")
    print('='*80)
    
    results = []
    
    # Run tests in order
    results.append(test_health())
    results.append(test_1_templates())
    results.append(test_2_create_page_with_template())
    results.append(test_3_create_blank_page())
    results.append(test_4_list_pages())
    results.append(test_5_get_page_by_id())
    results.append(test_6_update_page())
    results.append(test_7_duplicate_page())
    results.append(test_8_publish_page())
    results.append(test_9_public_slug_and_unpublish())
    results.append(test_10_delete_page())
    
    # Cleanup
    cleanup()
    
    # Summary
    print(f"\n{'='*80}")
    print("TEST SUMMARY")
    print('='*80)
    passed = sum(results)
    total = len(results)
    print(f"Passed: {passed}/{total}")
    print(f"Failed: {total - passed}/{total}")
    
    if passed == total:
        print("\n✅ ALL TESTS PASSED")
        return 0
    else:
        print(f"\n❌ {total - passed} TEST(S) FAILED")
        return 1

if __name__ == "__main__":
    sys.exit(main())
