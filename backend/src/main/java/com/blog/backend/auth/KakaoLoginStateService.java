package com.blog.backend.auth;

import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class KakaoLoginStateService {
    private static final Duration STATE_TTL = Duration.ofMinutes(10);
    private static final String HMAC_ALGORITHM = "HmacSHA256";

    private final Clock clock = Clock.systemUTC();
    private final SecureRandom secureRandom = new SecureRandom();
    private final byte[] signingKey;

    public KakaoLoginStateService(
        @Value("${b-log.kakao.state-secret}") String stateSecret,
        @Value("${b-log.kakao.login-client-secret}") String clientSecret
    ) {
        String configuredSecret = stateSecret.isBlank() ? clientSecret : stateSecret;
        this.signingKey = configuredSecret.isBlank()
            ? randomBytes(32)
            : configuredSecret.getBytes(StandardCharsets.UTF_8);
    }

    public String issue() {
        String timestamp = Long.toString(Instant.now(clock).getEpochSecond());
        String nonce = encode(randomBytes(24));
        String payload = timestamp + "." + nonce;
        return payload + "." + encode(sign(payload));
    }

    public void verify(String state) {
        String[] parts = state.split("\\.", 3);
        if (parts.length != 3 || isExpired(parts[0])) {
            reject();
        }

        String payload = parts[0] + "." + parts[1];
        byte[] expectedSignature = sign(payload);
        byte[] actualSignature;
        try {
            actualSignature = Base64.getUrlDecoder().decode(parts[2]);
        } catch (IllegalArgumentException error) {
            reject();
            return;
        }

        if (!MessageDigest.isEqual(expectedSignature, actualSignature)) {
            reject();
        }
    }

    private boolean isExpired(String timestamp) {
        try {
            Instant issuedAt = Instant.ofEpochSecond(Long.parseLong(timestamp));
            Instant now = Instant.now(clock);
            return issuedAt.isAfter(now.plusSeconds(30)) || issuedAt.plus(STATE_TTL).isBefore(now);
        } catch (RuntimeException error) {
            return true;
        }
    }

    private byte[] randomBytes(int length) {
        byte[] bytes = new byte[length];
        secureRandom.nextBytes(bytes);
        return bytes;
    }

    private byte[] sign(String payload) {
        try {
            Mac mac = Mac.getInstance(HMAC_ALGORITHM);
            mac.init(new SecretKeySpec(signingKey, HMAC_ALGORITHM));
            return mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
        } catch (GeneralSecurityException error) {
            throw new IllegalStateException("Could not sign Kakao login state.", error);
        }
    }

    private String encode(byte[] bytes) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private void reject() {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Kakao login state is invalid or expired.");
    }
}
