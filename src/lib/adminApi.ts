import {
  EmailAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  type User,
} from 'firebase/auth'
import { httpsCallable } from 'firebase/functions'
import { firebaseAuth, firebaseFunctions } from './firebase'

export type AdminCredentials = {
  username: string
  password: string
}

export type AdminCurrent = {
  username: string
  role: 'SUPER_ADMIN' | 'RANGE_ADMIN'
  rangeId: string | null
  rangeName: string | null
  active: boolean
  mustChangePassword: boolean
}

export type AdminOverview = {
  users: number
  practiceSummaries: number
  ranges: number
  groups: number
  groupMembers: number
}

export type AdminRange = {
  id: string
  region: string
  city: string | null
  name: string
  representative: string | null
  address: string | null
  phone: string | null
  postalCode: string | null
  latitude: number | null
  longitude: number | null
  distanceKm: number | null
}

export type AdminRangeStats = {
  rangeId: string
  rangeName: string
  members: number
  practiceSummaries: number
  totalShots: number
  totalHits: number
  hitRate: number
}

export type AdminUser = {
  id: string
  userId: string
  email: string | null
  name: string
  rangeId: string
  rangeName: string
  grade: string
  rankingPublic: boolean
  practiceSummaries: number
  totalShots: number
  totalHits: number
  hitRate: number
}

export type AdminPracticeSummary = {
  id: string
  userId: string
  userName: string
  rangeId: string
  rangeName: string
  practiceDate: string
  practicedAt: string
  recordMode: 'simple' | 'detail'
  totalShots: number
  totalHits: number
  rankingPublic: boolean
}

export type AdminAccount = {
  id: string
  username: string
  role: 'RANGE_ADMIN'
  rangeId: string
  rangeName: string
  active: boolean
  mustChangePassword: boolean
  lastLoginAt: string | null
  createdAt: string
}

export type AdminApprovalRequest = {
  id: string
  email: string
  displayName: string
  rangeId: string
  rangeName: string
  message: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  createdAt: string
}

export function encodeAdminCredentials(credentials: AdminCredentials) {
  return credentials.username.trim()
}

export async function loginAdmin(credentials: AdminCredentials) {
  const auth = requireFirebaseAuth()
  const email = credentials.username.trim()
  let userCredential
  try {
    userCredential = await signInWithEmailAndPassword(auth, email, credentials.password)
    const current = await loadAdminMe(userCredential.user.uid)

    return { token: userCredential.user.uid, current }
  } catch (error) {
    await signOut(auth).catch(() => undefined)
    throw error
  }
}

export async function logoutAdmin() {
  const auth = requireFirebaseAuth()
  await signOut(auth)
}

export async function loadAdminMe(_token: string) {
  void _token
  await requireCurrentUser()
  return callAdminFunction<unknown, AdminCurrent>('adminMe')
}

export async function loadAdminOverview(_token: string) {
  void _token
  return callAdminFunction<unknown, AdminOverview>('adminOverview')
}

export async function searchAdminRanges(_token: string, query: string) {
  return callAdminFunction<{ query: string }, AdminRange[]>('adminSearchRanges', { query })
}

export async function loadAdminRangeStats(_token: string, rangeId: string) {
  return callAdminFunction<{ rangeId: string }, AdminRangeStats>('adminRangeStats', { rangeId })
}

export async function searchAdminRangeMembers(_token: string, rangeId: string, query: string) {
  return callAdminFunction<{ rangeId: string; query: string }, AdminUser[]>('adminRangeMembers', { rangeId, query })
}

export async function loadAdminUserSummaries(_token: string, userId: string) {
  return callAdminFunction<{ userId: string }, AdminPracticeSummary[]>('adminUserSummaries', { userId })
}

export async function loadAdminAccounts(_token: string) {
  void _token
  return callAdminFunction<unknown, AdminAccount[]>('adminListAccounts')
}

export async function createAdminAccount(_token: string, username: string, password: string, rangeId: string) {
  return callAdminFunction<{ email: string; password: string; rangeId: string }, AdminAccount>('adminCreateAccount', {
    email: username.trim(),
    password,
    rangeId,
  })
}

export async function resetAdminAccountPassword(_token: string, accountId: string, password: string) {
  return callAdminFunction<{ accountId: string; password: string }, AdminAccount>('adminResetAccountPassword', {
    accountId,
    password,
  })
}

export async function setAdminAccountActive(_token: string, accountId: string, active: boolean) {
  return callAdminFunction<{ accountId: string; active: boolean }, AdminAccount>('adminSetAccountActive', {
    accountId,
    active,
  })
}

export async function changeAdminPassword(_token: string, currentPassword: string, newPassword: string) {
  const user = await requireCurrentUser()
  const email = user.email
  if (!email) {
    throw new Error('관리자 이메일을 확인할 수 없습니다.')
  }

  await reauthenticateWithCredential(user, EmailAuthProvider.credential(email, currentPassword))
  await updatePassword(user, newPassword)

  return callAdminFunction<unknown, AdminCurrent>('adminChangePasswordComplete')
}

export async function requestAdminApproval(email: string, displayName: string, rangeId: string, message: string) {
  return callAdminFunction<{ email: string; displayName: string; rangeId: string; message: string }, { id: string; status: string }>(
    'requestAdminApproval',
    {
      email: email.trim(),
      displayName: displayName.trim(),
      rangeId,
      message: message.trim(),
    },
    { publicCall: true },
  )
}

export async function loadAdminApprovalRequests(_token: string) {
  void _token
  return callAdminFunction<unknown, AdminApprovalRequest[]>('adminListApprovalRequests')
}

export async function approveAdminRequest(_token: string, requestId: string, password: string) {
  return callAdminFunction<{ requestId: string; password: string }, AdminAccount>('adminApproveRequest', {
    requestId,
    password,
  })
}

export async function rejectAdminRequest(_token: string, requestId: string, reason = '') {
  return callAdminFunction<{ requestId: string; reason: string }, { id: string; status: string }>('adminRejectRequest', {
    requestId,
    reason,
  })
}

async function callAdminFunction<TRequest, TResponse>(
  name: string,
  payload?: TRequest,
  options: { publicCall?: boolean } = {},
) {
  const functions = requireFirebaseFunctions()
  if (!options.publicCall) {
    await requireCurrentUser()
  }

  try {
    const callable = httpsCallable<TRequest | undefined, TResponse>(functions, name)
    const result = await callable(payload)
    return result.data
  } catch (error) {
    throw new Error(readCallableErrorMessage(error), { cause: error })
  }
}

async function requireCurrentUser() {
  const auth = requireFirebaseAuth()
  if (auth.currentUser) {
    return auth.currentUser
  }

  return new Promise<User>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      unsubscribe()
      reject(new Error('관리자 로그인이 필요합니다.'))
    }, 5000)
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        return
      }

      window.clearTimeout(timer)
      unsubscribe()
      resolve(user)
    })
  })
}

function requireFirebaseAuth() {
  if (!firebaseAuth) {
    throw new Error('Firebase Auth 설정이 필요합니다.')
  }

  return firebaseAuth
}

function requireFirebaseFunctions() {
  if (!firebaseFunctions) {
    throw new Error('Firebase Functions 설정이 필요합니다.')
  }

  return firebaseFunctions
}

function readCallableErrorMessage(error: unknown) {
  if (error instanceof Error) {
    if (error.message.includes('auth/invalid-credential') || error.message.includes('auth/wrong-password')) {
      return '관리자 이메일 또는 비밀번호를 확인해주세요.'
    }
    if (error.message.includes('auth/user-not-found')) {
      return '승인된 관리자 계정을 찾을 수 없습니다.'
    }
    if (error.message.includes('Password change is required.')) {
      return '비밀번호 변경이 필요합니다.'
    }
    if (error.message.includes('Admin account is not approved.')) {
      return '아직 승인되지 않은 관리자 계정입니다.'
    }
    if (error.message.includes('Admin account is disabled.')) {
      return '비활성화된 관리자 계정입니다.'
    }
    if (error.message.includes('Already requested.')) {
      return '이미 승인 대기 중인 요청이 있습니다.'
    }
    if (error.message.includes('Range not found.')) {
      return '활터 정보를 찾을 수 없습니다.'
    }
    return error.message
  }

  return '관리자 요청 처리 중 문제가 생겼습니다.'
}
