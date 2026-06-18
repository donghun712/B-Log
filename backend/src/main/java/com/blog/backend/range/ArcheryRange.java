package com.blog.backend.range;

import java.math.BigDecimal;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "archery_ranges")
public class ArcheryRange {
    @Id
    private String id;
    private String region;
    private String city;
    private String name;
    private String representative;
    private String address;
    private String phone;

    @Column(name = "postal_code")
    private String postalCode;

    private BigDecimal latitude;
    private BigDecimal longitude;

    @Column(name = "search_text")
    private String searchText;

    protected ArcheryRange() {
    }

    public ArcheryRange(ArcheryRangeSeed seed) {
        id = seed.id();
        region = seed.region();
        city = seed.city();
        name = seed.name();
        representative = seed.representative();
        address = seed.address();
        phone = seed.phone();
        postalCode = seed.postalCode();
        latitude = seed.latitude();
        longitude = seed.longitude();
        searchText = String.join(" ", region, city == null ? "" : city, name, address == null ? "" : address).toLowerCase();
    }

    public String getId() {
        return id;
    }

    public String getRegion() {
        return region;
    }

    public String getCity() {
        return city;
    }

    public String getName() {
        return name;
    }

    public String getRepresentative() {
        return representative;
    }

    public String getAddress() {
        return address;
    }

    public String getPhone() {
        return phone;
    }

    public String getPostalCode() {
        return postalCode;
    }

    public BigDecimal getLatitude() {
        return latitude;
    }

    public BigDecimal getLongitude() {
        return longitude;
    }
}
