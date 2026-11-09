package com.yash.api.security;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.data.mongodb.core.MongoTemplate;

class AuthServiceTest {
    private final AuthService auth = new AuthService(mock(MongoTemplate.class), new ObjectMapper());

    @Test
    void verifiesPasswordsCreatedByTheExistingNodeApi() {
        String salt = "00112233445566778899aabbccddeeff";
        String nodeScryptHash = "2cfee740a65f101f93158c74c75b9b86225c667b98a0d69ef97c8d73ec361cd"
                + "0332b410e186b31fb7ef40a250b07990bbdd09f8de9efaa238d04cb0905a36c50";

        assertTrue(auth.verifyPassword("legacy-pass", salt, nodeScryptHash));
        assertFalse(auth.verifyPassword("wrong-pass", salt, nodeScryptHash));
    }

    @Test
    void allowsFiveLoginAttemptsAndRejectsTheSixth() {
        String ip = "192.0.2.10";
        String email = "test@example.com";

        for (int attempt = 0; attempt < 5; attempt++) assertTrue(auth.allowLogin(ip, email));
        assertFalse(auth.allowLogin(ip, email));
    }
}