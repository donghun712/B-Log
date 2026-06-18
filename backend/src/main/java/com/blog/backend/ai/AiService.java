package com.blog.backend.ai;

import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AiService {
    private final RestClient restClient = RestClient.create("https://api.openai.com");
    private final String apiKey;
    private final String model;

    public AiService(@Value("${b-log.openai.api-key}") String apiKey, @Value("${b-log.openai.model}") String model) {
        this.apiKey = apiKey;
        this.model = model;
    }

    public String gugungFeedback(String recentShotSummary, String userQuestion) {
        return responseText("""
            You are a concise Korean traditional archery coach.
            Use Korean gugung terms such as 줌손, 각지손, 발시, 만작, 거궁 only when they help.
            Give practical feedback from the supplied local shot summary only.
            Do not claim medical diagnosis or invent observations.
            """, "최근 기록 요약:\n" + recentShotSummary + "\n사용자 질문:\n" + safe(userQuestion));
    }

    public String nearbyMessage(String rangeName, String localContext, String note) {
        return responseText("""
            You recommend a short after-practice stop in Korean.
            Use only the supplied nearby place context. If context is empty, say that no nearby place data is available.
            Keep the answer under four short sentences.
            """, "활터: " + rangeName + "\n주변 정보:\n" + localContext + "\n참고:\n" + safe(note));
    }

    private String responseText(String instructions, String input) {
        if (apiKey.isBlank()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "OPENAI_API_KEY is not configured.");
        }
        JsonNode body = restClient.post()
            .uri("/v1/responses")
            .contentType(MediaType.APPLICATION_JSON)
            .header("Authorization", "Bearer " + apiKey)
            .body(Map.of(
                "model", model,
                "instructions", instructions,
                "input", input
            ))
            .retrieve()
            .body(JsonNode.class);
        if (body == null) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "AI response was empty.");
        }
        JsonNode output = body.path("output");
        for (JsonNode item : output) {
            for (JsonNode content : item.path("content")) {
                if ("output_text".equals(content.path("type").asText())) {
                    return content.path("text").asText();
                }
            }
        }
        throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "AI response did not contain text.");
    }

    private String safe(String value) {
        return value == null || value.isBlank() ? "없음" : value.trim();
    }
}
