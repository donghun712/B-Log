package com.blog.backend.admin;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record AdminAccountRequest(
    @NotBlank(message = "관리자 ID를 입력해주세요.")
    @Size(max = 80, message = "관리자 ID는 80자 이하여야 합니다.")
    String username,

    @NotBlank(message = "임시 비밀번호를 입력해주세요.")
    @Size(min = 5, max = 80, message = "비밀번호는 5자 이상 80자 이하여야 합니다.")
    String password,

    @NotBlank(message = "활터를 선택해주세요.")
    String rangeId
) {
}
