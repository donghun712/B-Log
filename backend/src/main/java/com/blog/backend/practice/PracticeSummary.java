package com.blog.backend.practice;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;

import com.blog.backend.user.AppUser;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "practice_summaries")
public class PracticeSummary {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "user_id", nullable = false)
    private AppUser user;

    @Column(name = "client_session_id", nullable = false, unique = true)
    private String clientSessionId;

    @Column(name = "range_id", nullable = false)
    private String rangeId;

    @Column(name = "range_name", nullable = false)
    private String rangeName;

    @Column(name = "practice_date", nullable = false)
    private LocalDate practiceDate;

    @Column(name = "practiced_at", nullable = false)
    private OffsetDateTime practicedAt;

    @Column(name = "record_mode", nullable = false)
    private String recordMode;

    @Column(name = "total_shots", nullable = false)
    private int totalShots;

    @Column(name = "total_hits", nullable = false)
    private int totalHits;

    @Column(name = "ranking_public", nullable = false)
    private boolean rankingPublic;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    protected PracticeSummary() {
    }

    public PracticeSummary(AppUser user, PracticeSummaryRequest request, LocalDateTime now) {
        this.user = user;
        clientSessionId = request.clientSessionId().trim();
        createdAt = now;
        update(request, now);
    }

    public void update(PracticeSummaryRequest request, LocalDateTime now) {
        rangeId = request.rangeId().trim();
        rangeName = request.rangeName().trim();
        practiceDate = request.practiceDate();
        practicedAt = request.practicedAt();
        recordMode = request.mode();
        totalShots = request.totalShots();
        totalHits = request.totalHits();
        rankingPublic = request.isRankingPublic();
        updatedAt = now;
    }

    public void setRankingPublic(boolean rankingPublic, LocalDateTime now) {
        this.rankingPublic = rankingPublic;
        updatedAt = now;
    }

    public Long getId() {
        return id;
    }

    public AppUser getUser() {
        return user;
    }

    public String getClientSessionId() {
        return clientSessionId;
    }

    public String getRangeId() {
        return rangeId;
    }

    public String getRangeName() {
        return rangeName;
    }

    public LocalDate getPracticeDate() {
        return practiceDate;
    }

    public OffsetDateTime getPracticedAt() {
        return practicedAt;
    }

    public String getRecordMode() {
        return recordMode;
    }

    public int getTotalShots() {
        return totalShots;
    }

    public int getTotalHits() {
        return totalHits;
    }

    public boolean isRankingPublic() {
        return rankingPublic;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }
}
