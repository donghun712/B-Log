package com.blog.backend.group;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface GroupMemberRepository extends JpaRepository<GroupMember, Long> {
    List<GroupMember> findAllByUserFirebaseUidOrderByJoinedAtAsc(String firebaseUid);
    List<GroupMember> findAllByGroupIdOrderByJoinedAtAsc(Long groupId);
    Optional<GroupMember> findByGroupIdAndUserFirebaseUid(Long groupId, String firebaseUid);
    boolean existsByGroupIdAndUserFirebaseUid(Long groupId, String firebaseUid);
    long countByGroupId(Long groupId);
    long countByUserFirebaseUid(String firebaseUid);
}
