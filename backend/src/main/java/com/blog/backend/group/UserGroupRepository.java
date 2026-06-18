package com.blog.backend.group;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface UserGroupRepository extends JpaRepository<UserGroup, Long> {
    boolean existsByNameIgnoreCase(String name);
    boolean existsByInviteCode(String inviteCode);
    Optional<UserGroup> findByInviteCodeIgnoreCase(String inviteCode);
}
