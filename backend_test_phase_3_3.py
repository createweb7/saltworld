#!/usr/bin/env python3
"""
Salt World BOS Admin API - Phase 3.3 (Growth) Test Suite
Tests Marketing, CMS, Notifications, Settings, Resources, Integrations, and Users endpoints.
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

# Track created resources for cleanup
created_resources = {
    'announcements': [],
    'campaigns': [],
    'reviews': [],
    'testimonials': [],
    'media': [],
    'blog': [],
    'templates': [],
    'resources': [],
    'users': []
}

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

def login():
    """Login and establish session"""
    try:
        resp = session.post(f"{BASE_URL}/admin/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if resp.status_code == 200:
            print("✅ Logged in successfully")
            return True
        else:
            print(f"❌ Login failed: {resp.status_code}")
            return False
    except Exception as e:
        print(f"❌ Login error: {e}")
        return False

def test_marketing_crud():
    """Test Phase 3.3: Marketing CRUD (announcements, campaigns, reviews, testimonials)"""
    print("\n=== PHASE 3.3: MARKETING CRUD ===\n")
    
    # Test each marketing kind
    marketing_kinds = [
        ('announcements', {
            'body': 'Free float therapy session this month!',
            'kind': 'bar',
            'ctaLabel': 'Book Now',
            'ctaHref': '/book'
        }),
        ('campaigns', {
            'name': 'July Flash Sale',
            'status': 'draft',
            'startDate': '2025-07-01',
            'endDate': '2025-07-31'
        }),
        ('reviews', {
            'rating': 5,
            'body': 'Best float therapy experience ever! Highly recommend.',
            'author': 'Ravi Kumar'
        }),
        ('testimonials', {
            'body': 'Life-changing experience. The salt therapy helped my breathing immensely.',
            'author': 'Anita Desai'
        })
    ]
    
    for kind, create_data in marketing_kinds:
        # Test 1: GET list (may be empty)
        try:
            resp = session.get(f"{BASE_URL}/admin/marketing/{kind}")
            if resp.status_code == 200:
                data = resp.json()
                if isinstance(data, list):
                    log_test(f"Marketing: GET /{kind} returns array", True)
                else:
                    log_test(f"Marketing: GET /{kind} returns array", False, "Response not a list")
            else:
                log_test(f"Marketing: GET /{kind} returns array", False, f"Status {resp.status_code}")
        except Exception as e:
            log_test(f"Marketing: GET /{kind} returns array", False, str(e))
        
        # Test 2: POST create
        try:
            resp = session.post(f"{BASE_URL}/admin/marketing/{kind}", json=create_data)
            if resp.status_code == 200:
                data = resp.json()
                if "id" in data and data.get("active") == True and "createdAt" in data:
                    if "_id" not in data:
                        created_resources[kind].append(data["id"])
                        log_test(f"Marketing: POST /{kind} creates with UUID id and active=true", True)
                    else:
                        log_test(f"Marketing: POST /{kind} creates with UUID id and active=true", False, "Response contains _id")
                else:
                    log_test(f"Marketing: POST /{kind} creates with UUID id and active=true", False, f"Invalid data: {data}")
            else:
                log_test(f"Marketing: POST /{kind} creates with UUID id and active=true", False, f"Status {resp.status_code}: {resp.text}")
        except Exception as e:
            log_test(f"Marketing: POST /{kind} creates with UUID id and active=true", False, str(e))
        
        # Test 3: PATCH update
        if created_resources[kind]:
            try:
                item_id = created_resources[kind][0]
                resp = session.patch(f"{BASE_URL}/admin/marketing/{kind}/{item_id}", json={"active": False})
                if resp.status_code == 200:
                    data = resp.json()
                    if data.get("active") == False and "updatedAt" in data:
                        log_test(f"Marketing: PATCH /{kind}/:id updates active=false", True)
                    else:
                        log_test(f"Marketing: PATCH /{kind}/:id updates active=false", False, f"Active: {data.get('active')}")
                else:
                    log_test(f"Marketing: PATCH /{kind}/:id updates active=false", False, f"Status {resp.status_code}")
            except Exception as e:
                log_test(f"Marketing: PATCH /{kind}/:id updates active=false", False, str(e))
        
        # Test 4: DELETE
        if created_resources[kind]:
            try:
                item_id = created_resources[kind][0]
                resp = session.delete(f"{BASE_URL}/admin/marketing/{kind}/{item_id}")
                if resp.status_code == 200:
                    data = resp.json()
                    if data.get("ok"):
                        # Verify deletion - subsequent PATCH should 404
                        resp2 = session.patch(f"{BASE_URL}/admin/marketing/{kind}/{item_id}", json={"active": True})
                        if resp2.status_code == 404:
                            log_test(f"Marketing: DELETE /{kind}/:id removes item", True)
                            created_resources[kind].remove(item_id)
                        else:
                            log_test(f"Marketing: DELETE /{kind}/:id removes item", False, "Item still exists after delete")
                    else:
                        log_test(f"Marketing: DELETE /{kind}/:id removes item", False, "Response not ok")
                else:
                    log_test(f"Marketing: DELETE /{kind}/:id removes item", False, f"Status {resp.status_code}")
            except Exception as e:
                log_test(f"Marketing: DELETE /{kind}/:id removes item", False, str(e))
    
    # Test 5: Unknown marketing kind returns 404
    try:
        resp = session.get(f"{BASE_URL}/admin/marketing/nonsense")
        if resp.status_code == 404:
            data = resp.json()
            if data.get("error") == "unknown_marketing_kind":
                log_test("Marketing: Unknown kind returns 404 with unknown_marketing_kind", True)
            else:
                log_test("Marketing: Unknown kind returns 404 with unknown_marketing_kind", False, f"Wrong error: {data}")
        else:
            log_test("Marketing: Unknown kind returns 404 with unknown_marketing_kind", False, f"Status {resp.status_code}")
    except Exception as e:
        log_test("Marketing: Unknown kind returns 404 with unknown_marketing_kind", False, str(e))
    
    # Test 6: Verify activity log entries
    try:
        resp = session.get(f"{BASE_URL}/admin/activity")
        if resp.status_code == 200:
            data = resp.json()
            if isinstance(data, list) and len(data) > 0:
                # Check if recent marketing activities are logged
                marketing_actions = [a for a in data if any(k in a.get('action', '') for k in ['announcements', 'campaigns', 'reviews', 'testimonials'])]
                if len(marketing_actions) > 0:
                    log_test("Marketing: Activity log contains marketing write operations", True)
                else:
                    log_test("Marketing: Activity log contains marketing write operations", False, "No marketing activities found")
            else:
                log_test("Marketing: Activity log contains marketing write operations", False, "Activity log empty")
        else:
            log_test("Marketing: Activity log contains marketing write operations", False, f"Status {resp.status_code}")
    except Exception as e:
        log_test("Marketing: Activity log contains marketing write operations", False, str(e))

def test_cms_media():
    """Test Phase 3.3: CMS Media"""
    print("\n=== PHASE 3.3: CMS MEDIA ===\n")
    
    # Test 1: POST media with URL (JSON body)
    try:
        resp = session.post(f"{BASE_URL}/admin/cms/media", json={
            "url": "https://picsum.photos/300",
            "alt": "Demo image",
            "mime": "image/jpeg"
        })
        if resp.status_code == 200:
            data = resp.json()
            if "id" in data and data.get("storage") == "external" and data.get("url") == "https://picsum.photos/300":
                if "_id" not in data:
                    created_resources['media'].append(data["id"])
                    log_test("CMS Media: POST with URL registers external media", True)
                else:
                    log_test("CMS Media: POST with URL registers external media", False, "Response contains _id")
            else:
                log_test("CMS Media: POST with URL registers external media", False, f"Invalid data: {data}")
        else:
            log_test("CMS Media: POST with URL registers external media", False, f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        log_test("CMS Media: POST with URL registers external media", False, str(e))
    
    # Test 2: POST media without URL returns 400
    try:
        resp = session.post(f"{BASE_URL}/admin/cms/media", json={
            "alt": "No URL provided"
        })
        if resp.status_code == 400:
            data = resp.json()
            if data.get("error") == "url_required":
                log_test("CMS Media: POST without URL returns 400 url_required", True)
            else:
                log_test("CMS Media: POST without URL returns 400 url_required", False, f"Wrong error: {data}")
        else:
            log_test("CMS Media: POST without URL returns 400 url_required", False, f"Status {resp.status_code}")
    except Exception as e:
        log_test("CMS Media: POST without URL returns 400 url_required", False, str(e))
    
    # Test 3: GET media list
    try:
        resp = session.get(f"{BASE_URL}/admin/cms/media")
        if resp.status_code == 200:
            data = resp.json()
            if isinstance(data, list):
                found = any(m.get("id") in created_resources['media'] for m in data)
                if found:
                    log_test("CMS Media: GET /media returns array with created media", True)
                else:
                    log_test("CMS Media: GET /media returns array with created media", False, "Created media not found")
            else:
                log_test("CMS Media: GET /media returns array with created media", False, "Response not a list")
        else:
            log_test("CMS Media: GET /media returns array with created media", False, f"Status {resp.status_code}")
    except Exception as e:
        log_test("CMS Media: GET /media returns array with created media", False, str(e))
    
    # Test 4: DELETE media
    if created_resources['media']:
        try:
            media_id = created_resources['media'][0]
            resp = session.delete(f"{BASE_URL}/admin/cms/media/{media_id}")
            if resp.status_code == 200:
                data = resp.json()
                if data.get("ok"):
                    log_test("CMS Media: DELETE /media/:id removes media", True)
                    created_resources['media'].remove(media_id)
                else:
                    log_test("CMS Media: DELETE /media/:id removes media", False, "Response not ok")
            else:
                log_test("CMS Media: DELETE /media/:id removes media", False, f"Status {resp.status_code}")
        except Exception as e:
            log_test("CMS Media: DELETE /media/:id removes media", False, str(e))

def test_cms_blog():
    """Test Phase 3.3: CMS Blog"""
    print("\n=== PHASE 3.3: CMS BLOG ===\n")
    
    blog_id = None
    
    # Test 1: POST blog with title
    try:
        resp = session.post(f"{BASE_URL}/admin/cms/blog", json={
            "title": "Salt Therapy 101: Complete Guide",
            "body": "Salt therapy, also known as halotherapy, is a natural wellness treatment...",
            "category": "Wellness",
            "tags": ["salt", "wellness", "therapy"]
        })
        if resp.status_code == 200:
            data = resp.json()
            if "id" in data and data.get("title") == "Salt Therapy 101: Complete Guide":
                if "slug" in data and data.get("status") == "draft":
                    if "_id" not in data:
                        blog_id = data["id"]
                        created_resources['blog'].append(blog_id)
                        log_test("CMS Blog: POST creates blog with auto-generated slug and status=draft", True)
                    else:
                        log_test("CMS Blog: POST creates blog with auto-generated slug and status=draft", False, "Response contains _id")
                else:
                    log_test("CMS Blog: POST creates blog with auto-generated slug and status=draft", False, f"Missing slug or wrong status: {data}")
            else:
                log_test("CMS Blog: POST creates blog with auto-generated slug and status=draft", False, f"Invalid data: {data}")
        else:
            log_test("CMS Blog: POST creates blog with auto-generated slug and status=draft", False, f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        log_test("CMS Blog: POST creates blog with auto-generated slug and status=draft", False, str(e))
    
    # Test 2: POST blog without title returns 400
    try:
        resp = session.post(f"{BASE_URL}/admin/cms/blog", json={
            "body": "No title provided"
        })
        if resp.status_code == 400:
            data = resp.json()
            if data.get("error") == "title_required":
                log_test("CMS Blog: POST without title returns 400 title_required", True)
            else:
                log_test("CMS Blog: POST without title returns 400 title_required", False, f"Wrong error: {data}")
        else:
            log_test("CMS Blog: POST without title returns 400 title_required", False, f"Status {resp.status_code}")
    except Exception as e:
        log_test("CMS Blog: POST without title returns 400 title_required", False, str(e))
    
    # Test 3: GET blog list
    try:
        resp = session.get(f"{BASE_URL}/admin/cms/blog")
        if resp.status_code == 200:
            data = resp.json()
            if isinstance(data, list):
                found = any(b.get("id") == blog_id for b in data)
                if found:
                    log_test("CMS Blog: GET /blog returns array with created blog", True)
                else:
                    log_test("CMS Blog: GET /blog returns array with created blog", False, "Created blog not found")
            else:
                log_test("CMS Blog: GET /blog returns array with created blog", False, "Response not a list")
        else:
            log_test("CMS Blog: GET /blog returns array with created blog", False, f"Status {resp.status_code}")
    except Exception as e:
        log_test("CMS Blog: GET /blog returns array with created blog", False, str(e))
    
    # Test 4: GET blog by ID
    if blog_id:
        try:
            resp = session.get(f"{BASE_URL}/admin/cms/blog/{blog_id}")
            if resp.status_code == 200:
                data = resp.json()
                if data.get("id") == blog_id:
                    log_test("CMS Blog: GET /blog/:id returns blog document", True)
                else:
                    log_test("CMS Blog: GET /blog/:id returns blog document", False, f"Wrong blog ID: {data.get('id')}")
            else:
                log_test("CMS Blog: GET /blog/:id returns blog document", False, f"Status {resp.status_code}")
        except Exception as e:
            log_test("CMS Blog: GET /blog/:id returns blog document", False, str(e))
    
    # Test 5: PATCH blog to publish
    if blog_id:
        try:
            resp = session.patch(f"{BASE_URL}/admin/cms/blog/{blog_id}", json={
                "status": "published"
            })
            if resp.status_code == 200:
                data = resp.json()
                if data.get("status") == "published" and "updatedAt" in data:
                    log_test("CMS Blog: PATCH /blog/:id updates status to published", True)
                else:
                    log_test("CMS Blog: PATCH /blog/:id updates status to published", False, f"Status: {data.get('status')}")
            else:
                log_test("CMS Blog: PATCH /blog/:id updates status to published", False, f"Status {resp.status_code}")
        except Exception as e:
            log_test("CMS Blog: PATCH /blog/:id updates status to published", False, str(e))
    
    # Test 6: DELETE blog
    if blog_id:
        try:
            resp = session.delete(f"{BASE_URL}/admin/cms/blog/{blog_id}")
            if resp.status_code == 200:
                data = resp.json()
                if data.get("ok"):
                    log_test("CMS Blog: DELETE /blog/:id removes blog", True)
                    created_resources['blog'].remove(blog_id)
                else:
                    log_test("CMS Blog: DELETE /blog/:id removes blog", False, "Response not ok")
            else:
                log_test("CMS Blog: DELETE /blog/:id removes blog", False, f"Status {resp.status_code}")
        except Exception as e:
            log_test("CMS Blog: DELETE /blog/:id removes blog", False, str(e))

def test_notifications():
    """Test Phase 3.3: Notifications (templates + logs + send)"""
    print("\n=== PHASE 3.3: NOTIFICATIONS ===\n")
    
    template_id = None
    
    # Test 1: POST template with key and channel
    try:
        resp = session.post(f"{BASE_URL}/admin/notifications/templates", json={
            "key": "booking_confirmation",
            "channel": "email",
            "subject": "Your booking is confirmed",
            "body": "Hi {{name}}, your booking for {{therapy}} on {{date}} is confirmed.",
            "variables": ["name", "therapy", "date"]
        })
        if resp.status_code == 200:
            data = resp.json()
            if "id" in data and data.get("key") == "booking_confirmation" and data.get("active") == True:
                if "_id" not in data:
                    template_id = data["id"]
                    created_resources['templates'].append(template_id)
                    log_test("Notifications: POST /templates creates with key and active=true", True)
                else:
                    log_test("Notifications: POST /templates creates with key and active=true", False, "Response contains _id")
            else:
                log_test("Notifications: POST /templates creates with key and active=true", False, f"Invalid data: {data}")
        else:
            log_test("Notifications: POST /templates creates with key and active=true", False, f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        log_test("Notifications: POST /templates creates with key and active=true", False, str(e))
    
    # Test 2: POST template without key or channel returns 400
    try:
        resp = session.post(f"{BASE_URL}/admin/notifications/templates", json={
            "subject": "Missing key and channel"
        })
        if resp.status_code == 400:
            data = resp.json()
            if data.get("error") == "key_channel_required":
                log_test("Notifications: POST /templates without key/channel returns 400", True)
            else:
                log_test("Notifications: POST /templates without key/channel returns 400", False, f"Wrong error: {data}")
        else:
            log_test("Notifications: POST /templates without key/channel returns 400", False, f"Status {resp.status_code}")
    except Exception as e:
        log_test("Notifications: POST /templates without key/channel returns 400", False, str(e))
    
    # Test 3: GET templates list
    try:
        resp = session.get(f"{BASE_URL}/admin/notifications/templates")
        if resp.status_code == 200:
            data = resp.json()
            if isinstance(data, list):
                found = any(t.get("id") == template_id for t in data)
                if found:
                    log_test("Notifications: GET /templates returns array with created template", True)
                else:
                    log_test("Notifications: GET /templates returns array with created template", False, "Created template not found")
            else:
                log_test("Notifications: GET /templates returns array with created template", False, "Response not a list")
        else:
            log_test("Notifications: GET /templates returns array with created template", False, f"Status {resp.status_code}")
    except Exception as e:
        log_test("Notifications: GET /templates returns array with created template", False, str(e))
    
    # Test 4: PATCH template to deactivate
    if template_id:
        try:
            resp = session.patch(f"{BASE_URL}/admin/notifications/templates/{template_id}", json={
                "active": False
            })
            if resp.status_code == 200:
                data = resp.json()
                if data.get("active") == False:
                    log_test("Notifications: PATCH /templates/:id updates active=false", True)
                else:
                    log_test("Notifications: PATCH /templates/:id updates active=false", False, f"Active: {data.get('active')}")
            else:
                log_test("Notifications: PATCH /templates/:id updates active=false", False, f"Status {resp.status_code}")
        except Exception as e:
            log_test("Notifications: PATCH /templates/:id updates active=false", False, str(e))
    
    # Test 5: POST send notification (queued)
    try:
        resp = session.post(f"{BASE_URL}/admin/notifications/send", json={
            "channel": "whatsapp",
            "templateId": template_id or "booking_confirmation",
            "payload": {
                "name": "Ravi Kumar",
                "therapy": "Float Therapy",
                "date": "2025-07-15"
            }
        })
        if resp.status_code == 200:
            data = resp.json()
            if "id" in data and data.get("status") == "queued":
                log_test("Notifications: POST /send queues message with status=queued", True)
            else:
                log_test("Notifications: POST /send queues message with status=queued", False, f"Status: {data.get('status')}")
        else:
            log_test("Notifications: POST /send queues message with status=queued", False, f"Status {resp.status_code}")
    except Exception as e:
        log_test("Notifications: POST /send queues message with status=queued", False, str(e))
    
    # Test 6: GET logs returns array with queued send
    try:
        resp = session.get(f"{BASE_URL}/admin/notifications/logs")
        if resp.status_code == 200:
            data = resp.json()
            if isinstance(data, list):
                queued = [c for c in data if c.get("status") == "queued"]
                if len(queued) > 0:
                    log_test("Notifications: GET /logs returns array with queued communications", True)
                else:
                    log_test("Notifications: GET /logs returns array with queued communications", False, "No queued communications found")
            else:
                log_test("Notifications: GET /logs returns array with queued communications", False, "Response not a list")
        else:
            log_test("Notifications: GET /logs returns array with queued communications", False, f"Status {resp.status_code}")
    except Exception as e:
        log_test("Notifications: GET /logs returns array with queued communications", False, str(e))
    
    # Test 7: DELETE template
    if template_id:
        try:
            resp = session.delete(f"{BASE_URL}/admin/notifications/templates/{template_id}")
            if resp.status_code == 200:
                data = resp.json()
                if data.get("ok"):
                    log_test("Notifications: DELETE /templates/:id removes template", True)
                    created_resources['templates'].remove(template_id)
                else:
                    log_test("Notifications: DELETE /templates/:id removes template", False, "Response not ok")
            else:
                log_test("Notifications: DELETE /templates/:id removes template", False, f"Status {resp.status_code}")
        except Exception as e:
            log_test("Notifications: DELETE /templates/:id removes template", False, str(e))

def test_settings():
    """Test Phase 3.3: Settings (business, taxes, brand)"""
    print("\n=== PHASE 3.3: SETTINGS ===\n")
    
    # Test 1: PUT business settings
    try:
        resp = session.put(f"{BASE_URL}/admin/settings/business", json={
            "hours": {
                "monday": {"open": True, "from": "06:00", "to": "21:00"},
                "tuesday": {"open": True, "from": "06:00", "to": "21:00"}
            },
            "phone": "+91-80-1234-5678",
            "email": "hello@saltworld.in"
        })
        if resp.status_code == 200:
            data = resp.json()
            if data.get("ok") and data.get("key") == "business":
                log_test("Settings: PUT /settings/business upserts value", True)
            else:
                log_test("Settings: PUT /settings/business upserts value", False, f"Invalid response: {data}")
        else:
            log_test("Settings: PUT /settings/business upserts value", False, f"Status {resp.status_code}")
    except Exception as e:
        log_test("Settings: PUT /settings/business upserts value", False, str(e))
    
    # Test 2: GET business settings
    try:
        resp = session.get(f"{BASE_URL}/admin/settings/business")
        if resp.status_code == 200:
            data = resp.json()
            if "hours" in data and "monday" in data["hours"]:
                log_test("Settings: GET /settings/business returns value with hours", True)
            else:
                log_test("Settings: GET /settings/business returns value with hours", False, f"Invalid data: {data}")
        else:
            log_test("Settings: GET /settings/business returns value with hours", False, f"Status {resp.status_code}")
    except Exception as e:
        log_test("Settings: GET /settings/business returns value with hours", False, str(e))
    
    # Test 3: PUT taxes settings
    try:
        resp = session.put(f"{BASE_URL}/admin/settings/taxes", json={
            "gstRate": 18,
            "cgstRate": 9,
            "sgstRate": 9,
            "gstin": "29ABCDE1234F1Z5",
            "hsnServices": "999722"
        })
        if resp.status_code == 200:
            data = resp.json()
            if data.get("ok") and data.get("key") == "taxes":
                log_test("Settings: PUT /settings/taxes upserts value", True)
            else:
                log_test("Settings: PUT /settings/taxes upserts value", False, f"Invalid response: {data}")
        else:
            log_test("Settings: PUT /settings/taxes upserts value", False, f"Status {resp.status_code}")
    except Exception as e:
        log_test("Settings: PUT /settings/taxes upserts value", False, str(e))
    
    # Test 4: GET all settings
    try:
        resp = session.get(f"{BASE_URL}/admin/settings")
        if resp.status_code == 200:
            data = resp.json()
            if "business" in data and "taxes" in data:
                log_test("Settings: GET /settings returns object with business and taxes keys", True)
            else:
                log_test("Settings: GET /settings returns object with business and taxes keys", False, f"Missing keys: {data.keys()}")
        else:
            log_test("Settings: GET /settings returns object with business and taxes keys", False, f"Status {resp.status_code}")
    except Exception as e:
        log_test("Settings: GET /settings returns object with business and taxes keys", False, str(e))

def test_resources():
    """Test Phase 3.3: Resources (rooms/equipment)"""
    print("\n=== PHASE 3.3: RESOURCES ===\n")
    
    resource_id = None
    
    # Test 1: POST resource with name and type
    try:
        resp = session.post(f"{BASE_URL}/admin/resources", json={
            "name": "Float Tank 3",
            "type": "float_tank",
            "capacity": 1
        })
        if resp.status_code == 200:
            data = resp.json()
            if "id" in data and data.get("name") == "Float Tank 3" and data.get("type") == "float_tank":
                if "_id" not in data:
                    resource_id = data["id"]
                    created_resources['resources'].append(resource_id)
                    log_test("Resources: POST /resources creates with name and type", True)
                else:
                    log_test("Resources: POST /resources creates with name and type", False, "Response contains _id")
            else:
                log_test("Resources: POST /resources creates with name and type", False, f"Invalid data: {data}")
        else:
            log_test("Resources: POST /resources creates with name and type", False, f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        log_test("Resources: POST /resources creates with name and type", False, str(e))
    
    # Test 2: POST resource without name returns 400
    try:
        resp = session.post(f"{BASE_URL}/admin/resources", json={
            "type": "float_tank"
        })
        if resp.status_code == 400:
            data = resp.json()
            if data.get("error") == "name_type_required":
                log_test("Resources: POST without name returns 400 name_type_required", True)
            else:
                log_test("Resources: POST without name returns 400 name_type_required", False, f"Wrong error: {data}")
        else:
            log_test("Resources: POST without name returns 400 name_type_required", False, f"Status {resp.status_code}")
    except Exception as e:
        log_test("Resources: POST without name returns 400 name_type_required", False, str(e))
    
    # Test 3: GET resources list
    try:
        resp = session.get(f"{BASE_URL}/admin/resources")
        if resp.status_code == 200:
            data = resp.json()
            if isinstance(data, list):
                found = any(r.get("id") == resource_id for r in data)
                if found:
                    log_test("Resources: GET /resources returns array with created resource", True)
                else:
                    log_test("Resources: GET /resources returns array with created resource", False, "Created resource not found")
            else:
                log_test("Resources: GET /resources returns array with created resource", False, "Response not a list")
        else:
            log_test("Resources: GET /resources returns array with created resource", False, f"Status {resp.status_code}")
    except Exception as e:
        log_test("Resources: GET /resources returns array with created resource", False, str(e))
    
    # Test 4: DELETE resource
    if resource_id:
        try:
            resp = session.delete(f"{BASE_URL}/admin/resources/{resource_id}")
            if resp.status_code == 200:
                data = resp.json()
                if data.get("ok"):
                    log_test("Resources: DELETE /resources/:id removes resource", True)
                    created_resources['resources'].remove(resource_id)
                else:
                    log_test("Resources: DELETE /resources/:id removes resource", False, "Response not ok")
            else:
                log_test("Resources: DELETE /resources/:id removes resource", False, f"Status {resp.status_code}")
        except Exception as e:
            log_test("Resources: DELETE /resources/:id removes resource", False, str(e))

def test_integrations():
    """Test Phase 3.3: Integrations (API keys with masking)"""
    print("\n=== PHASE 3.3: INTEGRATIONS ===\n")
    
    # Test 1: PUT integration (super_admin only)
    try:
        resp = session.put(f"{BASE_URL}/admin/integrations/razorpay", json={
            "keyId": "rzp_test_1234567890",
            "keySecret": "secret_key_abcdefghijklmnop",
            "webhookSecret": "whsec_test123456"
        })
        if resp.status_code == 200:
            data = resp.json()
            if data.get("ok") and data.get("key") == "razorpay":
                log_test("Integrations: PUT /integrations/:key stores config (super_admin)", True)
            else:
                log_test("Integrations: PUT /integrations/:key stores config (super_admin)", False, f"Invalid response: {data}")
        else:
            log_test("Integrations: PUT /integrations/:key stores config (super_admin)", False, f"Status {resp.status_code}")
    except Exception as e:
        log_test("Integrations: PUT /integrations/:key stores config (super_admin)", False, str(e))
    
    # Test 2: GET integrations with masked secrets
    try:
        resp = session.get(f"{BASE_URL}/admin/integrations")
        if resp.status_code == 200:
            data = resp.json()
            if isinstance(data, list):
                razorpay = next((i for i in data if i.get("key") == "razorpay"), None)
                if razorpay:
                    config = razorpay.get("config", {})
                    # Check if secrets are masked (contain bullet characters)
                    has_bullets = any('\u2022' in str(v) for v in config.values() if isinstance(v, str))
                    has_configured_flag = "configured" in razorpay
                    if has_bullets and has_configured_flag:
                        log_test("Integrations: GET /integrations returns masked secrets and configured flag", True)
                    else:
                        log_test("Integrations: GET /integrations returns masked secrets and configured flag", False, 
                                f"Bullets: {has_bullets}, Configured: {has_configured_flag}")
                else:
                    log_test("Integrations: GET /integrations returns masked secrets and configured flag", False, "Razorpay not found")
            else:
                log_test("Integrations: GET /integrations returns masked secrets and configured flag", False, "Response not a list")
        else:
            log_test("Integrations: GET /integrations returns masked secrets and configured flag", False, f"Status {resp.status_code}")
    except Exception as e:
        log_test("Integrations: GET /integrations returns masked secrets and configured flag", False, str(e))

def test_users():
    """Test Phase 3.3: Users (super_admin only)"""
    print("\n=== PHASE 3.3: USERS ===\n")
    
    user_id = None
    
    # Test 1: GET users list (super_admin only)
    try:
        resp = session.get(f"{BASE_URL}/admin/users")
        if resp.status_code == 200:
            data = resp.json()
            if isinstance(data, list):
                # Check that no user has passwordHash or _id
                has_sensitive = any("passwordHash" in u or "_id" in u for u in data)
                if not has_sensitive:
                    log_test("Users: GET /users returns array without passwordHash or _id", True)
                else:
                    log_test("Users: GET /users returns array without passwordHash or _id", False, "Sensitive fields present")
            else:
                log_test("Users: GET /users returns array without passwordHash or _id", False, "Response not a list")
        else:
            log_test("Users: GET /users returns array without passwordHash or _id", False, f"Status {resp.status_code}")
    except Exception as e:
        log_test("Users: GET /users returns array without passwordHash or _id", False, str(e))
    
    # Test 2: POST create staff user
    try:
        # Use timestamp to ensure unique email
        import time
        unique_email = f"test.reception.{int(time.time())}@saltworld.in"
        resp = session.post(f"{BASE_URL}/admin/users", json={
            "name": "Test Reception Staff",
            "email": unique_email,
            "role": "reception",
            "password": "ReceptionPass123"
        })
        if resp.status_code == 200:
            data = resp.json()
            if "id" in data and data.get("email") == unique_email:
                if "passwordHash" not in data and "_id" not in data:
                    user_id = data["id"]
                    created_resources['users'].append(user_id)
                    log_test("Users: POST /users creates staff without passwordHash or _id in response", True)
                else:
                    log_test("Users: POST /users creates staff without passwordHash or _id in response", False, "Sensitive fields in response")
            else:
                log_test("Users: POST /users creates staff without passwordHash or _id in response", False, f"Invalid data: {data}")
        else:
            log_test("Users: POST /users creates staff without passwordHash or _id in response", False, f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        log_test("Users: POST /users creates staff without passwordHash or _id in response", False, str(e))

def test_regression_health():
    """Test Regression: Health endpoint still works"""
    print("\n=== REGRESSION: HEALTH CHECK ===\n")
    
    try:
        resp = requests.get(f"{BASE_URL}/health")
        if resp.status_code == 200:
            data = resp.json()
            if data.get("ok"):
                log_test("Regression: GET /health returns {ok: true}", True)
            else:
                log_test("Regression: GET /health returns {ok: true}", False, f"Invalid response: {data}")
        else:
            log_test("Regression: GET /health returns {ok: true}", False, f"Status {resp.status_code}")
    except Exception as e:
        log_test("Regression: GET /health returns {ok: true}", False, str(e))

def cleanup():
    """Clean up created resources"""
    print("\n=== CLEANUP ===\n")
    
    # Clean up marketing items
    for kind in ['announcements', 'campaigns', 'reviews', 'testimonials']:
        for item_id in created_resources[kind]:
            try:
                session.delete(f"{BASE_URL}/admin/marketing/{kind}/{item_id}")
                print(f"✅ Deleted {kind} {item_id}")
            except:
                print(f"⚠️  Failed to delete {kind} {item_id}")
    
    # Clean up media
    for media_id in created_resources['media']:
        try:
            session.delete(f"{BASE_URL}/admin/cms/media/{media_id}")
            print(f"✅ Deleted media {media_id}")
        except:
            print(f"⚠️  Failed to delete media {media_id}")
    
    # Clean up blog
    for blog_id in created_resources['blog']:
        try:
            session.delete(f"{BASE_URL}/admin/cms/blog/{blog_id}")
            print(f"✅ Deleted blog {blog_id}")
        except:
            print(f"⚠️  Failed to delete blog {blog_id}")
    
    # Clean up templates
    for template_id in created_resources['templates']:
        try:
            session.delete(f"{BASE_URL}/admin/notifications/templates/{template_id}")
            print(f"✅ Deleted template {template_id}")
        except:
            print(f"⚠️  Failed to delete template {template_id}")
    
    # Clean up resources
    for resource_id in created_resources['resources']:
        try:
            session.delete(f"{BASE_URL}/admin/resources/{resource_id}")
            print(f"✅ Deleted resource {resource_id}")
        except:
            print(f"⚠️  Failed to delete resource {resource_id}")
    
    # Note: We don't delete users as they might be needed for other tests
    if created_resources['users']:
        print(f"⚠️  Created {len(created_resources['users'])} test user(s) - not auto-deleted")

def main():
    print("=" * 80)
    print("SALT WORLD BOS ADMIN API - PHASE 3.3 (GROWTH) TEST SUITE")
    print("=" * 80)
    
    # Login first
    if not login():
        print("\n❌ Login failed. Cannot proceed with tests.")
        return False
    
    # Run all test suites
    test_marketing_crud()
    test_cms_media()
    test_cms_blog()
    test_notifications()
    test_settings()
    test_resources()
    test_integrations()
    test_users()
    test_regression_health()
    
    # Cleanup
    cleanup()
    
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
