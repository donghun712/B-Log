package com.blog.backend.auth;

import java.util.Map;

import com.fasterxml.jackson.databind.JsonNode;
import com.google.firebase.FirebaseApp;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseAuthException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;

@Service
public class KakaoAuthService {
    private final RestClient authClient = RestClient.create("https://kauth.kakao.com");
    private final RestClient apiClient = RestClient.create("https://kapi.kakao.com");
    private final String restApiKey;
    private final String clientSecret;
    private final KakaoLoginStateService loginStates;

    public KakaoAuthService(
        @Value("${b-log.kakao.rest-api-key}") String restApiKey,
        @Value("${b-log.kakao.login-client-secret}") String clientSecret,
        KakaoLoginStateService loginStates
    ) {
        this.restApiKey = restApiKey;
        this.clientSecret = clientSecret;
        this.loginStates = loginStates;
    }

    public String issueState() {
        verifyConfiguration();
        return loginStates.issue();
    }

    public String exchange(String code, String state, String redirectUri) {
        verifyConfiguration();
        loginStates.verify(state);
        String kakaoAccessToken = accessToken(code, redirectUri);
        JsonNode user = kakaoUser(kakaoAccessToken);
        String kakaoId = user.path("id").asText();
        if (kakaoId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Kakao user id was missing.");
        }
        try {
            return FirebaseAuth.getInstance().createCustomToken(
                "kakao:" + kakaoId,
                Map.of("provider", "kakao", "kakao_id", kakaoId)
            );
        } catch (FirebaseAuthException error) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Could not create Firebase custom token.");
        }
    }

    private String accessToken(String code, String redirectUri) {
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("grant_type", "authorization_code");
        form.add("client_id", restApiKey);
        form.add("redirect_uri", redirectUri);
        form.add("code", code);
        if (!clientSecret.isBlank()) {
            form.add("client_secret", clientSecret);
        }

        JsonNode response = authClient.post()
            .uri("/oauth/token")
            .contentType(MediaType.APPLICATION_FORM_URLENCODED)
            .body(form)
            .retrieve()
            .body(JsonNode.class);
        String token = response == null ? "" : response.path("access_token").asText();
        if (token.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Kakao access token exchange failed.");
        }
        return token;
    }

    private JsonNode kakaoUser(String accessToken) {
        JsonNode response = apiClient.get()
            .uri("/v2/user/me")
            .header("Authorization", "Bearer " + accessToken)
            .retrieve()
            .body(JsonNode.class);
        if (response == null) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Kakao user lookup failed.");
        }
        return response;
    }

    private void verifyConfiguration() {
        if (restApiKey.isBlank()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "KAKAO_REST_API_KEY is not configured.");
        }
        if (FirebaseApp.getApps().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Firebase Admin is not configured for Kakao login.");
        }
    }
}
