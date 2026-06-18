package com.blog.backend.group;

import java.util.List;

import com.blog.backend.config.DevUserHeaderFilter.CurrentUser;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/groups")
public class GroupController {
    private final GroupService groups;

    public GroupController(GroupService groups) {
        this.groups = groups;
    }

    @GetMapping("/my")
    List<GroupResponse> my(@AuthenticationPrincipal CurrentUser currentUser) {
        return groups.myGroups(currentUser.firebaseUid());
    }

    @PostMapping
    GroupResponse create(@AuthenticationPrincipal CurrentUser currentUser, @Valid @RequestBody GroupRequests.Create request) {
        return groups.create(currentUser.firebaseUid(), request.name());
    }

    @PostMapping("/join")
    GroupResponse join(@AuthenticationPrincipal CurrentUser currentUser, @Valid @RequestBody GroupRequests.Join request) {
        return groups.join(currentUser.firebaseUid(), request.inviteCode());
    }

    @GetMapping("/{groupId}/members")
    List<GroupMemberResponse> members(@AuthenticationPrincipal CurrentUser currentUser, @PathVariable Long groupId) {
        return groups.members(currentUser.firebaseUid(), groupId);
    }

    @DeleteMapping("/{groupId}/leave")
    ResponseEntity<Void> leave(@AuthenticationPrincipal CurrentUser currentUser, @PathVariable Long groupId) {
        groups.leave(currentUser.firebaseUid(), groupId);
        return ResponseEntity.noContent().build();
    }
}
