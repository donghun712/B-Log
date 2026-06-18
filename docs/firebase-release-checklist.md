# Firebase Release Checklist

Firebase/Firestore 기준으로 B-Log를 배포할 때 확인할 항목입니다.

## 1. Firebase Console

- Authentication에서 Google 로그인을 활성화합니다.
- Kakao 로그인은 OIDC 제공업체로 등록합니다.
- 승인된 도메인에 배포 도메인과 개발 도메인을 등록합니다.
- Firestore Database를 프로덕션 모드로 생성합니다.
- Firestore Rules와 Indexes를 배포합니다.
- Hosting에 PWA를 배포합니다.

## 2. Kakao OIDC

Kakao Developers와 Firebase OIDC 설정이 서로 맞아야 합니다.

- Kakao OpenID Connect: ON
- Kakao Client Secret: 활성화
- Firebase OIDC provider id: `oidc.kakao`
- Kakao Redirect URI: Firebase가 안내하는 callback URL
- JavaScript 플랫폼 도메인: 개발/배포 도메인 모두 등록

## 3. Build And Deploy

```bash
npm run lint
npm run build
npx firebase-tools deploy --only hosting,firestore --project b-log-ffa4d
```

## 4. Admin Features

현재 관리자 기능은 Firestore 직접 방식으로 동작합니다.

- 관리자 신청: `adminRequests/{uid}` 문서 생성
- 최고관리자 승인: `adminAccounts/{uid}` 문서 생성 또는 수정
- 관리자 권한 확인: 현재 로그인 UID의 `adminAccounts/{uid}` 조회
- 활터 관리자 조회: 본인 `rangeId` 기준으로 회원과 요약 기록 조회
- 최고관리자 조회: 전체 관리자/신청/회원 조회

Firebase Functions는 이전 구현 보관 코드이며 기본 배포 대상에서 제외합니다. 출시 전에는 Firestore Rules가 최고관리자와 활터관리자 권한을 올바르게 제한하는지 확인합니다.

## 5. Manual Smoke Test

- Google 로그인
- Kakao OIDC 로그인
- 최초 온보딩 저장
- 간단 기록 저장
- 상세 기록 저장
- 기록 수정/삭제
- 랭킹 반영과 비공개 제외
- 그룹 생성/참가/탈퇴
- 관리자 승인 요청
- 최고 관리자 페이지 접근
- PWA 설치 후 재실행 로그인 유지
