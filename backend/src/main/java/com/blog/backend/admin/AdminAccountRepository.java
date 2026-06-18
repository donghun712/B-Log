package com.blog.backend.admin;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface AdminAccountRepository extends JpaRepository<AdminAccount, Long> {
    Optional<AdminAccount> findByUsername(String username);
    boolean existsByUsername(String username);
    boolean existsByRangeId(String rangeId);
    List<AdminAccount> findAllByOrderByCreatedAtDesc();
}
