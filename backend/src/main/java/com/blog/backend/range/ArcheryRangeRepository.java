package com.blog.backend.range;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ArcheryRangeRepository extends JpaRepository<ArcheryRange, String> {
    List<ArcheryRange> findTop50BySearchTextContainingIgnoreCaseOrderByNameAsc(String keyword);
    List<ArcheryRange> findTop100ByOrderByNameAsc();
}
