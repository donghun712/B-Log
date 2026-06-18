package com.blog.backend.practice;

import java.time.LocalDateTime;
import java.util.List;

import com.blog.backend.user.AppUser;
import com.blog.backend.user.AppUserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class PracticeSummaryService {
    private static final int MAX_DAILY_SHOTS = 90;
    private static final double OUTLIER_MULTIPLIER = 2.5;
    private final PracticeSummaryRepository summaries;
    private final AppUserRepository users;

    public PracticeSummaryService(PracticeSummaryRepository summaries, AppUserRepository users) {
        this.summaries = summaries;
        this.users = users;
    }

    @Transactional(readOnly = true)
    public List<PracticeSummaryResponse> list(String firebaseUid) {
        return summaries.findAllByUserFirebaseUidOrderByPracticedAtDesc(firebaseUid).stream()
            .map(PracticeSummaryResponse::from)
            .toList();
    }

    @Transactional
    public PracticeSummaryResponse create(String firebaseUid, PracticeSummaryRequest request) {
        AppUser user = users.findByFirebaseUid(firebaseUid)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT, "Complete onboarding first."));
        PracticeSummary summary = summaries.findByClientSessionIdAndUserFirebaseUid(request.clientSessionId(), firebaseUid)
            .orElseGet(() -> new PracticeSummary(user, request, LocalDateTime.now()));
        verifySave(firebaseUid, request, summary.getId());
        summary.update(request, LocalDateTime.now());
        return PracticeSummaryResponse.from(summaries.save(summary));
    }

    @Transactional
    public PracticeSummaryResponse update(String firebaseUid, Long id, PracticeSummaryRequest request) {
        PracticeSummary summary = ownedSummary(id, firebaseUid);
        verifySave(firebaseUid, request, summary.getId());
        summary.update(request, LocalDateTime.now());
        return PracticeSummaryResponse.from(summaries.save(summary));
    }

    @Transactional
    public void delete(String firebaseUid, Long id) {
        summaries.delete(ownedSummary(id, firebaseUid));
    }

    @Transactional(readOnly = true)
    public PracticeTrustCheckResponse trustCheck(String firebaseUid, PracticeSummaryRequest request) {
        List<PracticeSummary> recent = summaries.findTop5ByUserFirebaseUidOrderByPracticedAtDesc(firebaseUid);
        if (recent.size() < 5) {
            return new PracticeTrustCheckResponse(false, 0, 0, "");
        }
        double recentAverage = recent.stream().mapToDouble(this::hitRate).average().orElse(0);
        double currentRate = request.totalShots() == 0 ? 0 : (double) request.totalHits() / request.totalShots();
        double multiplier = recentAverage == 0 ? (currentRate == 0 ? 1 : Double.POSITIVE_INFINITY) : currentRate / recentAverage;
        boolean warning = multiplier >= OUTLIER_MULTIPLIER;
        String message = warning
            ? "Recent hit rate is " + readableMultiplier(multiplier) + " times lower than this record. Confirm before saving."
            : "";
        return new PracticeTrustCheckResponse(warning, finite(multiplier), recentAverage, message);
    }

    @Transactional
    public void updateRankingVisibility(AppUser user) {
        LocalDateTime now = LocalDateTime.now();
        summaries.findAllByUserFirebaseUidOrderByPracticedAtDesc(user.getFirebaseUid())
            .forEach(summary -> summary.setRankingPublic(user.isRankingPublic(), now));
    }

    private void verifySave(String firebaseUid, PracticeSummaryRequest request, Long currentId) {
        int otherShotsToday = summaries.findAllByUserFirebaseUidAndPracticeDate(firebaseUid, request.practiceDate()).stream()
            .filter(summary -> currentId == null || !currentId.equals(summary.getId()))
            .mapToInt(PracticeSummary::getTotalShots)
            .sum();
        if (otherShotsToday + request.totalShots() > MAX_DAILY_SHOTS) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Daily practice limit is 18 rounds.");
        }
        PracticeTrustCheckResponse trust = trustCheck(firebaseUid, request);
        if (trust.warning() && !request.confirmedOutlier()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, trust.message());
        }
    }

    private PracticeSummary ownedSummary(Long id, String firebaseUid) {
        return summaries.findByIdAndUserFirebaseUid(id, firebaseUid)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    }

    private double hitRate(PracticeSummary summary) {
        return summary.getTotalShots() == 0 ? 0 : (double) summary.getTotalHits() / summary.getTotalShots();
    }

    private double finite(double value) {
        return Double.isFinite(value) ? value : 999;
    }

    private String readableMultiplier(double multiplier) {
        return Double.isFinite(multiplier) ? String.format("%.1f", multiplier) : "many";
    }
}
