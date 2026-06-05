package com.careercompass.service;

import com.careercompass.model.Dtos.EmailCodeResult;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
public class EmailVerificationService {
  private final JavaMailSender mailSender;
  private final SecureRandom random = new SecureRandom();
  private final Map<String, CodeEntry> codes = new ConcurrentHashMap<>();
  private final boolean verificationEnabled;
  private final String mailUsername;
  private final String mailPassword;
  private final int ttlMinutes;
  private final int cooldownSeconds;
  private final int maxSendsPerWindow;
  private final int maxAttempts;
  private final StringRedisTemplate redisTemplate;

  public EmailVerificationService(
      JavaMailSender mailSender,
      @Value("${app.mail.verification-enabled:true}") boolean verificationEnabled,
      @Value("${spring.mail.username:}") String mailUsername,
      @Value("${spring.mail.password:}") String mailPassword,
      @Value("${app.mail.code-ttl-minutes:10}") int ttlMinutes,
      @Value("${app.mail.code-cooldown-seconds:60}") int cooldownSeconds,
      @Value("${app.mail.code-max-sends-per-window:3}") int maxSendsPerWindow,
      @Value("${app.mail.code-max-attempts:5}") int maxAttempts,
      ObjectProvider<StringRedisTemplate> redisTemplateProvider
  ) {
    this.mailSender = mailSender;
    this.verificationEnabled = verificationEnabled;
    this.mailUsername = mailUsername == null ? "" : mailUsername.trim();
    this.mailPassword = mailPassword == null ? "" : mailPassword.trim();
    this.ttlMinutes = Math.max(1, ttlMinutes);
    this.cooldownSeconds = Math.max(10, cooldownSeconds);
    this.maxSendsPerWindow = Math.max(1, maxSendsPerWindow);
    this.maxAttempts = Math.max(1, maxAttempts);
    this.redisTemplate = redisTemplateProvider.getIfAvailable();
  }

  public EmailCodeResult sendRegisterCode(String email) {
    return sendCode(email, "register", "注册 Career Compass 职业规划网站");
  }

  public EmailCodeResult sendLoginCode(String email) {
    return sendCode(email, "login", "使用邮箱验证码登录 Career Compass");
  }

  public EmailCodeResult sendPasswordResetCode(String email) {
    return sendCode(email, "password-reset", "重置 Career Compass 登录密码");
  }

  private EmailCodeResult sendCode(String email, String purpose, String actionText) {
    String normalized = normalizeEmail(email);
    if (!verificationEnabled) {
      return new EmailCodeResult(maskEmail(normalized), 0, 0);
    }
    ensureMailConfigured();
    Instant now = Instant.now();
    String key = codeKey(normalized, purpose);
    CodeEntry current = loadCode(key);
    if (current != null && current.lastSentAt().plusSeconds(cooldownSeconds).isAfter(now)) {
      long waitSeconds = Duration.between(now, current.lastSentAt().plusSeconds(cooldownSeconds)).toSeconds();
      throw new IllegalArgumentException("验证码发送过于频繁，请 " + Math.max(1, waitSeconds) + " 秒后再试");
    }
    Instant windowStart = current != null && current.windowStart().plus(Duration.ofMinutes(10)).isAfter(now)
        ? current.windowStart()
        : now;
    int sentInWindow = current != null && current.windowStart().equals(windowStart) ? current.sentInWindow() : 0;
    if (sentInWindow >= maxSendsPerWindow) {
      long waitSeconds = Duration.between(now, windowStart.plus(Duration.ofMinutes(10))).toSeconds();
      throw new IllegalArgumentException("同一邮箱 10 分钟内最多发送 " + maxSendsPerWindow + " 次验证码，请 " + Math.max(1, waitSeconds) + " 秒后再试");
    }

    String code = String.format(Locale.ROOT, "%06d", random.nextInt(1_000_000));
    sendMail(normalized, code, actionText);
    saveCode(key, new CodeEntry(
        code,
        now.plus(Duration.ofMinutes(ttlMinutes)),
        now,
        windowStart,
        sentInWindow + 1,
        0
    ));
    return new EmailCodeResult(maskEmail(normalized), ttlMinutes * 60, cooldownSeconds);
  }

  public void verifyRegisterCode(String email, String code) {
    verifyCode(email, code, "register");
  }

  public void verifyLoginCode(String email, String code) {
    verifyCode(email, code, "login");
  }

  public void verifyPasswordResetCode(String email, String code) {
    verifyCode(email, code, "password-reset");
  }

  private void verifyCode(String email, String code, String purpose) {
    if (!verificationEnabled) return;
    String normalized = normalizeEmail(email);
    if (!StringUtils.hasText(code)) {
      throw new IllegalArgumentException("请输入邮箱验证码");
    }
    String key = codeKey(normalized, purpose);
    CodeEntry current = loadCode(key);
    if (current == null) {
      throw new IllegalArgumentException("请先获取邮箱验证码");
    }
    Instant now = Instant.now();
    if (current.expiresAt().isBefore(now)) {
      deleteCode(key);
      throw new IllegalArgumentException("验证码已过期，请重新发送");
    }
    if (!current.code().equals(code.trim())) {
      int attempts = current.attempts() + 1;
      if (attempts >= maxAttempts) {
        deleteCode(key);
        throw new IllegalArgumentException("验证码错误次数过多，请重新发送");
      }
      saveCode(key, new CodeEntry(
          current.code(),
          current.expiresAt(),
          current.lastSentAt(),
          current.windowStart(),
          current.sentInWindow(),
          attempts
      ));
      throw new IllegalArgumentException("验证码错误，还可尝试 " + (maxAttempts - attempts) + " 次");
    }
    deleteCode(key);
  }

  private void sendMail(String email, String code, String actionText) {
    SimpleMailMessage message = new SimpleMailMessage();
    message.setFrom(mailUsername);
    message.setTo(email);
    message.setSubject("Career Compass 学校邮箱验证码");
    message.setText("""
        你好：

        你正在%s，本次学校邮箱验证码为：%s

        验证码 %d 分钟内有效。若非本人操作，请忽略本邮件。
        """.formatted(actionText, code, ttlMinutes));
    mailSender.send(message);
  }

  private void ensureMailConfigured() {
    if (!StringUtils.hasText(mailUsername) || !StringUtils.hasText(mailPassword)) {
      throw new IllegalStateException("QQ 邮箱 SMTP 未配置，请设置 QQ_MAIL_USERNAME 与 QQ_MAIL_SMTP_AUTH_CODE");
    }
  }

  private String normalizeEmail(String email) {
    if (!StringUtils.hasText(email)) {
      throw new IllegalArgumentException("邮箱不能为空");
    }
    return email.trim().toLowerCase(Locale.ROOT);
  }

  private String maskEmail(String email) {
    int at = email.indexOf('@');
    if (at <= 2) return email;
    return email.substring(0, 2) + "***" + email.substring(at);
  }

  private String codeKey(String email, String purpose) {
    return (StringUtils.hasText(purpose) ? purpose.trim().toLowerCase(Locale.ROOT) : "register") + ":" + email;
  }

  private CodeEntry loadCode(String key) {
    if (redisTemplate != null) {
      try {
        String raw = redisTemplate.opsForValue().get(redisKey(key));
        if (StringUtils.hasText(raw)) {
          return parseEntry(raw);
        }
      } catch (RuntimeException ignored) {
        // Redis is preferred for production, memory remains a local fallback.
      }
    }
    return codes.get(key);
  }

  private void saveCode(String key, CodeEntry entry) {
    codes.put(key, entry);
    if (redisTemplate != null) {
      try {
        long ttlSeconds = Math.max(1, Duration.between(Instant.now(), entry.expiresAt()).toSeconds());
        redisTemplate.opsForValue().set(redisKey(key), serializeEntry(entry), Duration.ofSeconds(ttlSeconds));
      } catch (RuntimeException ignored) {
        // Keep the in-memory copy.
      }
    }
  }

  private void deleteCode(String key) {
    codes.remove(key);
    if (redisTemplate != null) {
      try {
        redisTemplate.delete(redisKey(key));
      } catch (RuntimeException ignored) {
        // Best-effort cleanup.
      }
    }
  }

  private String redisKey(String key) {
    return "career-compass:email-code:" + key;
  }

  private String serializeEntry(CodeEntry entry) {
    return String.join("|",
        entry.code(),
        String.valueOf(entry.expiresAt().toEpochMilli()),
        String.valueOf(entry.lastSentAt().toEpochMilli()),
        String.valueOf(entry.windowStart().toEpochMilli()),
        String.valueOf(entry.sentInWindow()),
        String.valueOf(entry.attempts())
    );
  }

  private CodeEntry parseEntry(String raw) {
    try {
      String[] parts = raw.split("\\|");
      if (parts.length != 6) return null;
      return new CodeEntry(
          parts[0],
          Instant.ofEpochMilli(Long.parseLong(parts[1])),
          Instant.ofEpochMilli(Long.parseLong(parts[2])),
          Instant.ofEpochMilli(Long.parseLong(parts[3])),
          Integer.parseInt(parts[4]),
          Integer.parseInt(parts[5])
      );
    } catch (RuntimeException exception) {
      return null;
    }
  }

  private record CodeEntry(
      String code,
      Instant expiresAt,
      Instant lastSentAt,
      Instant windowStart,
      int sentInWindow,
      int attempts
  ) {}
}
