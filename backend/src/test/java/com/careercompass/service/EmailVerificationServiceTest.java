package com.careercompass.service;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;

class EmailVerificationServiceTest {

  @Test
  void verifiesScenarioSpecificEmailCode() {
    JavaMailSender mailSender = mock(JavaMailSender.class);
    EmailVerificationService service = service(mailSender);

    service.sendPasswordResetCode("2335061025@st.usst.edu.cn");

    String code = sentCode(mailSender);
    assertDoesNotThrow(() -> service.verifyPasswordResetCode("2335061025@st.usst.edu.cn", code));
    assertThrows(IllegalArgumentException.class, () -> service.verifyPasswordResetCode("2335061025@st.usst.edu.cn", code));
  }

  @Test
  void rejectsWrongCodeUntilResend() {
    JavaMailSender mailSender = mock(JavaMailSender.class);
    EmailVerificationService service = service(mailSender);

    service.sendLoginCode("2335061025@st.usst.edu.cn");

    assertThrows(IllegalArgumentException.class, () -> service.verifyLoginCode("2335061025@st.usst.edu.cn", "000000"));
  }

  @Test
  void verifiesCodeStoredInRedisAcrossServiceInstances() {
    JavaMailSender mailSender = mock(JavaMailSender.class);
    ObjectProvider<StringRedisTemplate> redisProvider = redisProviderBackedBy(new ConcurrentHashMap<>());
    EmailVerificationService senderService = service(mailSender, redisProvider);
    EmailVerificationService verifierService = service(mock(JavaMailSender.class), redisProvider);

    senderService.sendRegisterCode("2335061025@st.usst.edu.cn");

    String code = sentCode(mailSender);
    assertDoesNotThrow(() -> verifierService.verifyRegisterCode("2335061025@st.usst.edu.cn", code));
    assertThrows(IllegalArgumentException.class, () -> verifierService.verifyRegisterCode("2335061025@st.usst.edu.cn", code));
  }

  private EmailVerificationService service(JavaMailSender mailSender) {
    @SuppressWarnings("unchecked")
    ObjectProvider<StringRedisTemplate> redisProvider = mock(ObjectProvider.class);
    when(redisProvider.getIfAvailable()).thenReturn(null);
    return service(mailSender, redisProvider);
  }

  private EmailVerificationService service(JavaMailSender mailSender, ObjectProvider<StringRedisTemplate> redisProvider) {
    return new EmailVerificationService(
        mailSender,
        true,
        "noreply@example.com",
        "smtp-code",
        10,
        10,
        3,
        5,
        redisProvider
    );
  }

  private ObjectProvider<StringRedisTemplate> redisProviderBackedBy(Map<String, String> storage) {
    @SuppressWarnings("unchecked")
    ObjectProvider<StringRedisTemplate> redisProvider = mock(ObjectProvider.class);
    StringRedisTemplate redisTemplate = mock(StringRedisTemplate.class);
    @SuppressWarnings("unchecked")
    ValueOperations<String, String> valueOperations = mock(ValueOperations.class);
    when(redisProvider.getIfAvailable()).thenReturn(redisTemplate);
    when(redisTemplate.opsForValue()).thenReturn(valueOperations);
    when(valueOperations.get(anyString())).thenAnswer(invocation -> storage.get(invocation.getArgument(0)));
    doAnswer(invocation -> {
      storage.put(invocation.getArgument(0), invocation.getArgument(1));
      return null;
    }).when(valueOperations).set(anyString(), anyString(), any(Duration.class));
    when(redisTemplate.delete(anyString())).thenAnswer(invocation -> storage.remove(invocation.getArgument(0)) != null);
    return redisProvider;
  }

  private String sentCode(JavaMailSender mailSender) {
    ArgumentCaptor<SimpleMailMessage> captor = ArgumentCaptor.forClass(SimpleMailMessage.class);
    verify(mailSender).send(captor.capture());
    Matcher matcher = Pattern.compile("验证码为：([0-9]{6})").matcher(captor.getValue().getText());
    if (!matcher.find()) throw new AssertionError("验证码邮件正文未包含 6 位验证码");
    return matcher.group(1);
  }
}
