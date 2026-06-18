package com.blog.backend.range;

import java.math.BigDecimal;
import java.util.Comparator;
import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/ranges")
public class ArcheryRangeController {
    private final ArcheryRangeRepository ranges;

    public ArcheryRangeController(ArcheryRangeRepository ranges) {
        this.ranges = ranges;
    }

    @GetMapping
    List<ArcheryRangeResponse> list(@RequestParam(required = false) String keyword) {
        List<ArcheryRange> rows = keyword == null || keyword.isBlank()
            ? ranges.findTop100ByOrderByNameAsc()
            : ranges.findTop50BySearchTextContainingIgnoreCaseOrderByNameAsc(keyword.trim());
        return rows.stream().map(ArcheryRangeResponse::from).toList();
    }

    @GetMapping("/nearby")
    List<ArcheryRangeResponse> nearby(
        @RequestParam BigDecimal lat,
        @RequestParam BigDecimal lng,
        @RequestParam(defaultValue = "5") int limit
    ) {
        return ranges.findAll().stream()
            .filter(range -> range.getLatitude() != null && range.getLongitude() != null)
            .map(range -> ArcheryRangeResponse.from(range, distanceKm(lat, lng, range.getLatitude(), range.getLongitude())))
            .sorted(Comparator.comparing(ArcheryRangeResponse::distanceKm))
            .limit(Math.max(1, Math.min(limit, 20)))
            .toList();
    }

    private double distanceKm(BigDecimal lat, BigDecimal lng, BigDecimal rangeLat, BigDecimal rangeLng) {
        double dLat = Math.toRadians(rangeLat.doubleValue() - lat.doubleValue());
        double dLng = Math.toRadians(rangeLng.doubleValue() - lng.doubleValue());
        double sourceLat = Math.toRadians(lat.doubleValue());
        double targetLat = Math.toRadians(rangeLat.doubleValue());
        double a = Math.pow(Math.sin(dLat / 2), 2)
            + Math.cos(sourceLat) * Math.cos(targetLat) * Math.pow(Math.sin(dLng / 2), 2);
        return 6371.0088 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }
}
