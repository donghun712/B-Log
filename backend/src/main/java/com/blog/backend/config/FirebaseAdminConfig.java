package com.blog.backend.config;

import java.io.FileInputStream;
import java.io.IOException;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;

@Configuration
public class FirebaseAdminConfig {
    public FirebaseAdminConfig(
        @Value("${b-log.auth.firebase-enabled}") boolean enabled,
        @Value("${b-log.auth.firebase-service-account}") String serviceAccountPath,
        @Value("${b-log.auth.firebase-project-id}") String projectId
    ) throws IOException {
        if (!enabled || !FirebaseApp.getApps().isEmpty()) {
            return;
        }

        FirebaseOptions.Builder options = FirebaseOptions.builder();
        if (!serviceAccountPath.isBlank()) {
            try (FileInputStream input = new FileInputStream(serviceAccountPath)) {
                options.setCredentials(GoogleCredentials.fromStream(input));
            }
        } else {
            options.setCredentials(GoogleCredentials.getApplicationDefault());
        }
        if (!projectId.isBlank()) {
            options.setProjectId(projectId);
        }
        FirebaseApp.initializeApp(options.build());
    }
}
