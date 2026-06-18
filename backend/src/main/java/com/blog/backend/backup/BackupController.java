package com.blog.backend.backup;

import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;

import com.blog.backend.config.DevUserHeaderFilter.CurrentUser;
import com.blog.backend.user.AppUser;
import com.blog.backend.user.AppUserRepository;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/backups")
public class BackupController {
    private final UserBackupRepository backups;
    private final AppUserRepository users;
    private final int maxBytes;

    public BackupController(
        UserBackupRepository backups,
        AppUserRepository users,
        @Value("${b-log.backup.max-bytes}") int maxBytes
    ) {
        this.backups = backups;
        this.users = users;
        this.maxBytes = maxBytes;
    }

    @GetMapping("/latest")
    ResponseEntity<BackupResponse> latest(@AuthenticationPrincipal CurrentUser currentUser) {
        return backups.findTopByUserFirebaseUidOrderByUpdatedAtDesc(currentUser.firebaseUid())
            .map(BackupResponse::from)
            .map(ResponseEntity::ok)
            .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PutMapping("/latest")
    BackupResponse save(@AuthenticationPrincipal CurrentUser currentUser, @Valid @RequestBody BackupRequests.Save request) {
        int size = request.payload().getBytes(StandardCharsets.UTF_8).length;
        if (size > maxBytes) {
            throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "Backup exceeds server backup size limit.");
        }
        AppUser user = users.findByFirebaseUid(currentUser.firebaseUid())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT, "Complete onboarding first."));
        LocalDateTime now = LocalDateTime.now();
        UserBackup backup = backups.findTopByUserFirebaseUidOrderByUpdatedAtDesc(currentUser.firebaseUid())
            .map(existing -> {
                existing.update(request.payload(), size, now);
                return existing;
            })
            .orElseGet(() -> new UserBackup(user, request.payload(), size, now));
        return BackupResponse.from(backups.save(backup));
    }
}
