package com.blog.backend.range;

import java.io.IOException;
import java.io.InputStream;
import java.util.Arrays;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

@Component
public class ArcheryRangeSeeder implements ApplicationRunner {
    private final ArcheryRangeRepository ranges;
    private final ObjectMapper objectMapper;

    public ArcheryRangeSeeder(ArcheryRangeRepository ranges, ObjectMapper objectMapper) {
        this.ranges = ranges;
        this.objectMapper = objectMapper;
    }

    @Override
    public void run(ApplicationArguments args) throws IOException {
        if (ranges.count() > 0) {
            return;
        }

        ClassPathResource resource = new ClassPathResource("seed/archery-ranges.json");
        try (InputStream input = resource.getInputStream()) {
            ranges.saveAll(Arrays.stream(objectMapper.readValue(input, ArcheryRangeSeed[].class)).map(ArcheryRange::new).toList());
        }
    }
}
