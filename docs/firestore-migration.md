# Firestore Migration Notes

B-Log는 PWA 출시를 전제로 Firebase Auth와 Firestore를 서버 데이터 계층으로 사용합니다. 브라우저 로컬 IndexedDB에는 상세 탄착군, 메모, 로컬 캐시를 남기고, Firestore에는 랭킹과 그룹에 필요한 요약 데이터를 저장합니다.

## Collections

### `profiles/{uid}`

사용자 기본 정보와 설정입니다.

- 이름
- 소속 활터
- 등급
- 좌/우궁
- 기본 기록 방식
- 랭킹 공개 여부
- 비활성화 여부

### `practiceSummaries/{clientSessionId}`

랭킹과 주간/월간 집계에 필요한 요약 기록입니다.

- 사용자 ID
- 활터 ID/이름
- 날짜와 실제 기록 시각
- 기록 모드
- 총 발수
- 총 관중 수
- 랭킹 공개 여부

문서 ID는 클라이언트 세션 ID를 사용해 중복 저장 가능성을 줄입니다.

### `groups/{groupId}`

그룹 정보입니다.

- 그룹명
- 초대 코드
- 방장 ID
- 회원 수

### `groups/{groupId}/members/{uid}`

그룹별 회원 정보입니다.

- 사용자 ID
- 이름
- 소속 활터
- 방장 여부
- 가입 시각

### `adminRequests/{requestId}`

관리자 승인 요청입니다. 일반 사용자가 관리자 페이지에서 신청하면 자신의 UID 문서로 생성합니다.

- 신청자 UID/연락 정보
- 소속 활터
- 직책 또는 관계
- 상태

### `adminAccounts/{uid}`

관리자 권한 문서입니다. 최고관리자가 승인하면 신청자의 UID 문서로 생성합니다.

- 역할: `SUPER_ADMIN` 또는 `RANGE_ADMIN`
- 담당 활터
- 활성 여부
- 최초 비밀번호 변경 필요 여부

## Local Data

상세 기록은 Dexie.js/IndexedDB에 남깁니다.

- 9방향 탄착군
- 메모
- 로컬 상세 로그

요약 기록 수정/삭제 시에는 Firestore 요약과 로컬 상세 데이터를 함께 맞춰야 합니다.

## Spring Boot Status

`backend/`에는 이전 Spring Boot 서버 구현이 남아 있습니다. `functions/`에는 이전 Firebase Functions 관리자 구현이 남아 있습니다. 현재 앱은 Firestore 중심으로 동작하므로 Spring Boot 서버나 Firebase Functions를 실행하지 않아도 됩니다.

추후 이용자가 늘거나 백엔드 개발 경험을 더 강조해야 할 때 다음 기능부터 Spring Boot로 분리할 수 있습니다.

- 랭킹 사전 집계
- 관리자 통계
- 대량 백업/복원
- AI 분석 요청 중계
- 외부 API 키 보호가 필요한 기능
