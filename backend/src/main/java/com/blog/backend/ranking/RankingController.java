package com.blog.backend.ranking;

import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import com.blog.backend.practice.PracticeSummary;
import com.blog.backend.practice.PracticeSummaryRepository;
import com.blog.backend.config.DevUserHeaderFilter.CurrentUser;
import com.blog.backend.group.GroupService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/rankings")
public class RankingController {
    private static final int MIN_RANKING_SHOTS = 45;
    private final PracticeSummaryRepository summaries;
    private final GroupService groups;

    public RankingController(PracticeSummaryRepository summaries, GroupService groups) {
        this.summaries = summaries;
        this.groups = groups;
    }

    @GetMapping("/groups/{groupId}")
    List<RankingRowResponse> group(
        @AuthenticationPrincipal CurrentUser currentUser,
        @org.springframework.web.bind.annotation.PathVariable Long groupId,
        @RequestParam(defaultValue = "weekly") String period,
        @RequestParam(defaultValue = "accuracy") String type
    ) {
        List<String> memberIds = groups.memberFirebaseUids(currentUser.firebaseUid(), groupId);
        return rank(
            summaries.findAllByRankingPublicTrueAndPracticeDateGreaterThanEqual(startDate(period)).stream()
                .filter(summary -> memberIds.contains(summary.getUser().getFirebaseUid()))
                .toList(),
            type
        );
    }

    @GetMapping("/overall")
    List<RankingRowResponse> overall(
        @RequestParam(defaultValue = "weekly") String period,
        @RequestParam(defaultValue = "accuracy") String type
    ) {
        return rank(summaries.findAllByRankingPublicTrueAndPracticeDateGreaterThanEqual(startDate(period)), type);
    }

    @GetMapping("/range")
    List<RankingRowResponse> range(
        @RequestParam String rangeId,
        @RequestParam(defaultValue = "weekly") String period,
        @RequestParam(defaultValue = "accuracy") String type
    ) {
        return rank(
            summaries.findAllByRankingPublicTrueAndPracticeDateGreaterThanEqual(startDate(period))
                .stream()
                .filter(summary -> rangeId.equals(summary.getRangeId()))
                .toList(),
            type
        );
    }

    private LocalDate startDate(String period) {
        LocalDate today = LocalDate.now();
        return "monthly".equals(period)
            ? today.withDayOfMonth(1)
            : today.with(TemporalAdjusters.previousOrSame(java.time.DayOfWeek.MONDAY));
    }

    private List<RankingRowResponse> rank(List<PracticeSummary> rows, String type) {
        Map<String, RankingAccumulator> grouped = new HashMap<>();
        for (PracticeSummary summary : rows) {
            String userId = summary.getUser().getFirebaseUid();
            RankingAccumulator row = grouped.computeIfAbsent(userId, unused -> new RankingAccumulator(summary));
            row.add(summary);
        }

        Comparator<RankingAccumulator> comparator = "total".equals(type)
            ? Comparator.comparingInt(RankingAccumulator::totalShots).reversed()
                .thenComparing(Comparator.comparingDouble(RankingAccumulator::hitRate).reversed())
            : Comparator.comparingDouble(RankingAccumulator::hitRate).reversed()
                .thenComparing(Comparator.comparingInt(RankingAccumulator::totalShots).reversed());

        List<RankingAccumulator> eligible = grouped.values()
            .stream()
            .filter(row -> row.totalShots() >= MIN_RANKING_SHOTS)
            .sorted(comparator)
            .limit(10)
            .toList();

        for (int index = 0; index < eligible.size(); index++) {
            eligible.get(index).rank = index + 1;
        }
        return eligible.stream().map(RankingAccumulator::response).toList();
    }

    private static class RankingAccumulator {
        private final String userId;
        private final String name;
        private String rangeId;
        private String rangeName;
        private int totalShots;
        private int totalHits;
        private int rank;

        RankingAccumulator(PracticeSummary summary) {
            userId = summary.getUser().getFirebaseUid();
            name = summary.getUser().getName();
            rangeId = summary.getRangeId();
            rangeName = summary.getRangeName();
        }

        void add(PracticeSummary summary) {
            rangeId = summary.getRangeId();
            rangeName = summary.getRangeName();
            totalShots += summary.getTotalShots();
            totalHits += summary.getTotalHits();
        }

        int totalShots() {
            return totalShots;
        }

        double hitRate() {
            return totalShots == 0 ? 0 : (double) totalHits / totalShots;
        }

        RankingRowResponse response() {
            return new RankingRowResponse(rank, userId, name, rangeId, rangeName, totalShots, totalHits, hitRate());
        }
    }
}
