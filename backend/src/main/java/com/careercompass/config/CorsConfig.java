package com.careercompass.config;

import java.util.Arrays;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class CorsConfig implements WebMvcConfigurer {
  private final String[] allowedOriginPatterns;

  public CorsConfig(@Value("${app.cors.allowed-origin-patterns:http://localhost:*,http://127.0.0.1:*}") String allowedOriginPatterns) {
    this.allowedOriginPatterns = Arrays.stream(allowedOriginPatterns.split(","))
        .map(String::trim)
        .filter(value -> !value.isEmpty())
        .toArray(String[]::new);
  }

  @Override
  public void addCorsMappings(CorsRegistry registry) {
    registry.addMapping("/**")
        .allowedOriginPatterns(allowedOriginPatterns)
        .allowedMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
        .allowedHeaders("*")
        .exposedHeaders("X-Request-Id")
        .allowCredentials(false)
        .maxAge(3600);
  }
}
