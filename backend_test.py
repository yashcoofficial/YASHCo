#!/usr/bin/env python3
"""
Comprehensive backend test for YASH luxury e-commerce API
Tests all endpoints in the order specified in the review request
"""
import requests
import json
import random
import string
from datetime import datetime

# Base URL for testing (internal Next.js)
BASE_URL = "http://localhost:3000/api"

# Admin credentials (seeded)
ADMIN_EMAIL = "yashcoofficial@gmail.com"
ADMIN_PASSWORD = "Admin@123"

# Test state
customer_token = None
customer_email = None
admin_token = None
test_product_id = None
test_order_id = None
test_inquiry_id = None
test_address_id = None
test_collection_id = None
reset_token = None

def random_email():
    """Generate a random email for testing"""
    rand = ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))
    return f"customer_{rand}@yashtest.com"

def print_test(name):
    """Print test name"""
    print(f"\n{'='*80}")
    print(f"TEST: {name}")
    print('='*80)

def print_result(success, message, response=None):
    """Print test result"""
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status}: {message}")
    if response and not success:
        print(f"Response: {response.status_code}")
        try:
            print(f"Body: {json.dumps(response.json(), indent=2)}")
        except:
            print(f"Body: {response.text}")

def test_health():
    """Test 1: GET /api/health"""
    print_test("1. Health Check")
    try:
        r = requests.get(f"{BASE_URL}/health", timeout=10)
        data = r.json()
        success = r.status_code == 200 and data.get('ok') == True
        print_result(success, f"Health check returned {data}", r if not success else None)
        return success
    except Exception as e:
        print_result(False, f"Exception: {e}")
        return False

def test_settings():
    """Test 2: GET /api/settings"""
    print_test("2. Get Site Settings")
    try:
        r = requests.get(f"{BASE_URL}/settings", timeout=10)
        data = r.json()
        settings = data.get('settings', {})
        
        checks = [
            settings.get('brand') == 'YASH',
            settings.get('slogan') == 'Own Every Moment',
            settings.get('currency') == 'INR',
            'concierge' in settings,
            'heroTitle' in settings,
            'lookbookImages' in settings and isinstance(settings['lookbookImages'], list)
        ]
        
        success = r.status_code == 200 and all(checks)
        print_result(success, f"Settings: brand={settings.get('brand')}, slogan={settings.get('slogan')}, currency={settings.get('currency')}", r if not success else None)
        return success
    except Exception as e:
        print_result(False, f"Exception: {e}")
        return False

def test_collections():
    """Test 3: GET /api/collections"""
    print_test("3. Get Collections")
    try:
        r = requests.get(f"{BASE_URL}/collections", timeout=10)
        data = r.json()
        collections = data.get('collections', [])
        
        success = r.status_code == 200 and len(collections) == 3
        names = [c.get('name') for c in collections]
        print_result(success, f"Found {len(collections)} collections: {names}", r if not success else None)
        return success
    except Exception as e:
        print_result(False, f"Exception: {e}")
        return False

def test_products_list():
    """Test 4: GET /api/products"""
    print_test("4. Get Products List")
    global test_product_id
    try:
        r = requests.get(f"{BASE_URL}/products", timeout=10)
        data = r.json()
        products = data.get('products', [])
        
        if len(products) > 0:
            test_product_id = products[0].get('id')
            p = products[0]
            required_fields = ['id', 'name', 'price', 'collection', 'sizes', 'colors', 'images', 'sku', 'stock', 'lowStockThreshold']
            has_all_fields = all(field in p for field in required_fields)
            no_mongo_id = '_id' not in p
            
            success = r.status_code == 200 and len(products) == 10 and has_all_fields and no_mongo_id
            print_result(success, f"Found {len(products)} products, first: {p.get('name')}, no _id leak: {no_mongo_id}", r if not success else None)
            return success
        else:
            print_result(False, "No products found", r)
            return False
    except Exception as e:
        print_result(False, f"Exception: {e}")
        return False

def test_products_filter_collection():
    """Test 5: GET /api/products?collection=menswear&sort=price_asc"""
    print_test("5. Filter Products by Collection and Sort")
    try:
        r = requests.get(f"{BASE_URL}/products?collection=menswear&sort=price_asc", timeout=10)
        data = r.json()
        products = data.get('products', [])
        
        all_menswear = all(p.get('collection') == 'menswear' for p in products)
        prices = [p.get('price') for p in products]
        sorted_asc = prices == sorted(prices)
        
        success = r.status_code == 200 and all_menswear and sorted_asc and len(products) > 0
        print_result(success, f"Found {len(products)} menswear products, prices sorted: {sorted_asc}, prices: {prices}", r if not success else None)
        return success
    except Exception as e:
        print_result(False, f"Exception: {e}")
        return False

def test_products_search():
    """Test 6: GET /api/products?search=silk"""
    print_test("6. Search Products")
    try:
        r = requests.get(f"{BASE_URL}/products?search=silk", timeout=10)
        data = r.json()
        products = data.get('products', [])
        
        has_silk = all('silk' in p.get('name', '').lower() for p in products) if products else True
        success = r.status_code == 200
        print_result(success, f"Search 'silk' returned {len(products)} products", r if not success else None)
        return success
    except Exception as e:
        print_result(False, f"Exception: {e}")
        return False

def test_products_price_range():
    """Test 7: GET /api/products?minPrice=50000&maxPrice=100000"""
    print_test("7. Filter Products by Price Range")
    try:
        r = requests.get(f"{BASE_URL}/products?minPrice=50000&maxPrice=100000", timeout=10)
        data = r.json()
        products = data.get('products', [])
        
        in_range = all(50000 <= p.get('price', 0) <= 100000 for p in products)
        success = r.status_code == 200 and in_range
        prices = [p.get('price') for p in products]
        print_result(success, f"Found {len(products)} products in range 50000-100000, prices: {prices}", r if not success else None)
        return success
    except Exception as e:
        print_result(False, f"Exception: {e}")
        return False

def test_product_detail():
    """Test 8: GET /api/products/{id}"""
    print_test("8. Get Product Detail")
    global test_product_id
    try:
        if not test_product_id:
            print_result(False, "No product ID available from previous test")
            return False
        
        r = requests.get(f"{BASE_URL}/products/{test_product_id}", timeout=10)
        data = r.json()
        product = data.get('product', {})
        
        success = r.status_code == 200 and product.get('id') == test_product_id
        print_result(success, f"Product detail: {product.get('name')}", r if not success else None)
        return success
    except Exception as e:
        print_result(False, f"Exception: {e}")
        return False

def test_register():
    """Test 9: POST /api/auth/register"""
    print_test("9. Register New Customer")
    global customer_token, customer_email
    try:
        customer_email = random_email()
        payload = {
            "email": customer_email,
            "password": "Customer@123",
            "name": "Test Customer"
        }
        r = requests.post(f"{BASE_URL}/auth/register", json=payload, timeout=10)
        data = r.json()
        
        customer_token = data.get('token')
        user = data.get('user', {})
        
        success = r.status_code == 200 and customer_token and user.get('role') == 'customer'
        print_result(success, f"Registered {customer_email}, role: {user.get('role')}, token: {customer_token[:20] if customer_token else None}...", r if not success else None)
        return success
    except Exception as e:
        print_result(False, f"Exception: {e}")
        return False

def test_login():
    """Test 10: POST /api/auth/login"""
    print_test("10. Login with Customer Credentials")
    global customer_token, customer_email
    try:
        payload = {
            "email": customer_email,
            "password": "Customer@123"
        }
        r = requests.post(f"{BASE_URL}/auth/login", json=payload, timeout=10)
        data = r.json()
        
        new_token = data.get('token')
        success = r.status_code == 200 and new_token
        print_result(success, f"Login successful, new token: {new_token[:20] if new_token else None}...", r if not success else None)
        
        if success:
            customer_token = new_token
        return success
    except Exception as e:
        print_result(False, f"Exception: {e}")
        return False

def test_me():
    """Test 11: GET /api/auth/me"""
    print_test("11. Get Current User")
    global customer_token
    try:
        headers = {"Authorization": f"Bearer {customer_token}"}
        r = requests.get(f"{BASE_URL}/auth/me", headers=headers, timeout=10)
        data = r.json()
        user = data.get('user', {})
        
        success = r.status_code == 200 and user.get('email') == customer_email
        print_result(success, f"Current user: {user.get('email')}, role: {user.get('role')}", r if not success else None)
        return success
    except Exception as e:
        print_result(False, f"Exception: {e}")
        return False

def test_forgot_reset():
    """Test 12: POST /api/auth/forgot and /api/auth/reset"""
    print_test("12. Forgot Password and Reset")
    global customer_email, reset_token
    try:
        # Forgot password
        payload = {"email": customer_email}
        r1 = requests.post(f"{BASE_URL}/auth/forgot", json=payload, timeout=10)
        data1 = r1.json()
        
        reset_token = data1.get('mockedResetToken')
        forgot_success = r1.status_code == 200 and reset_token
        print_result(forgot_success, f"Forgot password returned mockedResetToken: {reset_token[:20] if reset_token else None}...", r1 if not forgot_success else None)
        
        if not forgot_success:
            return False
        
        # Reset password
        payload2 = {
            "token": reset_token,
            "newPassword": "NewPass@123"
        }
        r2 = requests.post(f"{BASE_URL}/auth/reset", json=payload2, timeout=10)
        data2 = r2.json()
        
        reset_success = r2.status_code == 200 and data2.get('ok') == True
        print_result(reset_success, f"Password reset successful", r2 if not reset_success else None)
        
        if not reset_success:
            return False
        
        # Login with new password
        payload3 = {
            "email": customer_email,
            "password": "NewPass@123"
        }
        r3 = requests.post(f"{BASE_URL}/auth/login", json=payload3, timeout=10)
        data3 = r3.json()
        
        login_success = r3.status_code == 200 and data3.get('token')
        print_result(login_success, f"Login with new password successful", r3 if not login_success else None)
        
        return forgot_success and reset_success and login_success
    except Exception as e:
        print_result(False, f"Exception: {e}")
        return False

def test_admin_login():
    """Test 13: POST /api/auth/login as admin"""
    print_test("13. Admin Login")
    global admin_token
    try:
        payload = {
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        }
        r = requests.post(f"{BASE_URL}/auth/login", json=payload, timeout=10)
        data = r.json()
        
        admin_token = data.get('token')
        user = data.get('user', {})
        
        success = r.status_code == 200 and admin_token and user.get('role') == 'admin'
        print_result(success, f"Admin login successful, role: {user.get('role')}, token: {admin_token[:20] if admin_token else None}...", r if not success else None)
        return success
    except Exception as e:
        print_result(False, f"Exception: {e}")
        return False

def test_admin_product_crud():
    """Test 14: Admin product CRUD with auth checks"""
    print_test("14. Admin Product CRUD with Auth Checks")
    global admin_token, customer_token, test_product_id
    
    try:
        # Test 1: POST without token should return 401
        payload = {
            "name": "Test Luxury Item",
            "description": "A test product",
            "collection": "menswear",
            "price": 75000,
            "stock": 5,
            "sku": "TEST-001"
        }
        r1 = requests.post(f"{BASE_URL}/products", json=payload, timeout=10)
        test1 = r1.status_code == 401
        print_result(test1, f"POST without token returned 401", r1 if not test1 else None)
        
        # Test 2: POST with customer token should return 403
        headers_customer = {"Authorization": f"Bearer {customer_token}"}
        r2 = requests.post(f"{BASE_URL}/products", json=payload, headers=headers_customer, timeout=10)
        test2 = r2.status_code == 403
        print_result(test2, f"POST with customer token returned 403", r2 if not test2 else None)
        
        # Test 3: POST with admin token should succeed
        headers_admin = {"Authorization": f"Bearer {admin_token}"}
        r3 = requests.post(f"{BASE_URL}/products", json=payload, headers=headers_admin, timeout=10)
        data3 = r3.json()
        created_product_id = data3.get('product', {}).get('id')
        test3 = r3.status_code == 200 and created_product_id
        print_result(test3, f"POST with admin token created product: {created_product_id}", r3 if not test3 else None)
        
        if not created_product_id:
            return False
        
        # Test 4: PUT to update product
        update_payload = {"name": "Updated Luxury Item", "price": 80000}
        r4 = requests.put(f"{BASE_URL}/products/{created_product_id}", json=update_payload, headers=headers_admin, timeout=10)
        data4 = r4.json()
        updated_product = data4.get('product', {})
        test4 = r4.status_code == 200 and updated_product.get('name') == "Updated Luxury Item"
        print_result(test4, f"PUT updated product name to: {updated_product.get('name')}", r4 if not test4 else None)
        
        # Test 5: DELETE product
        r5 = requests.delete(f"{BASE_URL}/products/{created_product_id}", headers=headers_admin, timeout=10)
        data5 = r5.json()
        test5 = r5.status_code == 200 and data5.get('ok') == True
        print_result(test5, f"DELETE removed product", r5 if not test5 else None)
        
        return all([test1, test2, test3, test4, test5])
    except Exception as e:
        print_result(False, f"Exception: {e}")
        return False

def test_admin_overview():
    """Test 15: GET /api/admin/overview"""
    print_test("15. Admin Overview")
    global admin_token
    try:
        headers = {"Authorization": f"Bearer {admin_token}"}
        r = requests.get(f"{BASE_URL}/admin/overview", headers=headers, timeout=10)
        data = r.json()
        
        has_counts = all(key in data for key in ['productCount', 'orderCount', 'inquiryCount', 'userCount', 'lowStock'])
        success = r.status_code == 200 and has_counts
        print_result(success, f"Overview: products={data.get('productCount')}, orders={data.get('orderCount')}, inquiries={data.get('inquiryCount')}, users={data.get('userCount')}, lowStock={len(data.get('lowStock', []))}", r if not success else None)
        return success
    except Exception as e:
        print_result(False, f"Exception: {e}")
        return False

def test_settings_cms():
    """Test 16: PUT /api/settings (admin CMS)"""
    print_test("16. Site Settings CMS Update")
    global admin_token
    try:
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Update heroTitle
        payload = {"heroTitle": "TEST HERO"}
        r1 = requests.put(f"{BASE_URL}/settings", json=payload, headers=headers, timeout=10)
        data1 = r1.json()
        test1 = r1.status_code == 200 and data1.get('settings', {}).get('heroTitle') == "TEST HERO"
        print_result(test1, f"Updated heroTitle to: {data1.get('settings', {}).get('heroTitle')}", r1 if not test1 else None)
        
        # Verify with GET
        r2 = requests.get(f"{BASE_URL}/settings", timeout=10)
        data2 = r2.json()
        test2 = r2.status_code == 200 and data2.get('settings', {}).get('heroTitle') == "TEST HERO"
        print_result(test2, f"GET confirmed heroTitle: {data2.get('settings', {}).get('heroTitle')}", r2 if not test2 else None)
        
        # Reset back
        payload2 = {"heroTitle": "Own Every Moment"}
        r3 = requests.put(f"{BASE_URL}/settings", json=payload2, headers=headers, timeout=10)
        data3 = r3.json()
        test3 = r3.status_code == 200 and data3.get('settings', {}).get('heroTitle') == "Own Every Moment"
        print_result(test3, f"Reset heroTitle to: {data3.get('settings', {}).get('heroTitle')}", r3 if not test3 else None)
        
        return all([test1, test2, test3])
    except Exception as e:
        print_result(False, f"Exception: {e}")
        return False

def test_orders_flow():
    """Test 17: Orders flow (create, list, admin update, customer view)"""
    print_test("17. Orders Flow")
    global customer_token, admin_token, test_order_id, test_product_id
    
    try:
        # 17a: Create order as customer
        headers_customer = {"Authorization": f"Bearer {customer_token}"}
        order_payload = {
            "items": [
                {
                    "key": f"{test_product_id}-M-Noir",
                    "id": test_product_id,
                    "name": "Test Product",
                    "price": 50000,
                    "image": "https://example.com/image.jpg",
                    "size": "M",
                    "color": "Noir",
                    "qty": 1
                }
            ],
            "subtotal": 50000,
            "shipping": 0,
            "total": 50000,
            "shippingAddress": {
                "name": "Test Customer",
                "address": "123 Test St",
                "city": "Mumbai",
                "state": "Maharashtra",
                "pincode": "400001",
                "country": "India"
            },
            "customerName": "Test Customer",
            "customerEmail": customer_email,
            "customerPhone": "+91 9876543210"
        }
        r1 = requests.post(f"{BASE_URL}/orders", json=order_payload, headers=headers_customer, timeout=10)
        data1 = r1.json()
        order = data1.get('order', {})
        test_order_id = order.get('id')
        
        test1 = (r1.status_code == 200 and 
                test_order_id and 
                order.get('status') == 'Enquiry Received' and
                len(order.get('history', [])) == 1)
        print_result(test1, f"Created order {test_order_id}, status: {order.get('status')}, history entries: {len(order.get('history', []))}", r1 if not test1 else None)
        
        if not test_order_id:
            return False
        
        # 17b: GET orders as customer (should see only their order)
        r2 = requests.get(f"{BASE_URL}/orders", headers=headers_customer, timeout=10)
        data2 = r2.json()
        customer_orders = data2.get('orders', [])
        test2 = r2.status_code == 200 and len(customer_orders) >= 1 and any(o.get('id') == test_order_id for o in customer_orders)
        print_result(test2, f"Customer sees {len(customer_orders)} order(s)", r2 if not test2 else None)
        
        # 17c: GET orders as admin (should see all orders)
        headers_admin = {"Authorization": f"Bearer {admin_token}"}
        r3 = requests.get(f"{BASE_URL}/orders", headers=headers_admin, timeout=10)
        data3 = r3.json()
        admin_orders = data3.get('orders', [])
        test3 = r3.status_code == 200 and len(admin_orders) >= 1
        print_result(test3, f"Admin sees {len(admin_orders)} order(s)", r3 if not test3 else None)
        
        # 17d: Admin updates order status
        update_payload = {
            "status": "Shipped",
            "trackingNumber": "TRK123",
            "historyNote": "Dispatched"
        }
        r4 = requests.put(f"{BASE_URL}/orders/{test_order_id}", json=update_payload, headers=headers_admin, timeout=10)
        data4 = r4.json()
        updated_order = data4.get('order', {})
        test4 = (r4.status_code == 200 and 
                updated_order.get('status') == 'Shipped' and
                updated_order.get('trackingNumber') == 'TRK123' and
                len(updated_order.get('history', [])) == 2)
        print_result(test4, f"Admin updated order status to: {updated_order.get('status')}, tracking: {updated_order.get('trackingNumber')}, history entries: {len(updated_order.get('history', []))}", r4 if not test4 else None)
        
        # 17e: Customer views updated order
        r5 = requests.get(f"{BASE_URL}/orders/{test_order_id}", headers=headers_customer, timeout=10)
        data5 = r5.json()
        customer_order = data5.get('order', {})
        test5 = (r5.status_code == 200 and 
                customer_order.get('status') == 'Shipped' and
                customer_order.get('trackingNumber') == 'TRK123')
        print_result(test5, f"Customer sees updated status: {customer_order.get('status')}, tracking: {customer_order.get('trackingNumber')}", r5 if not test5 else None)
        
        return all([test1, test2, test3, test4, test5])
    except Exception as e:
        print_result(False, f"Exception: {e}")
        return False

def test_inquiries():
    """Test 18: Inquiries (public submit, admin manage)"""
    print_test("18. Inquiries Flow")
    global admin_token, test_inquiry_id
    
    try:
        # Submit inquiry (public, no auth)
        inquiry_payload = {
            "name": "Test Inquirer",
            "email": "inquirer@test.com",
            "message": "I have a question about your products"
        }
        r1 = requests.post(f"{BASE_URL}/inquiries", json=inquiry_payload, timeout=10)
        data1 = r1.json()
        inquiry = data1.get('inquiry', {})
        test_inquiry_id = inquiry.get('id')
        
        test1 = r1.status_code == 200 and test_inquiry_id
        print_result(test1, f"Created inquiry {test_inquiry_id}", r1 if not test1 else None)
        
        if not test_inquiry_id:
            return False
        
        # Admin lists inquiries
        headers_admin = {"Authorization": f"Bearer {admin_token}"}
        r2 = requests.get(f"{BASE_URL}/inquiries", headers=headers_admin, timeout=10)
        data2 = r2.json()
        inquiries = data2.get('inquiries', [])
        test2 = r2.status_code == 200 and any(i.get('id') == test_inquiry_id for i in inquiries)
        print_result(test2, f"Admin sees {len(inquiries)} inquiries, including test inquiry", r2 if not test2 else None)
        
        # Admin updates inquiry
        update_payload = {
            "status": "Answered",
            "response": "Thank you for your inquiry. We will contact you shortly."
        }
        r3 = requests.put(f"{BASE_URL}/inquiries/{test_inquiry_id}", json=update_payload, headers=headers_admin, timeout=10)
        data3 = r3.json()
        updated_inquiry = data3.get('inquiry', {})
        test3 = r3.status_code == 200 and updated_inquiry.get('status') == 'Answered'
        print_result(test3, f"Admin updated inquiry status to: {updated_inquiry.get('status')}", r3 if not test3 else None)
        
        return all([test1, test2, test3])
    except Exception as e:
        print_result(False, f"Exception: {e}")
        return False

def test_wishlist():
    """Test 19: Wishlist (auth required)"""
    print_test("19. Wishlist Flow")
    global customer_token, test_product_id
    
    try:
        headers = {"Authorization": f"Bearer {customer_token}"}
        
        # Add to wishlist
        payload = {"productId": test_product_id}
        r1 = requests.post(f"{BASE_URL}/wishlist", json=payload, headers=headers, timeout=10)
        data1 = r1.json()
        test1 = r1.status_code == 200 and data1.get('ok') == True
        print_result(test1, f"Added product {test_product_id} to wishlist", r1 if not test1 else None)
        
        # Get wishlist
        r2 = requests.get(f"{BASE_URL}/wishlist", headers=headers, timeout=10)
        data2 = r2.json()
        product_ids = data2.get('productIds', [])
        test2 = r2.status_code == 200 and test_product_id in product_ids
        print_result(test2, f"Wishlist contains {len(product_ids)} products, includes test product: {test_product_id in product_ids}", r2 if not test2 else None)
        
        # Remove from wishlist
        r3 = requests.delete(f"{BASE_URL}/wishlist/{test_product_id}", headers=headers, timeout=10)
        data3 = r3.json()
        test3 = r3.status_code == 200 and data3.get('ok') == True
        print_result(test3, f"Removed product {test_product_id} from wishlist", r3 if not test3 else None)
        
        return all([test1, test2, test3])
    except Exception as e:
        print_result(False, f"Exception: {e}")
        return False

def test_addresses():
    """Test 20: Addresses (auth required)"""
    print_test("20. Addresses CRUD")
    global customer_token, test_address_id
    
    try:
        headers = {"Authorization": f"Bearer {customer_token}"}
        
        # Create address
        address_payload = {
            "name": "Home",
            "address": "456 Test Avenue",
            "city": "Delhi",
            "state": "Delhi",
            "pincode": "110001",
            "country": "India",
            "phone": "+91 9876543210"
        }
        r1 = requests.post(f"{BASE_URL}/addresses", json=address_payload, headers=headers, timeout=10)
        data1 = r1.json()
        address = data1.get('address', {})
        test_address_id = address.get('id')
        
        test1 = r1.status_code == 200 and test_address_id
        print_result(test1, f"Created address {test_address_id}", r1 if not test1 else None)
        
        if not test_address_id:
            return False
        
        # List addresses
        r2 = requests.get(f"{BASE_URL}/addresses", headers=headers, timeout=10)
        data2 = r2.json()
        addresses = data2.get('addresses', [])
        test2 = r2.status_code == 200 and any(a.get('id') == test_address_id for a in addresses)
        print_result(test2, f"Found {len(addresses)} addresses, includes test address", r2 if not test2 else None)
        
        # Update address
        update_payload = {"city": "New Delhi"}
        r3 = requests.put(f"{BASE_URL}/addresses/{test_address_id}", json=update_payload, headers=headers, timeout=10)
        data3 = r3.json()
        updated_address = data3.get('address', {})
        test3 = r3.status_code == 200 and updated_address.get('city') == 'New Delhi'
        print_result(test3, f"Updated address city to: {updated_address.get('city')}", r3 if not test3 else None)
        
        # Delete address
        r4 = requests.delete(f"{BASE_URL}/addresses/{test_address_id}", headers=headers, timeout=10)
        data4 = r4.json()
        test4 = r4.status_code == 200 and data4.get('ok') == True
        print_result(test4, f"Deleted address {test_address_id}", r4 if not test4 else None)
        
        return all([test1, test2, test3, test4])
    except Exception as e:
        print_result(False, f"Exception: {e}")
        return False

def test_collections_crud():
    """Test 21: Collections CRUD (admin)"""
    print_test("21. Collections CRUD")
    global admin_token, test_collection_id
    
    try:
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Create collection
        collection_payload = {
            "name": "Test Collection",
            "slug": "test-collection",
            "description": "A test collection",
            "image": "https://example.com/test.jpg",
            "order": 99
        }
        r1 = requests.post(f"{BASE_URL}/collections", json=collection_payload, headers=headers, timeout=10)
        data1 = r1.json()
        collection = data1.get('collection', {})
        test_collection_id = collection.get('id')
        
        test1 = r1.status_code == 200 and test_collection_id
        print_result(test1, f"Created collection {test_collection_id}", r1 if not test1 else None)
        
        if not test_collection_id:
            return False
        
        # Update collection
        update_payload = {"name": "Updated Test Collection"}
        r2 = requests.put(f"{BASE_URL}/collections/{test_collection_id}", json=update_payload, headers=headers, timeout=10)
        data2 = r2.json()
        updated_collection = data2.get('collection', {})
        test2 = r2.status_code == 200 and updated_collection.get('name') == 'Updated Test Collection'
        print_result(test2, f"Updated collection name to: {updated_collection.get('name')}", r2 if not test2 else None)
        
        # Delete collection
        r3 = requests.delete(f"{BASE_URL}/collections/{test_collection_id}", headers=headers, timeout=10)
        data3 = r3.json()
        test3 = r3.status_code == 200 and data3.get('ok') == True
        print_result(test3, f"Deleted collection {test_collection_id}", r3 if not test3 else None)
        
        return all([test1, test2, test3])
    except Exception as e:
        print_result(False, f"Exception: {e}")
        return False

def main():
    """Run all tests in order"""
    print("\n" + "="*80)
    print("YASH LUXURY E-COMMERCE BACKEND TEST SUITE")
    print("="*80)
    
    results = {}
    
    # Run tests in order
    results['1. Health Check'] = test_health()
    results['2. Site Settings'] = test_settings()
    results['3. Collections'] = test_collections()
    results['4. Products List'] = test_products_list()
    results['5. Filter by Collection'] = test_products_filter_collection()
    results['6. Search Products'] = test_products_search()
    results['7. Price Range Filter'] = test_products_price_range()
    results['8. Product Detail'] = test_product_detail()
    results['9. Register Customer'] = test_register()
    results['10. Login Customer'] = test_login()
    results['11. Get Current User'] = test_me()
    results['12. Forgot/Reset Password'] = test_forgot_reset()
    results['13. Admin Login'] = test_admin_login()
    results['14. Admin Product CRUD'] = test_admin_product_crud()
    results['15. Admin Overview'] = test_admin_overview()
    results['16. Settings CMS'] = test_settings_cms()
    results['17. Orders Flow'] = test_orders_flow()
    results['18. Inquiries'] = test_inquiries()
    results['19. Wishlist'] = test_wishlist()
    results['20. Addresses CRUD'] = test_addresses()
    results['21. Collections CRUD'] = test_collections_crud()
    
    # Print summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for test_name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {test_name}")
    
    print("\n" + "="*80)
    print(f"TOTAL: {passed}/{total} tests passed ({passed*100//total}%)")
    print("="*80)
    
    return passed == total

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
