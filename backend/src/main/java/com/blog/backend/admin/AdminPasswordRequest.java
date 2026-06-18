package com.blog.backend.admin;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record AdminPasswordRequest(
    @NotBlank(message = "현재 비밀번호를 입력해주세요.")
    String currentPassword,

    @NotBlank(message = "새 비밀번호를 입력해주세요.")
    @Size(min = 5, max = 80, message = "새 비밀번호는 5자 이상 80자 이하여야 합니다.")
    String newPassword
) {
}
