package com.yash.api.security;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.model.Filters;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.Date;
import java.util.HexFormat;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.bson.Document;
import org.bouncycastle.crypto.generators.SCrypt;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.stereotype.Service;

@Service
public class AuthService {
    private static final long TOKEN_LIFETIME_SECONDS = 60L * 60 * 24 * 30;
    private static final long LOGIN_WINDOW_MILLIS = 15L * 60 * 1000;
    private static final int MAX_LOGIN_ATTEMPTS = 5;
    private final MongoTemplate mongo;
    private final ObjectMapper objectMapper;
    private final SecureRandom secureRandom = new SecureRandom();
    private final ConcurrentHashMap<String, LoginAttempts> loginAttempts = new ConcurrentHashMap<>();

    @Value("${JWT_SECRET:local-dev-secret-change-me}")
    private String jwtSecret;

    public AuthService(MongoTemplate mongo, ObjectMapper objectMapper) {
        this.mongo = mongo;
        this.objectMapper = objectMapper;
    }

    public Document currentUser(HttpServletRequest request) {
        String token = bearerToken(request);
        if (token.isBlank()) token = cookieToken(request, "yash_auth");
        if (token.isBlank()) return null;

        Map<String, Object> payload = verifyToken(token);
        if (payload == null) return null;
        Document session = collection("sessions").find(Filters.eq("tokenHash", tokenHash(token))).first();
        if (session == null) return null;
        Date expiry = session.getDate("expiresAt");
        if (expiry != null && expiry.before(new Date())) return null;
        return collection("users").find(Filters.eq("id", session.getString("userId"))).first();
    }

    public String createToken(Document user) {
        long now = Instant.now().getEpochSecond();
        Map<String, Object> header = Map.of("alg", "HS256", "typ", "JWT");
        Map<String, Object> payload = Map.of(
                "sub", user.getString("id"),
                "role", user.getString("role"),
                "email", user.getString("email"),
                "iat", now,
                "exp", now + TOKEN_LIFETIME_SECONDS);
        String encodedHeader = base64Url(writeJson(header));
        String encodedPayload = base64Url(writeJson(payload));
        String content = encodedHeader + "." + encodedPayload;
        return content + "." + sign(content);
    }

    public void createSession(String userId, String token) {
        collection("sessions").insertOne(new Document("tokenHash", tokenHash(token))
                .append("userId", userId)
                .append("createdAt", new Date())
                .append("expiresAt", new Date(System.currentTimeMillis() + TOKEN_LIFETIME_SECONDS * 1000)));
    }

    public PasswordHash hashPassword(String password) {
        byte[] salt = new byte[16];
        secureRandom.nextBytes(salt);
        String saltHex = HexFormat.of().formatHex(salt);
        byte[] hash = SCrypt.generate(password.getBytes(StandardCharsets.UTF_8), saltHex.getBytes(StandardCharsets.UTF_8), 16384, 8, 1, 64);
        return new PasswordHash(saltHex, HexFormat.of().formatHex(hash));
    }

    public boolean verifyPassword(String password, String saltHex, String expectedHex) {
        try {
            byte[] actual = SCrypt.generate(password.getBytes(StandardCharsets.UTF_8), saltHex.getBytes(StandardCharsets.UTF_8), 16384, 8, 1, 64);
            return MessageDigest.isEqual(actual, HexFormat.of().parseHex(expectedHex));
        } catch (RuntimeException error) {
            return false;
        }
    }

    public boolean allowLogin(String ip, String email) {
        String key = ip + ":" + (email == null ? "" : email.toLowerCase());
        long now = System.currentTimeMillis();
        boolean[] allowed = {true};
        loginAttempts.compute(key, (ignored, current) -> {
            if (current == null || current.expiresAt <= now) return new LoginAttempts(1, now + LOGIN_WINDOW_MILLIS);
            if (current.count >= MAX_LOGIN_ATTEMPTS) {
                allowed[0] = false;
                return current;
            }
            current.count++;
            return current;
        });
        return allowed[0];
    }

    public void clearLoginAttempts(String ip, String email) {
        loginAttempts.remove(ip + ":" + (email == null ? "" : email.toLowerCase()));
    }

    public String tokenHash(String token) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (Exception error) {
            throw new IllegalStateException("SHA-256 is unavailable", error);
        }
    }

    private Map<String, Object> verifyToken(String token) {
        try {
            String[] parts = token.split("\\.");
            if (parts.length != 3) return null;
            String content = parts[0] + "." + parts[1];
            byte[] expected = sign(content).getBytes(StandardCharsets.US_ASCII);
            byte[] actual = parts[2].getBytes(StandardCharsets.US_ASCII);
            if (!MessageDigest.isEqual(expected, actual)) return null;
            Map<String, Object> payload = objectMapper.readValue(
                    Base64.getUrlDecoder().decode(parts[1]), new TypeReference<>() {});
            Object expiry = payload.get("exp");
            if (expiry instanceof Number number && number.longValue() < Instant.now().getEpochSecond()) return null;
            return payload;
        } catch (Exception error) {
            return null;
        }
    }

    private String sign(String content) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(jwtSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(mac.doFinal(content.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception error) {
            throw new IllegalStateException("Could not sign token", error);
        }
    }

    private String writeJson(Object value) {
        try { return objectMapper.writeValueAsString(value); }
        catch (Exception error) { throw new IllegalStateException("Could not encode token", error); }
    }

    private static String base64Url(String value) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(value.getBytes(StandardCharsets.UTF_8));
    }

    private static String bearerToken(HttpServletRequest request) {
        String authorization = request.getHeader("Authorization");
        if (authorization == null || !authorization.startsWith("Bearer ")) return "";
        return authorization.substring(7).trim();
    }

    private static String cookieToken(HttpServletRequest request, String name) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) return "";
        for (Cookie cookie : cookies) if (name.equals(cookie.getName())) return cookie.getValue();
        return "";
    }

    private MongoCollection<Document> collection(String name) {
        return mongo.getCollection(name);
    }

    public record PasswordHash(String salt, String hash) { }

    private static final class LoginAttempts {
        private int count;
        private final long expiresAt;
        private LoginAttempts(int count, long expiresAt) { this.count = count; this.expiresAt = expiresAt; }
    }
}