package com.blog.backend.admin;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "admin_accounts")
public class AdminAccount {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String username;

    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    @Column(nullable = false)
    private String role;

    @Column(name = "range_id", unique = true)
    private String rangeId;

    @Column(name = "range_name")
    private String rangeName;

    @Column(nullable = false)
    private boolean active;

    @Column(name = "must_change_password", nullable = false)
    private boolean mustChangePassword;

    @Column(name = "last_login_at")
    private LocalDateTime lastLoginAt;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    protected AdminAccount() {
    }

    public AdminAccount(String username, String passwordHash, String role, String rangeId, String rangeName, LocalDateTime now) {
        this.username = username.trim();
        this.passwordHash = passwordHash;
        this.role = role;
        this.rangeId = rangeId;
        this.rangeName = rangeName;
        this.active = true;
        this.mustChangePassword = true;
        this.createdAt = now;
        this.updatedAt = now;
    }

    public void changePassword(String nextPasswordHash, LocalDateTime now) {
        passwordHash = nextPasswordHash;
        mustChangePassword = false;
        updatedAt = now;
    }

    public void resetPassword(String nextPasswordHash, LocalDateTime now) {
        passwordHash = nextPasswordHash;
        mustChangePassword = true;
        updatedAt = now;
    }

    public void setActive(boolean nextActive, LocalDateTime now) {
        active = nextActive;
        updatedAt = now;
    }

    public void markLogin(LocalDateTime now) {
        lastLoginAt = now;
        updatedAt = now;
    }

    public Long getId() {
        return id;
    }

    public String getUsername() {
        return username;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public String getRole() {
        return role;
    }

    public String getRangeId() {
        return rangeId;
    }

    public String getRangeName() {
        return rangeName;
    }

    public boolean isActive() {
        return active;
    }

    public boolean isMustChangePassword() {
        return mustChangePassword;
    }

    public LocalDateTime getLastLoginAt() {
        return lastLoginAt;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }
}
