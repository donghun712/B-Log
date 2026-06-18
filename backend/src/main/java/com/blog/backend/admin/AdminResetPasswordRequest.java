package com.blog.backend.admin;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record AdminResetPasswordRequest(
    @NotBlank(message = "임시 비밀번호를 입력해주세요.")
    @Size(min = 5, max = 80, message = "임시 비밀번호는 5자 이상 80자 이하여야 합니다.")
    String password
) {
}
