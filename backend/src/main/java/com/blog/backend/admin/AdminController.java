package com.blog.backend.admin;

import java.util.Comparator;
import java.util.List;

import com.blog.backend.group.GroupMemberRepository;
import com.blog.backend.group.UserGroupRepository;
import com.blog.backend.practice.PracticeSummary;
import com.blog.backend.practice.PracticeSummaryRepository;
import com.blog.backend.range.ArcheryRangeRepository;
import com.blog.backend.range.ArcheryRangeResponse;
import com.blog.backend.user.AppUser;
import com.blog.backend.user.AppUserRepository;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/admin")
public class AdminController {
    private final AppUserRepository users;
    private final PracticeSummaryRepository summaries;
    private final ArcheryRangeRepository ranges;
    private final UserGroupRepository groups;
    private final GroupMemberRepository members;
    private final AdminAccountService adminAccounts;

    public AdminController(
        AppUserRepository users,
        PracticeSummaryRepository summaries,
        ArcheryRangeRepository ranges,
        UserGroupRepository groups,
        GroupMemberRepository members,
        AdminAccountService adminAccounts
    ) {
        this.users = users;
        this.summaries = summaries;
        this.ranges = ranges;
        this.groups = groups;
        this.members = members;
        this.adminAccounts = adminAccounts;
    }

    @GetMapping("/me")
    AdminCurrentResponse me(Authentication authentication) {
        return adminAccounts.current(authentication);
    }

    @GetMapping("/overview")
    AdminOverviewResponse overview(Authentication authentication) {
        adminAccounts.requirePasswordReady(authentication);
        return new AdminOverviewResponse(users.count(), summaries.count(), ranges.count(), groups.count(), members.count());
    }

    @GetMapping("/ranges")
    List<ArcheryRangeResponse> ranges(Authentication authentication, @RequestParam(defaultValue = "") String query) {
        adminAccounts.requirePasswordReady(authentication);
        String requiredRangeId = adminAccounts.requiredRangeId(authentication);
        if (requiredRangeId != null) {
            return ranges.findById(requiredRangeId).stream().map(ArcheryRangeResponse::from).toList();
        }
        String keyword = query.trim();
        return (keyword.isBlank() ? ranges.findTop100ByOrderByNameAsc() : ranges.findTop50BySearchTextContainingIgnoreCaseOrderByNameAsc(keyword))
            .stream()
            .map(ArcheryRangeResponse::from)
            .toList();
    }

    @GetMapping("/ranges/{rangeId}/stats")
    AdminRangeStatsResponse rangeStats(Authentication authentication, @PathVariable String rangeId) {
        adminAccounts.requirePasswordReady(authentication);
        requireRangeAccess(authentication, rangeId);
        List<PracticeSummary> rangeSummaries = summaries.findAllByRangeIdOrderByPracticedAtDesc(rangeId);
        long totalShots = rangeSummaries.stream().mapToLong(PracticeSummary::getTotalShots).sum();
        long totalHits = rangeSummaries.stream().mapToLong(PracticeSummary::getTotalHits).sum();
        String rangeName = rangeSummaries.stream()
            .findFirst()
            .map(PracticeSummary::getRangeName)
            .or(() -> ranges.findById(rangeId).map(range -> range.getCity() + " / " + range.getName()))
            .orElse(rangeId);
        double hitRate = totalShots == 0 ? 0 : (double) totalHits / totalShots;
        return new AdminRangeStatsResponse(
            rangeId,
            rangeName,
            users.countByRangeId(rangeId),
            rangeSummaries.size(),
            totalShots,
            totalHits,
            hitRate
        );
    }

    @GetMapping("/ranges/{rangeId}/members")
    List<AdminUserResponse> rangeMembers(Authentication authentication, @PathVariable String rangeId, @RequestParam(defaultValue = "") String query) {
        adminAccounts.requirePasswordReady(authentication);
        requireRangeAccess(authentication, rangeId);
        String keyword = query.trim();
        List<AppUser> rangeUsers = keyword.isBlank()
            ? users.findAllByRangeIdOrderByNameAsc(rangeId)
            : users.searchRangeMembers(rangeId, keyword.toLowerCase());

        return rangeUsers.stream()
            .map(this::userResponse)
            .sorted(Comparator.comparing(AdminUserResponse::name))
            .toList();
    }

    @GetMapping("/users/{userId}/practice-summaries")
    List<AdminPracticeSummaryResponse> userSummaries(Authentication authentication, @PathVariable Long userId) {
        adminAccounts.requirePasswordReady(authentication);
        AppUser user = users.findById(userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "회원을 찾을 수 없습니다."));
        requireRangeAccess(authentication, user.getRangeId());
        return summaries.findAllByUserIdOrderByPracticedAtDesc(user.getId()).stream()
            .map(AdminPracticeSummaryResponse::from)
            .toList();
    }

    @GetMapping("/accounts")
    List<AdminAccountResponse> accounts(Authentication authentication) {
        return adminAccounts.listAccounts(authentication);
    }

    @PostMapping("/accounts")
    AdminAccountResponse createAccount(Authentication authentication, @Valid @RequestBody AdminAccountRequest request) {
        return adminAccounts.create(authentication, request);
    }

    @PatchMapping("/accounts/{accountId}/password")
    AdminAccountResponse resetPassword(
        Authentication authentication,
        @PathVariable Long accountId,
        @Valid @RequestBody AdminResetPasswordRequest request
    ) {
        return adminAccounts.resetPassword(authentication, accountId, request);
    }

    @PatchMapping("/accounts/{accountId}/active")
    AdminAccountResponse setActive(
        Authentication authentication,
        @PathVariable Long accountId,
        @RequestBody AdminActiveRequest request
    ) {
        return adminAccounts.setActive(authentication, accountId, request);
    }

    @PatchMapping("/password")
    AdminCurrentResponse changePassword(Authentication authentication, @Valid @RequestBody AdminPasswordRequest request) {
        return adminAccounts.changePassword(authentication, request);
    }

    private AdminUserResponse userResponse(AppUser user) {
        List<PracticeSummary> userSummaries = summaries.findAllByUserIdOrderByPracticedAtDesc(user.getId());
        long totalShots = userSummaries.stream().mapToLong(PracticeSummary::getTotalShots).sum();
        long totalHits = userSummaries.stream().mapToLong(PracticeSummary::getTotalHits).sum();
        return AdminUserResponse.from(user, userSummaries.size(), totalShots, totalHits);
    }

    private void requireRangeAccess(Authentication authentication, String rangeId) {
        if (!adminAccounts.canAccessRange(authentication, rangeId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "이 활터를 조회할 권한이 없습니다.");
        }
    }
}
