package com.blog.backend.practice;

import java.util.List;

import com.blog.backend.config.DevUserHeaderFilter.CurrentUser;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/practice-summaries")
public class PracticeSummaryController {
    private final PracticeSummaryRepository summaries;
    private final PracticeSummaryService service;

    public PracticeSummaryController(PracticeSummaryRepository summaries, PracticeSummaryService service) {
        this.summaries = summaries;
        this.service = service;
    }

    @GetMapping
    List<PracticeSummaryResponse> list(@AuthenticationPrincipal CurrentUser currentUser) {
        return service.list(currentUser.firebaseUid());
    }

    @PostMapping
    ResponseEntity<PracticeSummaryResponse> create(
        @AuthenticationPrincipal CurrentUser currentUser,
        @Valid @RequestBody PracticeSummaryRequest request
    ) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(currentUser.firebaseUid(), request));
    }

    @PatchMapping("/{id}")
    PracticeSummaryResponse update(
        @AuthenticationPrincipal CurrentUser currentUser,
        @PathVariable Long id,
        @Valid @RequestBody PracticeSummaryRequest request
    ) {
        return service.update(currentUser.firebaseUid(), id, request);
    }

    @DeleteMapping("/{id}")
    ResponseEntity<Void> delete(@AuthenticationPrincipal CurrentUser currentUser, @PathVariable Long id) {
        service.delete(currentUser.firebaseUid(), id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/trust-check")
    PracticeTrustCheckResponse trustCheck(
        @AuthenticationPrincipal CurrentUser currentUser,
        @Valid @RequestBody PracticeSummaryRequest request
    ) {
        return service.trustCheck(currentUser.firebaseUid(), request);
    }
}
