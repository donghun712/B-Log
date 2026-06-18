package com.blog.backend.backup;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface UserBackupRepository extends JpaRepository<UserBackup, Long> {
    Optional<UserBackup> findTopByUserFirebaseUidOrderByUpdatedAtDesc(String firebaseUid);
}
