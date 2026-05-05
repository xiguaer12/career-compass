package com.careercompass.config;

import com.careercompass.service.SecurityService;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@Component
public class AdminTokenFilter extends OncePerRequestFilter {
  private final String adminToken;
  private final SecurityService security;

  public AdminTokenFilter(@Value("${app.admin-token}") String adminToken, SecurityService security) {
    this.adminToken = adminToken;
    this.security = security;
  }

  @Override
  protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
      throws ServletException, IOException {
    if (!request.getRequestURI().startsWith("/admin/")
        || request.getRequestURI().startsWith("/admin/auth/")
        || "OPTIONS".equalsIgnoreCase(request.getMethod())) {
      filterChain.doFilter(request, response);
      return;
    }

    String token = request.getHeader("X-Admin-Token");
    if (adminToken.equals(token)) {
      filterChain.doFilter(request, response);
      return;
    }
    try {
      String authorization = request.getHeader("Authorization");
      if (authorization != null && "admin".equals(security.parse(authorization).role())) {
        filterChain.doFilter(request, response);
        return;
      }
    } catch (RuntimeException ignored) {
      // Fall through to a uniform 401 response.
    }

    response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
    response.setContentType(MediaType.APPLICATION_JSON_VALUE);
    response.setCharacterEncoding(StandardCharsets.UTF_8.name());
    response.getWriter().write("{\"success\":false,\"message\":\"后台 Token 无效或缺失\",\"data\":null}");
  }
}
