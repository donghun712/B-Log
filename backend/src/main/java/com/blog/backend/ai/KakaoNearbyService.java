package com.blog.backend.ai;

import java.math.BigDecimal;
import java.util.stream.StreamSupport;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;

@Service
public class KakaoNearbyService {
    private final RestClient restClient = RestClient.create("https://dapi.kakao.com");
    private final String apiKey;

    public KakaoNearbyService(@Value("${b-log.kakao.rest-api-key}") String apiKey) {
        this.apiKey = apiKey;
    }

    public String context(BigDecimal latitude, BigDecimal longitude) {
        if (apiKey.isBlank()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "KAKAO_REST_API_KEY is not configured.");
        }
        if (latitude == null || longitude == null) {
            return "";
        }
        return StreamSupport.stream(search("맛집", latitude, longitude).spliterator(), false)
            .limit(3)
            .map(this::line)
            .reduce("", (left, right) -> left.isBlank() ? right : left + "\n" + right);
    }

    private JsonNode search(String keyword, BigDecimal latitude, BigDecimal longitude) {
        JsonNode body = restClient.get()
            .uri(uri -> uri.path("/v2/local/search/keyword.json")
                .queryParam("query", keyword)
                .queryParam("y", latitude)
                .queryParam("x", longitude)
                .queryParam("radius", 3000)
                .queryParam("size", 5)
                .build())
            .header("Authorization", "KakaoAK " + apiKey)
            .retrieve()
            .body(JsonNode.class);
        return body == null ? JsonNodeFactory.instance.arrayNode() : body.path("documents");
    }

    private String line(JsonNode place) {
        return place.path("place_name").asText() + " - " + place.path("road_address_name").asText(place.path("address_name").asText());
    }
}
