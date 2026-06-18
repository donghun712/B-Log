package com.blog.backend.admin;

import java.time.LocalDateTime;
import java.util.List;

import com.blog.backend.range.ArcheryRange;
import com.blog.backend.range.ArcheryRangeRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AdminAccountService {
    public static final String ROLE_SUPER_ADMIN = "SUPER_ADMIN";
    public static final String ROLE_RANGE_ADMIN = "RANGE_ADMIN";

    private final AdminAccountRepository accounts;
    private final ArcheryRangeRepository ranges;
    private final PasswordEncoder passwordEncoder;
    private final String superUsername;

    public AdminAccountService(
        AdminAccountRepository accounts,
        ArcheryRangeRepository ranges,
        PasswordEncoder passwordEncoder,
        @Value("${b-log.admin.username}") String superUsername
    ) {
        this.accounts = accounts;
        this.ranges = ranges;
        this.passwordEncoder = passwordEncoder;
        this.superUsername = superUsername;
    }

    public AdminCurrentResponse current(Authentication authentication) {
        if (isSuper(authentication)) {
            return new AdminCurrentResponse(authentication.getName(), ROLE_SUPER_ADMIN, null, null, true, false);
        }

        AdminAccount account = currentAccount(authentication);
        account.markLogin(LocalDateTime.now());
        accounts.save(account);
        return new AdminCurrentResponse(
            account.getUsername(),
            account.getRole(),
            account.getRangeId(),
            account.getRangeName(),
            account.isActive(),
            account.isMustChangePassword()
        );
    }

    public List<AdminAccountResponse> listAccounts(Authentication authentication) {
        requireSuper(authentication);
        return accounts.findAllByOrderByCreatedAtDesc().stream().map(AdminAccountResponse::from).toList();
    }

    public AdminAccountResponse create(Authentication authentication, AdminAccountRequest request) {
        requireSuper(authentication);
        String username = request.username().trim();
        if (accounts.existsByUsername(username) || username.equals(superUsername)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "이미 사용 중인 관리자 ID입니다.");
        }
        if (accounts.existsByRangeId(request.rangeId())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "이미 관리자 계정이 있는 활터입니다.");
        }

        ArcheryRange range = ranges.findById(request.rangeId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "활터를 찾을 수 없습니다."));
        String rangeName = formatRangeName(range);
        AdminAccount account = new AdminAccount(
            username,
            passwordEncoder.encode(request.password()),
            ROLE_RANGE_ADMIN,
            range.getId(),
            rangeName,
            LocalDateTime.now()
        );
        return AdminAccountResponse.from(accounts.save(account));
    }

    public AdminAccountResponse resetPassword(Authentication authentication, Long accountId, AdminResetPasswordRequest request) {
        requireSuper(authentication);
        AdminAccount account = account(accountId);
        account.resetPassword(passwordEncoder.encode(request.password()), LocalDateTime.now());
        return AdminAccountResponse.from(accounts.save(account));
    }

    public AdminAccountResponse setActive(Authentication authentication, Long accountId, AdminActiveRequest request) {
        requireSuper(authentication);
        AdminAccount account = account(accountId);
        account.setActive(request.active(), LocalDateTime.now());
        return AdminAccountResponse.from(accounts.save(account));
    }

    public AdminCurrentResponse changePassword(Authentication authentication, AdminPasswordRequest request) {
        if (isSuper(authentication)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "최고 관리자 비밀번호는 서버 환경 설정에서 변경해주세요.");
        }

        AdminAccount account = currentAccount(authentication);
        if (!passwordEncoder.matches(request.currentPassword(), account.getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "현재 비밀번호가 올바르지 않습니다.");
        }

        account.changePassword(passwordEncoder.encode(request.newPassword()), LocalDateTime.now());
        accounts.save(account);
        return new AdminCurrentResponse(
            account.getUsername(),
            account.getRole(),
            account.getRangeId(),
            account.getRangeName(),
            account.isActive(),
            account.isMustChangePassword()
        );
    }

    public void requireSuper(Authentication authentication) {
        if (!isSuper(authentication)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "최고 관리자만 사용할 수 있습니다.");
        }
    }

    public void requirePasswordReady(Authentication authentication) {
        if (!isSuper(authentication) && currentAccount(authentication).isMustChangePassword()) {
            throw new ResponseStatusException(HttpStatus.LOCKED, "비밀번호 변경이 필요합니다.");
        }
    }

    public boolean canAccessRange(Authentication authentication, String rangeId) {
        if (isSuper(authentication)) {
            return true;
        }
        AdminAccount account = currentAccount(authentication);
        return rangeId.equals(account.getRangeId());
    }

    public String requiredRangeId(Authentication authentication) {
        if (isSuper(authentication)) {
            return null;
        }
        return currentAccount(authentication).getRangeId();
    }

    public boolean isSuper(Authentication authentication) {
        return authentication != null && authentication.getAuthorities().stream()
            .anyMatch(authority -> "ROLE_SUPER_ADMIN".equals(authority.getAuthority()));
    }

    private AdminAccount currentAccount(Authentication authentication) {
        if (authentication == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "관리자 로그인이 필요합니다.");
        }
        return accounts.findByUsername(authentication.getName())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "관리자 계정을 찾을 수 없습니다."));
    }

    private AdminAccount account(Long accountId) {
        return accounts.findById(accountId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "관리자 계정을 찾을 수 없습니다."));
    }

    private String formatRangeName(ArcheryRange range) {
        return (range.getCity() == null || range.getCity().isBlank())
            ? range.getName()
            : range.getCity() + " / " + range.getName();
    }
}
