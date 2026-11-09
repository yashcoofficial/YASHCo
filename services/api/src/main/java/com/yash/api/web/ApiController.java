package com.yash.api.web;

import com.mongodb.client.MongoCollection;
import com.mongodb.client.model.Filters;
import com.mongodb.client.model.Sorts;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Date;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.regex.Pattern;
import org.bson.Document;
import org.bson.conversions.Bson;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.http.ResponseCookie;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;
import com.yash.api.security.AuthService;
import com.yash.api.security.MailService;
import com.yash.api.data.StoreBootstrap;

@RestController
public class ApiController {
    private final MongoTemplate mongo;
    private final CacheManager caches;
    private final AuthService auth;
    private final MailService mail;
    private final StoreBootstrap bootstrap;
    private final SecureRandom secureRandom = new SecureRandom();

    @Value("${APP_URL:https://yashatelier.store}")
    private String appUrl;
    @Value("${COOKIE_SECURE:false}")
    private boolean secureCookies;

    public ApiController(MongoTemplate mongo, CacheManager caches, AuthService auth, MailService mail, StoreBootstrap bootstrap) {
        this.mongo = mongo;
        this.caches = caches;
        this.auth = auth;
        this.mail = mail;
        this.bootstrap = bootstrap;
    }

    @RequestMapping(path = {"/api", "/api/{*path}"}, method = {
            RequestMethod.GET, RequestMethod.POST, RequestMethod.PUT,
            RequestMethod.PATCH, RequestMethod.DELETE, RequestMethod.OPTIONS
    })
    public ResponseEntity<?> handle(
            HttpServletRequest request,
            HttpServletResponse response,
            @RequestBody(required = false) Map<String, Object> requestBody) {
        String path = request.getRequestURI().replaceFirst("^/api/?", "");
        String[] parts = path.isBlank() ? new String[0] : path.split("/");
        String root = parts.length > 0 ? parts[0] : "";
        String action = parts.length > 1 ? parts[1] : "";
        String id = parts.length > 2 ? parts[2] : "";
        Map<String, Object> body = requestBody == null ? Map.of() : requestBody;
        HttpMethod method = HttpMethod.valueOf(request.getMethod());

        if ("OPTIONS".equals(request.getMethod())) return ResponseEntity.noContent().build();
        if (root.isEmpty() || "health".equals(root)) return ResponseEntity.ok(Map.of("ok", true, "service", "YASH API"));
        bootstrap.ensureSeeded();

        if ("auth".equals(root)) return authRoute(action, request, response, body);
        if ("users".equals(root)) return usersRoute(method, request);

        if ("settings".equals(root)) {
            if (method == HttpMethod.GET) return ResponseEntity.ok(Map.of("settings", cachedSettings()));
            if (method == HttpMethod.PUT) return updateSettings(request, body);
            return notImplemented();
        }
        if ("collections".equals(root)) {
            if (method == HttpMethod.GET) return ResponseEntity.ok(Map.of("collections", cachedCollections()));
            return collectionsMutation(method, action, request, body);
        }
        if ("orders".equals(root)) return ordersRoute(method, action, request, body);
        if ("inquiries".equals(root)) return inquiriesRoute(method, action, request, body);
        if ("feedback".equals(root)) return feedbackRoute(method, action, request, body);
        if ("wishlist".equals(root)) return wishlistRoute(method, action, request, body);
        if ("addresses".equals(root)) return addressesRoute(method, action, request, body);
        if ("admin".equals(root) && "overview".equals(action) && method == HttpMethod.GET) return adminOverview(request);
        if ("admin".equals(root) && "export".equals(action) && method == HttpMethod.GET) return adminExport(id, request);
        if ("products".equals(root)) {
            if (method == HttpMethod.GET) {
                if (!action.isEmpty()) return productById(action);
                return products(request);
            }
            return productsMutation(method, action, request, body);
        }

        return ResponseEntity.status(404).body(Map.of("error", "Not found", "path", path));
    }

    private ResponseEntity<?> authRoute(String action, HttpServletRequest request, HttpServletResponse response, Map<String, Object> body) {
        MongoCollection<Document> users = collection("users");
        if ("register".equals(action) && "POST".equals(request.getMethod())) {
            String email = string(body.get("email")).toLowerCase();
            String password = string(body.get("password"));
            if (email.isBlank() || password.isBlank()) return error(400, "Email and password required");
            if (users.find(Filters.eq("email", email)).first() != null) return error(400, "Email already registered");
            AuthService.PasswordHash hash = auth.hashPassword(password);
            Document user = new Document("id", java.util.UUID.randomUUID().toString())
                    .append("email", email)
                    .append("name", value(body, "name", email.substring(0, email.indexOf('@'))))
                    .append("phone", value(body, "phone", ""))
                    .append("role", "customer")
                    .append("passwordSalt", hash.salt())
                    .append("passwordHash", hash.hash())
                    .append("createdAt", new Date());
            users.insertOne(user);
            String token = auth.createToken(user);
            auth.createSession(user.getString("id"), token);
            setAuthCookie(response, token, secureCookies || request.isSecure());
            return ResponseEntity.ok(Map.of("token", token, "user", publicDocument(user)));
        }
        if ("login".equals(action) && "POST".equals(request.getMethod())) {
            String email = string(body.get("email")).toLowerCase();
            String password = string(body.get("password"));
            String ip = clientIp(request);
            if (!auth.allowLogin(ip, email)) return error(429, "Too many login attempts. Please try again shortly.");
            Document user = users.find(Filters.eq("email", email)).first();
            if (user == null || !auth.verifyPassword(password, user.getString("passwordSalt"), user.getString("passwordHash"))) {
                return error(401, "Invalid credentials");
            }
            String token = auth.createToken(user);
            auth.createSession(user.getString("id"), token);
            auth.clearLoginAttempts(ip, email);
            setAuthCookie(response, token, secureCookies || request.isSecure());
            sendLoginNotification(user, request);
            return ResponseEntity.ok(Map.of("token", token, "user", publicDocument(user)));
        }
        if ("me".equals(action) && "GET".equals(request.getMethod())) {
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("user", safeUser(auth.currentUser(request)));
            return ResponseEntity.ok(result);
        }
        if ("logout".equals(action) && "POST".equals(request.getMethod())) {
            String token = bearer(request);
            if (token.isBlank()) token = cookie(request, "yash_auth");
            if (!token.isBlank()) collection("sessions").deleteOne(Filters.eq("tokenHash", auth.tokenHash(token)));
            response.addHeader("Set-Cookie", ResponseCookie.from("yash_auth", "").httpOnly(true).path("/").maxAge(0).build().toString());
            return ResponseEntity.ok(Map.of("ok", true));
        }
        if ("forgot".equals(action) && "POST".equals(request.getMethod())) {
            String email = string(body.get("email")).toLowerCase();
            Document user = users.find(Filters.eq("email", email)).first();
            if (user != null) {
                byte[] bytes = new byte[24];
                secureRandom.nextBytes(bytes);
                String resetToken = HexFormat.of().formatHex(bytes);
                String resetHash = auth.tokenHash(resetToken);
                String resetUrl = appUrl.replaceAll("/+$", "") + "/reset?token=" + URLEncoder.encode(resetToken, StandardCharsets.UTF_8);
                collection("resetTokens").deleteMany(Filters.eq("userId", user.getString("id")));
                collection("resetTokens").insertOne(new Document("tokenHash", resetHash)
                        .append("userId", user.getString("id"))
                        .append("createdAt", new Date())
                        .append("expiresAt", new Date(System.currentTimeMillis() + 30L * 60 * 1000)));
                String text = "Hello " + value(user, "name", "there") + ",\n\nUse this secure link to reset your YASH password:\n" + resetUrl;
                mail.send(email, null, "Password reset request - YASH", text, "<p>Use the secure link below to reset your YASH password.</p><p><a href=\"" + resetUrl + "\">Reset password</a></p>");
            }
            return ResponseEntity.ok(Map.of("ok", true, "message", "If the account exists, a reset link has been sent."));
        }
        if ("reset".equals(action) && "POST".equals(request.getMethod())) {
            String token = string(body.get("token"));
            String newPassword = string(body.get("newPassword"));
            if (token.isBlank()) return error(400, "Reset token required");
            if (newPassword.length() < 8) return error(400, "Password must be at least 8 characters");
            String tokenHash = auth.tokenHash(token);
            Document reset = collection("resetTokens").find(Filters.eq("tokenHash", tokenHash)).first();
            if (reset == null) return error(400, "Invalid or expired token");
            if (reset.getDate("expiresAt").before(new Date())) return error(400, "Token expired");
            AuthService.PasswordHash hash = auth.hashPassword(newPassword);
            users.updateOne(Filters.eq("id", reset.getString("userId")), new Document("$set", new Document("passwordSalt", hash.salt()).append("passwordHash", hash.hash())));
            collection("resetTokens").deleteOne(Filters.eq("tokenHash", tokenHash));
            return ResponseEntity.ok(Map.of("ok", true));
        }
        return error(404, "Not found");
    }

    private ResponseEntity<?> usersRoute(HttpMethod method, HttpServletRequest request) {
        Document user = auth.currentUser(request);
        if (user == null) return error(401, "Unauthorized");
        if (!"admin".equals(user.getString("role"))) return error(403, "Forbidden");
        if (method != HttpMethod.GET) return error(404, "Not found");
        List<Map<String, Object>> users = collection("users").find(Filters.ne("role", "admin"))
                .sort(Sorts.descending("createdAt")).into(new ArrayList<>()).stream()
                .map(ApiController::publicDocument).toList();
        return ResponseEntity.ok(Map.of("users", users));
    }

    private ResponseEntity<?> ordersRoute(HttpMethod method, String id, HttpServletRequest request, Map<String, Object> body) {
        Document user = auth.currentUser(request);
        MongoCollection<Document> orders = collection("orders");
        if (method == HttpMethod.POST && id.isEmpty()) {
            if (user == null) return error(401, "Unauthorized");
            if (!(body.get("items") instanceof List<?> submitted) || submitted.isEmpty()) return error(400, "A valid cart is required");
            List<String> productIds = submitted.stream().filter(Map.class::isInstance)
                    .map(item -> string(((Map<?, ?>) item).get("id"))).filter(value -> !value.isBlank()).distinct().toList();
            List<Document> products = collection("products").find(Filters.and(Filters.in("id", productIds), Filters.ne("hidden", true))).into(new ArrayList<>());
            Map<String, Document> byId = new LinkedHashMap<>();
            products.forEach(product -> byId.put(product.getString("id"), product));
            List<Map<String, Object>> orderItems = new ArrayList<>();
            for (Object value : submitted) {
                if (!(value instanceof Map<?, ?> item)) return error(400, "A valid cart is required");
                Document product = byId.get(string(item.get("id")));
                if (product == null) return error(400, "One or more products are unavailable");
                double originalPrice = number(product.get("price"));
                double price = offerPrice(product);
                int quantity = Math.max(1, (int) number(item.get("qty")));
                Map<String, Object> orderItem = new LinkedHashMap<>();
                orderItem.put("key", valueOr(item.get("key"), product.getString("id") + "|" + valueOr(item.get("size"), "") + "|" + valueOr(item.get("color"), "")));
                orderItem.put("id", product.getString("id"));
                orderItem.put("name", product.getString("name"));
                orderItem.put("collection", product.getString("collection"));
                orderItem.put("slug", product.getString("slug"));
                orderItem.put("price", price);
                if (price < originalPrice) orderItem.put("originalPrice", originalPrice);
                orderItem.put("shipping", Math.max(0, number(product.get("shipping"))));
                orderItem.put("image", firstImage(product));
                orderItem.put("size", valueOr(item.get("size"), ""));
                orderItem.put("color", valueOr(item.get("color"), ""));
                orderItem.put("qty", quantity);
                orderItems.add(orderItem);
            }
            double shipping = orderItems.stream().mapToDouble(item -> number(item.get("shipping")) * number(item.get("qty"))).sum();
            String submittedPromo = string(body.get("promoCode")).trim().toUpperCase();
            String promo = List.of("YASH15", "ROHAN20").contains(submittedPromo) ? submittedPromo : "";
            Map<String, Object> bill = calculateBill(orderItems, shipping, promo);
            Date now = new Date();
                String orderNumber = "YSH" + String.format("%08d", System.currentTimeMillis() % 100_000_000L);
            Document order = new Document("id", java.util.UUID.randomUUID().toString())
                    .append("orderNumber", orderNumber)
                    .append("userId", user.getString("id"))
                    .append("customerName", value(body, "customerName", value(user, "name", "")))
                    .append("customerEmail", value(body, "customerEmail", value(user, "email", "")))
                    .append("customerPhone", value(body, "customerPhone", ""))
                    .append("items", orderItems)
                    .append("promoCode", Boolean.TRUE.equals(bill.get("discountEligible")) ? promo : "")
                    .append("subtotal", bill.get("subtotal"))
                    .append("discount", bill.get("discount"))
                    .append("shipping", bill.get("shipping"))
                    .append("total", bill.get("total"))
                    .append("shippingAddress", body.getOrDefault("shippingAddress", Map.of()))
                    .append("notes", value(body, "notes", ""))
                    .append("status", "Enquiry Received")
                    .append("paymentStatus", "Awaiting Confirmation")
                    .append("trackingNumber", "")
                    .append("createdAt", now)
                    .append("history", List.of(Map.of("status", "Enquiry Received", "at", now, "note", "We have received your enquiry.")));
            orders.insertOne(order);
            return ResponseEntity.ok(Map.of("order", publicDocument(order)));
        }
        if (method == HttpMethod.GET && id.isEmpty()) {
            if (user == null) return error(401, "Unauthorized");
            Bson filter = "admin".equals(user.getString("role")) ? new Document() : Filters.eq("userId", user.getString("id"));
            List<Map<String, Object>> result = orders.find(filter).sort(Sorts.descending("createdAt"))
                    .into(new ArrayList<>()).stream().map(ApiController::publicDocument).toList();
            return ResponseEntity.ok(Map.of("orders", result));
        }
        if (method == HttpMethod.GET && !id.isEmpty()) {
            if (user == null) return error(401, "Unauthorized");
            Document order = orders.find(Filters.eq("id", id)).first();
            if (order == null) return error(404, "Not found");
            if (!"admin".equals(user.getString("role")) && !Objects.equals(user.getString("id"), order.getString("userId"))) return error(403, "Forbidden");
            return ResponseEntity.ok(Map.of("order", publicDocument(order)));
        }
        if ((method == HttpMethod.PUT || method == HttpMethod.DELETE) && !id.isEmpty()) {
            ResponseEntity<?> adminError = adminRequired(request);
            if (adminError != null) return adminError;
            if (method == HttpMethod.DELETE) {
                orders.deleteOne(Filters.eq("id", id));
                return ResponseEntity.ok(Map.of("ok", true));
            }
            Document changes = new Document();
            if (body.get("status") != null) changes.put("status", body.get("status"));
            if (body.get("paymentStatus") != null) changes.put("paymentStatus", body.get("paymentStatus"));
            if (body.containsKey("trackingNumber")) changes.put("trackingNumber", body.get("trackingNumber"));
            if (body.containsKey("adminNotes")) changes.put("adminNotes", body.get("adminNotes"));
            Document update = new Document("$set", changes);
            if (body.get("status") != null) update.put("$push", new Document("history", new Document("status", body.get("status"))
                    .append("at", new Date()).append("note", value(body, "historyNote", ""))));
            orders.updateOne(Filters.eq("id", id), update);
            return ResponseEntity.ok(single("order", publicDocument(orders.find(Filters.eq("id", id)).first())));
        }
        return error(404, "Not found");
    }

    private ResponseEntity<?> inquiriesRoute(HttpMethod method, String id, HttpServletRequest request, Map<String, Object> body) {
        MongoCollection<Document> inquiries = collection("inquiries");
        Document user = auth.currentUser(request);
        if (method == HttpMethod.POST && id.isEmpty()) {
            if (List.of("name", "email", "phone", "message").stream().anyMatch(key -> string(body.get(key)).isBlank())) {
                return error(400, "name, email, phone and message are required");
            }
            Document inquiry = new Document("id", java.util.UUID.randomUUID().toString())
                    .append("userId", user == null ? null : user.getString("id"))
                    .append("name", body.get("name")).append("email", body.get("email"))
                    .append("phone", body.get("phone")).append("subject", value(body, "subject", "General Enquiry"))
                    .append("message", body.get("message")).append("productId", body.get("productId"))
                    .append("status", "New").append("response", "").append("createdAt", new Date());
            inquiries.insertOne(inquiry);
            return ResponseEntity.ok(Map.of("inquiry", publicDocument(inquiry)));
        }
        if (method == HttpMethod.GET) {
            if (user == null) return error(401, "Unauthorized");
            Bson filter = Filters.ne("subject", "Website Feedback");
            if (!"admin".equals(user.getString("role"))) filter = Filters.and(filter, Filters.eq("userId", user.getString("id")));
            List<Map<String, Object>> result = inquiries.find(filter).sort(Sorts.descending("createdAt"))
                    .into(new ArrayList<>()).stream().map(ApiController::publicDocument).toList();
            return ResponseEntity.ok(Map.of("inquiries", result));
        }
        if (!id.isEmpty() && (method == HttpMethod.PUT || method == HttpMethod.DELETE)) {
            ResponseEntity<?> adminError = adminRequired(request);
            if (adminError != null) return adminError;
            if (method == HttpMethod.DELETE) {
                inquiries.deleteOne(Filters.eq("id", id));
                return ResponseEntity.ok(Map.of("ok", true));
            }
            Document changes = new Document(body);
            changes.remove("_id");
            changes.remove("id");
            inquiries.updateOne(Filters.eq("id", id), new Document("$set", changes));
            return ResponseEntity.ok(single("inquiry", publicDocument(inquiries.find(Filters.eq("id", id)).first())));
        }
        return error(404, "Not found");
    }

    private ResponseEntity<?> feedbackRoute(HttpMethod method, String id, HttpServletRequest request, Map<String, Object> body) {
        MongoCollection<Document> feedback = collection("feedback");
        if (method == HttpMethod.POST && id.isEmpty()) {
            if (string(body.get("name")).isBlank() || string(body.get("email")).isBlank() || string(body.get("message")).isBlank()) {
                return error(400, "name, email and message are required");
            }
            Document user = auth.currentUser(request);
            Document item = new Document("id", java.util.UUID.randomUUID().toString())
                    .append("userId", user == null ? null : user.getString("id"))
                    .append("name", body.get("name")).append("email", body.get("email"))
                    .append("message", body.get("message")).append("status", "New").append("createdAt", new Date());
            feedback.insertOne(item);
            return ResponseEntity.ok(Map.of("feedback", publicDocument(item)));
        }
        ResponseEntity<?> adminError = adminRequired(request);
        if (adminError != null) return adminError;
        if (method == HttpMethod.GET && id.isEmpty()) {
            List<Map<String, Object>> items = feedback.find().sort(Sorts.descending("createdAt"))
                    .into(new ArrayList<>()).stream().map(ApiController::publicDocument).toList();
            return ResponseEntity.ok(Map.of("feedback", items));
        }
        if (method == HttpMethod.DELETE && !id.isEmpty()) {
            feedback.deleteOne(Filters.eq("id", id));
            return ResponseEntity.ok(Map.of("ok", true));
        }
        return error(404, "Not found");
    }

    private ResponseEntity<?> wishlistRoute(HttpMethod method, String productId, HttpServletRequest request, Map<String, Object> body) {
        Document user = auth.currentUser(request);
        if (user == null) return error(401, "Unauthorized");
        MongoCollection<Document> wishlists = collection("wishlists");
        String userId = user.getString("id");
        if (method == HttpMethod.GET) {
            Document wishlist = wishlists.find(Filters.eq("userId", userId)).first();
            List<String> savedIds = wishlist == null ? List.of() : strings(wishlist.get("productIds"));
            List<Map<String, Object>> products = savedIds.isEmpty() ? List.of()
                    : collection("products").find(Filters.and(Filters.in("id", savedIds), Filters.ne("hidden", true)))
                            .into(new ArrayList<>()).stream().map(ApiController::publicDocument).toList();
            List<String> availableIds = products.stream().map(product -> string(product.get("id"))).toList();
            return ResponseEntity.ok(Map.of("productIds", availableIds, "products", products));
        }
        if (method == HttpMethod.POST) {
            String requestedId = string(body.get("productId"));
            if (requestedId.isBlank()) return error(400, "Product ID required");
            wishlists.updateOne(Filters.eq("userId", userId), new Document("$addToSet", new Document("productIds", requestedId)),
                    new com.mongodb.client.model.UpdateOptions().upsert(true));
            return ResponseEntity.ok(Map.of("ok", true));
        }
        if (method == HttpMethod.DELETE && !productId.isEmpty()) {
            wishlists.updateOne(Filters.eq("userId", userId), new Document("$pull", new Document("productIds", productId)));
            return ResponseEntity.ok(Map.of("ok", true));
        }
        return error(404, "Not found");
    }

    private ResponseEntity<?> addressesRoute(HttpMethod method, String id, HttpServletRequest request, Map<String, Object> body) {
        Document user = auth.currentUser(request);
        if (user == null) return error(401, "Unauthorized");
        MongoCollection<Document> addresses = collection("addresses");
        String userId = user.getString("id");
        if (method == HttpMethod.GET) {
            List<Map<String, Object>> items = addresses.find(Filters.eq("userId", userId)).into(new ArrayList<>())
                    .stream().map(ApiController::publicDocument).toList();
            return ResponseEntity.ok(Map.of("addresses", items));
        }
        if (method == HttpMethod.POST) {
            Document address = new Document(body);
            address.remove("_id");
            address.remove("id");
            address.put("id", java.util.UUID.randomUUID().toString());
            address.put("userId", userId);
            address.put("createdAt", new Date());
            addresses.insertOne(address);
            return ResponseEntity.ok(Map.of("address", publicDocument(address)));
        }
        if (method == HttpMethod.PUT && !id.isEmpty()) {
            Document changes = new Document(body);
            changes.remove("_id");
            changes.remove("id");
            changes.remove("userId");
            addresses.updateOne(Filters.and(Filters.eq("id", id), Filters.eq("userId", userId)), new Document("$set", changes));
            return ResponseEntity.ok(single("address", publicDocument(addresses.find(Filters.eq("id", id)).first())));
        }
        if (method == HttpMethod.DELETE && !id.isEmpty()) {
            addresses.deleteOne(Filters.and(Filters.eq("id", id), Filters.eq("userId", userId)));
            return ResponseEntity.ok(Map.of("ok", true));
        }
        return error(404, "Not found");
    }

    private ResponseEntity<?> adminOverview(HttpServletRequest request) {
        ResponseEntity<?> adminError = adminRequired(request);
        if (adminError != null) return adminError;
        long productCount = collection("products").countDocuments();
        long orderCount = collection("orders").countDocuments();
        long inquiryCount = collection("inquiries").countDocuments(Filters.eq("status", "New"));
        long userCount = collection("users").countDocuments();
        Bson lowStockFilter = Filters.expr(new Document("$lte", List.of("$stock", "$lowStockThreshold")));
        List<Map<String, Object>> lowStock = collection("products").find(lowStockFilter).into(new ArrayList<>())
                .stream().map(ApiController::publicDocument).toList();
        return ResponseEntity.ok(Map.of("productCount", productCount, "orderCount", orderCount,
                "inquiryCount", inquiryCount, "userCount", userCount, "lowStock", lowStock));
    }

    private ResponseEntity<?> adminExport(String type, HttpServletRequest request) {
        ResponseEntity<?> adminError = adminRequired(request);
        if (adminError != null) return adminError;
        String sheetName;
        List<Map<String, Object>> rows;
        List<String[]> columns;
        if ("clients".equals(type)) {
            sheetName = "clients";
            rows = collection("users").find(Filters.ne("role", "admin")).sort(Sorts.descending("createdAt"))
                    .into(new ArrayList<>()).stream().map(ApiController::publicDocument).toList();
            columns = List.of(new String[]{"id", "Client ID"}, new String[]{"name", "Name"}, new String[]{"email", "Email"},
                    new String[]{"phone", "Phone"}, new String[]{"role", "Role"}, new String[]{"createdAt", "Joined"});
        } else if ("orders".equals(type)) {
            sheetName = "orders";
            rows = collection("orders").find().sort(Sorts.descending("createdAt")).into(new ArrayList<>())
                    .stream().map(ApiController::publicDocument).toList();
            columns = List.of(new String[]{"id", "Order ID"}, new String[]{"orderNumber", "Order Number"},
                    new String[]{"userId", "Client ID"}, new String[]{"customerName", "Customer Name"},
                    new String[]{"customerEmail", "Customer Email"}, new String[]{"customerPhone", "Customer Phone"},
                    new String[]{"subtotal", "Subtotal"}, new String[]{"discount", "Discount"}, new String[]{"shipping", "Shipping"},
                    new String[]{"total", "Total"}, new String[]{"status", "Status"}, new String[]{"paymentStatus", "Payment Status"},
                    new String[]{"trackingNumber", "Tracking Number"}, new String[]{"createdAt", "Created"});
        } else {
            return error(404, "Not found");
        }
        StringBuilder xml = new StringBuilder("<?xml version=\"1.0\"?><Workbook xmlns=\"urn:schemas-microsoft-com:office:spreadsheet\" xmlns:ss=\"urn:schemas-microsoft-com:office:spreadsheet\"><Worksheet ss:Name=\"")
                .append(sheetName).append("\"><Table><Row>");
        for (String[] column : columns) xml.append(excelCell(column[1]));
        xml.append("</Row>");
        for (Map<String, Object> row : rows) {
            xml.append("<Row>");
            for (String[] column : columns) xml.append(excelCell(row.get(column[0])));
            xml.append("</Row>");
        }
        xml.append("</Table></Worksheet></Workbook>");
        return ResponseEntity.ok().header("Content-Type", "application/vnd.ms-excel; charset=utf-8")
                .header("Content-Disposition", "attachment; filename=\"yash-" + sheetName + ".xls\"").body(xml.toString());
    }

    private static String excelCell(Object value) {
        String text = value instanceof Date date ? date.toInstant().toString() : string(value);
        String escaped = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;");
        return "<Cell><Data ss:Type=\"String\">" + escaped + "</Data></Cell>";
    }

    private static Map<String, Object> calculateBill(List<Map<String, Object>> items, double shipping, String promoCode) {
        double subtotal = items.stream().mapToDouble(item -> number(item.get("price")) * number(item.get("qty"))).sum();
        boolean eligible = "YASH15".equals(promoCode) ? subtotal > 4999 : "ROHAN20".equals(promoCode) && subtotal > 0;
        double discount = !eligible ? 0 : "ROHAN20".equals(promoCode)
                ? Math.round(items.stream().mapToDouble(item -> number(item.get("price")) * number(item.get("qty")) * 0.20).sum())
                : Math.round(subtotal * 0.15);
        return Map.of("subtotal", subtotal, "discount", discount, "shipping", shipping, "total", subtotal - discount + shipping, "discountEligible", eligible);
    }

    private static double offerPrice(Document product) {
        double price = number(product.get("price"));
        double salePrice = number(product.get("salePrice"));
        return salePrice > 0 && salePrice < price ? salePrice : price;
    }

    private static double number(Object value) {
        if (value instanceof Number number) return number.doubleValue();
        try { return Double.parseDouble(string(value)); } catch (RuntimeException ignored) { return 0; }
    }

    private static String firstImage(Document product) {
        Object images = product.get("images");
        return images instanceof List<?> list && !list.isEmpty() ? string(list.get(0)) : "";
    }

    private static String valueOr(Object value, String fallback) { return value == null ? fallback : String.valueOf(value); }

    private static List<String> strings(Object value) {
        if (!(value instanceof List<?> list)) return List.of();
        return list.stream().map(String::valueOf).toList();
    }

    private static Map<String, Object> single(String key, Object value) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put(key, value);
        return result;
    }

    private void sendLoginNotification(Document user, HttpServletRequest request) {
        String userAgent = request.getHeader("User-Agent");
        String forwarded = request.getHeader("x-forwarded-for");
        String text = "Your account was accessed successfully.\n\nTime: " + Instant.now()
                + "\nDevice: " + device(userAgent) + "\nBrowser: " + browser(userAgent)
                + "\nIP: " + clientIp(request) + "\nLocation: " + value(request.getHeader("x-vercel-ip-country"), "Unavailable");
        mail.send(user.getString("email"), "concierge@yashatelier.store", "Login Successful - YASH", text, "<p>" + text.replace("\n", "<br />") + "</p>");
    }

    private static void setAuthCookie(HttpServletResponse response, String token, boolean secure) {
        response.addHeader("Set-Cookie", ResponseCookie.from("yash_auth", token)
                .httpOnly(true).sameSite("Lax").secure(secure).path("/").maxAge(60L * 60 * 24 * 30).build().toString());
    }

    private static String clientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("x-forwarded-for");
        if (forwarded == null || forwarded.isBlank()) forwarded = request.getHeader("x-real-ip");
        return forwarded == null || forwarded.isBlank() ? "local" : forwarded.split(",")[0].trim();
    }

    private static String bearer(HttpServletRequest request) {
        String authorization = request.getHeader("Authorization");
        return authorization != null && authorization.startsWith("Bearer ") ? authorization.substring(7).trim() : "";
    }

    private static String cookie(HttpServletRequest request, String name) {
        if (request.getCookies() == null) return "";
        for (var cookie : request.getCookies()) if (name.equals(cookie.getName())) return cookie.getValue();
        return "";
    }

    private static String device(String userAgent) {
        String ua = userAgent == null ? "" : userAgent;
        if (ua.contains("iPhone")) return "iPhone";
        if (ua.contains("Android")) return "Android";
        if (ua.contains("Mac")) return "Mac";
        if (ua.contains("Windows")) return "Windows";
        return "Desktop";
    }

    private static String browser(String userAgent) {
        String ua = userAgent == null ? "" : userAgent;
        if (ua.contains("Chrome")) return "Chrome";
        if (ua.contains("Firefox")) return "Firefox";
        if (ua.contains("Safari")) return "Safari";
        if (ua.contains("Edge")) return "Edge";
        return "Unknown";
    }

    private static Map<String, Object> safeUser(Document user) {
        return user == null ? null : publicDocument(user);
    }

    private static String string(Object value) { return value == null ? "" : String.valueOf(value); }
    private static String value(Map<String, Object> map, String key, String fallback) { return map.get(key) == null ? fallback : String.valueOf(map.get(key)); }
    private static String value(Object value, String fallback) { return value == null ? fallback : String.valueOf(value); }

    private ResponseEntity<?> products(HttpServletRequest request) {
        Map<String, String> params = queryParams(request);
        String cacheKey = String.join("&", params.entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .map(entry -> entry.getKey() + "=" + entry.getValue()).toList());
        Document user = auth.currentUser(request);
        boolean includeHidden = "true".equals(params.get("includeHidden")) && user != null && "admin".equals(user.getString("role"));
        if (includeHidden) return ResponseEntity.ok(Map.of("products", queryProducts(params, true)));

        Cache cache = caches.getCache("public-products");
        List<Map<String, Object>> cached = cache == null ? null : cache.get(cacheKey, List.class);
        if (cached != null) return ResponseEntity.ok(Map.of("products", cached));

        List<Map<String, Object>> products = queryProducts(params, false);
        if (cache != null) cache.put(cacheKey, products);
        return ResponseEntity.ok(Map.of("products", products));
    }

    private List<Map<String, Object>> queryProducts(Map<String, String> params, boolean includeHidden) {
        List<Bson> filters = new ArrayList<>();
        if (!includeHidden) filters.add(Filters.ne("hidden", true));

        String collection = params.get("collection");
        if (collection != null && !collection.isBlank()) {
            List<String> categories = new ArrayList<>(List.of(collection));
            cachedCollections().stream()
                    .filter(item -> Objects.equals(collection, item.get("parentSlug")))
                    .map(item -> (String) item.get("slug"))
                    .forEach(categories::add);
            filters.add(Filters.in("collection", categories));
        }
        if (params.containsKey("color")) filters.add(Filters.in("colors", params.get("color")));
        if (params.containsKey("size")) filters.add(Filters.in("sizes", params.get("size")));
        if (params.containsKey("minPrice")) filters.add(Filters.gte("price", parseInt(params.get("minPrice"), 0)));
        if (params.containsKey("maxPrice")) filters.add(Filters.lte("price", parseInt(params.get("maxPrice"), Integer.MAX_VALUE)));
        if ("true".equals(params.get("featured"))) filters.add(Filters.eq("featured", true));
        if (params.containsKey("search")) filters.add(Filters.regex("name", Pattern.quote(params.get("search")), "i"));

        Bson filter = filters.isEmpty() ? new Document() : Filters.and(filters);
        String sort = params.get("sort");
        Bson sortBy = "price_asc".equals(sort) ? Sorts.ascending("price")
                : "price_desc".equals(sort) ? Sorts.descending("price")
                : Sorts.orderBy(Sorts.ascending("sortOrder"), Sorts.descending("createdAt"));
        return collection("products").find(filter).sort(sortBy).into(new ArrayList<>()).stream()
                .map(ApiController::publicDocument).toList();
    }

    private ResponseEntity<?> productById(String id) {
        Document product = collection("products").find(Filters.and(Filters.eq("id", id), Filters.ne("hidden", true))).first();
        if (product == null) return ResponseEntity.status(404).body(Map.of("error", "Not found"));
        return ResponseEntity.ok(Map.of("product", publicDocument(product)));
    }

    private ResponseEntity<?> productsMutation(HttpMethod method, String id, HttpServletRequest request, Map<String, Object> body) {
        ResponseEntity<?> authError = adminRequired(request);
        if (authError != null) return authError;
        MongoCollection<Document> products = collection("products");

        if (method == HttpMethod.PUT && "reorder".equals(id)) {
            Object value = body.get("productIds");
            if (!(value instanceof List<?> productIds)) return error(400, "Product order must be an array");
            for (int index = 0; index < productIds.size(); index++) {
                products.updateOne(Filters.eq("id", String.valueOf(productIds.get(index))),
                        new Document("$set", new Document("sortOrder", index)));
            }
            clearProductCache();
            return ResponseEntity.ok(Map.of("ok", true));
        }
        if (method == HttpMethod.POST && id.isEmpty()) {
            int sortOrder = (int) products.countDocuments();
            String name = value(body, "name", "Untitled");
            Document product = new Document("id", java.util.UUID.randomUUID().toString())
                    .append("name", name)
                    .append("slug", slug(name))
                    .append("description", value(body, "description", ""))
                    .append("collection", value(body, "collection", "womenswear"))
                    .append("price", parseInt(value(body, "price", "0"), 0))
                    .append("shipping", Math.max(0, parseInt(value(body, "shipping", "0"), 0)))
                    .append("salePrice", parseNullableInt(body.get("salePrice")))
                    .append("onSale", Boolean.TRUE.equals(body.get("onSale")))
                    .append("sku", value(body, "sku", "YSH-" + System.currentTimeMillis()))
                    .append("stock", parseInt(value(body, "stock", "0"), 0))
                    .append("images", listValue(body.get("images"), List.of()))
                    .append("sizes", listValue(body.get("sizes"), List.of("XS", "S", "M", "L", "XL")))
                    .append("colors", listValue(body.get("colors"), List.of("Noir")))
                    .append("colorHexes", listValue(body.get("colorHexes"), List.of()))
                    .append("material", value(body, "material", ""))
                    .append("care", value(body, "care", ""))
                    .append("sizeGuide", value(body, "sizeGuide", ""))
                    .append("sizeGuideImage", value(body, "sizeGuideImage", ""))
                    .append("outfitProductIds", listValue(body.get("outfitProductIds"), List.of()))
                    .append("featured", Boolean.TRUE.equals(body.get("featured")))
                    .append("hidden", Boolean.TRUE.equals(body.get("hidden")))
                    .append("lowStockThreshold", parseInt(value(body, "lowStockThreshold", "3"), 3))
                    .append("sortOrder", sortOrder)
                    .append("createdAt", new Date());
            products.insertOne(product);
            clearProductCache();
            return ResponseEntity.ok(Map.of("product", publicDocument(product)));
        }
        if (method == HttpMethod.PUT && !id.isEmpty()) {
            Document changes = new Document(body);
            changes.remove("_id");
            changes.remove("id");
            if (changes.containsKey("price")) changes.put("price", parseInt(string(changes.get("price")), 0));
            if (changes.containsKey("salePrice")) changes.put("salePrice", parseNullableInt(changes.get("salePrice")));
            if (changes.containsKey("stock")) changes.put("stock", parseInt(string(changes.get("stock")), 0));
            if (changes.containsKey("shipping")) changes.put("shipping", Math.max(0, parseInt(string(changes.get("shipping")), 0)));
            products.updateOne(Filters.eq("id", id), new Document("$set", changes));
            Document product = products.find(Filters.eq("id", id)).first();
            clearProductCache();
            return ResponseEntity.ok(Map.of("product", publicDocument(product)));
        }
        if (method == HttpMethod.DELETE && !id.isEmpty()) {
            products.deleteOne(Filters.eq("id", id));
            clearProductCache();
            return ResponseEntity.ok(Map.of("ok", true));
        }
        return error(404, "Not found");
    }

    private ResponseEntity<?> collectionsMutation(HttpMethod method, String id, HttpServletRequest request, Map<String, Object> body) {
        ResponseEntity<?> authError = adminRequired(request);
        if (authError != null) return authError;
        MongoCollection<Document> collections = collection("collections");
        if (method == HttpMethod.POST) {
            String name = string(body.get("name"));
            Document collection = new Document("id", java.util.UUID.randomUUID().toString())
                    .append("name", name)
                    .append("slug", slug(value(body, "slug", name)))
                    .append("parentSlug", body.get("parentSlug"))
                    .append("image", value(body, "image", ""))
                    .append("description", value(body, "description", ""))
                    .append("order", parseInt(value(body, "order", "0"), 0));
            collections.insertOne(collection);
            clearCollectionCache();
            return ResponseEntity.ok(Map.of("collection", publicDocument(collection)));
        }
        if (method == HttpMethod.PUT && !id.isEmpty()) {
            Document changes = new Document(body);
            changes.remove("_id");
            changes.remove("id");
            collections.updateOne(Filters.eq("id", id), new Document("$set", changes));
            Document collection = collections.find(Filters.eq("id", id)).first();
            clearCollectionCache();
            return ResponseEntity.ok(Map.of("collection", publicDocument(collection)));
        }
        if (method == HttpMethod.DELETE && !id.isEmpty()) {
            Document deleted = collections.find(Filters.eq("id", id)).first();
            if (deleted != null && deleted.getString("parentSlug") != null) {
                collection("products").updateMany(Filters.eq("collection", deleted.getString("slug")),
                        new Document("$set", new Document("collection", deleted.getString("parentSlug"))));
            }
            collections.deleteOne(Filters.eq("id", id));
            clearCollectionCache();
            clearProductCache();
            return ResponseEntity.ok(Map.of("ok", true));
        }
        return error(404, "Not found");
    }

    private ResponseEntity<?> updateSettings(HttpServletRequest request, Map<String, Object> body) {
        ResponseEntity<?> authError = adminRequired(request);
        if (authError != null) return authError;
        Document changes = new Document(body);
        changes.remove("_id");
        changes.remove("id");
        changes.remove("key");
        changes.put("updatedAt", new Date());
        collection("settings").updateOne(Filters.eq("key", "site"), new Document("$set", changes),
                new com.mongodb.client.model.UpdateOptions().upsert(true));
        Cache cache = caches.getCache("site-settings");
        if (cache != null) cache.evict("site");
        return ResponseEntity.ok(Map.of("settings", cachedSettings()));
    }

    private ResponseEntity<?> adminRequired(HttpServletRequest request) {
        Document user = auth.currentUser(request);
        if (user == null) return error(401, "Unauthorized");
        return "admin".equals(user.getString("role")) ? null : error(403, "Forbidden");
    }

    private void clearProductCache() {
        Cache cache = caches.getCache("public-products");
        if (cache != null) cache.clear();
    }

    private void clearCollectionCache() {
        Cache cache = caches.getCache("collections");
        if (cache != null) cache.evict("all");
    }

    private static String slug(String value) {
        return value == null ? "" : value.toLowerCase().replaceAll("[^a-z0-9]+", "-").replaceAll("^-|-$", "");
    }

    private static Integer parseNullableInt(Object value) {
        if (value == null || string(value).isBlank()) return null;
        return parseInt(string(value), 0);
    }

    private static List<?> listValue(Object value, List<?> fallback) {
        return value instanceof List<?> list ? list : fallback;
    }

    private Map<String, Object> cachedSettings() {
        Cache cache = caches.getCache("site-settings");
        Map<String, Object> cached = cache == null ? null : cache.get("site", Map.class);
        if (cached != null) return cached;
        Document settings = collection("settings").find(Filters.eq("key", "site")).first();
        Map<String, Object> result = publicDocument(settings);
        if (cache != null && result != null) cache.put("site", result);
        return result;
    }

    private List<Map<String, Object>> cachedCollections() {
        Cache cache = caches.getCache("collections");
        List<Map<String, Object>> cached = cache == null ? null : cache.get("all", List.class);
        if (cached != null) return cached;
        List<Map<String, Object>> result = collection("collections").find().sort(Sorts.ascending("order"))
                .into(new ArrayList<>()).stream().map(ApiController::publicDocument).toList();
        if (cache != null) cache.put("all", result);
        return result;
    }

    private MongoCollection<Document> collection(String name) {
        return mongo.getCollection(name);
    }

    private static Map<String, String> queryParams(HttpServletRequest request) {
        Map<String, String> result = new LinkedHashMap<>();
        request.getParameterMap().forEach((key, values) -> {
            if (values.length > 0) result.put(key, values[0]);
        });
        return result;
    }

    private static int parseInt(String value, int fallback) {
        try { return Integer.parseInt(value); } catch (RuntimeException ignored) { return fallback; }
    }

    private static Map<String, Object> publicDocument(Document document) {
        if (document == null) return null;
        Map<String, Object> result = new LinkedHashMap<>(document);
        result.remove("_id");
        result.remove("passwordHash");
        result.remove("passwordSalt");
        return result;
    }

    private static ResponseEntity<?> error(int status, String message) {
        return ResponseEntity.status(status).body(Map.of("error", message));
    }

    private static ResponseEntity<?> notImplemented() {
        return ResponseEntity.status(501).body(Map.of("error", "Endpoint is not available yet"));
    }
}