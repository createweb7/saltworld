#!/usr/bin/env python3
"""
Backend API tests for M3 (Referral System) and M4 (Loyalty Wallet)
Tests the new endpoints shipped in the M1-M4 sprint.
"""

import requests
import json
import re
from datetime import datetime

# Base URL from .env
BASE_URL = "https://saltwell-arch.preview.emergentagent.com/api"

# Admin credentials
ADMIN_EMAIL = "admin@saltworld.in"
ADMIN_PASSWORD = "SaltWorld@2025"

# Test state
admin_cookie = None
customer_cookie = None
customer_id = None
customer_phone = None
booking_id = None

def print_test(name, passed, details=""):
    """Print test result"""
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"{status}: {name}")
    if details:
        print(f"  → {details}")

def admin_login():
    """Login as admin and get session cookie"""
    global admin_cookie
    print("\n=== ADMIN LOGIN ===")
    try:
        resp = requests.post(
            f"{BASE_URL}/admin/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
            timeout=30
        )
        if resp.status_code == 200:
            admin_cookie = resp.cookies.get("sw_admin")
            print_test("Admin login", admin_cookie is not None, f"Got admin cookie")
            return True
        else:
            print_test("Admin login", False, f"Status {resp.status_code}: {resp.text[:200]}")
            return False
    except Exception as e:
        print_test("Admin login", False, f"Exception: {str(e)}")
        return False

def customer_otp_login():
    """Customer OTP login flow"""
    global customer_cookie, customer_id, customer_phone
    print("\n=== CUSTOMER OTP LOGIN ===")
    
    # Use a test phone number
    customer_phone = "919999900001"
    
    try:
        # Step 1: Request OTP
        print("Step 1: Request OTP...")
        resp = requests.post(
            f"{BASE_URL}/customer/auth/request-otp",
            json={"phone": customer_phone},
            timeout=30
        )
        
        if resp.status_code != 200:
            print_test("Request OTP", False, f"Status {resp.status_code}: {resp.text[:200]}")
            return False
        
        data = resp.json()
        print_test("Request OTP", True, f"Response: {json.dumps(data)[:200]}")
        
        # In dev mode, OTP is returned in response
        otp = data.get("devOtp") or data.get("otp")
        if not otp:
            print_test("Get OTP from response", False, "No OTP in response")
            return False
        
        print_test("Get OTP from response", True, f"OTP: {otp}")
        
        # Step 2: Verify OTP
        print("Step 2: Verify OTP...")
        resp = requests.post(
            f"{BASE_URL}/customer/auth/verify-otp",
            json={"phone": customer_phone, "otp": otp},
            timeout=30
        )
        
        if resp.status_code != 200:
            print_test("Verify OTP", False, f"Status {resp.status_code}: {resp.text[:200]}")
            return False
        
        data = resp.json()
        customer_cookie = resp.cookies.get("sw_customer")
        customer_id = data.get("customer", {}).get("id")
        
        print_test("Verify OTP", customer_cookie is not None and customer_id is not None, 
                   f"Got customer cookie and ID: {customer_id}")
        
        return customer_cookie is not None and customer_id is not None
        
    except Exception as e:
        print_test("Customer OTP login", False, f"Exception: {str(e)}")
        return False

def test_m3_referrals():
    """Test M3 Referral System endpoints"""
    print("\n" + "="*60)
    print("=== M3 REFERRAL SYSTEM TESTS ===")
    print("="*60)
    
    # R1: Customer referrals endpoint - first call (issue code)
    print("\n--- R1: GET /api/customer/referrals (with session) ---")
    try:
        resp = requests.get(
            f"{BASE_URL}/customer/referrals",
            cookies={"sw_customer": customer_cookie},
            timeout=30
        )
        
        if resp.status_code != 200:
            print_test("R1: Get customer referrals", False, f"Status {resp.status_code}: {resp.text[:200]}")
        else:
            data = resp.json()
            code = data.get("code", {}).get("code")
            referrals = data.get("referrals", [])
            total_earned = data.get("totalEarned", 0)
            revenue = data.get("revenue", 0)
            
            # Check code format: ^SW[A-Z0-9]{6}$
            code_valid = code and re.match(r'^SW[A-Z0-9]{6}$', code)
            
            print_test("R1: Code format valid", code_valid, f"Code: {code}")
            print_test("R1: Referrals array", isinstance(referrals, list), f"Referrals: {referrals}")
            print_test("R1: Total earned", total_earned == 0, f"Total earned: {total_earned}")
            print_test("R1: Revenue", revenue == 0, f"Revenue: {revenue}")
            
            # Store code for second call
            first_code = code
            
            # R1 continued: Second call - code should be unchanged (idempotent)
            print("\n--- R1 (continued): Second call - idempotent code ---")
            resp2 = requests.get(
                f"{BASE_URL}/customer/referrals",
                cookies={"sw_customer": customer_cookie},
                timeout=30
            )
            
            if resp2.status_code != 200:
                print_test("R1: Second call", False, f"Status {resp2.status_code}")
            else:
                data2 = resp2.json()
                second_code = data2.get("code", {}).get("code")
                print_test("R1: Code unchanged (idempotent)", first_code == second_code, 
                          f"First: {first_code}, Second: {second_code}")
    
    except Exception as e:
        print_test("R1: Get customer referrals", False, f"Exception: {str(e)}")
    
    # R2: Without session cookie - should return 401
    print("\n--- R2: GET /api/customer/referrals (without session) ---")
    try:
        resp = requests.get(
            f"{BASE_URL}/customer/referrals",
            timeout=30
        )
        
        is_401 = resp.status_code == 401
        has_error = resp.json().get("error") == "not_signed_in" if is_401 else False
        
        print_test("R2: Returns 401", is_401, f"Status: {resp.status_code}")
        print_test("R2: Error message", has_error, f"Error: {resp.json().get('error')}")
    
    except Exception as e:
        print_test("R2: Unauthenticated request", False, f"Exception: {str(e)}")
    
    # R3: Admin referrals stats
    print("\n--- R3: GET /api/admin/referrals/stats ---")
    try:
        resp = requests.get(
            f"{BASE_URL}/admin/referrals/stats",
            cookies={"sw_admin": admin_cookie},
            timeout=30
        )
        
        if resp.status_code != 200:
            print_test("R3: Get referral stats", False, f"Status {resp.status_code}: {resp.text[:200]}")
        else:
            data = resp.json()
            
            has_total_referrals = "totalReferrals" in data and isinstance(data["totalReferrals"], (int, float))
            has_total_revenue = "totalRevenue" in data and isinstance(data["totalRevenue"], (int, float))
            has_total_rewards = "totalRewards" in data and isinstance(data["totalRewards"], (int, float))
            has_conversion_rate = "conversionRate" in data and isinstance(data["conversionRate"], (int, float))
            has_top_referrers = "topReferrers" in data and isinstance(data["topReferrers"], list)
            
            print_test("R3: Has totalReferrals", has_total_referrals, f"Value: {data.get('totalReferrals')}")
            print_test("R3: Has totalRevenue", has_total_revenue, f"Value: {data.get('totalRevenue')}")
            print_test("R3: Has totalRewards", has_total_rewards, f"Value: {data.get('totalRewards')}")
            print_test("R3: Has conversionRate", has_conversion_rate, f"Value: {data.get('conversionRate')}")
            print_test("R3: Has topReferrers array", has_top_referrers, f"Count: {len(data.get('topReferrers', []))}")
    
    except Exception as e:
        print_test("R3: Get referral stats", False, f"Exception: {str(e)}")
    
    # R4: Admin get customer referrals
    print("\n--- R4: GET /api/admin/referrals/customer/:customerId ---")
    try:
        resp = requests.get(
            f"{BASE_URL}/admin/referrals/customer/{customer_id}",
            cookies={"sw_admin": admin_cookie},
            timeout=30
        )
        
        if resp.status_code != 200:
            print_test("R4: Get customer referrals (admin)", False, f"Status {resp.status_code}: {resp.text[:200]}")
        else:
            data = resp.json()
            code = data.get("code", {}).get("code") if data.get("code") else None
            referrals = data.get("referrals", [])
            
            has_code = code is not None
            has_referrals_array = isinstance(referrals, list)
            
            print_test("R4: Has code", has_code, f"Code: {code}")
            print_test("R4: Has referrals array", has_referrals_array, f"Count: {len(referrals)}")
    
    except Exception as e:
        print_test("R4: Get customer referrals (admin)", False, f"Exception: {str(e)}")

def test_m4_loyalty_wallet():
    """Test M4 Loyalty Wallet endpoints"""
    print("\n" + "="*60)
    print("=== M4 LOYALTY WALLET TESTS ===")
    print("="*60)
    
    # W1: Customer wallet - should be 0 initially
    print("\n--- W1: GET /api/customer/wallet ---")
    try:
        resp = requests.get(
            f"{BASE_URL}/customer/wallet",
            cookies={"sw_customer": customer_cookie},
            timeout=30
        )
        
        if resp.status_code != 200:
            print_test("W1: Get customer wallet", False, f"Status {resp.status_code}: {resp.text[:200]}")
        else:
            data = resp.json()
            balance = data.get("balance", -1)
            history = data.get("history", None)
            
            print_test("W1: Balance is 0", balance == 0, f"Balance: {balance}")
            print_test("W1: History is array", isinstance(history, list), f"History: {history}")
    
    except Exception as e:
        print_test("W1: Get customer wallet", False, f"Exception: {str(e)}")
    
    # W2: Admin adjust wallet - add 250 points
    print("\n--- W2: POST /api/admin/wallet/:customerId/adjust (add 250 points) ---")
    try:
        resp = requests.post(
            f"{BASE_URL}/admin/wallet/{customer_id}/adjust",
            json={"points": 250, "note": "test credit"},
            cookies={"sw_admin": admin_cookie},
            timeout=30
        )
        
        if resp.status_code != 200:
            print_test("W2: Adjust wallet +250", False, f"Status {resp.status_code}: {resp.text[:200]}")
        else:
            data = resp.json()
            
            tx_type = data.get("type")
            balance_after = data.get("balanceAfter")
            tx_id = data.get("id")
            created_at = data.get("createdAt")
            has_mongo_id = "_id" in data
            
            print_test("W2: Type is manual_adjustment", tx_type == "manual_adjustment", f"Type: {tx_type}")
            print_test("W2: Balance after is 250", balance_after == 250, f"Balance: {balance_after}")
            print_test("W2: Has UUID id", tx_id is not None and len(tx_id) == 36, f"ID: {tx_id}")
            print_test("W2: Has createdAt ISO string", created_at is not None, f"Created: {created_at}")
            print_test("W2: No _id field", not has_mongo_id, f"Has _id: {has_mongo_id}")
    
    except Exception as e:
        print_test("W2: Adjust wallet +250", False, f"Exception: {str(e)}")
    
    # W3: Customer wallet - should now be 250
    print("\n--- W3: GET /api/customer/wallet (after adjustment) ---")
    try:
        resp = requests.get(
            f"{BASE_URL}/customer/wallet",
            cookies={"sw_customer": customer_cookie},
            timeout=30
        )
        
        if resp.status_code != 200:
            print_test("W3: Get customer wallet", False, f"Status {resp.status_code}: {resp.text[:200]}")
        else:
            data = resp.json()
            balance = data.get("balance", -1)
            history = data.get("history", [])
            
            print_test("W3: Balance is 250", balance == 250, f"Balance: {balance}")
            print_test("W3: History has transaction", len(history) > 0, f"History count: {len(history)}")
            
            if len(history) > 0:
                tx = history[0]
                print_test("W3: Transaction type", tx.get("type") == "manual_adjustment", 
                          f"Type: {tx.get('type')}")
                print_test("W3: Transaction points", tx.get("points") == 250, 
                          f"Points: {tx.get('points')}")
    
    except Exception as e:
        print_test("W3: Get customer wallet", False, f"Exception: {str(e)}")
    
    # W4: Adjust with 0 points - should return 400
    print("\n--- W4: POST /api/admin/wallet/:customerId/adjust (0 points) ---")
    try:
        resp = requests.post(
            f"{BASE_URL}/admin/wallet/{customer_id}/adjust",
            json={"points": 0, "note": "zero"},
            cookies={"sw_admin": admin_cookie},
            timeout=30
        )
        
        is_400 = resp.status_code == 400
        has_error = resp.json().get("error") == "invalid_points" if is_400 else False
        
        print_test("W4: Returns 400", is_400, f"Status: {resp.status_code}")
        print_test("W4: Error is invalid_points", has_error, f"Error: {resp.json().get('error')}")
    
    except Exception as e:
        print_test("W4: Adjust with 0 points", False, f"Exception: {str(e)}")
    
    # W5: Over-debit - should error with insufficient_balance
    print("\n--- W5: POST /api/admin/wallet/:customerId/adjust (over-debit) ---")
    try:
        resp = requests.post(
            f"{BASE_URL}/admin/wallet/{customer_id}/adjust",
            json={"points": -999999, "note": "over-debit"},
            cookies={"sw_admin": admin_cookie},
            timeout=30
        )
        
        is_error = resp.status_code in [400, 500]
        error_text = resp.text.lower()
        has_insufficient = "insufficient" in error_text or "balance" in error_text
        
        print_test("W5: Returns error (400 or 500)", is_error, f"Status: {resp.status_code}")
        print_test("W5: Error mentions insufficient balance", has_insufficient, 
                  f"Error: {resp.text[:200]}")
        
        # Verify balance is still 250
        resp2 = requests.get(
            f"{BASE_URL}/customer/wallet",
            cookies={"sw_customer": customer_cookie},
            timeout=30
        )
        
        if resp2.status_code == 200:
            balance = resp2.json().get("balance", -1)
            print_test("W5: Balance unchanged (still 250)", balance == 250, f"Balance: {balance}")
    
    except Exception as e:
        print_test("W5: Over-debit test", False, f"Exception: {str(e)}")
    
    # W6: Admin get wallet history
    print("\n--- W6: GET /api/admin/wallet/:customerId/history ---")
    try:
        resp = requests.get(
            f"{BASE_URL}/admin/wallet/{customer_id}/history",
            cookies={"sw_admin": admin_cookie},
            timeout=30
        )
        
        if resp.status_code != 200:
            print_test("W6: Get wallet history", False, f"Status {resp.status_code}: {resp.text[:200]}")
        else:
            data = resp.json()
            is_array = isinstance(data, list)
            has_tx = len(data) > 0 if is_array else False
            
            print_test("W6: Returns array", is_array, f"Type: {type(data)}")
            print_test("W6: Contains +250 transaction", has_tx, f"Count: {len(data) if is_array else 0}")
            
            if has_tx:
                tx = data[0]
                print_test("W6: Transaction has correct points", tx.get("points") == 250, 
                          f"Points: {tx.get('points')}")
    
    except Exception as e:
        print_test("W6: Get wallet history", False, f"Exception: {str(e)}")
    
    # W7: Admin get wallet balance
    print("\n--- W7: GET /api/admin/wallet/:customerId/balance ---")
    try:
        resp = requests.get(
            f"{BASE_URL}/admin/wallet/{customer_id}/balance",
            cookies={"sw_admin": admin_cookie},
            timeout=30
        )
        
        if resp.status_code != 200:
            print_test("W7: Get wallet balance", False, f"Status {resp.status_code}: {resp.text[:200]}")
        else:
            data = resp.json()
            balance = data.get("balance", -1)
            
            print_test("W7: Balance is 250", balance == 250, f"Balance: {balance}")
    
    except Exception as e:
        print_test("W7: Get wallet balance", False, f"Exception: {str(e)}")

def test_regression_bookings():
    """Regression test: POST /api/bookings"""
    print("\n" + "="*60)
    print("=== REGRESSION SANITY: POST /api/bookings ===")
    print("="*60)
    
    try:
        payload = {
            "contact": {
                "name": "Loyalty Tester",
                "phone": "919999900001",
                "email": "test@example.com"
            },
            "outcomeSlug": "stress-relief",
            "outcomeLabel": "Stress Relief",
            "therapies": [
                {
                    "slug": "salt-therapy",
                    "label": "Halotherapy",
                    "durationMin": 45,
                    "price": 1499
                }
            ],
            "slotDate": "2025-12-31",
            "slotTime": "15:00",
            "total": 1499,
            "customerId": customer_id
        }
        
        resp = requests.post(
            f"{BASE_URL}/bookings",
            json=payload,
            timeout=30
        )
        
        if resp.status_code != 200:
            print_test("Regression: POST /api/bookings", False, 
                      f"Status {resp.status_code}: {resp.text[:200]}")
        else:
            data = resp.json()
            booking_id = data.get("id")
            booking_ref = data.get("ref")
            
            has_id = booking_id is not None
            has_ref = booking_ref is not None and booking_ref.startswith("SW-")
            
            print_test("Regression: Booking created", has_id and has_ref, 
                      f"ID: {booking_id}, Ref: {booking_ref}")
            print_test("Regression: Response structure", "status" in data, 
                      f"Status: {data.get('status')}")
    
    except Exception as e:
        print_test("Regression: POST /api/bookings", False, f"Exception: {str(e)}")

def main():
    """Run all tests"""
    print("\n" + "="*60)
    print("BACKEND API TESTS - M3 & M4")
    print("="*60)
    print(f"Base URL: {BASE_URL}")
    print(f"Admin: {ADMIN_EMAIL}")
    print("="*60)
    
    # Step 1: Admin login
    if not admin_login():
        print("\n❌ CRITICAL: Admin login failed. Cannot proceed with tests.")
        return
    
    # Step 2: Customer OTP login
    if not customer_otp_login():
        print("\n❌ CRITICAL: Customer OTP login failed. Cannot proceed with tests.")
        return
    
    # Step 3: Test M3 Referrals
    test_m3_referrals()
    
    # Step 4: Test M4 Loyalty Wallet
    test_m4_loyalty_wallet()
    
    # Step 5: Regression test
    test_regression_bookings()
    
    print("\n" + "="*60)
    print("ALL TESTS COMPLETED")
    print("="*60)

if __name__ == "__main__":
    main()
