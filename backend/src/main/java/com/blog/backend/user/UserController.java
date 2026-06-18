package com.blog.backend.user;

import java.time.LocalDateTime;

import com.blog.backend.config.DevUserHeaderFilter.CurrentUser;
import com.blog.backend.practice.PracticeSummaryService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/me")
public class UserController {
    private final AppUserRepository users;
    private final PracticeSummaryService summaries;

    public UserController(AppUserRepository users, PracticeSummaryService summaries) {
        this.users = users;
        this.summaries = summaries;
    }

    @GetMapping
    ResponseEntity<UserProfileResponse> profile(@AuthenticationPrincipal CurrentUser currentUser) {
        return users.findByFirebaseUid(currentUser.firebaseUid())
            .map(UserProfileResponse::from)
            .map(ResponseEntity::ok)
            .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PutMapping
    UserProfileResponse saveProfile(
        @AuthenticationPrincipal CurrentUser currentUser,
        @Valid @RequestBody UserProfileRequest request
    ) {
        LocalDateTime now = LocalDateTime.now();
        AppUser user = users.findByFirebaseUid(currentUser.firebaseUid())
            .map(existing -> {
                existing.update(request, currentUser.email(), now);
                return existing;
            })
            .orElseGet(() -> new AppUser(currentUser.firebaseUid(), currentUser.email(), request, now));
        AppUser saved = users.save(user);
        summaries.updateRankingVisibility(saved);
        return UserProfileResponse.from(saved);
    }
}
