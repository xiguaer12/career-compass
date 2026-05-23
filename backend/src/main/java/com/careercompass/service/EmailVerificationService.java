package com.careercompass.service;

import com.careercompass.model.Dtos.EmailCodeResult;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.beans.factory.annotation.Value;
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

  public EmailVerificationService(
      JavaMailSender mailSender,
      @Value("${app.mail.verification-enabled:true}") boolean verificationEnabled,
      @Value("${spring.mail.username:}") String mailUsername,
      @Value("${spring.mail.password:}") String mailPassword,
      @Value("${app.mail.code-ttl-minutes:10}") int ttlMinutes,
      @Value("${app.mail.code-cooldown-seconds:60}") int cooldownSeconds,
      @Value("${app.mail.code-max-sends-per-window:3}") int maxSendsPerWindow,
      @Value("${app.mail.code-max-attempts:5}") int maxAttempts
  ) {
    this.mailSender = mailSender;
    this.verificationEnabled = verificationEnabled;
    this.mailUsername = mailUsername == null ? "" : mailUsername.trim();
    this.mailPassword = mailPassword == null ? "" : mailPassword.trim();
    this.ttlMinutes = Math.max(1, ttlMinutes);
    this.cooldownSeconds = Math.max(10, cooldownSeconds);
    this.maxSendsPerWindow = Math.max(1, maxSendsPerWindow);
    this.maxAttempts = Math.max(1, maxAttempts);
  }

  public EmailCodeResult sendRegisterCode(String email) {
    String normalized = normalizeEmail(email);
    if (!verificationEnabled) {
      return new EmailCodeResult(maskEmail(normalized), 0, 0);
    }
    ensureMailConfigured();
    Instant now = Instant.now();
    CodeEntry current = codes.get(normalized);
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
    sendMail(normalized, code);
    codes.put(normalized, new CodeEntry(
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
    if (!verificationEnabled) return;
    String normalized = normalizeEmail(email);
    if (!StringUtils.hasText(code)) {
      throw new IllegalArgumentException("请输入邮箱验证码");
    }
    CodeEntry current = codes.get(normalized);
    if (current == null) {
      throw new IllegalArgumentException("请先获取邮箱验证码");
    }
    Instant now = Instant.now();
    if (current.expiresAt().isBefore(now)) {
      codes.remove(normalized);
      throw new IllegalArgumentException("验证码已过期，请重新发送");
    }
    if (!current.code().equals(code.trim())) {
      int attempts = current.attempts() + 1;
      if (attempts >= maxAttempts) {
        codes.remove(normalized);
        throw new IllegalArgumentException("验证码错误次数过多，请重新发送");
      }
      codes.put(normalized, new CodeEntry(
          current.code(),
          current.expiresAt(),
          current.lastSentAt(),
          current.windowStart(),
          current.sentInWindow(),
          attempts
      ));
      throw new IllegalArgumentException("验证码错误，还可尝试 " + (maxAttempts - attempts) + " 次");
    }
    codes.remove(normalized);
  }

  private void sendMail(String email, String code) {
    SimpleMailMessage message = new SimpleMailMessage();
    message.setFrom(mailUsername);
    message.setTo(email);
    message.setSubject("Career Compass 学校邮箱验证码");
    message.setText("""
        你好：

        你正在注册 Career Compass 职业规划网站，本次学校邮箱验证码为：%s

        验证码 %d 分钟内有效。若非本人操作，请忽略本邮件。
        """.formatted(code, ttlMinutes));
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

  private record CodeEntry(
      String code,
      Instant expiresAt,
      Instant lastSentAt,
      Instant windowStart,
      int sentInWindow,
      int attempts
  ) {}
}
