package com.blog.backend.group;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.List;

import com.blog.backend.user.AppUser;
import com.blog.backend.user.AppUserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class GroupService {
    private static final int MAX_GROUPS_PER_USER = 3;
    private static final int MAX_MEMBERS_PER_GROUP = 50;
    private static final String CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private final UserGroupRepository groups;
    private final GroupMemberRepository members;
    private final AppUserRepository users;
    private final SecureRandom random = new SecureRandom();

    public GroupService(UserGroupRepository groups, GroupMemberRepository members, AppUserRepository users) {
        this.groups = groups;
        this.members = members;
        this.users = users;
    }

    @Transactional(readOnly = true)
    public List<GroupResponse> myGroups(String firebaseUid) {
        return members.findAllByUserFirebaseUidOrderByJoinedAtAsc(firebaseUid).stream()
            .map(member -> GroupResponse.from(member, members.countByGroupId(member.getGroup().getId())))
            .toList();
    }

    @Transactional
    public GroupResponse create(String firebaseUid, String name) {
        AppUser user = user(firebaseUid);
        verifyMembershipLimit(firebaseUid);
        if (groups.existsByNameIgnoreCase(name.trim())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Group name already exists.");
        }
        LocalDateTime now = LocalDateTime.now();
        UserGroup group = groups.save(new UserGroup(name, uniqueInviteCode(), user, now));
        GroupMember member = members.save(new GroupMember(group, user, "OWNER", now));
        return GroupResponse.from(member, 1);
    }

    @Transactional
    public GroupResponse join(String firebaseUid, String inviteCode) {
        AppUser user = user(firebaseUid);
        verifyMembershipLimit(firebaseUid);
        UserGroup group = groups.findByInviteCodeIgnoreCase(inviteCode.trim())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Invite code not found."));
        if (members.existsByGroupIdAndUserFirebaseUid(group.getId(), firebaseUid)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Already joined.");
        }
        if (members.countByGroupId(group.getId()) >= MAX_MEMBERS_PER_GROUP) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Group member limit reached.");
        }
        GroupMember member = members.save(new GroupMember(group, user, "MEMBER", LocalDateTime.now()));
        return GroupResponse.from(member, members.countByGroupId(group.getId()));
    }

    @Transactional
    public void leave(String firebaseUid, Long groupId) {
        GroupMember member = membership(firebaseUid, groupId);
        boolean owner = "OWNER".equals(member.getRole());
        members.delete(member);
        List<GroupMember> remaining = members.findAllByGroupIdOrderByJoinedAtAsc(groupId);
        if (remaining.isEmpty()) {
            groups.delete(member.getGroup());
            return;
        }
        if (owner) {
            GroupMember nextOwner = remaining.get(0);
            nextOwner.promoteOwner();
            nextOwner.getGroup().transferOwnership(nextOwner.getUser(), LocalDateTime.now());
        }
    }

    @Transactional(readOnly = true)
    public List<GroupMemberResponse> members(String firebaseUid, Long groupId) {
        membership(firebaseUid, groupId);
        return members.findAllByGroupIdOrderByJoinedAtAsc(groupId).stream().map(GroupMemberResponse::from).toList();
    }

    public List<String> memberFirebaseUids(String firebaseUid, Long groupId) {
        membership(firebaseUid, groupId);
        return members.findAllByGroupIdOrderByJoinedAtAsc(groupId).stream().map(member -> member.getUser().getFirebaseUid()).toList();
    }

    private GroupMember membership(String firebaseUid, Long groupId) {
        return members.findByGroupIdAndUserFirebaseUid(groupId, firebaseUid)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    }

    private AppUser user(String firebaseUid) {
        return users.findByFirebaseUid(firebaseUid)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT, "Complete onboarding first."));
    }

    private void verifyMembershipLimit(String firebaseUid) {
        if (members.countByUserFirebaseUid(firebaseUid) >= MAX_GROUPS_PER_USER) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "User group limit reached.");
        }
    }

    private String uniqueInviteCode() {
        String code;
        do {
            code = randomCode();
        } while (groups.existsByInviteCode(code));
        return code;
    }

    private String randomCode() {
        StringBuilder builder = new StringBuilder(6);
        for (int index = 0; index < 6; index++) {
            builder.append(CODE_CHARS.charAt(random.nextInt(CODE_CHARS.length())));
        }
        return builder.toString();
    }
}
