package com.blog.backend.group;

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
@Table(name = "group_members")
public class GroupMember {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "group_id", nullable = false)
    private UserGroup group;

    @ManyToOne
    @JoinColumn(name = "user_id", nullable = false)
    private AppUser user;

    @Column(nullable = false)
    private String role;

    @Column(name = "joined_at", nullable = false)
    private LocalDateTime joinedAt;

    protected GroupMember() {
    }

    public GroupMember(UserGroup group, AppUser user, String role, LocalDateTime now) {
        this.group = group;
        this.user = user;
        this.role = role;
        joinedAt = now;
    }

    public void promoteOwner() {
        role = "OWNER";
    }

    public Long getId() {
        return id;
    }

    public UserGroup getGroup() {
        return group;
    }

    public AppUser getUser() {
        return user;
    }

    public String getRole() {
        return role;
    }

    public LocalDateTime getJoinedAt() {
        return joinedAt;
    }
}
