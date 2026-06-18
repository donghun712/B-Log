package com.blog.backend.ai;

import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/ai")
public class AiController {
    private final AiService ai;
    private final KakaoNearbyService nearby;

    public AiController(AiService ai, KakaoNearbyService nearby) {
        this.ai = ai;
        this.nearby = nearby;
    }

    @PostMapping("/feedback")
    AiTextResponse feedback(@Valid @RequestBody AiRequests.Feedback request) {
        return new AiTextResponse(ai.gugungFeedback(request.recentShotSummary(), request.userQuestion()));
    }

    @PostMapping("/nearby")
    AiTextResponse nearby(@Valid @RequestBody AiRequests.Nearby request) {
        String context = nearby.context(request.latitude(), request.longitude());
        return new AiTextResponse(ai.nearbyMessage(request.rangeName(), context, request.note()));
    }
}
