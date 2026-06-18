# B-Log

국궁인을 위한 모바일 우선 시수 기록 PWA입니다. 현재 출시 방향은 Firebase Auth, Firestore, Firebase Hosting을 중심으로 운영하고, 상세 탄착군과 메모는 브라우저 로컬 IndexedDB에 보관하는 구조입니다.

## Current Stack

- React + TypeScript + Vite
- Tailwind CSS
- Firebase Auth
- Cloud Firestore
- Firebase Hosting
- Firebase Functions: 이전 관리자 구현 보관 코드. 현재 출시 경로에서는 사용하지 않음
- Dexie.js: 로컬 상세 기록 저장
- PWA manifest + service worker

## Run

```bash
npm install
npm run dev
```

## Verify

```bash
npm run lint
npm run build
```

## Deploy

```bash
npm run build
npx firebase-tools deploy --only hosting,firestore --project b-log-ffa4d
```

관리자 신청, 최고관리자 승인, 활터별 회원 조회는 현재 Firestore 직접 조회/저장과 Firestore Rules를 기준으로 동작합니다. Spark 요금제 유지를 위해 Firebase Functions는 기본 배포 대상에서 제외했습니다.

## Data Ownership

- Firestore: 프로필, 요약 기록, 랭킹용 데이터, 그룹, 관리자 승인/권한
- IndexedDB: 상세 탄착군, 메모, 오프라인/로컬 캐시
- Firebase Auth: Google 로그인, Kakao OIDC 로그인, 관리자 권한 확인용 계정

## Spring Boot Archive

`backend/` 디렉터리는 이전 Spring Boot + JPA + H2/MySQL 백엔드 구현입니다. `functions/` 디렉터리는 이전 Firebase Functions 관리자 구현입니다. 둘 다 현재 Firebase 중심 출시 경로에서는 사용하지 않지만, 추후 이용자 증가나 백엔드 평가 요소가 필요할 때 참고하거나 재활용할 수 있습니다.

삭제 전에 다음을 확인하세요.

- 기존 H2 데이터가 필요한지
- Spring Boot 구현을 별도 백업할지
- 관리자/랭킹/통계 기능을 다시 서버로 분리할 계획이 있는지
