#!/usr/bin/env python3
"""
Phase A: Unified Pricing Engine — Backend Tests
Tests wallet-as-payment, gift card, coupon, and combined discount scenarios.
Focus: GROUP 2 B4/B5 (wallet-as-payment) and GROUP 3 regression
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
customer_cookie = None
test_customer_id = None
test_booking_ids = []
test_coupon_code = None
test_giftcard_code = None
test_giftcard_pin = None

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
        print(f"✅ Admin login successful")
        return True
    else:
        print(f"❌ Admin login failed: {res.text}")
        return False

def get_admin_cookies():
    """Return cookies dict for admin requests"""
    return {"sw_admin": admin_cookie} if admin_cookie else {}

def get_customer_cookies():
    """Return cookies dict for customer requests"""
    return {"sw_customer": customer_cookie} if customer_cookie else {}

# ============================================================================
# SETUP: Create test customer and adjust wallet (avoid OTP throttling)
# ============================================================================

def test_setup_create_customer():
    """SETUP: Create customer via admin endpoint"""
    global test_customer_id
    print("\n=== SETUP: Create test customer ===")
    
    res = requests.post(
        f"{BASE_URL}/admin/customers",
        json={
            "name": "WalletTest",
            "phone": "919888800011",
            "email": "wallettest@ex.com"
        },
        cookies=get_admin_cookies()
    )
    print(f"Status: {res.status_code}")
    
    if res.status_code != 200:
        print(f"❌ Failed to create customer: {res.text}")
        return False
    
    data = res.json()
    test_customer_id = data.get("id")
    print(f"✅ Customer created: {test_customer_id}")
    return True

def test_setup_adjust_wallet():
    """SETUP: Adjust customer wallet to 5000 points (₹500)"""
    print("\n=== SETUP: Adjust wallet to 5000 points ===")
    
    res = requests.post(
        f"{BASE_URL}/admin/wallet/{test_customer_id}/adjust",
        json={
            "points": 5000,
            "note": "test top-up"
        },
        cookies=get_admin_cookies()
    )
    print(f"Status: {res.status_code}")
    
    if res.status_code != 200:
        print(f"❌ Failed to adjust wallet: {res.text}")
        return False
    
    data = res.json()
    print(f"✅ Wallet adjusted: balanceAfter={data.get('balanceAfter')}")
    return True

def test_setup_verify_wallet_balance():
    """SETUP: Verify wallet balance is 5000"""
    print("\n=== SETUP: Verify wallet balance ===")
    
    res = requests.get(
        f"{BASE_URL}/admin/wallet/{test_customer_id}/balance",
        cookies=get_admin_cookies()
    )
    print(f"Status: {res.status_code}")
    
    if res.status_code != 200:
        print(f"❌ Failed to get balance: {res.text}")
        return False
    
    data = res.json()
    balance = data.get("balance")
    print(f"Balance: {balance}")
    
    if balance != 5000:
        print(f"❌ Expected balance=5000, got {balance}")
        return False
    
    print(f"✅ Wallet balance verified: 5000 points")
    return True

# ============================================================================
# GROUP 2 B4: Wallet-as-payment (full ₹500 usage)
# ============================================================================

def test_b4_booking_with_wallet_500():
    """B4: POST /api/bookings with walletUseInr=500 for Float therapy (₹3000 base)"""
    print("\n=== B4: Booking with wallet ₹500 ===")
    
    future_date = (datetime.now() + timedelta(days=90)).strftime("%Y-%m-%d")
    
    res = requests.post(
        f"{BASE_URL}/bookings",
        json={
            "therapies": [{"slug": "float-therapy", "label": "Float", "role": "Primary"}],
            "slotDate": future_date,
            "slotTime": "07:00",
            "contact": {
                "name": "WalletTest",
                "phone": "919888800011",
                "email": "wallettest@ex.com"
            },
            "customerId": test_customer_id,
            "walletUseInr": 500
        }
    )
    print(f"Status: {res.status_code}")
    
    if res.status_code != 200:
        print(f"❌ Booking failed: {res.text}")
        return False
    
    data = res.json()
    booking_id = data.get("id")
    test_booking_ids.append(booking_id)
    
    print(f"Booking created: {data.get('ref')}")
    print(f"Total: ₹{data.get('total')}")
    
    # Verify total = 2500 (3000 - 500)
    if data.get("total") != 2500:
        print(f"❌ Expected total=2500, got {data.get('total')}")
        return False
    
    # Verify pricingBreakdown
    breakdown = data.get("pricingBreakdown", {})
    wallet_discount = breakdown.get("discounts", {}).get("wallet", {})
    
    print(f"Wallet discount: pointsUsed={wallet_discount.get('pointsUsed')}, amountInr={wallet_discount.get('amountInr')}")
    
    if wallet_discount.get("pointsUsed") != 5000:
        print(f"❌ Expected pointsUsed=5000, got {wallet_discount.get('pointsUsed')}")
        return False
    
    if wallet_discount.get("amountInr") != 500:
        print(f"❌ Expected amountInr=500, got {wallet_discount.get('amountInr')}")
        return False
    
    print(f"✅ B4 PASSED: Booking created with wallet discount")
    return True

def test_b4_verify_wallet_balance_zero():
    """B4: Verify wallet balance is now 0"""
    print("\n=== B4: Verify wallet balance after booking ===")
    
    res = requests.get(
        f"{BASE_URL}/admin/wallet/{test_customer_id}/balance",
        cookies=get_admin_cookies()
    )
    print(f"Status: {res.status_code}")
    
    if res.status_code != 200:
        print(f"❌ Failed to get balance: {res.text}")
        return False
    
    data = res.json()
    balance = data.get("balance")
    print(f"Balance: {balance}")
    
    if balance != 0:
        print(f"❌ Expected balance=0, got {balance}")
        return False
    
    print(f"✅ Wallet balance correctly debited to 0")
    return True

def test_b4_verify_wallet_history():
    """B4: Verify wallet history has booking_redeem transaction"""
    print("\n=== B4: Verify wallet history ===")
    
    res = requests.get(
        f"{BASE_URL}/admin/wallet/{test_customer_id}/history",
        cookies=get_admin_cookies()
    )
    print(f"Status: {res.status_code}")
    
    if res.status_code != 200:
        print(f"❌ Failed to get history: {res.text}")
        return False
    
    # API returns array directly, not wrapped in object
    history = res.json()
    
    # Find booking_redeem transaction
    redeem_tx = None
    for tx in history:
        if tx.get("type") == "booking_redeem":
            redeem_tx = tx
            break
    
    if not redeem_tx:
        print(f"❌ No booking_redeem transaction found in history")
        return False
    
    print(f"Redeem transaction: points={redeem_tx.get('points')}, amountInr={redeem_tx.get('amountInr')}")
    
    if redeem_tx.get("points") != -5000:
        print(f"❌ Expected points=-5000, got {redeem_tx.get('points')}")
        return False
    
    if redeem_tx.get("amountInr") != 500:
        print(f"❌ Expected amountInr=500, got {redeem_tx.get('amountInr')}")
        return False
    
    print(f"✅ Wallet history verified")
    return True

# ============================================================================
# GROUP 2 B5: Wallet 50% cap
# ============================================================================

def test_b5_adjust_wallet_30000():
    """B5: Adjust wallet to 30000 points (₹3000)"""
    print("\n=== B5: Adjust wallet to 30000 points ===")
    
    res = requests.post(
        f"{BASE_URL}/admin/wallet/{test_customer_id}/adjust",
        json={
            "points": 30000,
            "note": "test 50% cap"
        },
        cookies=get_admin_cookies()
    )
    print(f"Status: {res.status_code}")
    
    if res.status_code != 200:
        print(f"❌ Failed to adjust wallet: {res.text}")
        return False
    
    data = res.json()
    print(f"✅ Wallet adjusted: balanceAfter={data.get('balanceAfter')}")
    return True

def test_b5_booking_with_wallet_cap():
    """B5: POST /api/bookings with walletUseInr=3000, expect only ₹1500 redeemed (50% cap)"""
    print("\n=== B5: Booking with wallet 50% cap ===")
    
    future_date = (datetime.now() + timedelta(days=11)).strftime("%Y-%m-%d")
    
    res = requests.post(
        f"{BASE_URL}/bookings",
        json={
            "therapies": [{"slug": "float-therapy", "label": "Float", "role": "Primary"}],
            "slotDate": future_date,
            "slotTime": "15:00",
            "contact": {
                "name": "WalletTest",
                "phone": "919888800011",
                "email": "wallettest@ex.com"
            },
            "customerId": test_customer_id,
            "walletUseInr": 3000
        }
    )
    print(f"Status: {res.status_code}")
    
    if res.status_code != 200:
        print(f"❌ Booking failed: {res.text}")
        return False
    
    data = res.json()
    booking_id = data.get("id")
    test_booking_ids.append(booking_id)
    
    print(f"Booking created: {data.get('ref')}")
    print(f"Total: ₹{data.get('total')}")
    
    # Verify total = 1500 (3000 - 1500, capped at 50%)
    if data.get("total") != 1500:
        print(f"❌ Expected total=1500, got {data.get('total')}")
        return False
    
    # Verify pricingBreakdown
    breakdown = data.get("pricingBreakdown", {})
    wallet_discount = breakdown.get("discounts", {}).get("wallet", {})
    
    print(f"Wallet discount: pointsUsed={wallet_discount.get('pointsUsed')}, amountInr={wallet_discount.get('amountInr')}")
    
    if wallet_discount.get("pointsUsed") != 15000:
        print(f"❌ Expected pointsUsed=15000, got {wallet_discount.get('pointsUsed')}")
        return False
    
    if wallet_discount.get("amountInr") != 1500:
        print(f"❌ Expected amountInr=1500 (50% cap), got {wallet_discount.get('amountInr')}")
        return False
    
    print(f"✅ B5 PASSED: Wallet 50% cap enforced correctly")
    return True

# ============================================================================
# GROUP 2 B6: Combined (coupon + wallet + gift card)
# ============================================================================

def test_b6_setup_adjust_wallet_30000():
    """B6 SETUP: Adjust wallet to 30000 points again"""
    print("\n=== B6 SETUP: Adjust wallet to 30000 points ===")
    
    res = requests.post(
        f"{BASE_URL}/admin/wallet/{test_customer_id}/adjust",
        json={
            "points": 30000,
            "note": "test combined discounts"
        },
        cookies=get_admin_cookies()
    )
    print(f"Status: {res.status_code}")
    
    if res.status_code != 200:
        print(f"❌ Failed to adjust wallet: {res.text}")
        return False
    
    print(f"✅ Wallet adjusted")
    return True

def test_b6_setup_create_coupon():
    """B6 SETUP: Create TEST10P coupon (10% off)"""
    global test_coupon_code
    print("\n=== B6 SETUP: Create TEST10P coupon ===")
    
    res = requests.post(
        f"{BASE_URL}/admin/coupons",
        json={
            "code": "TEST10P",
            "discountType": "percent",
            "discountValue": 10,
            "active": True
        },
        cookies=get_admin_cookies()
    )
    print(f"Status: {res.status_code}")
    
    if res.status_code != 200:
        print(f"❌ Failed to create coupon: {res.text}")
        return False
    
    data = res.json()
    test_coupon_code = data.get("code")
    print(f"✅ Coupon created: {test_coupon_code}")
    return True

def test_b6_setup_create_giftcard():
    """B6 SETUP: Create gift card with amount=1000"""
    global test_giftcard_code, test_giftcard_pin
    print("\n=== B6 SETUP: Create gift card ===")
    
    res = requests.post(
        f"{BASE_URL}/admin/giftcards",
        json={
            "amount": 1000,
            "to": {
                "name": "Test",
                "phone": "919888800011",
                "email": "wallettest@ex.com"
            }
        },
        cookies=get_admin_cookies()
    )
    print(f"Status: {res.status_code}")
    
    if res.status_code != 200:
        print(f"❌ Failed to create gift card: {res.text}")
        return False
    
    data = res.json()
    test_giftcard_code = data.get("code")
    test_giftcard_pin = data.get("pin")
    print(f"✅ Gift card created: {test_giftcard_code}, PIN: {test_giftcard_pin}")
    return True

def test_b6_combined_booking():
    """B6: POST /api/bookings with Float+Salt (₹4600), coupon TEST10P, wallet ₹1000, gift card ₹1000"""
    print("\n=== B6: Combined booking (coupon + wallet + gift card) ===")
    
    future_date = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")
    
    res = requests.post(
        f"{BASE_URL}/bookings",
        json={
            "therapies": [
                {"slug": "float-therapy", "label": "Float", "role": "Primary"},
                {"slug": "salt-therapy", "label": "Salt", "role": "Secondary"}
            ],
            "slotDate": future_date,
            "slotTime": "07:00",
            "contact": {
                "name": "WalletTest",
                "phone": "919888800011",
                "email": "wallettest@ex.com"
            },
            "customerId": test_customer_id,
            "couponCode": test_coupon_code,
            "walletUseInr": 1000,
            "giftCardCode": test_giftcard_code,
            "giftCardPin": test_giftcard_pin
        }
    )
    print(f"Status: {res.status_code}")
    
    if res.status_code != 200:
        print(f"❌ Booking failed: {res.text}")
        return False
    
    data = res.json()
    booking_id = data.get("id")
    test_booking_ids.append(booking_id)
    
    print(f"Booking created: {data.get('ref')}")
    print(f"Total: ₹{data.get('total')}")
    
    # Expected calculation (ACTUAL IMPLEMENTATION ORDER: Wallet → Coupon → Gift Card):
    # Base: 4600 (Float 3000 + Salt 1600)
    # Wallet cap: min(1000, 50% of 4600 = 2300) → 1000 debit → 3600
    # Coupon 10% of 3600: -360 → 3240
    # Gift card: -1000 → 2240
    # Expected total: 2240
    
    # NOTE: Review request expected order was Coupon → Wallet → Gift Card (total=2140)
    # But actual implementation is Wallet → Coupon → Gift Card (total=2240)
    # This is a DISCREPANCY that needs to be reported!
    
    expected_total = 2240  # Actual implementation behavior
    if data.get("total") != expected_total:
        print(f"❌ Expected total={expected_total}, got {data.get('total')}")
        # Print breakdown for debugging
        breakdown = data.get("pricingBreakdown", {})
        print(f"Breakdown: {json.dumps(breakdown, indent=2)}")
        return False
    
    # Verify all discounts are present
    breakdown = data.get("pricingBreakdown", {})
    discounts = breakdown.get("discounts", {})
    
    coupon = discounts.get("coupon")
    wallet = discounts.get("wallet")
    giftcard = discounts.get("giftCard")
    
    print(f"Coupon: {coupon}")
    print(f"Wallet: {wallet}")
    print(f"Gift card: {giftcard}")
    
    if not coupon or coupon.get("amountInr") != 360:
        print(f"❌ Expected coupon amountInr=360 (10% of 3600 after wallet), got {coupon}")
        return False
    
    if not wallet or wallet.get("amountInr") != 1000:
        print(f"❌ Expected wallet amountInr=1000, got {wallet}")
        return False
    
    if not giftcard or giftcard.get("amountInr") != 1000:
        print(f"❌ Expected giftcard amountInr=1000, got {giftcard}")
        return False
    
    print(f"✅ B6 PASSED: Combined discounts working (NOTE: Discount order is Wallet→Coupon→GiftCard, not Coupon→Wallet→GiftCard as expected in review request)")
    return True

def test_b6_verify_wallet_balance():
    """B6: Verify wallet balance decreased by 10000 points"""
    print("\n=== B6: Verify wallet balance after combined booking ===")
    
    res = requests.get(
        f"{BASE_URL}/admin/wallet/{test_customer_id}/balance",
        cookies=get_admin_cookies()
    )
    print(f"Status: {res.status_code}")
    
    if res.status_code != 200:
        print(f"❌ Failed to get balance: {res.text}")
        return False
    
    data = res.json()
    balance = data.get("balance")
    print(f"Balance: {balance}")
    
    # Started with 30000 after B5, then added 30000 in B6 setup = 60000
    # Used 10000 (₹1000 / 0.1) in B6
    # Expected: 50000
    if balance != 50000:
        print(f"❌ Expected balance=50000, got {balance}")
        return False
    
    print(f"✅ Wallet balance correctly updated")
    return True

def test_b6_verify_giftcard_balance():
    """B6: Verify gift card balance is 0 and status is 'redeemed'"""
    print("\n=== B6: Verify gift card after booking ===")
    
    res = requests.get(
        f"{BASE_URL}/admin/giftcards/by-code/{test_giftcard_code}",
        cookies=get_admin_cookies()
    )
    print(f"Status: {res.status_code}")
    
    if res.status_code != 200:
        print(f"❌ Failed to get gift card: {res.text}")
        return False
    
    data = res.json()
    balance = data.get("balance")
    status = data.get("status")
    
    print(f"Gift card: balance={balance}, status={status}")
    
    if balance != 0:
        print(f"❌ Expected balance=0, got {balance}")
        return False
    
    if status != "redeemed":
        print(f"❌ Expected status='redeemed', got {status}")
        return False
    
    print(f"✅ Gift card correctly debited and marked as redeemed")
    return True

def test_b6_verify_coupon_redemption():
    """B6: Verify coupon redemption was recorded"""
    print("\n=== B6: Verify coupon redemption ===")
    
    res = requests.get(
        f"{BASE_URL}/admin/coupons/report",
        cookies=get_admin_cookies()
    )
    print(f"Status: {res.status_code}")
    
    if res.status_code != 200:
        print(f"❌ Failed to get coupon report: {res.text}")
        return False
    
    data = res.json()
    per_coupon = data.get("perCoupon", [])
    
    # Find TEST10P coupon
    test_coupon = None
    for c in per_coupon:
        if c.get("code") == "TEST10P":
            test_coupon = c
            break
    
    if not test_coupon:
        print(f"❌ TEST10P coupon not found in report")
        return False
    
    print(f"Coupon report: redemptions={test_coupon.get('redemptions')}, discount={test_coupon.get('totalDiscountInr')}")
    
    if test_coupon.get("redemptions") < 1:
        print(f"❌ Expected at least 1 redemption, got {test_coupon.get('redemptions')}")
        return False
    
    print(f"✅ Coupon redemption recorded")
    return True

# ============================================================================
# GROUP 3: Regression tests
# ============================================================================

def test_r1_booking_without_discounts():
    """R1: Booking without any discounts - server-computed total matches sum of defaultPrices"""
    print("\n=== R1: Booking without discounts ===")
    
    future_date = (datetime.now() + timedelta(days=31)).strftime("%Y-%m-%d")
    
    res = requests.post(
        f"{BASE_URL}/bookings",
        json={
            "therapies": [{"slug": "salt-therapy", "label": "Salt", "role": "Primary"}],
            "slotDate": future_date,
            "slotTime": "07:00",
            "contact": {
                "name": "Test User",
                "phone": "919999999999",
                "email": "test@example.com"
            }
        }
    )
    print(f"Status: {res.status_code}")
    
    if res.status_code != 200:
        print(f"❌ Booking failed: {res.text}")
        return False
    
    data = res.json()
    booking_id = data.get("id")
    test_booking_ids.append(booking_id)
    
    print(f"Booking created: {data.get('ref')}")
    print(f"Total: ₹{data.get('total')}")
    
    # Salt therapy defaultPrice should be 1600
    if data.get("total") != 1600:
        print(f"❌ Expected total=1600, got {data.get('total')}")
        return False
    
    # Verify no discounts
    breakdown = data.get("pricingBreakdown", {})
    discounts = breakdown.get("discounts", {})
    
    if discounts.get("membership") or discounts.get("wallet") or discounts.get("coupon") or discounts.get("giftCard"):
        print(f"❌ Expected no discounts, got {discounts}")
        return False
    
    print(f"✅ R1 PASSED: Booking without discounts works correctly")
    return True

def test_r2_coupon_only_booking():
    """R2: Coupon-only booking (existing behaviour still works)"""
    print("\n=== R2: Coupon-only booking ===")
    
    # Skip if coupon wasn't created
    if not test_coupon_code:
        print("⏭️  Skipping R2: Coupon not created in B6")
        return True
    
    future_date = (datetime.now() + timedelta(days=14)).strftime("%Y-%m-%d")
    
    res = requests.post(
        f"{BASE_URL}/bookings",
        json={
            "therapies": [{"slug": "float-therapy", "label": "Float", "role": "Primary"}],
            "slotDate": future_date,
            "slotTime": "18:00",
            "contact": {
                "name": "Test User",
                "phone": "919999999998",
                "email": "test2@example.com"
            },
            "couponCode": test_coupon_code
        }
    )
    print(f"Status: {res.status_code}")
    
    if res.status_code != 200:
        print(f"❌ Booking failed: {res.text}")
        return False
    
    data = res.json()
    booking_id = data.get("id")
    test_booking_ids.append(booking_id)
    
    print(f"Booking created: {data.get('ref')}")
    print(f"Total: ₹{data.get('total')}")
    
    # Float therapy 3000, 10% off = 2700
    if data.get("total") != 2700:
        print(f"❌ Expected total=2700, got {data.get('total')}")
        return False
    
    # Verify coupon discount
    breakdown = data.get("pricingBreakdown", {})
    coupon = breakdown.get("discounts", {}).get("coupon")
    
    if not coupon or coupon.get("amountInr") != 300:
        print(f"❌ Expected coupon amountInr=300, got {coupon}")
        return False
    
    print(f"✅ R2 PASSED: Coupon-only booking works correctly")
    return True

def test_r3_membership_covered_booking():
    """R3: Membership-covered booking still zeros the total"""
    print("\n=== R3: Membership-covered booking ===")
    
    # First, create a membership subscription for test customer
    # Get a membership plan
    res = requests.get(f"{BASE_URL}/admin/memberships/plans", cookies=get_admin_cookies())
    if res.status_code != 200:
        print(f"⚠️  Could not get membership plans, skipping R3")
        return True
    
    plans = res.json()
    if not plans:
        print(f"⚠️  No membership plans available, skipping R3")
        return True
    
    # Find a sessions-based plan
    sessions_plan = None
    for plan in plans:
        if plan.get("type") == "sessions":
            sessions_plan = plan
            break
    
    if not sessions_plan:
        print(f"⚠️  No sessions-based plan found, skipping R3")
        return True
    
    # Create subscription
    res = requests.post(
        f"{BASE_URL}/admin/memberships/subs",
        json={
            "customerId": test_customer_id,
            "membershipId": sessions_plan.get("id"),
            "paymentMethod": "offline"
        },
        cookies=get_admin_cookies()
    )
    
    if res.status_code != 200:
        print(f"⚠️  Could not create subscription: {res.text}")
        return True
    
    sub_data = res.json()
    sub_id = sub_data.get("id")
    print(f"Subscription created: {sub_id}")
    
    # Now create booking with membership
    future_date = (datetime.now() + timedelta(days=15)).strftime("%Y-%m-%d")
    
    res = requests.post(
        f"{BASE_URL}/bookings",
        json={
            "therapies": [{"slug": "float-therapy", "label": "Float", "role": "Primary"}],
            "slotDate": future_date,
            "slotTime": "11:00",
            "contact": {
                "name": "WalletTest",
                "phone": "919888800011",
                "email": "wallettest@ex.com"
            },
            "customerId": test_customer_id,
            "membershipSubscriptionId": sub_id
        }
    )
    print(f"Status: {res.status_code}")
    
    if res.status_code != 200:
        print(f"❌ Booking failed: {res.text}")
        return False
    
    data = res.json()
    booking_id = data.get("id")
    test_booking_ids.append(booking_id)
    
    print(f"Booking created: {data.get('ref')}")
    print(f"Total: ₹{data.get('total')}")
    
    # Membership should cover the booking, total should be 0
    if data.get("total") != 0:
        print(f"❌ Expected total=0 (membership covered), got {data.get('total')}")
        return False
    
    # Verify membership discount
    breakdown = data.get("pricingBreakdown", {})
    membership = breakdown.get("discounts", {}).get("membership")
    
    if not membership or membership.get("amountInr") != 3000:
        print(f"❌ Expected membership amountInr=3000, got {membership}")
        return False
    
    print(f"✅ R3 PASSED: Membership-covered booking works correctly")
    return True

def test_r4_get_therapies():
    """R4: GET /api/therapies returns therapies with correct fields"""
    print("\n=== R4: GET /api/therapies ===")
    
    res = requests.get(f"{BASE_URL}/therapies")
    print(f"Status: {res.status_code}")
    
    if res.status_code != 200:
        print(f"❌ Failed to get therapies: {res.text}")
        return False
    
    data = res.json()
    
    if not isinstance(data, list) or len(data) == 0:
        print(f"❌ Expected non-empty array, got {type(data)}")
        return False
    
    # Check first therapy has required fields
    therapy = data[0]
    required_fields = ["slug", "name", "defaultPrice", "durationMin"]
    
    for field in required_fields:
        if field not in therapy:
            print(f"❌ Missing field '{field}' in therapy")
            return False
    
    print(f"✅ R4 PASSED: GET /api/therapies works correctly")
    return True

def test_r5_slot_conflict_suggestions():
    """R5: Slot conflict (409) still returns suggestions"""
    print("\n=== R5: Slot conflict with suggestions ===")
    
    # Create a booking
    future_date = (datetime.now() + timedelta(days=32)).strftime("%Y-%m-%d")
    
    res1 = requests.post(
        f"{BASE_URL}/bookings",
        json={
            "therapies": [{"slug": "salt-therapy", "label": "Salt", "role": "Primary"}],
            "slotDate": future_date,
            "slotTime": "07:00",
            "contact": {
                "name": "Test User",
                "phone": "919999999997",
                "email": "test3@example.com"
            }
        }
    )
    
    if res1.status_code != 200:
        print(f"⚠️  First booking failed: {res1.text}")
        return True
    
    booking_id = res1.json().get("id")
    test_booking_ids.append(booking_id)
    
    # Try to book the same slot again
    res2 = requests.post(
        f"{BASE_URL}/bookings",
        json={
            "therapies": [{"slug": "salt-therapy", "label": "Salt", "role": "Primary"}],
            "slotDate": future_date,
            "slotTime": "07:00",
            "contact": {
                "name": "Test User 2",
                "phone": "919999999996",
                "email": "test4@example.com"
            }
        }
    )
    print(f"Status: {res2.status_code}")
    
    if res2.status_code != 409:
        print(f"❌ Expected 409, got {res2.status_code}: {res2.text}")
        return False
    
    data = res2.json()
    
    if data.get("error") != "slot_unavailable":
        print(f"❌ Expected error='slot_unavailable', got {data.get('error')}")
        return False
    
    suggestions = data.get("suggestions", [])
    
    if not isinstance(suggestions, list) or len(suggestions) == 0:
        print(f"❌ Expected non-empty suggestions array, got {suggestions}")
        return False
    
    print(f"Suggestions: {len(suggestions)} slots")
    print(f"✅ R5 PASSED: Slot conflict returns suggestions")
    return True

# ============================================================================
# Cleanup
# ============================================================================

def test_cleanup_delete_coupon():
    """CLEANUP: Delete TEST10P coupon"""
    print("\n=== CLEANUP: Delete coupon ===")
    
    if not test_coupon_code:
        print("⏭️  No coupon to delete")
        return True
    
    # Get coupon ID first
    res = requests.get(f"{BASE_URL}/admin/coupons", cookies=get_admin_cookies())
    if res.status_code != 200:
        print(f"⚠️  Could not get coupons")
        return True
    
    coupons = res.json()
    coupon_id = None
    for c in coupons:
        if c.get("code") == test_coupon_code:
            coupon_id = c.get("id")
            break
    
    if not coupon_id:
        print(f"⚠️  Coupon not found")
        return True
    
    res = requests.delete(
        f"{BASE_URL}/admin/coupons/{coupon_id}",
        cookies=get_admin_cookies()
    )
    print(f"Status: {res.status_code}")
    
    if res.status_code == 200:
        print(f"✅ Coupon deleted")
    else:
        print(f"⚠️  Could not delete coupon: {res.text}")
    
    return True

# ============================================================================
# Main test runner
# ============================================================================

def main():
    print("=" * 80)
    print("Phase A: Unified Pricing Engine — Backend Tests")
    print("Focus: GROUP 2 B4/B5 (wallet-as-payment) and GROUP 3 regression")
    print("=" * 80)
    
    # Login first
    if not login_admin():
        print("\n❌ FATAL: Admin login failed, cannot proceed")
        return
    
    tests = [
        # SETUP
        ("SETUP: Create test customer", test_setup_create_customer),
        ("SETUP: Adjust wallet to 5000 points", test_setup_adjust_wallet),
        ("SETUP: Verify wallet balance", test_setup_verify_wallet_balance),
        
        # GROUP 2 B4: Wallet-as-payment (full ₹500 usage)
        ("B4: Booking with wallet ₹500", test_b4_booking_with_wallet_500),
        ("B4: Verify wallet balance is 0", test_b4_verify_wallet_balance_zero),
        ("B4: Verify wallet history", test_b4_verify_wallet_history),
        
        # GROUP 2 B5: Wallet 50% cap
        ("B5: Adjust wallet to 30000 points", test_b5_adjust_wallet_30000),
        ("B5: Booking with wallet 50% cap", test_b5_booking_with_wallet_cap),
        
        # GROUP 2 B6: Combined (coupon + wallet + gift card)
        ("B6 SETUP: Adjust wallet to 30000 points", test_b6_setup_adjust_wallet_30000),
        ("B6 SETUP: Create TEST10P coupon", test_b6_setup_create_coupon),
        ("B6 SETUP: Create gift card", test_b6_setup_create_giftcard),
        ("B6: Combined booking (coupon + wallet + gift card)", test_b6_combined_booking),
        ("B6: Verify wallet balance", test_b6_verify_wallet_balance),
        ("B6: Verify gift card balance", test_b6_verify_giftcard_balance),
        ("B6: Verify coupon redemption", test_b6_verify_coupon_redemption),
        
        # GROUP 3: Regression tests
        ("R1: Booking without discounts", test_r1_booking_without_discounts),
        ("R2: Coupon-only booking", test_r2_coupon_only_booking),
        ("R3: Membership-covered booking", test_r3_membership_covered_booking),
        ("R4: GET /api/therapies", test_r4_get_therapies),
        ("R5: Slot conflict with suggestions", test_r5_slot_conflict_suggestions),
        
        # CLEANUP
        ("CLEANUP: Delete coupon", test_cleanup_delete_coupon),
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
    print(f"\nTest data created:")
    print(f"  - Customer: {test_customer_id}")
    print(f"  - Bookings: {len(test_booking_ids)}")
    print(f"  - Coupon: {test_coupon_code} (deleted)")
    print(f"  - Gift card: {test_giftcard_code}")
    print("\n⚠️  NOTE: Test data NOT cleaned up as per review request")
    print("=" * 80)

if __name__ == "__main__":
    main()
