package com.blog.backend.backup;

import java.time.LocalDateTime;

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
@Table(name = "user_backups")
public class UserBackup {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "user_id", nullable = false)
    private AppUser user;

    @Column(nullable = false, columnDefinition = "longtext")
    private String payload;

    @Column(name = "byte_size", nullable = false)
    private int byteSize;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    protected UserBackup() {
    }

    public UserBackup(AppUser user, String payload, int byteSize, LocalDateTime now) {
        this.user = user;
        this.createdAt = now;
        update(payload, byteSize, now);
    }

    public void update(String payload, int byteSize, LocalDateTime now) {
        this.payload = payload;
        this.byteSize = byteSize;
        updatedAt = now;
    }

    public Long getId() {
        return id;
    }

    public String getPayload() {
        return payload;
    }

    public int getByteSize() {
        return byteSize;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }
}
