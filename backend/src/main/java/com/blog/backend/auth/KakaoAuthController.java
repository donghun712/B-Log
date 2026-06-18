package com.blog.backend.auth;

import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth/kakao")
public class KakaoAuthController {
    private final KakaoAuthService kakaoAuth;

    public KakaoAuthController(KakaoAuthService kakaoAuth) {
        this.kakaoAuth = kakaoAuth;
    }

    @GetMapping("/state")
    KakaoStateResponse state() {
        return new KakaoStateResponse(kakaoAuth.issueState());
    }

    @PostMapping("/exchange")
    KakaoAuthResponse exchange(@Valid @RequestBody KakaoAuthRequests.Exchange request) {
        return new KakaoAuthResponse(kakaoAuth.exchange(request.code(), request.state(), request.redirectUri()));
    }
}
