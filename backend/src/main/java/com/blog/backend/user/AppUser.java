package com.blog.backend.user;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "app_users")
public class AppUser {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "firebase_uid", nullable = false, unique = true)
    private String firebaseUid;

    private String email;
    private String name;

    @Column(name = "range_id")
    private String rangeId;

    @Column(name = "range_name")
    private String rangeName;

    private String grade;

    @Column(name = "bow_hand")
    private String bowHand;

    @Column(name = "default_record_mode")
    private String defaultRecordMode;

    @Column(name = "ranking_public")
    private boolean rankingPublic;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    protected AppUser() {
    }

    public AppUser(String firebaseUid, String email, UserProfileRequest request, LocalDateTime now) {
        this.firebaseUid = firebaseUid;
        this.email = email;
        this.createdAt = now;
        update(request, email, now);
    }

    public void update(UserProfileRequest request, String nextEmail, LocalDateTime now) {
        email = nextEmail != null ? nextEmail : email;
        name = request.name().trim();
        rangeId = request.rangeId().trim();
        rangeName = request.rangeName().trim();
        grade = request.grade().trim();
        bowHand = request.bowHand();
        defaultRecordMode = request.defaultRecordMode();
        rankingPublic = request.isRankingPublic();
        updatedAt = now;
    }

    public Long getId() {
        return id;
    }

    public String getFirebaseUid() {
        return firebaseUid;
    }

    public String getEmail() {
        return email;
    }

    public String getName() {
        return name;
    }

    public String getRangeId() {
        return rangeId;
    }

    public String getRangeName() {
        return rangeName;
    }

    public String getGrade() {
        return grade;
    }

    public String getBowHand() {
        return bowHand;
    }

    public String getDefaultRecordMode() {
        return defaultRecordMode;
    }

    public boolean isRankingPublic() {
        return rankingPublic;
    }
}
