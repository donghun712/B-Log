# Play Store Release Preparation

## Release Strategy

B-Log is currently a Firebase Hosting PWA. For Google Play, the safest release path is to package the deployed PWA as an Android app using Trusted Web Activity (TWA). TWA keeps the web app as the source of truth while providing an Android package that can be distributed through Play Store.

Recommended package name:

```text
com.blog.b_log
```

Important: package names are unique and permanent in Play Console. Confirm this package name before uploading the first app bundle.

## Current Release Status

- Web production URL: `https://b-log-ffa4d.web.app`
- Firebase Hosting CI/CD: complete
- PWA manifest: present
- App icons: present
  - `public/pwa-icon-192.png`
  - `public/pwa-icon-512.png`
  - `public/pwa-icon-maskable-512.png`
- Store listing Korean draft: present under `play-store/listing/ko-KR/`
- Digital Asset Links template: `public/.well-known/assetlinks.template.json`
- Final Android App Bundle (`.aab`): not generated yet
- Play App Signing SHA-256 fingerprint: not available yet

## Required Play Store Items

### Android Package

Use Bubblewrap or PWABuilder to create a TWA Android project from the deployed manifest.

```bash
npm install -g @bubblewrap/cli
bubblewrap init --manifest=https://b-log-ffa4d.web.app/manifest.webmanifest
bubblewrap build
```

When prompted, use:

- App name: `B-Log`
- Launcher name: `B-Log`
- Package ID: `com.blog.b_log`
- Start URL: `https://b-log-ffa4d.web.app/`
- Scope URL: `https://b-log-ffa4d.web.app/`
- Display mode: `standalone`
- Orientation: `portrait`
- Theme color: `#eef8ff`
- Background color: `#eef8ff`

For Play Store upload, generate an Android App Bundle (`.aab`) if the toolchain offers both APK and AAB outputs.

### Digital Asset Links

After Play Console creates or shows the Play App Signing certificate, copy its SHA-256 fingerprint and replace the placeholder in:

```text
public/.well-known/assetlinks.template.json
```

Then publish it as:

```text
public/.well-known/assetlinks.json
```

Deploy Firebase Hosting again:

```bash
npm run build
npx firebase-tools deploy --only hosting --project b-log-ffa4d
```

Without a valid `assetlinks.json`, the app may open as a Custom Tab with browser UI instead of a verified TWA.

### Target API

As of the current Google Play requirement, new apps and updates submitted after August 31, 2025 must target Android 15 / API level 35 or higher. Confirm the generated Android project uses `targetSdkVersion` or `targetSdk` 35+ before upload.

### Store Listing

Use the draft copy in:

```text
play-store/listing/ko-KR/
```

Required assets to prepare in Play Console:

- App icon: 512 x 512 PNG, under 1024 KB
- Feature graphic: 1024 x 500 JPEG or 24-bit PNG
- Phone screenshots: at least 2
- Support email
- Privacy policy URL

Recommended category:

```text
Sports
```

## Data Safety Draft

B-Log uses Firebase Authentication and Firestore, and stores some details locally in IndexedDB.

Likely declarations to review in Play Console:

- Personal info: name, email address, user ID
- App activity: practice records, rankings, group participation
- Location: approximate/current location may be used to suggest nearby archery ranges if the user grants browser location permission
- Data is transmitted over HTTPS
- Users can edit/delete practice records in the app
- Authentication is required for cloud sync features

Review the final Play Console Data safety form carefully before submission.

## Pre-Submission Checklist

1. Confirm package name before first upload.
2. Generate TWA Android project.
3. Build signed `.aab`.
4. Create Play Console app.
5. Enable Play App Signing.
6. Upload `.aab` to internal testing.
7. Copy Play App Signing SHA-256 fingerprint.
8. Publish `public/.well-known/assetlinks.json`.
9. Redeploy Firebase Hosting.
10. Install from internal testing and verify TWA fullscreen behavior.
11. Verify Google/Kakao login on installed app.
12. Verify record creation, ranking, group flow, and admin access.
13. Complete store listing, Data safety, app content, target audience, and privacy policy sections.
14. If using a new personal Play developer account, complete closed testing requirements before production.

## Official References

- Google Play target API requirements: https://support.google.com/googleplay/android-developer/answer/11926878
- Play Console app setup and app bundle notes: https://support.google.com/googleplay/android-developer/answer/9859152
- TWA quick start: https://developer.chrome.com/docs/android/trusted-web-activity/quick-start/
- Play Store preview assets: https://support.google.com/googleplay/android-developer/answer/9866151
- New personal account testing requirements: https://support.google.com/googleplay/android-developer/answer/14151465
