package com.blog.backend.range;

import java.math.BigDecimal;

public record ArcheryRangeResponse(
    String id,
    String region,
    String city,
    String name,
    String representative,
    String address,
    String phone,
    String postalCode,
    BigDecimal latitude,
    BigDecimal longitude,
    Double distanceKm
) {
    public static ArcheryRangeResponse from(ArcheryRange range) {
        return from(range, null);
    }

    public static ArcheryRangeResponse from(ArcheryRange range, Double distanceKm) {
        return new ArcheryRangeResponse(
            range.getId(),
            range.getRegion(),
            range.getCity(),
            range.getName(),
            range.getRepresentative(),
            range.getAddress(),
            range.getPhone(),
            range.getPostalCode(),
            range.getLatitude(),
            range.getLongitude(),
            distanceKm
        );
    }
}
