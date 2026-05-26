package com.careercompass.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

@Component
public class SecurityConfigGuard {
  private static final String DEFAULT_ADMIN_TOKEN = "change-me-admin-token";
  private static final String DEFAULT_JWT_SECRET = "career-compass-local-secret-change-me";

  public SecurityConfigGuard(
      @Value("${app.security.require-strong-secrets:false}") boolean requireStrongSecrets,
      @Value("${app.admin-token}") String adminToken,
      @Value("${app.jwt-secret}") String jwtSecret
  ) {
    if (!requireStrongSecrets) {
      return;
    }
    requireStrongSecret("ADMIN_TOKEN", adminToken, DEFAULT_ADMIN_TOKEN);
    requireStrongSecret("JWT_SECRET", jwtSecret, DEFAULT_JWT_SECRET);
  }

  private void requireStrongSecret(String name, String value, String defaultValue) {
    if (!StringUtils.hasText(value) || defaultValue.equals(value) || value.length() < 32) {
      throw new IllegalStateException(name + " must be set to a non-default value with at least 32 characters");
    }
  }
}
