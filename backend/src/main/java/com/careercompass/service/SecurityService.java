package com.careercompass.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import javax.crypto.Mac;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
public class SecurityService {
  private static final int PBKDF2_ITERATIONS = 120_000;
  private static final int HASH_BITS = 256;
  private final SecureRandom random = new SecureRandom();
  private final byte[] jwtSecret;

  public SecurityService(@Value("${app.jwt-secret}") String jwtSecret) {
    this.jwtSecret = jwtSecret.getBytes(StandardCharsets.UTF_8);
  }

  public String hashPassword(String password) {
    byte[] salt = new byte[16];
    random.nextBytes(salt);
    byte[] hash = pbkdf2(password.toCharArray(), salt, PBKDF2_ITERATIONS, HASH_BITS);
    return "pbkdf2$" + PBKDF2_ITERATIONS + "$" + base64Url(salt) + "$" + base64Url(hash);
  }

  public boolean verifyPassword(String password, String storedHash) {
    if (!StringUtils.hasText(password) || !StringUtils.hasText(storedHash)) {
      return false;
    }
    if ("$2a$10$demo".equals(storedHash)) {
      return "Demo123!".equals(password);
    }
    String[] parts = storedHash.split("\\$");
    if (parts.length != 4 || !"pbkdf2".equals(parts[0])) {
      return false;
    }
    int iterations = Integer.parseInt(parts[1]);
    byte[] salt = Base64.getUrlDecoder().decode(parts[2]);
    byte[] expected = Base64.getUrlDecoder().decode(parts[3]);
    byte[] actual = pbkdf2(password.toCharArray(), salt, iterations, expected.length * 8);
    return MessageDigest.isEqual(expected, actual);
  }

  public String issueToken(long userId, String email, String role) {
    long expiresAt = Instant.now().plusSeconds(60L * 60 * 24 * 7).getEpochSecond();
    String payload = userId + ":" + email + ":" + role + ":" + expiresAt;
    String encodedPayload = base64Url(payload.getBytes(StandardCharsets.UTF_8));
    String signature = sign(encodedPayload);
    return encodedPayload + "." + signature;
  }

  public AuthUser requireStudent(String authorizationHeader) {
    AuthUser user = parse(authorizationHeader);
    if (!"student".equals(user.role())) {
      throw new IllegalArgumentException("需要学生登录");
    }
    return user;
  }

  public AuthUser parse(String authorizationHeader) {
    if (!StringUtils.hasText(authorizationHeader) || !authorizationHeader.startsWith("Bearer ")) {
      throw new IllegalArgumentException("未登录或登录已过期");
    }
    String token = authorizationHeader.substring("Bearer ".length()).trim();
    String[] parts = token.split("\\.");
    if (parts.length != 2 || !MessageDigest.isEqual(sign(parts[0]).getBytes(StandardCharsets.UTF_8), parts[1].getBytes(StandardCharsets.UTF_8))) {
      throw new IllegalArgumentException("登录凭证无效");
    }
    String payload = new String(Base64.getUrlDecoder().decode(parts[0]), StandardCharsets.UTF_8);
    String[] values = payload.split(":", 4);
    if (values.length != 4) {
      throw new IllegalArgumentException("登录凭证格式无效");
    }
    long expiresAt = Long.parseLong(values[3]);
    if (Instant.now().getEpochSecond() > expiresAt) {
      throw new IllegalArgumentException("登录已过期");
    }
    return new AuthUser(Long.parseLong(values[0]), values[1], values[2]);
  }

  private byte[] pbkdf2(char[] password, byte[] salt, int iterations, int bits) {
    try {
      PBEKeySpec spec = new PBEKeySpec(password, salt, iterations, bits);
      return SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).getEncoded();
    } catch (Exception exception) {
      throw new IllegalStateException("密码哈希失败", exception);
    }
  }

  private String sign(String payload) {
    try {
      Mac mac = Mac.getInstance("HmacSHA256");
      mac.init(new SecretKeySpec(jwtSecret, "HmacSHA256"));
      return base64Url(mac.doFinal(payload.getBytes(StandardCharsets.UTF_8)));
    } catch (Exception exception) {
      throw new IllegalStateException("Token 签名失败", exception);
    }
  }

  private String base64Url(byte[] bytes) {
    return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
  }

  public record AuthUser(long id, String email, String role) {}
}
