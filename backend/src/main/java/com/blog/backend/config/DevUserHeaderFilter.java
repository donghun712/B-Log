package com.blog.backend.config;

import java.io.IOException;
import java.util.List;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class DevUserHeaderFilter extends OncePerRequestFilter {
    public static final String USER_ID_HEADER = "X-Blog-User-Id";
    public static final String USER_EMAIL_HEADER = "X-Blog-User-Email";
    private final boolean enabled;

    public DevUserHeaderFilter(@Value("${b-log.auth.dev-headers-enabled}") boolean enabled) {
        this.enabled = enabled;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
        throws ServletException, IOException {
        String firebaseUid = request.getHeader(USER_ID_HEADER);
        if (enabled && SecurityContextHolder.getContext().getAuthentication() == null && firebaseUid != null && !firebaseUid.isBlank()) {
            CurrentUser currentUser = new CurrentUser(firebaseUid.trim(), blankToNull(request.getHeader(USER_EMAIL_HEADER)));
            UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
                currentUser,
                null,
                List.of(new SimpleGrantedAuthority("ROLE_USER"))
            );
            SecurityContextHolder.getContext().setAuthentication(authentication);
        }

        filterChain.doFilter(request, response);
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    public record CurrentUser(String firebaseUid, String email) {
    }
}
