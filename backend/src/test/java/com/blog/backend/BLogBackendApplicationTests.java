package com.blog.backend;

import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;

@SpringBootTest
class BLogBackendApplicationTests {
	@Autowired
	private UserDetailsService userDetailsService;

	@Test
	void contextLoads() {
	}

	@Test
	void fallbackAdminIsDisabledWithoutExplicitCredentials() {
		assertThrows(UsernameNotFoundException.class, () -> userDetailsService.loadUserByUsername("admin"));
	}

}
