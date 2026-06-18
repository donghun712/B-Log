# B-Log

B-Log는 국궁 습사 기록을 모바일에서 간편하게 남기고, 기록 분석과 랭킹을 확인할 수 있는 PWA입니다. 현재 출시 경로는 Firebase Auth, Cloud Firestore, Firebase Hosting을 중심으로 구성되어 있으며, 상세 탄착 기록과 메모는 브라우저 로컬 IndexedDB에 저장합니다.

## Current Stack

- React + TypeScript + Vite
- Tailwind CSS
- Firebase Authentication: Google 로그인, Kakao OIDC 로그인
- Cloud Firestore
- Firebase Hosting
- Dexie.js / IndexedDB
- PWA manifest + service worker
- GitHub Actions CI/CD

`backend/`의 Spring Boot 서버와 `functions/`의 Firebase Functions 코드는 이전 구현 또는 보관용 코드입니다. 현재 기본 배포 대상은 Firebase Hosting과 Firestore rules/indexes입니다.

## Features

- Google/Kakao 로그인
- 최초 프로필, 소속 활터, 등급, 활손, 기본 기록 방식 설정
- 간단 기록 및 상세 탄착 기록
- 기록 수정/삭제
- 주간/월간 캘린더, 차트, 방향성/시간대 통계
- 전체/소속 활터/그룹 랭킹
- 그룹 생성, 초대코드 참여, 탈퇴
- 관리자 권한 요청/승인
- 최고 관리자 및 활터 관리자용 회원/기록 조회

## Data Ownership

- Firebase Auth: 로그인 계정과 인증 상태
- Firestore: 프로필, 습사 요약 기록, 그룹, 그룹 멤버, 관리자 요청/권한, 활터 데이터
- IndexedDB: 상세 탄착 기록, 메모, 로컬 캐시

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

배포 URL:

- https://b-log-ffa4d.web.app
- https://b-log-ffa4d.firebaseapp.com

## CI/CD

GitHub Actions workflow는 `.github/workflows/firebase-hosting.yml`에 있습니다.

- Pull Request: `npm ci`, `npm run lint`, `npm run build`
- `main` 또는 `master` push: 빌드 후 Firebase Hosting 자동 배포

GitHub Repository Secrets에 Firebase 프론트 환경변수와 서비스 계정 JSON을 등록해야 자동 배포가 동작합니다.

필수 secrets:

- `FIREBASE_SERVICE_ACCOUNT_B_LOG_FFA4D`
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

선택 secrets:

- `VITE_FIREBASE_FUNCTIONS_REGION`
- `VITE_FIREBASE_KAKAO_PROVIDER_ID`

Firestore rules/indexes는 권한 범위가 Hosting 배포와 다르므로 필요 시 아래 명령으로 수동 배포합니다.

```bash
npx firebase-tools deploy --only firestore --project b-log-ffa4d
```

## Test Data Cleanup

테스트 기록과 그룹만 정리하는 전용 스크립트가 있습니다. Auth, 로그인 제공자, 프로필, 관리자 권한, 활터 데이터는 삭제하지 않습니다.

```bash
cd functions
npm run cleanup:test-data -- --dry-run
node scripts/cleanup-test-data.js --confirm
```

기본 실행은 dry-run입니다. 실제 삭제는 `--confirm`을 붙인 경우에만 수행됩니다.
