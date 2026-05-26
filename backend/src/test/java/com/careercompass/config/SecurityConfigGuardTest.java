package com.careercompass.config;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;

class SecurityConfigGuardTest {
  @Test
  void allowsDefaultSecretsWhenGuardIsDisabledForLocalDevelopment() {
    assertDoesNotThrow(() -> new SecurityConfigGuard(
        false,
        "change-me-admin-token",
        "career-compass-local-secret-change-me"
    ));
  }

  @Test
  void rejectsDefaultSecretsWhenGuardIsEnabled() {
    assertThrows(IllegalStateException.class, () -> new SecurityConfigGuard(
        true,
        "change-me-admin-token",
        "career-compass-local-secret-change-me"
    ));
  }

  @Test
  void acceptsStrongSecretsWhenGuardIsEnabled() {
    assertDoesNotThrow(() -> new SecurityConfigGuard(
        true,
        "admin-token-with-at-least-thirty-two-characters",
        "jwt-secret-with-at-least-thirty-two-characters"
    ));
  }
}
