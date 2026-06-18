# B-Log Project Status

## Current Direction

현재 B-Log는 Firebase 중심 PWA로 출시하는 방향입니다. Spring Boot 서버는 당장 운영하지 않고, Firestore와 Firebase Auth를 기준으로 기능을 유지합니다.

## Completed Core Areas

- 모바일 우선 React PWA 화면 구조
- Google 로그인
- Kakao OIDC 로그인 구조
- 최초 온보딩
- 간단/상세 기록 입력
- 로컬 상세 기록 저장
- Firestore 요약 기록 저장
- 기록 수정/삭제
- 주간/월간 랭킹
- 그룹 생성/참가/탈퇴
- 통계 캘린더/차트/시간 통계/방향 통계
- 관리자 페이지 기본 구조
- Firestore 직접 방식의 관리자 신청/승인
- Firestore 직접 방식의 활터별 회원/기록 조회
- 회원 비활성화와 랭킹 제외
- PWA manifest/service worker/Hosting 배포 설정

## Remaining Work Before Wider Testing

1. 실제 Android 기기에서 PWA 설치 테스트
2. Kakao 로그인 모바일 실기기 테스트
3. 뒤로가기/종료 UX 실기기 확인
4. Firestore Rules 최종 점검
5. 테스트 데이터 정리
6. 앱 설명서/최초 실행 안내 제작
7. UI 세부 다듬기
8. Play Store 출시 시 TWA/WebView 포장 여부 결정

## Technical Debt

- `backend/` Spring Boot 프로젝트는 현재 사용하지 않는 보관 코드입니다.
- `functions/`는 이전 관리자 기능용 Firebase Functions 구현이며 Spring Boot와 별개입니다. 현재 기본 배포 대상에서는 제외했습니다.
- production bundle이 500KB를 넘는다는 Vite 경고가 있어 추후 코드 분할을 고려할 수 있습니다.

## Recommended Next Step

현재는 기능 추가보다 실기기 검증이 우선입니다. Android에서 PWA 설치 후 로그인, 기록 저장, 랭킹 반영, 뒤로가기, 재실행 로그인 유지 순서로 테스트하는 것이 좋습니다.
