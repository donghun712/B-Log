package com.blog.backend.range;

import java.math.BigDecimal;

public record ArcheryRangeSeed(
    String id,
    String region,
    String city,
    String name,
    String representative,
    String address,
    String phone,
    String postalCode,
    BigDecimal latitude,
    BigDecimal longitude
) {
}
