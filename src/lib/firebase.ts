import { initializeApp, type FirebaseApp } from 'firebase/app'
import { browserLocalPersistence, getAuth, GoogleAuthProvider, OAuthProvider, setPersistence, type Auth } from 'firebase/auth'
import { getFunctions, type Functions } from 'firebase/functions'
import { getFirestore, type Firestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const hasFirebaseConfig = Object.values(firebaseConfig).every(Boolean)

export const firebaseApp: FirebaseApp | null = hasFirebaseConfig ? initializeApp(firebaseConfig) : null
export const firebaseAuth: Auth | null = firebaseApp ? getAuth(firebaseApp) : null
if (firebaseAuth) {
  setPersistence(firebaseAuth, browserLocalPersistence).catch(() => {
    // Auth persistence should not block the app from loading.
  })
}
export const firebaseDb: Firestore | null = firebaseApp ? getFirestore(firebaseApp) : null
export const firebaseFunctions: Functions | null = firebaseApp ? getFunctions(firebaseApp, import.meta.env.VITE_FIREBASE_FUNCTIONS_REGION ?? 'asia-northeast3') : null
export const googleProvider = new GoogleAuthProvider()
export const isFirebaseConfigured = hasFirebaseConfig

const kakaoOidcProviderId = import.meta.env.VITE_FIREBASE_KAKAO_PROVIDER_ID ?? 'oidc.kakao'

export function shouldUsePopupAuth() {
  if (typeof window === 'undefined') {
    return false
  }

  return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
}

export function createKakaoProvider() {
  const provider = new OAuthProvider(kakaoOidcProviderId)
  provider.addScope('openid')

  return provider
}
