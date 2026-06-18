package com.blog.backend.practice;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface PracticeSummaryRepository extends JpaRepository<PracticeSummary, Long> {
    List<PracticeSummary> findAllByUserFirebaseUidOrderByPracticedAtDesc(String firebaseUid);
    Optional<PracticeSummary> findByIdAndUserFirebaseUid(Long id, String firebaseUid);
    Optional<PracticeSummary> findByClientSessionIdAndUserFirebaseUid(String clientSessionId, String firebaseUid);
    List<PracticeSummary> findAllByRangeIdOrderByPracticedAtDesc(String rangeId);
    List<PracticeSummary> findAllByUserIdOrderByPracticedAtDesc(Long userId);
    List<PracticeSummary> findAllByRankingPublicTrueAndPracticeDateGreaterThanEqual(LocalDate practiceDate);
    List<PracticeSummary> findAllByUserFirebaseUidAndPracticeDate(String firebaseUid, LocalDate practiceDate);
    List<PracticeSummary> findTop5ByUserFirebaseUidOrderByPracticedAtDesc(String firebaseUid);
}
