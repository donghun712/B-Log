package com.blog.backend.config;

import java.io.IOException;
import java.util.List;

import com.blog.backend.config.DevUserHeaderFilter.CurrentUser;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseAuthException;
import com.google.firebase.auth.FirebaseToken;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class FirebaseTokenFilter extends OncePerRequestFilter {
    private final boolean enabled;

    public FirebaseTokenFilter(@Value("${b-log.auth.firebase-enabled}") boolean enabled) {
        this.enabled = enabled;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
        throws ServletException, IOException {
        String bearer = bearerToken(request.getHeader(HttpHeaders.AUTHORIZATION));
        if (enabled && bearer != null) {
            try {
                FirebaseToken token = FirebaseAuth.getInstance().verifyIdToken(bearer);
                authenticate(new CurrentUser(token.getUid(), token.getEmail()));
            } catch (FirebaseAuthException | IllegalArgumentException error) {
                response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Invalid Firebase ID token.");
                return;
            }
        }

        filterChain.doFilter(request, response);
    }

    private void authenticate(CurrentUser currentUser) {
        UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
            currentUser,
            null,
            List.of(new SimpleGrantedAuthority("ROLE_USER"))
        );
        SecurityContextHolder.getContext().setAuthentication(authentication);
    }

    private String bearerToken(String authorization) {
        if (authorization == null || !authorization.startsWith("Bearer ")) {
            return null;
        }
        String token = authorization.substring("Bearer ".length()).trim();
        return token.isEmpty() ? null : token;
    }
}
