package com.careercompass.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;

class SecurityServiceTest {
  private final SecurityService security = new SecurityService("test-secret-with-enough-length-123456");

  @Test
  void verifiesPbkdf2PasswordHashes() {
    String hash = security.hashPassword("Demo123!");

    assertTrue(security.verifyPassword("Demo123!", hash));
    assertFalse(security.verifyPassword("Wrong123!", hash));
  }

  @Test
  void issuesAndParsesStudentToken() {
    String token = security.issueToken(42, "2026123456@st.usst.edu.cn", "student");

    SecurityService.AuthUser user = security.requireStudent("Bearer " + token);

    assertEquals(42, user.id());
    assertEquals("2026123456@st.usst.edu.cn", user.email());
    assertEquals("student", user.role());
  }

  @Test
  void rejectsInvalidTokenSignature() {
    String token = security.issueToken(42, "2026123456@st.usst.edu.cn", "student");

    assertThrows(IllegalArgumentException.class, () -> security.parse("Bearer " + token + "tampered"));
  }
}
