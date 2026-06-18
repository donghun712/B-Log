# B-Log 제출 요약

## Front-End 구성 및 링크

React + TypeScript + Vite 기반 PWA입니다. Tailwind CSS로 모바일 중심 UI를 구성했고, `react-router-dom`으로 로그인, 온보딩, 기록, 분석, 랭킹, 설정, 관리자 화면을 라우팅합니다.

- 로컬 실행: `npm run dev`
- 주요 경로: `/home`, `/stats`, `/ranking`, `/settings`, `/admin`
- 배포 URL: https://b-log-ffa4d.web.app

## Back-End 구성 및 링크

현재 운영 경로는 별도 Spring Boot 서버가 아니라 Firebase 중심 구조입니다. Firebase Auth와 Cloud Firestore를 프론트엔드에서 직접 사용합니다.

`backend/`에는 Spring Boot 기반 이전 구현이 있고, `functions/`에는 Firebase Functions 기반 관리자 기능 코드가 남아 있지만 현재 기본 배포 대상은 아닙니다.

## Database 구성 설명

Cloud Firestore와 IndexedDB를 함께 사용합니다.

- Firestore: `profiles`, `practiceSummaries`, `groups`, `groups/{groupId}/members`, `adminAccounts`, `adminRequests`, `archeryRanges`
- IndexedDB/Dexie: `userProfiles`, `archeryRanges`, `practiceSessions`, `localSessionDetails`, `groups`, `groupMembers`, `shotDetails`, `syncQueue`

Firestore에는 공유가 필요한 요약 데이터와 권한 데이터를 저장하고, IndexedDB에는 상세 탄착 기록과 메모 등 로컬 중심 데이터를 저장합니다.

## 배포 URL

- https://b-log-ffa4d.web.app
- https://b-log-ffa4d.firebaseapp.com

2026-06-18 기준 Firebase Hosting과 Firestore rules/indexes 배포를 완료했습니다.

## CI/CD 구성 설명

GitHub Actions를 사용합니다.

- Pull Request 또는 push 시 `npm ci`, `npm run lint`, `npm run build`로 검증
- `main` 또는 `master` 브랜치 push 시 Firebase Hosting 자동 배포
- workflow 파일: `.github/workflows/firebase-hosting.yml`

자동 배포에는 GitHub Repository Secrets 등록이 필요합니다.

Firestore rules/indexes는 권한 범위가 별도로 필요하므로 현재는 수동 배포 명령으로 관리합니다.

## GitHub Repository 링크

https://github.com/donghun712/B-Log

## 사용 기술 스택

React, TypeScript, Vite, Tailwind CSS, Firebase Authentication, Cloud Firestore, Firebase Hosting, IndexedDB/Dexie, PWA, lucide-react를 사용했습니다.

보관용 백엔드에는 Spring Boot, Java 17, JPA, Spring Security, H2/MySQL이 포함되어 있습니다.

## 주요 기능

Google/Kakao 로그인, 최초 프로필 설정, 활터 선택, 간단 기록, 상세 탄착 기록, 기록 수정/삭제, 주간/월간 분석, 캘린더/차트/통계, 전체/소속 활터/그룹 랭킹, 그룹 생성/참여/탈퇴, 관리자 권한 요청 및 승인, 활터별 회원/기록 조회 기능이 있습니다.

## AI Agent 또는 AI 활용 방식

현재 실제 서비스 화면에서는 AI 기능이 활성화되어 있지 않습니다. `/ai` 화면은 추후 업데이트 예정 상태입니다.

보관용 Spring Boot 백엔드에는 OpenAI API를 이용한 피드백/주변 장소 추천 API 코드가 남아 있지만, 현재 기본 운영 기능은 아닙니다.

## 공공데이터 활용 내용

명확한 공공데이터 포털 출처는 확인되지 않습니다.

국내 활터 목록 데이터와 Kakao Local API 기반 좌표 변환 스크립트는 확인됩니다.

## 본인 또는 팀원별 역할 분담

저장소 내에서 팀원별 역할 분담 정보는 확인되지 않습니다. 해당 없음 또는 별도 작성 필요입니다.

## 실행 방법 또는 확인 방법

```bash
npm install
npm run dev
```

검증:

```bash
npm run lint
npm run build
```

배포:

```bash
npm run build
npx firebase-tools deploy --only hosting,firestore --project b-log-ffa4d
```
