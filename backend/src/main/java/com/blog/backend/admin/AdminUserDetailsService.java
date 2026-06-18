package com.blog.backend.admin;

import java.util.ArrayList;
import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

@Service
public class AdminUserDetailsService implements UserDetailsService {
    private final AdminAccountRepository accounts;
    private final String superUsername;
    private final String superPassword;

    public AdminUserDetailsService(
        AdminAccountRepository accounts,
        @Value("${b-log.admin.username}") String superUsername,
        @Value("${b-log.admin.password}") String superPassword
    ) {
        this.accounts = accounts;
        this.superUsername = superUsername;
        this.superPassword = superPassword;
    }

    @Override
    public UserDetails loadUserByUsername(String username) {
        if (username.equals(superUsername)) {
            return User.withUsername(superUsername)
                .password("{noop}" + superPassword)
                .authorities("ROLE_ADMIN", "ROLE_SUPER_ADMIN")
                .build();
        }

        AdminAccount account = accounts.findByUsername(username)
            .orElseThrow(() -> new UsernameNotFoundException("Admin account not found."));
        List<SimpleGrantedAuthority> authorities = new ArrayList<>();
        authorities.add(new SimpleGrantedAuthority("ROLE_ADMIN"));
        authorities.add(new SimpleGrantedAuthority("ROLE_" + account.getRole()));

        return User.withUsername(account.getUsername())
            .password(account.getPasswordHash())
            .authorities(authorities)
            .disabled(!account.isActive())
            .build();
    }
}
