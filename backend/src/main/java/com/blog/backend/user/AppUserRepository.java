package com.blog.backend.user;

import java.util.Optional;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AppUserRepository extends JpaRepository<AppUser, Long> {
    Optional<AppUser> findByFirebaseUid(String firebaseUid);
    long countByRangeId(String rangeId);
    List<AppUser> findAllByRangeIdOrderByNameAsc(String rangeId);

    @Query("""
        select user from AppUser user
        where user.rangeId = :rangeId
        and (
            lower(user.name) like concat('%', :keyword, '%')
            or lower(coalesce(user.email, '')) like concat('%', :keyword, '%')
        )
        order by user.name asc
        """)
    List<AppUser> searchRangeMembers(@Param("rangeId") String rangeId, @Param("keyword") String keyword);
}
