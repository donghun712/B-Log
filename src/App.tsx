import type { LucideIcon } from 'lucide-react'
import type { ChangeEvent, FormEvent, ReactNode } from 'react'
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDown,
  ArrowDownLeft,
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpLeft,
  ArrowUpRight,
  BarChart3,
  ClipboardList,
  Database,
  Home,
  LoaderCircle,
  LogIn,
  LogOut,
  Settings,
  Shield,
  Save,
  Target,
  Trophy,
  Trash2,
  UserRound,
  X,
} from 'lucide-react'
import { type User, getRedirectResult, onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut } from 'firebase/auth'
import { BrowserRouter, Link, NavLink, Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import AdminPage from './AdminPage'
import { domesticArcheryRanges, type ArcheryRange } from './data/archeryRanges'
import {
  db,
  type LocalGroup,
  type LocalGroupMember,
  type LocalSessionDetail,
  type PracticeSession,
  type RecordMode,
  type ShotDetail,
  type ShotDirection,
} from './lib/db'
import { createKakaoProvider, firebaseAuth, googleProvider, isFirebaseConfigured } from './lib/firebase'
import {
  createApiPracticeSummary,
  createApiGroup,
  deleteApiPracticeSummary,
  joinApiGroup,
  leaveApiGroup,
  loadApiGroupRankingRows,
  loadApiGroups,
  loadApiPracticeSummaries,
  loadApiProfile,
  loadApiRankingRows,
  saveApiProfile,
  updateApiPracticeSummary,
} from './lib/api'

type NavItem = {
  to: string
  label: string
  icon: LucideIcon
}

type UserProfile = {
  name: string
  rangeId: string
  rangeName: string
  grade: string
  bowHand: 'left' | 'right'
  defaultRecordMode: 'simple' | 'detail'
  isRankingPublic: boolean
}

type ProfileFormValues = {
  name: string
  rangeId: string
  grade: string
  bowHand: 'left' | 'right' | ''
  defaultRecordMode: 'simple' | 'detail' | ''
}

type PracticeShotInput = {
  roundIndex: number
  shotIndex: number
  direction: ShotDirection
  shotTime: string
}

type DailyLog = {
  practiceDate: string
  rangeName: string
  totalShots: number
  totalHits: number
  sessionCount: number
}

type WeeklySummary = {
  totalShots: number
  totalHits: number
  rate: number
}

type CalendarDaySummary = {
  practiceDate: string
  totalShots: number
  totalHits: number
  sessionCount: number
}

type CalendarData = {
  summaries: Map<string, CalendarDaySummary>
  sessionsByDate: Map<string, PracticeSession[]>
}

type StatsPeriod = 'weekly' | 'monthly'
type StatsMode = 'direction' | 'time'

type TrendPoint = {
  dateKey: string
  label: string
  totalShots: number
  totalHits: number
  hitRate: number
}

type DirectionStat = {
  direction: ShotDirection
  label: string
  count: number
  percent: number
}

type TimeStat = {
  id: string
  label: string
  totalShots: number
  totalHits: number
  hitRate: number
}

type RankingRow = {
  userId: string
  name: string
  rangeId: string
  rangeName: string
  totalShots: number
  totalHits: number
  hitRate: number
}

type GroupMembership = {
  group: LocalGroup
  member: LocalGroupMember
  memberCount: number
}

type RecordEditForm = {
  totalShots: string
  totalHits: string
  note: string
}

type EditablePracticeRecord = PracticeSession & {
  note?: string
}

type PracticeRangeOption = ArcheryRange

type GeoPoint = {
  latitude: number
  longitude: number
}

type AuthContextValue = {
  user: User | null
  profile: UserProfile | null
  isLoading: boolean
  authError: string
  clearAuthError: () => void
  loginWithGoogle: () => Promise<void>
  loginWithKakao: () => Promise<void>
  logout: () => Promise<void>
  saveProfile: (values: UserProfile) => Promise<void>
}

type HomeHeaderContextValue = {
  greeting: string
  statsView: 'calendar' | 'chart' | 'stats'
  setStatsView: (view: 'calendar' | 'chart' | 'stats') => void
  rankingView: 'overall' | 'range' | 'group'
  setRankingView: (view: 'overall' | 'range' | 'group') => void
  settingsView: 'profile' | 'records' | 'preferences'
  setSettingsView: (view: 'profile' | 'records' | 'preferences') => void
}

const AuthContext = createContext<AuthContextValue | null>(null)
const HomeHeaderContext = createContext<HomeHeaderContextValue | null>(null)

const gradeOptions = ['궁사', '접장', '명궁']
const SHOTS_PER_ROUND = 5
const MAX_DAILY_ROUNDS = 18
const MIN_RANKING_ROUNDS = 9
const MIN_RANKING_SHOTS = MIN_RANKING_ROUNDS * SHOTS_PER_ROUND
const MAX_USER_GROUPS = 3
const recordModeOptions = [
  { label: '상세 기록', value: 'detail' },
  { label: '간단 기록', value: 'simple' },
] as const
const greetingTemplates = [
  '안녕하세요 {name} {grade}님',
  '반갑습니다 {name} {grade}님',
]
const statsTabs = [
  { label: '캘린더', value: 'calendar' },
  { label: '차트', value: 'chart' },
  { label: '통계', value: 'stats' },
] as const
const rankingTabs = [
  { label: '전체', value: 'overall' },
  { label: '소속', value: 'range' },
  { label: '그룹', value: 'group' },
] as const
const settingsTabs = [
  { label: '프로필 수정', value: 'profile' },
  { label: '기록 수정', value: 'records' },
  { label: '환경설정', value: 'preferences' },
] as const
const metropolitanRegions = new Set([
  '서울특별시',
  '부산광역시',
  '대구광역시',
  '인천광역시',
  '광주광역시',
  '대전광역시',
  '울산광역시',
])
const regionOptions = [...new Set(domesticArcheryRanges.map((range) => range.region))]

const navItems: NavItem[] = [
  { to: '/home', label: '기록', icon: Home },
  { to: '/stats', label: '분석', icon: BarChart3 },
  { to: '/ranking', label: '랭킹', icon: Trophy },
  { to: '/settings', label: '설정', icon: Settings },
]
const appRoutePaths = new Set(navItems.map((item) => item.to))

const pageSummaries = {
  home: {
    title: '습사 기록',
    description: '간단 모드와 상세 모드, 활터 선택, 최근 기록 요약이 들어갈 첫 화면입니다.',
  },
  stats: {
    title: '기록 분석',
    description: '활동 캘린더, 트렌드 차트, 피로도, 방향성 통계를 배치할 화면입니다.',
  },
  ranking: {
    title: '명예의 전당',
    description: '전체, 소속 활터, 내 그룹 랭킹과 그룹 관리를 담을 화면입니다.',
  },
  ai: {
    title: '업데이트 예정',
    description: 'AI 분석 기능은 추후 업데이트로 제공할 예정입니다.',
  },
  settings: {
    title: '설정 및 기록 관리',
    description: '프로필, 기록 CRUD, 백업/복원, 입력 환경 설정을 관리할 화면입니다.',
  },
}

const onboardingAuthKey = 'b-log:onboarding-auth-complete'
const adminAuthRedirectKey = 'b-log:admin-auth-redirect'
const kakaoAuthRedirectKey = 'b-log:kakao-auth-redirect'
const onboardingAuthWindowMs = 10 * 60 * 1000

function markOnboardingAuthComplete() {
  window.sessionStorage.setItem(onboardingAuthKey, String(Date.now()))
}

function clearKakaoAuthRedirect() {
  window.sessionStorage.removeItem(kakaoAuthRedirectKey)
}

function getFirstGuidePendingKey(uid: string) {
  return `b-log:first-guide-pending:${uid}`
}

function getFirstGuideDismissedKey(uid: string) {
  return `b-log:first-guide-dismissed:${uid}`
}

function markFirstGuidePending(uid: string) {
  window.localStorage.setItem(getFirstGuidePendingKey(uid), '1')
}

function shouldShowFirstGuide(uid: string) {
  return window.localStorage.getItem(getFirstGuidePendingKey(uid)) === '1'
    && window.localStorage.getItem(getFirstGuideDismissedKey(uid)) !== '1'
}

function dismissFirstGuide(uid: string) {
  window.localStorage.setItem(getFirstGuideDismissedKey(uid), '1')
  window.localStorage.removeItem(getFirstGuidePendingKey(uid))
}

function hasFreshKakaoAuthRedirect() {
  const startedAt = Number(window.sessionStorage.getItem(kakaoAuthRedirectKey))

  return Number.isFinite(startedAt) && startedAt > 0 && Date.now() - startedAt <= onboardingAuthWindowMs
}

function App() {
  useCanonicalLocalhost()

  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LoginPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route
            element={
              <ProtectedRoute requireProfile={false}>
                <OnboardingRedirect>
                  <OnboardingPage />
                </OnboardingRedirect>
              </ProtectedRoute>
            }
            path="/onboarding"
          />
          <Route
            element={
              <ProtectedRoute requireProfile>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/home" element={<HomePage />} />
            <Route path="/stats" element={<StatsPage />} />
            <Route path="/ranking" element={<RankingPage />} />
            <Route path="/ai" element={<AiPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

function useCanonicalLocalhost() {
  useEffect(() => {
    if (window.location.hostname !== '127.0.0.1') {
      return
    }

    const port = window.location.port ? `:${window.location.port}` : ''
    window.location.replace(`http://localhost${port}${window.location.pathname}${window.location.search}${window.location.hash}`)
  }, [])
}

function useBackButtonExitPrompt(enabled: boolean) {
  const location = useLocation()
  const locationKey = `${location.pathname}${location.search}${location.hash}`
  const isConfirmingRef = useRef(false)
  const isRestoringGuardRef = useRef(false)
  const hasPushedGuardRef = useRef(false)

  useEffect(() => {
    if (!enabled) {
      return
    }

    const isMobileLike = window.matchMedia('(display-mode: standalone)').matches || window.matchMedia('(pointer: coarse)').matches
    if (!isMobileLike) {
      return
    }

    const currentState = window.history.state
    const guardState = {
      ...(typeof currentState === 'object' && currentState !== null ? currentState : {}),
      bLogExitGuard: true,
      bLogExitGuardPath: locationKey,
    }

    if (!hasPushedGuardRef.current && !currentState?.bLogExitGuard) {
      window.history.pushState(guardState, '', window.location.href)
      hasPushedGuardRef.current = true
      return
    }

    window.history.replaceState(guardState, '', window.location.href)
    hasPushedGuardRef.current = true
  }, [enabled, locationKey])

  useEffect(() => {
    if (!enabled) {
      return
    }

    const isMobileLike = window.matchMedia('(display-mode: standalone)').matches || window.matchMedia('(pointer: coarse)').matches
    if (!isMobileLike) {
      return
    }

    function handlePopState() {
      if (isRestoringGuardRef.current) {
        isRestoringGuardRef.current = false
        return
      }

      if (isConfirmingRef.current) {
        return
      }

      isConfirmingRef.current = true
      const shouldExit = window.confirm('종료하시겠습니까?')
      isConfirmingRef.current = false

      if (shouldExit) {
        window.removeEventListener('popstate', handlePopState)
        exitAppView()
        return
      }

      isRestoringGuardRef.current = true
      window.history.forward()
      window.setTimeout(() => {
        isRestoringGuardRef.current = false
      }, 250)
    }

    window.addEventListener('popstate', handlePopState)

    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [enabled])
}

function exitAppView() {
  window.setTimeout(() => {
    window.open('', '_self')
    window.close()

    window.setTimeout(() => {
      if (!document.hidden) {
        window.location.replace('about:blank')
      }
    }, 120)
  }, 0)
}

function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(Boolean(firebaseAuth))
  const [authError, setAuthError] = useState('')

  useEffect(() => {
    if (!firebaseAuth) {
      return
    }

    const unsubscribe = onAuthStateChanged(firebaseAuth, async (nextUser) => {
      setIsLoading(true)
      setUser(nextUser)
      if (!nextUser) {
        setProfile(null)
        setIsLoading(false)
        return
      }

      clearKakaoAuthRedirect()
      const localProfile = readUserProfile(nextUser.uid)
      try {
        const serverProfile = await loadApiProfile(nextUser)
        setProfile(serverProfile ?? localProfile)
        if (serverProfile) {
          writeUserProfile(nextUser.uid, serverProfile)
          void db.userProfiles.put(toLocalUserProfile(nextUser.uid, serverProfile))
        }
        if (serverProfile || localProfile) {
          await mergeApiPracticeSummaries(nextUser)
        }
      } catch (profileError) {
        if (localProfile) {
          setProfile(localProfile)
          try {
            await mergeApiPracticeSummaries(nextUser)
          } catch (syncError) {
            console.warn('Practice summary sync after profile load failure skipped.', syncError)
          }
        } else {
          console.error('Profile load after login failed.', profileError)
          setAuthError('로그인은 완료됐지만 사용자 정보를 아직 불러오지 못했습니다. 기본 정보를 입력한 뒤 다시 저장해 주세요.')
          setProfile(null)
        }
      }
      setIsLoading(false)
    })

    getRedirectResult(firebaseAuth)
      .then((result) => {
        if (result?.user) {
          clearKakaoAuthRedirect()
          return
        }

        if (hasFreshKakaoAuthRedirect()) {
          clearKakaoAuthRedirect()
          window.sessionStorage.removeItem(onboardingAuthKey)
          setAuthError('카카오 로그인 결과를 Firebase가 받지 못했습니다. 카카오 Redirect URI와 Firebase OIDC 설정을 다시 확인해주세요.')
        }
      })
      .catch((error) => {
        clearKakaoAuthRedirect()
        window.sessionStorage.removeItem(onboardingAuthKey)
        setAuthError(getLoginErrorMessage(error))
        setIsLoading(false)
      })

    return unsubscribe
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile,
      isLoading,
      authError,
      clearAuthError: () => setAuthError(''),
      loginWithGoogle: async () => {
        if (!firebaseAuth || !isFirebaseConfigured) {
          throw new Error('Firebase 설정이 아직 적용되지 않았습니다.')
        }

        googleProvider.setCustomParameters({ prompt: 'select_account' })
        try {
          await signInWithPopup(firebaseAuth, googleProvider)
        } catch (error) {
          const code = getFirebaseErrorCode(error)
          if (code === 'auth/popup-blocked' || code === 'auth/cancelled-popup-request') {
            await signInWithRedirect(firebaseAuth, googleProvider)
            return
          }

          throw error
        }
      },
      loginWithKakao: async () => {
        if (!firebaseAuth || !isFirebaseConfigured) {
          throw new Error('Firebase 설정이 아직 적용되지 않았습니다.')
        }

        const kakaoProvider = createKakaoProvider()
        try {
          await signInWithPopup(firebaseAuth, kakaoProvider)
          clearKakaoAuthRedirect()
        } catch (error) {
          const code = getFirebaseErrorCode(error)
          if (code === 'auth/popup-blocked') {
            throw new Error('카카오 로그인 팝업이 차단되었습니다. 브라우저 팝업 차단을 해제한 뒤 다시 시도해주세요.', {
              cause: error,
            })
          }
          if (code === 'auth/cancelled-popup-request' || code === 'auth/popup-closed-by-user') {
            throw new Error('카카오 로그인이 취소되었습니다. 다시 시도해주세요.', {
              cause: error,
            })
          }

          throw error
        }
      },
      logout: async () => {
        if (!firebaseAuth) {
          return
        }

        await signOut(firebaseAuth)
      },
      saveProfile: async (values) => {
        if (!user) {
          return
        }

        const savedProfile = await saveApiProfile(user, values)
        await db.userProfiles.put(toLocalUserProfile(user.uid, savedProfile))
        writeUserProfile(user.uid, savedProfile)
        setProfile(savedProfile)
      },
    }),
    [authError, isLoading, profile, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider')
  }

  return context
}

function useHomeHeader() {
  const context = useContext(HomeHeaderContext)
  if (!context) {
    throw new Error('useHomeHeader must be used inside HomeHeaderProvider')
  }

  return context
}

function HomeHeaderProvider({ children }: { children: ReactNode }) {
  const { profile, user } = useAuth()
  const [statsView, setStatsView] = useState<'calendar' | 'chart' | 'stats'>('calendar')
  const [rankingView, setRankingView] = useState<'overall' | 'range' | 'group'>('overall')
  const [settingsView, setSettingsView] = useState<'profile' | 'records' | 'preferences'>('profile')
  const [greetingIndex] = useState(() => Math.floor(Math.random() * greetingTemplates.length))
  const displayName = profile?.name ?? user?.displayName ?? '궁사'
  const displayGrade = profile?.grade ?? ''
  const greeting = useMemo(() => {
    return greetingTemplates[greetingIndex].replace('{name}', displayName).replace('{grade}', displayGrade)
  }, [displayGrade, displayName, greetingIndex])

  const value = useMemo(
    () => ({
      greeting,
      statsView,
      setStatsView,
      rankingView,
      setRankingView,
      settingsView,
      setSettingsView,
    }),
    [greeting, rankingView, settingsView, statsView],
  )

  return <HomeHeaderContext.Provider value={value}>{children}</HomeHeaderContext.Provider>
}

function readUserProfile(uid: string): UserProfile | null {
  const stored = window.localStorage.getItem(getUserProfileKey(uid))
  if (!stored) {
    return null
  }

  try {
    const parsed = JSON.parse(stored) as Partial<UserProfile>
    if (!parsed.name || !parsed.rangeId || !parsed.rangeName || !parsed.grade || !parsed.bowHand) {
      return null
    }

    return {
      name: parsed.name,
      rangeId: parsed.rangeId,
      rangeName: parsed.rangeName,
      grade: parsed.grade,
      bowHand: parsed.bowHand,
      defaultRecordMode: parsed.defaultRecordMode ?? 'detail',
      isRankingPublic: parsed.isRankingPublic ?? true,
    }
  } catch {
    window.localStorage.removeItem(getUserProfileKey(uid))
    return null
  }
}

function writeUserProfile(uid: string, profile: UserProfile) {
  window.localStorage.setItem(getUserProfileKey(uid), JSON.stringify(profile))
}

function toLocalUserProfile(userId: string, profile: UserProfile) {
  const now = new Date().toISOString()
  return {
    userId,
    ...profile,
    createdAt: now,
    updatedAt: now,
  }
}

async function mergeApiPracticeSummaries(user: User) {
  const localSummaries = await db.practiceSessions.where('userId').equals(user.uid).toArray()
  for (const local of localSummaries.filter((summary) => !summary.serverId)) {
    try {
      const clientSessionId = local.clientSessionId ?? crypto.randomUUID()
      const saved = await createApiPracticeSummary(user, { ...local, clientSessionId })
      if (typeof local.id === 'number') {
        await db.practiceSessions.update(local.id, {
          clientSessionId,
          serverId: saved.id,
          syncedAt: new Date().toISOString(),
        })
      }
    } catch (syncError) {
      console.warn('Practice summary sync skipped.', syncError)
      // Keep local summaries until the next successful authenticated sync.
    }
  }

  const serverSummaries = await loadApiPracticeSummaries(user)
  const refreshedLocalSummaries = await db.practiceSessions.where('userId').equals(user.uid).toArray()
  const localByServerId = new Map(refreshedLocalSummaries.filter((summary) => summary.serverId).map((summary) => [summary.serverId, summary]))
  const localByClientId = new Map(
    refreshedLocalSummaries.filter((summary) => summary.clientSessionId).map((summary) => [summary.clientSessionId, summary]),
  )

  await db.practiceSessions.bulkPut(
    serverSummaries.map((summary) => {
      const local = localByServerId.get(summary.id) ?? localByClientId.get(summary.clientSessionId)
      return {
        ...summary,
        id: local?.id,
        serverId: summary.id,
        userId: user.uid,
        syncedAt: new Date().toISOString(),
      }
    }),
  )
}

function getUserProfileKey(uid: string) {
  return `sisu-record:user-profile:${uid}`
}

function ProtectedRoute({ children, requireProfile }: { children: ReactNode; requireProfile: boolean }) {
  const { isLoading, profile, user } = useAuth()

  if (isLoading) {
    return <LoadingScreen />
  }

  if (!user) {
    return <Navigate to="/" replace />
  }

  if (requireProfile && !profile) {
    return <Navigate to="/onboarding" replace />
  }

  return children
}

function OnboardingRedirect({ children }: { children: ReactNode }) {
  const { profile } = useAuth()

  if (profile) {
    return <Navigate to="/home" replace />
  }

  return children
}

function LoadingScreen() {
  return (
    <main className="mobile-screen grid place-items-center bg-[#eef8ff] text-black">
      <div className="grid justify-items-center gap-3">
        <LoaderCircle aria-hidden="true" className="animate-spin" size={32} />
        <p className="text-sm font-bold text-[#486272]">로그인 상태를 확인하는 중입니다.</p>
      </div>
    </main>
  )
}

function LoginPage() {
  const { authError, clearAuthError, isLoading, loginWithGoogle, loginWithKakao, profile, user } = useAuth()
  const [isAdminLoginOpen, setIsAdminLoginOpen] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [submittingProvider, setSubmittingProvider] = useState<'google' | 'kakao' | null>(null)
  const isSubmitting = submittingProvider !== null

  if (!isLoading && user && profile) {
    window.sessionStorage.removeItem(onboardingAuthKey)
    return <Navigate to="/home" replace />
  }

  if (!isLoading && user) {
    return <Navigate to="/onboarding" replace />
  }

  async function handleGoogleLogin() {
    clearAuthError()
    setStatusMessage('')
    setSubmittingProvider('google')
    window.sessionStorage.removeItem(adminAuthRedirectKey)
    markOnboardingAuthComplete()

    try {
      await loginWithGoogle()
    } catch (error) {
      window.sessionStorage.removeItem(onboardingAuthKey)
      setStatusMessage(getLoginErrorMessage(error))
    } finally {
      setSubmittingProvider(null)
    }
  }

  async function handleKakaoLogin() {
    clearAuthError()
    setStatusMessage('')
    setSubmittingProvider('kakao')
    window.sessionStorage.removeItem(adminAuthRedirectKey)
    markOnboardingAuthComplete()
    if (firebaseAuth?.currentUser) {
      await signOut(firebaseAuth)
    }

    try {
      await loginWithKakao()
    } catch (error) {
      clearKakaoAuthRedirect()
      window.sessionStorage.removeItem(onboardingAuthKey)
      setStatusMessage(getLoginErrorMessage(error))
    } finally {
      setSubmittingProvider(null)
    }
  }

  return (
    <main className="mobile-screen bg-[#eef8ff] text-[#1c2d38]">
      <section className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col justify-between px-5 pb-[calc(24px+env(safe-area-inset-bottom))] pt-[calc(42px+env(safe-area-inset-top))]">
        <div>
          <p className="mb-3 text-sm font-bold text-[#3b82b8]">국궁인을 위한 시수 기록앱</p>
          <h1 className="flex items-center gap-3 text-[44px] font-black leading-tight text-[#102a3a]">
            B-Log
          </h1>
          <p className="mt-4 max-w-sm text-base font-medium leading-7 text-[#526b7a]">
            활터에서 간편하게 기록하고
            <br />
            내 기록의 변화를 확인해보세요
          </p>
        </div>

        <div className="space-y-3">
          <section className="app-card border-[#cfe5f2] bg-white/95 p-4 shadow-[0_8px_24px_rgba(51,124,164,0.08)]">
            <p className="mb-3 text-sm font-bold text-[#29485b]">소셜 로그인</p>
            <div className="grid gap-3">
              <button
                className="mobile-button gap-3 border-2 border-[#b7d8ea] bg-white text-[#1c2d38] shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isLoading || isSubmitting}
                onClick={handleGoogleLogin}
                type="button"
              >
                {submittingProvider === 'google' ? (
                  <>
                    <LoaderCircle aria-hidden="true" className="mr-2 animate-spin" size={17} />
                    Google 로그인 중
                  </>
                ) : (
                  <>
                    <span className="grid h-8 w-8 place-items-center">
                      <img alt="" aria-hidden="true" className="h-5 w-5 object-contain" src="/google.png" />
                    </span>
                    <span className="min-w-[116px] text-left">Google로 시작하기</span>
                  </>
                )}
              </button>
              <button
                className="mobile-button gap-3 border-2 border-[#d7c83a] bg-[#f6e843] text-[#201b00] shadow-[0_3px_10px_rgba(184,165,25,0.16)] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isLoading || isSubmitting}
                onClick={() => void handleKakaoLogin()}
                type="button"
              >
                {submittingProvider === 'kakao' ? (
                  <>
                    <LoaderCircle aria-hidden="true" className="mr-2 animate-spin" size={17} />
                    Kakao 로그인 중
                  </>
                ) : (
                  <>
                    <span className="grid h-8 w-8 place-items-center">
                      <img alt="" aria-hidden="true" className="h-6 w-6 object-contain" src="/kakao.png" />
                    </span>
                    <span className="min-w-[116px] text-left">Kakao로 시작하기</span>
                  </>
                )}
              </button>
            </div>
            {statusMessage && (
              <p className="mt-3 rounded-md bg-[#e8f4fb] px-3 py-2 text-sm leading-6 text-[#315b72]">{statusMessage}</p>
            )}
            {authError && (
              <p className="mt-3 rounded-md bg-[#fff0ed] px-3 py-2 text-sm leading-6 text-[#8b3a2c]">{authError}</p>
            )}
          </section>

          <section className="app-card border-[#cfe5f2] bg-white/95 p-4 shadow-[0_8px_24px_rgba(51,124,164,0.08)]">
            <button
              className="flex min-h-11 w-full items-center justify-between text-left text-sm font-bold text-[#29485b]"
              onClick={() => setIsAdminLoginOpen((isOpen) => !isOpen)}
              type="button"
            >
              <span className="flex items-center gap-2">
                <Shield aria-hidden="true" size={17} />
                관리자 로그인
              </span>
              <span className="text-xs text-[#638296]">{isAdminLoginOpen ? '닫기' : '열기'}</span>
            </button>
            {isAdminLoginOpen && (
              <div className="mt-3 grid gap-3 border-t border-[#dbeef8] pt-3">
                <Link className="mobile-button gap-2 bg-[#2f8fc7] text-white" to="/admin">
                  <LogIn aria-hidden="true" size={17} />
                  관리자 페이지로
                </Link>
              </div>
            )}
          </section>
        </div>
      </section>
    </main>
  )
}

function OnboardingPage() {
  const { logout, user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    window.sessionStorage.removeItem(onboardingAuthKey)
  }, [])

  return (
    <main className="mobile-screen bg-[#eef8ff] text-[#1c2d38]">
      <section className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col px-5 pb-[calc(24px+env(safe-area-inset-bottom))] pt-[calc(28px+env(safe-area-inset-top))]">
        <div className="mb-6">
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-[#1b6f9f] text-white shadow-sm">
            <UserRound aria-hidden="true" size={24} />
          </div>
          <p className="mb-2 text-sm font-semibold text-[#4f6f52]">처음 한 번만 입력합니다</p>
          <h1 className="text-[30px] font-bold leading-tight">기본 정보를 알려주세요</h1>
          <p className="mt-3 text-sm leading-6 text-[#486272]">
            기록과 랭킹 표기에 사용할 정보입니다. 나중에 설정에서 언제든 수정할 수 있습니다.
          </p>
          <button
            className="mt-3 min-h-10 text-sm font-black text-black"
            onClick={async () => {
              await logout()
              navigate('/', { replace: true })
            }}
            type="button"
          >
            다른 계정으로 로그인
          </button>
        </div>

        <ProfileForm
          buttonLabel="시작하기"
          initialValues={{
            name: user?.displayName ?? '',
            rangeId: '',
            grade: '',
            bowHand: '',
            defaultRecordMode: '',
          }}
          onSaved={() => {
            if (user) {
              markFirstGuidePending(user.uid)
            }
            navigate('/home', { replace: true })
          }}
        />
      </section>
    </main>
  )
}

function ProfileForm({
  buttonLabel,
  initialValues,
  onSaved,
  showName = true,
  showRecordMode = true,
}: {
  buttonLabel: string
  initialValues: ProfileFormValues
  onSaved?: () => void
  showName?: boolean
  showRecordMode?: boolean
}) {
  const { profile, saveProfile } = useAuth()
  const initialRange = domesticArcheryRanges.find((range) => range.id === initialValues.rangeId)
  const [values, setValues] = useState<ProfileFormValues>(initialValues)
  const [selectedRegion, setSelectedRegion] = useState(initialRange?.region ?? '')
  const [selectedMiddleArea, setSelectedMiddleArea] = useState(initialRange ? getMiddleArea(initialRange) : '')
  const [message, setMessage] = useState('')
  const middleAreaOptions = useMemo(
    () =>
      selectedRegion
        ? [
            ...new Set(
              domesticArcheryRanges
                .filter((range) => range.region === selectedRegion)
                .map((range) => getMiddleArea(range))
                .filter(Boolean),
            ),
          ]
        : [],
    [selectedRegion],
  )
  const rangeOptions = useMemo(
    () =>
      domesticArcheryRanges.filter(
        (range) => range.region === selectedRegion && getMiddleArea(range) === selectedMiddleArea,
      ),
    [selectedMiddleArea, selectedRegion],
  )

  function updateValue<Key extends keyof ProfileFormValues>(key: Key, value: ProfileFormValues[Key]) {
    setValues((current) => ({ ...current, [key]: value }))
    setMessage('')
  }

  function updateRegion(region: string) {
    setSelectedRegion(region)
    setSelectedMiddleArea('')
    setValues((current) => ({ ...current, rangeId: '' }))
    setMessage('')
  }

  function updateMiddleArea(area: string) {
    setSelectedMiddleArea(area)
    setValues((current) => ({ ...current, rangeId: '' }))
    setMessage('')
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const selectedRange = domesticArcheryRanges.find((range) => range.id === values.rangeId)
    const savedName = showName ? values.name.trim() : profile?.name ?? values.name.trim()
    if (!savedName || !selectedRange || !values.grade || !values.bowHand || !values.defaultRecordMode) {
      setMessage(showName ? '소속, 이름, 등급, 좌/우궁, 기본 기록 방식을 모두 입력해주세요.' : '소속, 등급, 좌/우궁을 모두 입력해주세요.')
      return
    }

    try {
      await saveProfile({
        name: savedName,
        rangeId: selectedRange.id,
        rangeName: selectedRange.name,
        grade: values.grade,
        bowHand: values.bowHand,
        defaultRecordMode: values.defaultRecordMode,
        isRankingPublic: profile?.isRankingPublic ?? true,
      })
      setMessage('저장되었습니다.')
      onSaved?.()
    } catch {
      setMessage('프로필을 저장하지 못했습니다. 로그인 상태와 백엔드 연결을 확인해주세요.')
    }
  }

  return (
    <form className="app-card grid gap-4 p-4" onSubmit={handleSubmit}>
      <div className="grid grid-cols-2 gap-2">
        <label className="grid min-w-0 gap-2 text-sm font-semibold text-[#1c2d38]">
          도 / 광역시
          <select className="mobile-input min-w-0 bg-white" value={selectedRegion} onChange={(event) => updateRegion(event.target.value)}>
            <option value="">선택</option>
            {regionOptions.map((region) => (
              <option key={region} value={region}>
                {region}
              </option>
            ))}
          </select>
        </label>

        <label className="grid min-w-0 gap-2 text-sm font-semibold text-[#1c2d38]">
          {getMiddleAreaLabel(selectedRegion)}
          <select
            className="mobile-input min-w-0 bg-white"
            disabled={!selectedRegion}
            value={selectedMiddleArea}
            onChange={(event) => updateMiddleArea(event.target.value)}
          >
            <option value="">선택</option>
            {middleAreaOptions.map((area) => (
              <option key={area} value={area}>
                {area}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="grid gap-2 text-sm font-semibold text-[#1c2d38]">
        정
        <select
          className="mobile-input bg-white"
          disabled={!selectedMiddleArea}
          value={values.rangeId}
          onChange={(event) => updateValue('rangeId', event.target.value)}
        >
          <option value="">{selectedMiddleArea ? '소속 정을 선택해주세요' : '먼저 시/구를 선택해주세요'}</option>
          {rangeOptions.map((range) => (
            <option key={range.id} value={range.id}>
              {range.name}
            </option>
          ))}
        </select>
      </label>

      {showName && (
        <label className="grid gap-2 text-sm font-semibold text-[#1c2d38]">
          이름
          <input
            className="mobile-input"
            onChange={(event) => updateValue('name', event.target.value)}
            placeholder="본명으로 입력해주세요"
            value={values.name}
          />
          <span className="text-xs font-medium text-[#6b8090]">랭킹과 그룹에서 표시되므로 본명으로 입력해주세요.</span>
        </label>
      )}

      <label className="grid gap-2 text-sm font-semibold text-[#1c2d38]">
        등급
        <select className="mobile-input bg-white" value={values.grade} onChange={(event) => updateValue('grade', event.target.value)}>
          <option value="">등급을 선택해주세요</option>
          {gradeOptions.map((grade) => (
            <option key={grade} value={grade}>
              {grade}
            </option>
          ))}
        </select>
      </label>

      <fieldset className="grid gap-2">
        <legend className="text-sm font-semibold text-[#1c2d38]">좌/우궁</legend>
        <div className="grid grid-cols-2 gap-2 rounded-lg border border-[#c7deeb] bg-[#f8fcff] p-1">
          {[
            { label: '좌궁', value: 'left' },
            { label: '우궁', value: 'right' },
          ].map((option) => (
            <button
              className={`min-h-11 rounded-md text-sm font-bold transition ${
                values.bowHand === option.value ? 'bg-[#1b6f9f] text-white shadow-sm' : 'text-[#486272]'
              }`}
              key={option.value}
              onClick={() => updateValue('bowHand', option.value as ProfileFormValues['bowHand'])}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      </fieldset>

      {showRecordMode && (
        <fieldset className="grid gap-2">
          <legend className="text-sm font-semibold text-[#1c2d38]">기본 기록 방식</legend>
          <div className="grid grid-cols-2 gap-2 rounded-lg border border-[#c7deeb] bg-[#f8fcff] p-1">
            {recordModeOptions.map((option) => (
              <button
                className={`min-h-11 rounded-md text-sm font-bold transition ${
                  values.defaultRecordMode === option.value ? 'bg-[#1b6f9f] text-white shadow-sm' : 'text-[#486272]'
                }`}
                key={option.value}
                onClick={() => updateValue('defaultRecordMode', option.value)}
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {message && <p className="rounded-md bg-[#f4efe6] px-3 py-2 text-sm leading-6 text-[#6b5540]">{message}</p>}

      <button className="mobile-button bg-[#1b6f9f] text-white" type="submit">
        {buttonLabel}
      </button>
    </form>
  )
}

function getMiddleArea(range: (typeof domesticArcheryRanges)[number]) {
  if (range.region === '세종특별자치시') {
    return '세종특별자치시'
  }

  const firstToken = range.address.split(' ')[0] ?? ''
  const match = firstToken.match(/.+?(시|군|구)/)
  return match?.[0] ?? (firstToken || range.region)
}

function getMiddleAreaLabel(region: string) {
  if (!region) {
    return '시 / 구'
  }

  if (metropolitanRegions.has(region)) {
    return '구 / 군'
  }

  if (region === '세종특별자치시') {
    return '세부 지역'
  }

  return '시 / 군'
}

function getLoginErrorMessage(error: unknown) {
  const code = getFirebaseErrorCode(error)
  const message = error instanceof Error ? error.message : ''

  if (message.includes('redirect_uri_mismatch')) {
    return '로그인 Redirect URI가 맞지 않습니다. Firebase authDomain과 제공자 콘솔의 승인된 리디렉션 URI를 확인해주세요.'
  }

  if (code === 'auth/popup-closed-by-user') {
    return '로그인 창이 닫혔습니다. 다시 시도해주세요.'
  }

  if (code === 'auth/unauthorized-domain') {
    return '현재 접속 도메인이 Firebase 승인 도메인에 없습니다. Firebase Console의 승인된 도메인에 localhost를 추가해주세요.'
  }

  if (code === 'auth/operation-not-allowed') {
    return 'Firebase Authentication에서 해당 로그인 제공자가 아직 사용 설정되지 않았습니다.'
  }

  if (code === 'auth/api-key-not-valid') {
    return 'Firebase API 키가 올바르지 않습니다. Web App 설정값을 다시 확인해주세요.'
  }

  if (code === 'auth/network-request-failed') {
    return '네트워크 요청이 실패했습니다. 인터넷 연결이나 브라우저 차단 설정을 확인해주세요.'
  }

  if (code === 'auth/internal-error') {
    return '로그인 요청을 완료하지 못했습니다. 브라우저 팝업 또는 네트워크 차단 설정을 확인해주세요.'
  }

  if (message) {
    return `로그인 오류: ${message}`
  }

  return '로그인 중 문제가 생겼습니다. 잠시 후 다시 시도해주세요.'
}

function getFirebaseErrorCode(error: unknown) {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: unknown }).code
    return typeof code === 'string' ? code : ''
  }

  return ''
}

function AppLayout() {
  const { logout, user } = useAuth()
  const location = useLocation()
  const isHome = location.pathname === '/home'
  const isStats = location.pathname === '/stats'
  const isRanking = location.pathname === '/ranking'
  const isSettings = location.pathname === '/settings'
  const [dismissedGuideUid, setDismissedGuideUid] = useState('')
  const isGuideOpen = Boolean(user && dismissedGuideUid !== user.uid && shouldShowFirstGuide(user.uid))

  useBackButtonExitPrompt(appRoutePaths.has(location.pathname))

  function closeFirstGuide() {
    if (user) {
      dismissFirstGuide(user.uid)
      setDismissedGuideUid(user.uid)
    }
  }

  return (
    <HomeHeaderProvider>
      <div className="mobile-screen bg-[#eef8ff] text-[#1c2d38]">
        <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col bg-[#eef8ff] md:max-w-[1100px]">
          <header className="sticky top-0 z-10 border-b border-[#cfe5f2] bg-[#eef8ff]/95 px-5 pb-3 pt-[calc(14px+env(safe-area-inset-top))] backdrop-blur">
            {isHome ? (
              <HomeHeaderControls onLogout={logout} />
            ) : isStats ? (
              <StatsHeaderControls />
            ) : isRanking ? (
              <RankingHeaderControls />
            ) : isSettings ? (
              <SettingsHeaderControls />
            ) : (
              <div className="flex items-center justify-between gap-4">
                <Link className="flex min-h-10 items-center gap-2 font-bold" to="/home">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1b6f9f] text-white">
                    <Target aria-hidden="true" size={20} />
                  </span>
                </Link>
                <nav className="hidden items-center gap-1 md:flex">
                  {navItems.map((item) => (
                    <DesktopNavLink key={item.to} {...item} />
                  ))}
                </nav>
              </div>
            )}
          </header>

          <main className="flex-1 px-4 pb-[calc(96px+env(safe-area-inset-bottom))] pt-5 md:px-6 md:pb-8 md:pt-8">
            <Outlet />
          </main>

          <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-[#cfe5f2] bg-white/95 px-2 pb-[calc(10px+env(safe-area-inset-bottom))] pt-2 shadow-[0_-10px_30px_rgba(47,143,199,0.12)] backdrop-blur md:hidden">
            <div className="mx-auto grid max-w-[480px] grid-cols-4 gap-1">
              {navItems.map((item) => (
                <MobileNavLink key={item.to} {...item} />
              ))}
            </div>
          </nav>
        </div>
        {isGuideOpen && <FirstUseGuideDialog onClose={closeFirstGuide} />}
      </div>
    </HomeHeaderProvider>
  )
}

function FirstUseGuideDialog({ onClose }: { onClose: () => void }) {
  const guideItems = [
    '기록은 간단/상세 방식으로 남길 수 있습니다. 환경 설정에서 변경할 수 있습니다.',
    '랭킹은 주간/월간 기준으로 집계되며, 9순 이상부터 반영됩니다.',
    '상세 탄착군과 메모는 기기에 저장됩니다. 앱 삭제 또는 기기 변경 전에는 백업을 해주세요.',
    '그룹을 만들거나 초대 코드로 참가해 함께 랭킹을 볼 수 있습니다.',
    '설정에서 기록 방식, 랭킹 공개 여부, 좌/우궁, 등급 등을 변경할 수 있습니다.',
  ]

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-black/35 px-4 pb-[calc(16px+env(safe-area-inset-bottom))] pt-[calc(16px+env(safe-area-inset-top))] md:place-items-center">
      <section className="w-full max-w-[430px] rounded-md border border-[#cfe5f2] bg-white p-4 shadow-[0_18px_50px_rgba(16,42,58,0.22)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black text-[#2f8fc7]">처음 사용 안내</p>
            <h2 className="mt-1 text-xl font-black text-[#102a3a]">B-Log 사용 전 확인해주세요</h2>
          </div>
          <button
            aria-label="안내 닫기"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[#cfe5f2] bg-[#f7fcff] text-black"
            onClick={onClose}
            type="button"
          >
            <X aria-hidden="true" size={18} />
          </button>
        </div>

        <div className="mt-4 grid gap-2">
          {guideItems.map((item, index) => (
            <div className="grid grid-cols-[28px_minmax(0,1fr)] gap-2 rounded-md bg-[#eef8ff] px-3 py-3" key={item}>
              <span className="grid h-7 w-7 place-items-center rounded-full bg-white text-sm font-black text-[#1b6f9f]">
                {index + 1}
              </span>
              <p className="text-sm font-bold leading-6 text-[#1c2d38]">{item}</p>
            </div>
          ))}
        </div>

        <button className="mobile-button mt-4 bg-[#2f8fc7] text-white" onClick={onClose} type="button">
          확인했습니다
        </button>
      </section>
    </div>
  )
}

function HomeHeaderControls({ onLogout }: { onLogout: () => void }) {
  const { greeting } = useHomeHeader()

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
      <p className="min-w-0 truncate whitespace-nowrap text-left text-[13px] font-semibold leading-5 text-[#1c2d38]">{greeting}</p>
      <button
        aria-label="로그아웃"
        className="flex h-10 w-10 items-center justify-center rounded-full border border-[#c7deeb] bg-white text-[#486272]"
        onClick={onLogout}
        type="button"
      >
        <LogOut aria-hidden="true" size={18} />
      </button>
    </div>
  )
}

function StatsHeaderControls() {
  const { setStatsView, statsView } = useHomeHeader()

  return (
    <div className="grid grid-cols-3 rounded-lg border border-[#c7deeb] bg-white p-1 text-sm font-bold">
      {statsTabs.map((tab) => (
        <button
          className={`min-h-10 rounded-md px-2 transition ${
            statsView === tab.value ? 'bg-[#2f8fc7] text-white shadow-sm' : 'text-[#486272]'
          }`}
          key={tab.value}
          onClick={() => setStatsView(tab.value)}
          type="button"
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

function RankingHeaderControls() {
  const { rankingView, setRankingView } = useHomeHeader()

  return (
    <div className="grid grid-cols-3 rounded-lg border border-[#c7deeb] bg-white p-1 text-sm font-bold">
      {rankingTabs.map((tab) => (
        <button
          className={`min-h-10 rounded-md px-2 transition ${
            rankingView === tab.value ? 'bg-[#2f8fc7] text-white shadow-sm' : 'text-[#486272]'
          }`}
          key={tab.value}
          onClick={() => setRankingView(tab.value)}
          type="button"
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

function SettingsHeaderControls() {
  const { settingsView, setSettingsView } = useHomeHeader()

  return (
    <div className="grid grid-cols-3 rounded-lg border border-[#c7deeb] bg-white p-1 text-sm font-bold">
      {settingsTabs.map((tab) => (
        <button
          className={`min-h-10 rounded-md px-1 transition ${
            settingsView === tab.value ? 'bg-[#2f8fc7] text-white shadow-sm' : 'text-[#486272]'
          }`}
          key={tab.value}
          onClick={() => setSettingsView(tab.value)}
          type="button"
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

function DesktopNavLink({ to, label, icon: Icon }: NavItem) {
  return (
    <NavLink
      className={({ isActive }) =>
        `flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition ${
          isActive ? 'bg-[#2f8fc7] text-white' : 'text-[#486272] hover:bg-white hover:text-[#1c2d38]'
        }`
      }
      to={to}
      replace
    >
      <Icon aria-hidden="true" size={16} />
      {label}
    </NavLink>
  )
}

function MobileNavLink({ to, label, icon: Icon }: NavItem) {
  return (
    <NavLink
      className={({ isActive }) =>
        `flex min-h-[58px] flex-col items-center justify-center gap-1 rounded-md px-1 text-[11px] font-semibold transition ${
          isActive ? 'bg-[#e1f2fb] text-black' : 'text-[#6b8090]'
        }`
      }
      to={to}
      replace
    >
      <Icon aria-hidden="true" size={22} strokeWidth={2.2} />
      <span>{label}</span>
    </NavLink>
  )
}

function PageHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-4">
      <h1 className="text-[26px] font-bold leading-tight md:text-3xl">{title}</h1>
      <p className="mt-2 text-sm leading-6 text-[#486272] md:max-w-2xl md:text-base">{description}</p>
    </div>
  )
}

function HomePage() {
  const { profile, user } = useAuth()
  const recordMode = profile?.defaultRecordMode ?? 'detail'
  const [refreshKey, setRefreshKey] = useState(0)

  if (!profile || !user) {
    return null
  }

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1.55fr)_minmax(280px,0.9fr)]">
      <PracticeRecordPanel
        mode={recordMode}
        onSaved={() => setRefreshKey((current) => current + 1)}
        profile={profile}
        user={user}
      />
      <WeeklySummaryPanel refreshKey={refreshKey} userId={user.uid} />
      <div className="lg:col-span-2">
        <RecentLogsPanel refreshKey={refreshKey} userId={user.uid} />
      </div>
    </div>
  )
}

function PracticeRecordPanel({
  mode,
  onSaved,
  profile,
  user,
}: {
  mode: RecordMode
  onSaved: () => void
  profile: UserProfile
  user: User
}) {
  const userId = user.uid
  const [rangeId, setRangeId] = useState(profile.rangeId)
  const [simpleRounds, setSimpleRounds] = useState('1')
  const [simpleHits, setSimpleHits] = useState('0')
  const [note, setNote] = useState('')
  const [detailShots, setDetailShots] = useState<PracticeShotInput[]>([])
  const [message, setMessage] = useState('')
  const [userLocation, setUserLocation] = useState<GeoPoint | null>(null)
  const [locationStatus, setLocationStatus] = useState<'checking' | 'available' | 'fallback'>(() =>
    typeof navigator !== 'undefined' && 'geolocation' in navigator ? 'checking' : 'fallback',
  )
  const recommendedRanges = useMemo(() => getRecommendedPracticeRanges(profile, userLocation), [profile, userLocation])
  const effectiveRangeId = recommendedRanges.some((range) => range.id === rangeId) ? rangeId : recommendedRanges[0]?.id ?? profile.rangeId
  const selectedRange = domesticArcheryRanges.find((range) => range.id === effectiveRangeId) ?? domesticArcheryRanges[0]
  const simpleRoundCount = Number(simpleRounds || 0)
  const totalShots = mode === 'detail' ? detailShots.length : simpleRoundCount * SHOTS_PER_ROUND
  const totalHits = mode === 'detail' ? detailShots.filter((shot) => shot.direction === 'hit').length : Number(simpleHits || 0)

  useEffect(() => {
    if (!('geolocation' in navigator)) {
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        })
        setLocationStatus('available')
      },
      () => {
        setLocationStatus('fallback')
      },
      {
        enableHighAccuracy: false,
        maximumAge: 5 * 60 * 1000,
        timeout: 5000,
      },
    )
  }, [])

  function handleDetailShot(direction: ShotDirection) {
    setMessage('')
    setDetailShots((current) => {
      if (current.length >= MAX_DAILY_ROUNDS * SHOTS_PER_ROUND) {
        setMessage(`하루 최대 기록 범위는 ${MAX_DAILY_ROUNDS}순입니다.`)
        return current
      }

      return [
        ...current,
        {
          roundIndex: Math.floor(current.length / 5) + 1,
          shotIndex: (current.length % 5) + 1,
          direction,
          shotTime: new Date().toISOString(),
        },
      ]
    })
  }

  function undoDetailShot() {
    setMessage('')
    setDetailShots((current) => current.slice(0, -1))
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!selectedRange) {
      setMessage('활터를 선택해주세요.')
      return
    }

    if (mode === 'simple' && (!Number.isFinite(simpleRoundCount) || simpleRoundCount <= 0 || simpleRoundCount > MAX_DAILY_ROUNDS)) {
      setMessage(`순은 1순 이상 ${MAX_DAILY_ROUNDS}순 이하로 입력해주세요.`)
      return
    }

    if (!Number.isFinite(totalShots) || totalShots <= 0) {
      setMessage(mode === 'detail' ? '상세 기록은 탄착 위치를 먼저 입력해야 저장할 수 있습니다.' : '1순 이상 기록해야 합니다.')
      return
    }

    if (totalShots > MAX_DAILY_ROUNDS * SHOTS_PER_ROUND) {
      setMessage(`하루 최대 기록 범위는 ${MAX_DAILY_ROUNDS}순입니다.`)
      return
    }

    if (!Number.isFinite(totalHits) || totalHits < 0 || totalHits > totalShots) {
      setMessage('관중 수는 0 이상, 입력한 순의 총 화살 수 이하로 입력해주세요.')
      return
    }

    const practicedDate = new Date()
    const now = practicedDate.toISOString()
    const session: PracticeSession & { clientSessionId: string } = {
      clientSessionId: crypto.randomUUID(),
      userId,
      rangeId: selectedRange.id,
      rangeName: selectedRange.name,
      practiceDate: toDateKey(practicedDate),
      practicedAt: practicedDate.toISOString(),
      mode,
      totalShots,
      totalHits,
      isRankingPublic: profile.isRankingPublic,
      createdAt: now,
      updatedAt: now,
    }

    let serverSummary
    try {
      serverSummary = await createApiPracticeSummary(user, session)
    } catch (saveError) {
      setMessage(getPracticeSummarySaveErrorMessage(saveError))
      return
    }

    await db.transaction('rw', db.practiceSessions, db.localSessionDetails, db.shotDetails, async () => {
      const id = await db.practiceSessions.add({
        ...session,
        serverId: serverSummary.id,
        syncedAt: now,
      })
      if (typeof id !== 'number') {
        throw new Error('기록 ID를 생성하지 못했습니다.')
      }
      const trimmedNote = note.trim()
      if (trimmedNote) {
        await db.localSessionDetails.add({
          sessionId: id,
          userId,
          note: trimmedNote,
          createdAt: now,
          updatedAt: now,
        })
      }
      if (mode === 'detail') {
        const details: ShotDetail[] = detailShots.map((shot) => ({
          sessionId: id,
          userId,
          roundIndex: shot.roundIndex,
          shotIndex: shot.shotIndex,
          direction: shot.direction,
          isHit: shot.direction === 'hit',
          shotTime: shot.shotTime,
          createdAt: now,
        }))
        await db.shotDetails.bulkAdd(details)
      }

      return id
    })

    setMessage('기록을 저장했습니다.')
    setNote('')
    setSimpleRounds('1')
    setSimpleHits('0')
    setDetailShots([])
    onSaved()
  }

  return (
    <section className="app-card p-4">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold">{mode === 'simple' ? '간단 기록' : '상세 기록'}</h2>
          <p className="mt-1 text-sm leading-6 text-[#6b8090]">
            {mode === 'simple' ? '순과 관중 수를 빠르게 저장합니다.' : '한 순 5발 단위로 탄착 방향을 저장합니다.'}
          </p>
        </div>
        <div className="rounded-md bg-[#e6f6ff] px-2 py-1 text-xs font-bold text-black">
          {totalHits}중 / {formatRoundCount(totalShots || 0)}
        </div>
      </div>

      <form className="grid gap-3" onSubmit={handleSave}>
        <label className="grid gap-2 text-sm font-semibold text-[#1c2d38]">
          활터
          <select className="mobile-input bg-white" value={effectiveRangeId} onChange={(event) => setRangeId(event.target.value)}>
            {recommendedRanges.map((range) => (
              <option key={range.id} value={range.id}>
                {formatRangeOptionLabel(range, userLocation)}
              </option>
            ))}
          </select>
          <span className="text-xs font-medium text-[#8a938c]">
            {locationStatus === 'available' ? '소속 정 우선, 현재 위치 기준 가까운 활터 5개를 표시합니다.' : '위치 확인 전에는 소속 지역 후보 5개를 표시합니다.'}
          </span>
        </label>

        {mode === 'simple' ? (
          <div className="grid grid-cols-2 gap-2">
            <label className="grid gap-2 text-sm font-semibold text-[#1c2d38]">
              순
              <input className="mobile-input" inputMode="numeric" min={1} max={MAX_DAILY_ROUNDS} type="number" value={simpleRounds} onChange={(event) => setSimpleRounds(event.target.value)} />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-[#1c2d38]">
              관중 수
              <input className="mobile-input" inputMode="numeric" min={0} max={MAX_DAILY_ROUNDS * SHOTS_PER_ROUND} type="number" value={simpleHits} onChange={(event) => setSimpleHits(event.target.value)} />
            </label>
          </div>
        ) : (
          <DetailShotPad shots={detailShots} onPick={handleDetailShot} onUndo={undoDetailShot} />
        )}

        <label className="grid gap-2 text-sm font-semibold text-[#1c2d38]">
          메모
          <input className="mobile-input" placeholder="선택 입력" value={note} onChange={(event) => setNote(event.target.value)} />
        </label>

        {message && <p className="rounded-md bg-[#f4efe6] px-3 py-2 text-sm leading-6 text-[#6b5540]">{message}</p>}

        <button className="mobile-button bg-[#1b6f9f] text-white" type="submit">
          기록 저장
        </button>
      </form>
    </section>
  )
}

function DetailShotPad({
  onPick,
  onUndo,
  shots,
}: {
  onPick: (direction: ShotDirection) => void
  onUndo: () => void
  shots: PracticeShotInput[]
}) {
  const currentRound = Math.floor(shots.length / 5) + 1
  const currentShot = (shots.length % 5) + 1
  const roundShots = shots.slice(Math.floor(shots.length / 5) * 5)
  const padItems: Array<{ direction: ShotDirection; label: string; Icon?: LucideIcon; className?: string }> = [
    { direction: 'highLeft', label: '왼쪽 위', Icon: ArrowUpLeft },
    { direction: 'high', label: '위', Icon: ArrowUp },
    { direction: 'highRight', label: '오른쪽 위', Icon: ArrowUpRight },
    { direction: 'left', label: '왼쪽', Icon: ArrowLeft },
    { direction: 'hit', label: '관중', className: 'p-0' },
    { direction: 'right', label: '오른쪽', Icon: ArrowRight },
    { direction: 'lowLeft', label: '왼쪽 아래', Icon: ArrowDownLeft },
    { direction: 'low', label: '아래', Icon: ArrowDown },
    { direction: 'lowRight', label: '오른쪽 아래', Icon: ArrowDownRight },
  ]

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between text-sm font-semibold text-[#1c2d38]">
        <span>
          {Math.min(currentRound, MAX_DAILY_ROUNDS)}순 {shots.length >= MAX_DAILY_ROUNDS * SHOTS_PER_ROUND ? '완료' : `${currentShot}번째`}
        </span>
        <button className="rounded-md border border-[#c7deeb] bg-white px-3 py-1.5 text-xs font-bold text-[#486272]" onClick={onUndo} type="button">
          되돌리기
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {padItems.map((item) => (
          <button
            className={`flex aspect-square items-center justify-center rounded-lg border border-[#c7deeb] bg-[#f8fcff] text-2xl font-black text-black ${item.className ?? ''}`}
            key={item.direction}
            onClick={() => onPick(item.direction)}
            type="button"
          >
            {item.direction === 'hit' ? (
              <img alt="중앙 관중" className="h-full w-full rounded-lg object-cover" src="/target-center.jpeg" />
            ) : item.Icon ? (
              <item.Icon aria-label={item.label} className="h-11 w-11" strokeWidth={3.5} />
            ) : (
              item.label
            )}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-5 gap-1">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            className={`h-2 rounded-full ${roundShots[index] ? 'bg-[#1b6f9f]' : 'bg-[#c7deeb]'}`}
            key={`round-shot-${index + 1}`}
          />
        ))}
      </div>
    </div>
  )
}

function WeeklySummaryPanel({ refreshKey, userId }: { refreshKey: number; userId: string }) {
  const [summary, setSummary] = useState<WeeklySummary>({ totalShots: 0, totalHits: 0, rate: 0 })

  useEffect(() => {
    loadWeeklySummary(userId).then(setSummary)
  }, [refreshKey, userId])

  return (
    <section className="app-card p-4">
      <h2 className="text-base font-bold">이번주 총 기록</h2>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <Metric label="순" value={formatRoundCount(summary.totalShots)} />
        <Metric label="관중" value={`${summary.totalHits}`} />
        <Metric label="관중률" value={`${summary.rate}%`} />
      </div>
    </section>
  )
}

function RecentLogsPanel({ refreshKey, userId }: { refreshKey: number; userId: string }) {
  const [logs, setLogs] = useState<DailyLog[]>([])

  useEffect(() => {
    loadRecentLogs(userId).then(setLogs)
  }, [refreshKey, userId])

  return (
    <section className="app-card p-4">
      <h2 className="text-base font-bold">최근 로그</h2>
      <div className="mt-3 grid gap-2">
        {logs.length === 0 ? (
          <p className="rounded-md border border-dashed border-[#c7deeb] bg-[#f8fcff] p-4 text-sm text-[#6b8090]">아직 저장된 기록이 없습니다.</p>
        ) : (
          logs.map((log) => (
            <div className="grid grid-cols-[1fr_auto] gap-2 rounded-md border border-[#cfe5f2] bg-[#f8fcff] p-3" key={`${log.practiceDate}-${log.rangeName}`}>
              <div>
                <p className="text-sm font-bold">{formatDateLabel(log.practiceDate)}</p>
                <p className="mt-1 text-xs text-[#6b8090]">
                  {log.rangeName} · {log.sessionCount}회
                </p>
              </div>
              <p className="text-sm font-bold text-black">
                {log.totalHits}중 / {formatRoundCount(log.totalShots)}
              </p>
            </div>
          ))
        )}
      </div>
    </section>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-[#f8fcff] px-2 py-3">
      <p className="text-xs font-semibold text-[#6b8090]">{label}</p>
      <p className="mt-1 text-lg font-black text-black">{value}</p>
    </div>
  )
}

async function loadWeeklySummary(userId: string): Promise<WeeklySummary> {
  const weekStart = getWeekStart(new Date())
  const sessions = await db.practiceSessions.where('[userId+practiceDate]').between([userId, toDateKey(weekStart)], [userId, '9999-12-31']).toArray()
  const totalShots = sessions.reduce((sum, session) => sum + session.totalShots, 0)
  const totalHits = sessions.reduce((sum, session) => sum + session.totalHits, 0)
  return {
    totalShots,
    totalHits,
    rate: totalShots ? Math.round((totalHits / totalShots) * 100) : 0,
  }
}

async function loadRecentLogs(userId: string): Promise<DailyLog[]> {
  const sessions = (await db.practiceSessions.where('userId').equals(userId).toArray()).sort((a, b) =>
    b.practicedAt.localeCompare(a.practicedAt),
  )
  const grouped = new Map<string, DailyLog>()

  for (const session of sessions) {
    const key = `${session.practiceDate}:${session.rangeName}`
    const current = grouped.get(key) ?? {
      practiceDate: session.practiceDate,
      rangeName: session.rangeName,
      totalShots: 0,
      totalHits: 0,
      sessionCount: 0,
    }
    current.totalShots += session.totalShots
    current.totalHits += session.totalHits
    current.sessionCount += 1
    grouped.set(key, current)
  }

  return [...grouped.values()]
    .sort((a, b) => b.practiceDate.localeCompare(a.practiceDate))
    .slice(0, 7)
}

function toDatetimeLocalValue(date: Date) {
  const offsetMs = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16)
}

function toDateKey(date: Date) {
  return toDatetimeLocalValue(date).slice(0, 10)
}

function getWeekStart(date: Date) {
  const start = new Date(date)
  const day = start.getDay()
  const diff = day === 0 ? -6 : 1 - day
  start.setDate(start.getDate() + diff)
  start.setHours(0, 0, 0, 0)
  return start
}

function getMonthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function formatRoundCount(totalShots: number) {
  const rounds = totalShots / SHOTS_PER_ROUND
  return Number.isInteger(rounds) ? `${rounds}순` : `${rounds.toFixed(1)}순`
}

function getAverageHitsPerRoundValue(totalHits: number, totalShots: number) {
  if (!totalShots) {
    return 0
  }

  return totalHits / (totalShots / SHOTS_PER_ROUND)
}

function getPracticeSummarySaveErrorMessage(error: unknown) {
  const detail = error instanceof Error ? error.message : ''
  if (detail.includes('Complete onboarding first.')) {
    return '서버 프로필이 아직 준비되지 않았습니다. 설정의 프로필을 한 번 저장한 뒤 다시 기록해주세요.'
  }

  if (detail.includes('Daily practice limit is 18 rounds.')) {
    return '서버 기준으로 오늘 기록이 18순을 넘습니다. 기존 기록을 확인해주세요.'
  }

  if (detail.includes('Recent hit rate')) {
    return '최근 기록과 차이가 큰 시수입니다. 확인 팝업 연결을 마친 뒤 저장할 수 있습니다.'
  }

  if (detail.includes('Invalid Firebase ID token') || detail.includes('Unauthorized')) {
    return '로그인 인증을 확인하지 못했습니다. 다시 로그인한 뒤 기록해주세요.'
  }

  return '요약 기록을 서버에 저장하지 못했습니다. 백엔드와 네트워크 상태를 확인해주세요.'
}

function roundInputValue(totalShots: number) {
  const rounds = totalShots / SHOTS_PER_ROUND
  return Number.isInteger(rounds) ? String(rounds) : rounds.toFixed(1)
}

function formatDateLabel(dateKey: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(new Date(`${dateKey}T00:00:00`))
}

function formatMonthLabel(date: Date) {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
  }).format(date)
}

function formatTimeLabel(value: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function getCalendarMonthDays(date: Date) {
  const monthStart = new Date(date.getFullYear(), date.getMonth(), 1)
  const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  const leadingBlanks = (monthStart.getDay() + 6) % 7
  const days: Array<string | null> = Array.from({ length: leadingBlanks }, () => null)

  for (let day = 1; day <= daysInMonth; day += 1) {
    days.push(toDateKey(new Date(date.getFullYear(), date.getMonth(), day)))
  }

  while (days.length % 7 !== 0) {
    days.push(null)
  }

  return days
}

function getAverageHitsPerRound(summary?: CalendarDaySummary) {
  if (!summary) {
    return 0
  }

  return getAverageHitsPerRoundValue(summary.totalHits, summary.totalShots)
}

function getCalendarIntensity(averageHits: number) {
  if (averageHits >= 4) {
    return 'border-[#8fc9e8] bg-[#d7f0ff]'
  }
  if (averageHits >= 3) {
    return 'border-[#b9ddef] bg-[#e6f6ff]'
  }
  if (averageHits > 0) {
    return 'border-[#dbeaf3] bg-[#f1f9ff]'
  }
  return 'border-[#dbeaf3] bg-white'
}

async function loadCalendarData(userId: string, visibleMonth: Date): Promise<CalendarData> {
  const startKey = toDateKey(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1))
  const endKey = toDateKey(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0))
  const sessions = (await db.practiceSessions.where('userId').equals(userId).toArray())
    .filter((session) => session.practiceDate >= startKey && session.practiceDate <= endKey)
    .sort((a, b) => a.practicedAt.localeCompare(b.practicedAt))
  const summaries = new Map<string, CalendarDaySummary>()
  const sessionsByDate = new Map<string, PracticeSession[]>()

  sessions.forEach((session) => {
    const summary = summaries.get(session.practiceDate) ?? {
      practiceDate: session.practiceDate,
      totalShots: 0,
      totalHits: 0,
      sessionCount: 0,
    }
    summary.totalShots += session.totalShots
    summary.totalHits += session.totalHits
    summary.sessionCount += 1
    summaries.set(session.practiceDate, summary)

    const currentSessions = sessionsByDate.get(session.practiceDate) ?? []
    currentSessions.push(session)
    sessionsByDate.set(session.practiceDate, currentSessions)
  })

  return { summaries, sessionsByDate }
}

async function loadTrendPoints(userId: string, period: StatsPeriod): Promise<TrendPoint[]> {
  const dateKeys = getPeriodDateKeys(period)
  const startKey = dateKeys[0] ?? toDateKey(new Date())
  const sessions = (await db.practiceSessions.where('userId').equals(userId).toArray()).filter((session) => session.practiceDate >= startKey)
  const summaryByDate = new Map<string, CalendarDaySummary>()

  sessions.forEach((session) => {
    const summary = summaryByDate.get(session.practiceDate) ?? {
      practiceDate: session.practiceDate,
      totalShots: 0,
      totalHits: 0,
      sessionCount: 0,
    }
    summary.totalShots += session.totalShots
    summary.totalHits += session.totalHits
    summary.sessionCount += 1
    summaryByDate.set(session.practiceDate, summary)
  })

  return dateKeys.map((dateKey) => {
    const summary = summaryByDate.get(dateKey)
    const totalShots = summary?.totalShots ?? 0
    const totalHits = summary?.totalHits ?? 0
    return {
      dateKey,
      label: period === 'weekly' ? getWeekdayLabel(dateKey) : String(Number(dateKey.slice(-2))),
      totalShots,
      totalHits,
      hitRate: totalShots ? totalHits / totalShots : 0,
    }
  })
}

async function loadDirectionStats(userId: string, period: StatsPeriod): Promise<DirectionStat[]> {
  const sessions = await loadPeriodSessions(userId, period)
  const sessionIds = new Set(sessions.map((session) => session.id).filter((id): id is number => typeof id === 'number'))
  const details = (await db.shotDetails.where('userId').equals(userId).toArray()).filter((detail) => sessionIds.has(detail.sessionId))
  const countByDirection = new Map<ShotDirection, number>()

  details.forEach((detail) => {
    countByDirection.set(detail.direction, (countByDirection.get(detail.direction) ?? 0) + 1)
  })

  const totalCount = details.length
  const order: ShotDirection[] = ['highLeft', 'high', 'highRight', 'left', 'hit', 'right', 'lowLeft', 'low', 'lowRight']
  return order.map((direction) => {
    const count = countByDirection.get(direction) ?? 0
    return {
      direction,
      label: getDirectionLabel(direction),
      count,
      percent: totalCount ? (count / totalCount) * 100 : 0,
    }
  })
}

async function loadTimeStats(userId: string, period: StatsPeriod): Promise<TimeStat[]> {
  const sessions = await loadPeriodSessions(userId, period)
  const buckets = getTimeBuckets().map((bucket) => ({
    ...bucket,
    totalShots: 0,
    totalHits: 0,
  }))

  sessions.forEach((session) => {
    const hour = new Date(session.practicedAt).getHours()
    const bucket = buckets.find((item) => (item.start < item.end ? hour >= item.start && hour < item.end : hour >= item.start || hour < item.end))
    if (!bucket) {
      return
    }

    bucket.totalShots += session.totalShots
    bucket.totalHits += session.totalHits
  })

  return buckets.map((bucket) => ({
    id: bucket.id,
    label: bucket.label,
    totalShots: bucket.totalShots,
    totalHits: bucket.totalHits,
    hitRate: bucket.totalShots ? bucket.totalHits / bucket.totalShots : 0,
  }))
}

async function loadPeriodSessions(userId: string, period: StatsPeriod) {
  const startKey = getPeriodDateKeys(period)[0] ?? toDateKey(new Date())
  return (await db.practiceSessions.where('userId').equals(userId).toArray()).filter((session) => session.practiceDate >= startKey)
}

function getPeriodDateKeys(period: StatsPeriod) {
  const today = new Date()
  const start = period === 'weekly' ? getWeekStart(today) : getMonthStart(today)
  const keys: string[] = []
  const current = new Date(start)

  while (current <= today) {
    keys.push(toDateKey(current))
    current.setDate(current.getDate() + 1)
  }

  return keys
}

function getWeekdayLabel(dateKey: string) {
  return new Intl.DateTimeFormat('ko-KR', { weekday: 'short' }).format(new Date(`${dateKey}T00:00:00`))
}

function getDirectionLabel(direction: ShotDirection) {
  const labels: Record<ShotDirection, string> = {
    highLeft: '좌상',
    high: '상',
    highRight: '우상',
    left: '좌',
    hit: '관중',
    right: '우',
    lowLeft: '좌하',
    low: '하',
    lowRight: '우하',
  }
  return labels[direction]
}

function getDirectionIntensity(percent: number) {
  if (percent >= 35) {
    return 'bg-[#d7f0ff]'
  }
  if (percent >= 20) {
    return 'bg-[#e6f6ff]'
  }
  if (percent > 0) {
    return 'bg-[#f1f9ff]'
  }
  return 'bg-[#f8fcff]'
}

function getTimeBuckets() {
  return [
    { id: 'morning', label: '오전', start: 5, end: 12 },
    { id: 'afternoon', label: '오후', start: 12, end: 17 },
    { id: 'evening', label: '저녁', start: 17, end: 22 },
    { id: 'night', label: '야간', start: 22, end: 5 },
  ]
}

function getRecommendedPracticeRanges(profile: UserProfile, userLocation: GeoPoint | null): PracticeRangeOption[] {
  const homeRange = domesticArcheryRanges.find((range) => range.id === profile.rangeId) ?? domesticArcheryRanges[0]
  const nearbyRanges = userLocation ? getNearbyRanges(userLocation, homeRange.id) : getFallbackNearbyRanges(homeRange)
  return uniqueRanges([homeRange, ...nearbyRanges]).slice(0, 5)
}

function getNearbyRanges(userLocation: GeoPoint, excludedRangeId: string) {
  return (domesticArcheryRanges as readonly PracticeRangeOption[])
    .filter((range): range is PracticeRangeOption & { latitude: number; longitude: number } => range.id !== excludedRangeId && hasRangeCoordinate(range))
    .map((range) => ({
      range,
      distance: getDistanceKm(userLocation, {
        latitude: range.latitude,
        longitude: range.longitude,
      }),
    }))
    .sort((a, b) => a.distance - b.distance || a.range.name.localeCompare(b.range.name, 'ko-KR'))
    .map((item) => item.range)
}

function getFallbackNearbyRanges(homeRange: PracticeRangeOption) {
  const homeArea = getRangeAreaKey(homeRange)
  return domesticArcheryRanges
    .filter((range) => range.id !== homeRange.id)
    .sort((a, b) => {
      const aArea = getRangeAreaKey(a)
      const bArea = getRangeAreaKey(b)
      const aScore = aArea === homeArea ? 0 : a.region === homeRange.region ? 1 : 2
      const bScore = bArea === homeArea ? 0 : b.region === homeRange.region ? 1 : 2

      return aScore - bScore || a.name.localeCompare(b.name, 'ko-KR')
    })
}

function uniqueRanges(ranges: PracticeRangeOption[]) {
  const seen = new Set<string>()
  return ranges.filter((range) => {
    if (seen.has(range.id)) {
      return false
    }

    seen.add(range.id)
    return true
  })
}

function formatRangeOptionLabel(range: PracticeRangeOption, userLocation: GeoPoint | null) {
  const distanceLabel =
    userLocation && hasRangeCoordinate(range)
      ? ` · ${formatDistance(getDistanceKm(userLocation, { latitude: range.latitude, longitude: range.longitude }))}`
      : ''

  return `${getShortAreaName(range)} / ${range.name}${distanceLabel}`
}

function formatRankingDisplay(row: RankingRow) {
  return `${getShortAreaNameByRangeId(row.rangeId, row.rangeName)} / ${row.rangeName} / ${row.name}`
}

function getShortAreaNameByRangeId(rangeId: string, fallbackRangeName: string) {
  const range = domesticArcheryRanges.find((item) => item.id === rangeId)
  return range ? getShortAreaName(range) : fallbackRangeName
}

function getShortAreaName(range: PracticeRangeOption) {
  return simplifyAreaName(getRangeAreaKey(range))
}

function getRangeAreaKey(range: PracticeRangeOption) {
  if (metropolitanRegions.has(range.region) || range.region === '세종특별자치시') {
    return range.region
  }

  const firstToken = range.address.split(' ')[0] ?? ''
  const match = firstToken.match(/.+?(시|군|구)/)
  return match?.[0] ?? (firstToken || range.region)
}

function simplifyAreaName(areaName: string) {
  return areaName
    .replace(/특별자치시$/, '')
    .replace(/특별자치도$/, '')
    .replace(/특별시$/, '')
    .replace(/광역시$/, '')
    .replace(/시$/, '')
    .replace(/군$/, '')
    .replace(/구$/, '')
}

function hasRangeCoordinate(range: PracticeRangeOption): range is PracticeRangeOption & { latitude: number; longitude: number } {
  return Number.isFinite(range.latitude) && Number.isFinite(range.longitude)
}

function getDistanceKm(from: GeoPoint, to: GeoPoint) {
  const earthRadiusKm = 6371
  const dLat = toRadians(to.latitude - from.latitude)
  const dLon = toRadians(to.longitude - from.longitude)
  const fromLat = toRadians(from.latitude)
  const toLat = toRadians(to.latitude)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(fromLat) * Math.cos(toLat) * Math.sin(dLon / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return earthRadiusKm * c
}

function toRadians(value: number) {
  return (value * Math.PI) / 180
}

function formatDistance(distanceKm: number) {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)}m`
  }

  return `${distanceKm.toFixed(distanceKm < 10 ? 1 : 0)}km`
}

function StatsPage() {
  const { statsView } = useHomeHeader()
  const { user } = useAuth()

  if (statsView === 'stats') {
    return user ? <PracticeStats userId={user.uid} /> : null
  }

  if (statsView === 'calendar') {
    return user ? <ActivityCalendar userId={user.uid} /> : null
  }

  return user ? <TrendChart userId={user.uid} /> : null
}

function PeriodToggle({ period, onChange }: { period: StatsPeriod; onChange: (period: StatsPeriod) => void }) {
  return (
    <div className="grid grid-cols-2 rounded-md border border-[#c7deeb] bg-[#f8fcff] p-0.5">
      {[
        { label: '주간', value: 'weekly' },
        { label: '월간', value: 'monthly' },
      ].map((option) => (
        <button
          className={`min-h-8 rounded px-2 text-xs font-black transition ${
            period === option.value ? 'bg-[#1b6f9f] text-white shadow-sm' : 'text-[#486272]'
          }`}
          key={option.value}
          onClick={() => onChange(option.value as StatsPeriod)}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

function TrendChart({ userId }: { userId: string }) {
  const [period, setPeriod] = useState<StatsPeriod>('weekly')
  const [points, setPoints] = useState<TrendPoint[]>([])
  const [selectedPointKey, setSelectedPointKey] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    loadTrendPoints(userId, period)
      .then((nextPoints) => {
        if (isMounted) {
          setPoints(nextPoints)
          setSelectedPointKey(nextPoints.find((point) => point.totalShots > 0)?.dateKey ?? null)
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [period, userId])

  const activePoints = points.filter((point) => point.totalShots > 0)
  const totalShots = points.reduce((sum, point) => sum + point.totalShots, 0)
  const totalHits = points.reduce((sum, point) => sum + point.totalHits, 0)
  const averageHits = getAverageHitsPerRoundValue(totalHits, totalShots)
  const maxRounds = Math.max(1, ...points.map((point) => point.totalShots / SHOTS_PER_ROUND))
  const chartWidth = 320
  const chartHeight = 190
  const leftPad = 12
  const rightPad = 12
  const topPad = 20
  const bottomPad = 30
  const innerWidth = chartWidth - leftPad - rightPad
  const innerHeight = chartHeight - topPad - bottomPad
  const step = points.length > 1 ? innerWidth / (points.length - 1) : innerWidth
  const linePoints = points
    .map((point, index) => {
      const x = leftPad + index * step
      const y = topPad + innerHeight - point.hitRate * innerHeight
      return `${x},${y}`
    })
    .join(' ')

  return (
    <section className="app-card p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-black text-[#1c2d38]">차트</h2>
          <p className="mt-1 text-xs font-bold text-[#6b8090]">1순 평균과 습사량 변화</p>
        </div>
        <PeriodToggle
          period={period}
          onChange={(nextPeriod) => {
            setPeriod(nextPeriod)
            setSelectedPointKey(null)
          }}
        />
      </div>

      {isLoading ? (
        <p className="rounded-md bg-[#f8fcff] p-4 text-center text-sm font-bold text-[#6b8090]">차트를 불러오는 중입니다.</p>
      ) : activePoints.length === 0 ? (
        <p className="rounded-md border border-dashed border-[#c7deeb] bg-[#f8fcff] p-4 text-sm text-[#6b8090]">표시할 기록이 없습니다.</p>
      ) : (
        <div className="grid gap-3">
          <div className="grid grid-cols-3 gap-2 text-center">
            <Metric label="순" value={formatRoundCount(totalShots)} />
            <Metric label="관중" value={`${totalHits}`} />
            <Metric label="1순 평균" value={`${averageHits.toFixed(1)}중`} />
          </div>
          <div className="overflow-x-auto">
            <svg className="min-w-full rounded-md bg-[#f8fcff] text-black" role="img" viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
              <line stroke="#c7deeb" strokeWidth="1" x1={leftPad} x2={chartWidth - rightPad} y1={topPad + innerHeight} y2={topPad + innerHeight} />
              {points.map((point, index) => {
                const x = leftPad + index * step
                const rounds = point.totalShots / SHOTS_PER_ROUND
                const barHeight = (rounds / maxRounds) * innerHeight
                const isSelected = selectedPointKey === point.dateKey
                return (
                  <g key={point.dateKey} onClick={() => point.totalShots > 0 && setSelectedPointKey(point.dateKey)} role="button">
                    <rect fill={isSelected ? '#1d4ed8' : '#3b82f6'} height={barHeight} rx="2.5" width="9" x={x - 4.5} y={topPad + innerHeight - barHeight} />
                    {(period === 'weekly' || index % 5 === 0 || index === points.length - 1) && (
                      <text fill="#000000" fontSize="8" fontWeight="700" textAnchor="middle" x={x} y={chartHeight - 10}>
                        {point.label}
                      </text>
                    )}
                  </g>
                )
              })}
              <polyline fill="none" points={linePoints} stroke="#000000" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
              {points.map((point, index) => {
                const x = leftPad + index * step
                const y = topPad + innerHeight - point.hitRate * innerHeight
                const isSelected = selectedPointKey === point.dateKey
                const pointAverageHits = getAverageHitsPerRoundValue(point.totalHits, point.totalShots)
                const tooltipWidth = 96
                const tooltipX = Math.min(Math.max(x - tooltipWidth / 2, 4), chartWidth - tooltipWidth - 4)
                const tooltipTextX = tooltipX + tooltipWidth / 2
                return (
                  <g key={`${point.dateKey}-dot`} onClick={() => point.totalShots > 0 && setSelectedPointKey(point.dateKey)} role="button">
                    {isSelected && (
                      <g>
                        <rect fill="#000000" height="24" rx="5" width={tooltipWidth} x={tooltipX} y={Math.max(y - 36, 4)} />
                        <text fill="#ffffff" fontSize="9" fontWeight="800" textAnchor="middle" x={tooltipTextX} y={Math.max(y - 20, 20)}>
                          평균 {pointAverageHits.toFixed(1)}중 / {formatRoundCount(point.totalShots)}
                        </text>
                      </g>
                    )}
                    <circle cx={x} cy={y} fill="#000000" r={point.totalShots ? (isSelected ? 5 : 3) : 0} />
                    <circle cx={x} cy={y} fill="transparent" r="10" />
                  </g>
                )
              })}
            </svg>
            <p className="mt-2 text-center text-[11px] font-bold text-black">선은 관중률, 막대는 습사량입니다.</p>
          </div>
        </div>
      )}
    </section>
  )
}

function PracticeStats({ userId }: { userId: string }) {
  const [period, setPeriod] = useState<StatsPeriod>('weekly')
  const [mode, setMode] = useState<StatsMode>('time')
  const [directionStats, setDirectionStats] = useState<DirectionStat[]>([])
  const [timeStats, setTimeStats] = useState<TimeStat[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    Promise.all([loadDirectionStats(userId, period), loadTimeStats(userId, period)])
      .then(([nextDirectionStats, nextTimeStats]) => {
        if (isMounted) {
          setDirectionStats(nextDirectionStats)
          setTimeStats(nextTimeStats)
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [period, userId])

  return (
    <section className="app-card p-4">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="grid grid-cols-2 rounded-md border border-[#c7deeb] bg-[#f8fcff] p-0.5">
          {[
            { label: '시간', value: 'time' },
            { label: '방향성', value: 'direction' },
          ].map((option) => (
            <button
              className={`min-h-8 rounded px-2 text-xs font-black transition ${
                mode === option.value ? 'bg-[#1b6f9f] text-white shadow-sm' : 'text-[#486272]'
              }`}
              key={option.value}
              onClick={() => setMode(option.value as StatsMode)}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
        <PeriodToggle period={period} onChange={setPeriod} />
      </div>

      {isLoading ? (
        <p className="rounded-md bg-[#f8fcff] p-4 text-center text-sm font-bold text-[#6b8090]">통계를 불러오는 중입니다.</p>
      ) : mode === 'direction' ? (
        <DirectionStatsView stats={directionStats} />
      ) : (
        <TimeStatsView stats={timeStats} />
      )}
    </section>
  )
}

function DirectionStatsView({ stats }: { stats: DirectionStat[] }) {
  const totalCount = stats.reduce((sum, stat) => sum + stat.count, 0)
  const statByDirection = new Map(stats.map((stat) => [stat.direction, stat]))
  const order: ShotDirection[] = ['highLeft', 'high', 'highRight', 'left', 'hit', 'right', 'lowLeft', 'low', 'lowRight']

  if (totalCount === 0) {
    return <p className="rounded-md border border-dashed border-[#c7deeb] bg-[#f8fcff] p-4 text-sm text-[#6b8090]">상세 기록을 저장하면 방향성 통계가 표시됩니다.</p>
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      {order.map((direction) => {
        const stat = statByDirection.get(direction) ?? { direction, label: getDirectionLabel(direction), count: 0, percent: 0 }
        return (
          <div className={`rounded-md border border-[#cfe5f2] p-3 text-center ${getDirectionIntensity(stat.percent)}`} key={direction}>
            <p className="text-xs font-black text-[#1c2d38]">{stat.label}</p>
            <p className="mt-1 text-lg font-black text-black">{Math.round(stat.percent)}%</p>
            <p className="mt-1 text-[11px] font-bold text-[#6b8090]">{stat.count}</p>
          </div>
        )
      })}
    </div>
  )
}

function TimeStatsView({ stats }: { stats: TimeStat[] }) {
  const maxShots = Math.max(1, ...stats.map((stat) => stat.totalShots))
  const hasData = stats.some((stat) => stat.totalShots > 0)

  if (!hasData) {
    return <p className="rounded-md border border-dashed border-[#c7deeb] bg-[#f8fcff] p-4 text-sm text-[#6b8090]">기록을 저장하면 시간 통계가 표시됩니다.</p>
  }

  return (
    <div className="grid gap-2">
      {stats.map((stat) => (
        <div className="rounded-md border border-[#cfe5f2] bg-[#f8fcff] p-3" key={stat.id}>
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-sm font-black text-[#1c2d38]">{stat.label}</p>
            <p className="text-sm font-black text-black">{stat.totalShots ? `${Math.round(stat.hitRate * 100)}%` : '-'}</p>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white">
            <div className="h-full rounded-full bg-black" style={{ width: `${Math.max(4, (stat.totalShots / maxShots) * 100)}%` }} />
          </div>
          <p className="mt-2 text-xs font-bold text-[#6b8090]">
            {stat.totalHits}중 / {formatRoundCount(stat.totalShots)}
          </p>
        </div>
      ))}
    </div>
  )
}

function ActivityCalendar({ userId }: { userId: string }) {
  const [visibleMonth, setVisibleMonth] = useState(() => new Date())
  const [calendarData, setCalendarData] = useState<CalendarData>(() => ({
    summaries: new Map(),
    sessionsByDate: new Map(),
  }))
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    loadCalendarData(userId, visibleMonth)
      .then((nextData) => {
        if (isMounted) {
          setCalendarData(nextData)
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [userId, visibleMonth])

  function moveMonth(offset: number) {
    setSelectedDate(null)
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1))
  }

  if (selectedDate) {
    const summary = calendarData.summaries.get(selectedDate)
    const sessions = calendarData.sessionsByDate.get(selectedDate) ?? []
    const averageHits = getAverageHitsPerRound(summary)
    const hitRate = summary?.totalShots ? Math.round((summary.totalHits / summary.totalShots) * 100) : 0

    return (
      <section className="app-card overflow-hidden">
        <div className="border-b border-[#cfe5f2] bg-[#f6fbff] p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-[#1c2d38]">{formatDateLabel(selectedDate)}</h2>
              <p className="mt-1 text-xs font-bold text-[#6b8090]">습사 기록</p>
            </div>
            <button className="rounded-md border border-[#c7deeb] bg-white px-3 py-2 text-xs font-black text-black" onClick={() => setSelectedDate(null)} type="button">
              달력
            </button>
          </div>
        </div>
        <div className="p-4">
        {sessions.length === 0 ? (
          <p className="rounded-md border border-dashed border-[#c7deeb] bg-[#f6fbff] p-4 text-sm text-[#6b8090]">이 날짜에는 기록이 없습니다.</p>
        ) : (
          <div className="grid gap-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              <Metric label="1순 평균" value={`${averageHits.toFixed(1)}중`} />
              <Metric label="순" value={formatRoundCount(summary?.totalShots ?? 0)} />
              <Metric label="관중률" value={`${hitRate}%`} />
            </div>
            <div className="grid max-h-[50dvh] gap-2 overflow-y-auto pr-1">
              {sessions.map((session) => (
                <div className="grid grid-cols-[1fr_auto] gap-2 rounded-md border border-[#cfe5f2] bg-[#f8fcff] p-3" key={session.id}>
                  <div className="min-w-0">
                    <p className="text-sm font-black text-[#1c2d38]">{formatTimeLabel(session.practicedAt)}</p>
                    <p className="mt-1 truncate text-xs font-semibold text-[#6b8090]">{session.rangeName}</p>
                  </div>
                  <p className="text-sm font-black text-black">
                    {session.totalHits}중 / {formatRoundCount(session.totalShots)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
        </div>
      </section>
    )
  }

  const monthDays = getCalendarMonthDays(visibleMonth)
  const todayKey = toDateKey(new Date())

  return (
    <section className="app-card overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-[#cfe5f2] bg-[#f6fbff] px-4 py-3">
        <button className="rounded-md border border-[#c7deeb] bg-white px-3 py-1.5 text-sm font-black text-black" onClick={() => moveMonth(-1)} type="button">
          이전
        </button>
        <h2 className="text-base font-black text-black">{formatMonthLabel(visibleMonth)}</h2>
        <button className="rounded-md border border-[#c7deeb] bg-white px-3 py-1.5 text-sm font-black text-black" onClick={() => moveMonth(1)} type="button">
          다음
        </button>
      </div>

      {isLoading ? (
        <p className="m-4 rounded-md bg-[#f6fbff] p-4 text-center text-sm font-bold text-[#6b8090]">캘린더를 불러오는 중입니다.</p>
      ) : (
        <div className="grid gap-2 p-3">
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-black text-black">
            {['월', '화', '수', '목', '금', '토', '일'].map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {monthDays.map((dateKey, index) => {
              if (!dateKey) {
                return <div className="h-12 rounded-md bg-transparent" key={`blank-${index}`} />
              }

              const summary = calendarData.summaries.get(dateKey)
              const averageHits = getAverageHitsPerRound(summary)
              const intensity = getCalendarIntensity(averageHits)
              const isToday = dateKey === todayKey

              return (
                <button
                  className={`flex h-12 min-w-0 flex-col justify-between rounded-md border px-1.5 py-1 text-left text-black transition active:scale-[0.98] ${intensity} ${
                    isToday ? 'ring-1 ring-black ring-offset-1 ring-offset-white' : ''
                  }`}
                  key={dateKey}
                  onClick={() => setSelectedDate(dateKey)}
                  type="button"
                >
                  <span className="text-xs font-black leading-none">{Number(dateKey.slice(-2))}</span>
                  <span className="w-full truncate text-right text-xs font-black leading-none">{summary ? averageHits.toFixed(1) : ''}</span>
                </button>
              )
            })}
          </div>
          <p className="text-right text-[10px] font-bold text-black">숫자는 1순당 평균 관중입니다.</p>
        </div>
      )}
    </section>
  )
}

function RankingPage() {
  const { rankingView } = useHomeHeader()
  const { profile, user } = useAuth()

  if (!profile || !user) {
    return null
  }

  return <RankingBoard profile={profile} user={user} view={rankingView} />
}

function RankingBoard({
  profile,
  user,
  view,
}: {
  profile: UserProfile
  user: User
  view: 'overall' | 'range' | 'group'
}) {
  const userId = user.uid
  const [weeklyRows, setWeeklyRows] = useState<RankingRow[]>([])
  const [monthlyRows, setMonthlyRows] = useState<RankingRow[]>([])
  const [memberships, setMemberships] = useState<GroupMembership[]>([])
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [rankingType, setRankingType] = useState<'hitRate' | 'total'>('hitRate')

  async function refreshGroup() {
    const nextMemberships = await loadGroupMemberships(user)
    const nextSelectedGroupId = nextMemberships.some((membership) => membership.group.id === selectedGroupId)
      ? selectedGroupId
      : nextMemberships[0]?.group.id ?? null
    const [nextWeeklyRows, nextMonthlyRows] = await Promise.all([
      loadRankingRows(view, profile, user, toDateKey(getWeekStart(new Date())), nextSelectedGroupId, rankingType),
      loadRankingRows(view, profile, user, toDateKey(getMonthStart(new Date())), nextSelectedGroupId, rankingType),
    ])
    setMemberships(nextMemberships)
    setSelectedGroupId(nextSelectedGroupId)
    setWeeklyRows(nextWeeklyRows)
    setMonthlyRows(nextMonthlyRows)
  }

  useEffect(() => {
    let isMounted = true

    loadGroupMemberships(user)
      .then(async (nextMemberships) => {
        const nextSelectedGroupId =
          view === 'group'
            ? nextMemberships.some((membership) => membership.group.id === selectedGroupId)
              ? selectedGroupId
              : nextMemberships[0]?.group.id ?? null
            : null
        const [nextWeeklyRows, nextMonthlyRows] = await Promise.all([
          loadRankingRows(view, profile, user, toDateKey(getWeekStart(new Date())), nextSelectedGroupId, rankingType),
          loadRankingRows(view, profile, user, toDateKey(getMonthStart(new Date())), nextSelectedGroupId, rankingType),
        ])

        if (isMounted) {
          setMemberships(nextMemberships)
          setSelectedGroupId(nextSelectedGroupId)
          setWeeklyRows(nextWeeklyRows)
          setMonthlyRows(nextMonthlyRows)
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [profile, rankingType, selectedGroupId, user, userId, view])

  if (view === 'group' && isLoading) {
    return <div className="rounded-md border border-[#cfe5f2] bg-white p-5 text-center text-sm font-bold text-[#6b8090]">그룹을 불러오는 중입니다.</div>
  }

  return (
    <section className="grid gap-3">
      {view === 'group' &&
        <GroupListControl
          memberships={memberships}
          profile={profile}
          selectedGroupId={selectedGroupId}
          user={user}
          onChanged={refreshGroup}
          onSelect={setSelectedGroupId}
        />}
      {view === 'group' && memberships.length === 0 ? (
        <div className="rounded-md border border-[#cfe5f2] bg-white p-5 text-center text-sm font-bold text-[#6b8090]">
          그룹에 참가하면 그룹 랭킹을 볼 수 있습니다.
        </div>
      ) : (
        <>
          <RankingList
            isLoading={isLoading}
            periodLabel="주간 랭킹"
            rows={weeklyRows}
            type={rankingType}
            onTypeChange={setRankingType}
          />
          <RankingList
            isLoading={isLoading}
            periodLabel="월간 랭킹"
            rows={monthlyRows}
            type={rankingType}
            onTypeChange={setRankingType}
          />
        </>
      )}
    </section>
  )
}

function GroupListControl({
  memberships,
  onChanged,
  onSelect,
  profile,
  selectedGroupId,
  user,
}: {
  memberships: GroupMembership[]
  onChanged: () => Promise<void>
  onSelect: (groupId: string | null) => void
  profile: UserProfile
  selectedGroupId: string | null
  user: User
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [groupName, setGroupName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const selectedMembership = memberships.find((membership) => membership.group.id === selectedGroupId) ?? null

  async function createGroup() {
    const name = groupName.trim()
    if (!name) {
      setMessage('그룹 이름을 입력해주세요.')
      return
    }

    try {
      setIsSubmitting(true)
      const group = await createLocalGroup(user, profile, name)
      onSelect(group.id)
      setGroupName('')
      setMessage(`그룹 코드 ${group.inviteCode}가 생성되었습니다.`)
      await onChanged()
    } catch (error) {
      console.warn('Group creation failed.', error)
      setMessage(getGroupErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  async function joinGroup() {
    const code = inviteCode.trim().toUpperCase()
    if (code.length !== 6) {
      setMessage('6자리 그룹 코드를 입력해주세요.')
      return
    }

    try {
      setIsSubmitting(true)
      const group = await joinLocalGroup(user, profile, code)
      if (!group) {
        setMessage('일치하는 그룹 코드를 찾지 못했습니다.')
        return
      }

      onSelect(group.id)
      setInviteCode('')
      setMessage('그룹에 참가했습니다.')
      await onChanged()
    } catch (error) {
      console.warn('Group join failed.', error)
      setMessage(getGroupErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  async function leaveGroup(groupId: string, groupNameToLeave: string) {
    const confirmed = window.confirm(`${groupNameToLeave}에서 탈퇴할까요?`)
    if (!confirmed) {
      return
    }

    await leaveLocalGroup(user, groupId)
    setMessage('그룹에서 탈퇴했습니다.')
    await onChanged()
  }

  return (
    <section className="w-full max-w-[300px] justify-self-start">
      <button className="min-h-10 rounded-md bg-[#1b6f9f] px-4 text-sm font-black text-white shadow-sm" onClick={() => setIsOpen((current) => !current)} type="button">
        그룹 목록
      </button>

      {isOpen && (
        <div className="mt-2 grid gap-2 rounded-md border border-[#cfe5f2] bg-white p-3 shadow-sm">
          {memberships.length === 0 ? (
            <p className="rounded-md bg-[#f8fcff] p-3 text-sm font-bold text-[#6b8090]">참가한 그룹이 없습니다.</p>
          ) : (
            <div className="grid gap-2">
              {memberships.map((membership) => (
                <div
                  className={`rounded-md border p-2 ${
                    membership.group.id === selectedGroupId ? 'border-[#1b6f9f] bg-[#e6f6ff]' : 'border-[#cfe5f2] bg-[#f8fcff]'
                  }`}
                  key={membership.group.id}
                >
                  <button className="w-full text-left" onClick={() => onSelect(membership.group.id)} type="button">
                    <p className="truncate text-sm font-black text-[#1c2d38]">{membership.group.name}</p>
                    <p className="mt-1 text-xs font-bold text-[#6b8090]">
                      코드 {membership.group.inviteCode} · {membership.memberCount}명
                    </p>
                  </button>
                  <button
                    className="mt-2 rounded-md border border-[#ead0c7] bg-white px-2 py-1.5 text-xs font-black text-[#8b3a2c]"
                    onClick={() => leaveGroup(membership.group.id, membership.group.name)}
                    type="button"
                  >
                    탈퇴
                  </button>
                </div>
              ))}
            </div>
          )}

          {selectedMembership && (
            <p className="rounded-md bg-[#f4efe6] px-3 py-2 text-xs font-bold text-[#6b5540]">선택됨: {selectedMembership.group.name}</p>
          )}

          <div className="h-px bg-[#cfe5f2]" />

        <label className="grid gap-2 text-sm font-semibold text-[#1c2d38]">
          그룹 코드
          <input
            className="mobile-input uppercase"
            maxLength={6}
            onChange={(event) => {
              setInviteCode(event.target.value.toUpperCase())
              setMessage('')
            }}
            placeholder="ABC123"
            value={inviteCode}
          />
        </label>
        <button className="min-h-10 rounded-md bg-[#1b6f9f] px-3 text-sm font-black text-white disabled:opacity-60" disabled={isSubmitting} onClick={joinGroup} type="button">
          참가
        </button>

        <div className="h-px bg-[#cfe5f2]" />

        {memberships.length >= MAX_USER_GROUPS ? (
          <p className="rounded-md bg-[#f8fcff] p-3 text-sm font-bold text-[#6b8090]">그룹은 최대 {MAX_USER_GROUPS}개까지 가능합니다.</p>
        ) : (
          <>
        <label className="grid gap-2 text-sm font-semibold text-[#1c2d38]">
          새 그룹 이름
          <input
            className="mobile-input"
            onChange={(event) => {
              setGroupName(event.target.value)
              setMessage('')
            }}
            value={groupName}
          />
        </label>
        <button className="min-h-10 rounded-md border border-[#c7deeb] bg-white px-3 text-sm font-black text-[#1c2d38] disabled:opacity-60" disabled={isSubmitting} onClick={createGroup} type="button">
          새 그룹 만들기
        </button>
          </>
        )}

        {message && <p className="rounded-md bg-[#f4efe6] px-3 py-2 text-sm leading-6 text-[#6b5540]">{message}</p>}
      </div>
      )}
    </section>
  )
}

function RankingList({
  isLoading,
  onTypeChange,
  periodLabel,
  rows,
  type,
}: {
  isLoading: boolean
  onTypeChange: (type: 'hitRate' | 'total') => void
  periodLabel: string
  rows: RankingRow[]
  type: 'hitRate' | 'total'
}) {
  const rankedRows =
    type === 'hitRate'
      ? [...rows].sort((a, b) => b.hitRate - a.hitRate || b.totalShots - a.totalShots || b.totalHits - a.totalHits)
      : [...rows].sort((a, b) => b.totalShots - a.totalShots || b.totalHits - a.totalHits || b.hitRate - a.hitRate)

  return (
    <div className="rounded-md border border-[#cfe5f2] bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-base font-black text-[#1c2d38]">{periodLabel}</h3>
          <p className="mt-0.5 text-xs font-bold text-[#6b8090]">{type === 'hitRate' ? '명중률 랭킹' : '다사 랭킹'}</p>
        </div>
        <div className="grid grid-cols-2 rounded-md border border-[#c7deeb] bg-[#f8fcff] p-0.5">
          {[
            { label: '명중률', value: 'hitRate' },
            { label: '다사', value: 'total' },
          ].map((option) => (
            <button
              className={`min-h-8 rounded px-2 text-xs font-black transition ${
                type === option.value ? 'bg-[#1b6f9f] text-white shadow-sm' : 'text-[#486272]'
              }`}
              key={option.value}
              onClick={() => onTypeChange(option.value as 'hitRate' | 'total')}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      {isLoading ? (
        <div className="rounded-md bg-[#f8fcff] p-4 text-center text-sm font-bold text-[#6b8090]">랭킹을 불러오는 중입니다.</div>
      ) : rankedRows.length === 0 ? (
        <div className="rounded-md bg-[#f8fcff] p-4 text-center text-sm font-bold text-[#6b8090]">9순 이상 기록하면 랭킹이 표시됩니다.</div>
      ) : (
        <ol className="grid max-h-[34dvh] gap-2 overflow-y-auto pr-1">
          {rankedRows.slice(0, 10).map((row, index) => (
            <li key={`${type}-${row.userId}`} className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-2 rounded-md bg-[#f8fcff] px-3 py-3">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-white text-sm font-black text-black">{index + 1}</span>
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-[#1c2d38]">{formatRankingDisplay(row)}</p>
                <p className="text-xs font-semibold text-[#6b8090]">
                  {row.totalHits}중 / {formatRoundCount(row.totalShots)}
                </p>
              </div>
              <strong className="text-right text-sm font-black text-black">{type === 'hitRate' ? formatHitRate(row.hitRate) : formatRoundCount(row.totalShots)}</strong>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

async function loadRankingRows(
  view: 'overall' | 'range' | 'group',
  profile: UserProfile,
  user: User,
  startDateKey: string,
  selectedGroupId: string | null = null,
  rankingType: 'hitRate' | 'total' = 'hitRate',
): Promise<RankingRow[]> {
  const userId = user.uid
  if (view === 'group' && !selectedGroupId) {
    return []
  }

  if (view === 'group' && selectedGroupId) {
    const period = startDateKey === toDateKey(getMonthStart(new Date())) ? 'monthly' : 'weekly'
    try {
      return await loadApiGroupRankingRows(user, selectedGroupId, period, rankingType === 'total' ? 'total' : 'accuracy')
    } catch {
      // Fall back to the old local group cache if the API is unavailable.
    }
  }

  if (view !== 'group') {
    const period = startDateKey === toDateKey(getMonthStart(new Date())) ? 'monthly' : 'weekly'
    try {
      return await loadApiRankingRows(user, view, profile.rangeId, period, rankingType === 'total' ? 'total' : 'accuracy')
    } catch {
      // Keep the local summary cache useful while the development backend is unavailable.
    }
  }

  const [sessions, localProfiles] = await Promise.all([db.practiceSessions.toArray(), db.userProfiles.toArray()])
  const profileByUser = new Map(localProfiles.map((localProfile) => [localProfile.userId, localProfile]))
  const publicSessions = sessions.filter((session) => session.isRankingPublic !== false && session.practiceDate >= startDateKey)
  const groupMemberIds = view === 'group' ? await loadCurrentGroupMemberIds(userId, selectedGroupId) : null
  const scopedSessions =
    view === 'range'
      ? publicSessions.filter((session) => session.rangeId === profile.rangeId)
      : groupMemberIds
        ? publicSessions.filter((session) => groupMemberIds.has(session.userId))
        : publicSessions
  const rowByUser = new Map<string, RankingRow>()

  scopedSessions.forEach((session) => {
    const localProfile = profileByUser.get(session.userId)
    const existing = rowByUser.get(session.userId)

    if (existing) {
      existing.totalShots += session.totalShots
      existing.totalHits += session.totalHits
      existing.hitRate = existing.totalShots ? existing.totalHits / existing.totalShots : 0
      return
    }

    rowByUser.set(session.userId, {
      userId: session.userId,
      name: localProfile?.name ?? (session.userId === userId ? profile.name : '궁사'),
      rangeId: localProfile?.rangeId ?? session.rangeId,
      rangeName: localProfile?.rangeName ?? session.rangeName,
      totalShots: session.totalShots,
      totalHits: session.totalHits,
      hitRate: session.totalShots ? session.totalHits / session.totalShots : 0,
    })
  })

  return [...rowByUser.values()].filter((row) => row.totalShots >= MIN_RANKING_SHOTS)
}

async function loadGroupMemberships(user: User): Promise<GroupMembership[]> {
  try {
    const groups = await loadApiGroups(user)
    const now = new Date().toISOString()
    await replaceLocalGroupMembershipCache(user.uid, groups)
    return groups.map((group) => ({
      group: {
        id: String(group.id),
        name: group.name,
        inviteCode: group.inviteCode,
        ownerUserId: group.owner ? user.uid : '',
        createdAt: group.createdAt,
        updatedAt: now,
      },
      member: {
        groupId: String(group.id),
        userId: user.uid,
        name: '',
        rangeId: '',
        rangeName: '',
        isOwner: group.owner,
        joinedAt: group.createdAt,
      },
      memberCount: group.memberCount,
    }))
  } catch {
    return loadLocalGroupMemberships(user.uid)
  }
}

async function loadLocalGroupMemberships(userId: string): Promise<GroupMembership[]> {
  const members = await db.groupMembers.where('userId').equals(userId).toArray()
  const memberships = await Promise.all(
    members.map(async (member) => {
      const group = await db.groups.get(member.groupId)
      if (!group) {
        return null
      }

      const memberCount = await db.groupMembers.where('groupId').equals(group.id).count()
      return { group, member, memberCount }
    }),
  )

  return memberships
    .filter((membership): membership is GroupMembership => membership !== null)
    .sort((a, b) => a.group.createdAt.localeCompare(b.group.createdAt))
}

async function loadCurrentGroupMemberIds(userId: string, selectedGroupId: string | null) {
  const memberships = await loadLocalGroupMemberships(userId)
  const membership = memberships.find((item) => item.group.id === selectedGroupId) ?? memberships[0]
  if (!membership) {
    return new Set<string>()
  }

  const members = await db.groupMembers.where('groupId').equals(membership.group.id).toArray()
  return new Set(members.map((member) => member.userId))
}

async function createLocalGroup(user: User, _profile: UserProfile, name: string) {
  const group = await createApiGroup(user, name)
  await upsertLocalApiGroup(group, user.uid)
  return toLocalApiGroup(group, user.uid)
}

async function joinLocalGroup(user: User, _profile: UserProfile, inviteCode: string) {
  const group = await joinApiGroup(user, inviteCode)
  await upsertLocalApiGroup(group, user.uid)
  return toLocalApiGroup(group, user.uid)
}

async function leaveLocalGroup(user: User, groupId?: string) {
  if (groupId) {
    await leaveApiGroup(user, groupId)
    await removeLocalGroupMembership(user.uid, groupId)
    return
  }

  const userId = user.uid
  const memberships = (await db.groupMembers.where('userId').equals(userId).toArray()).filter((membership) => !groupId || membership.groupId === groupId)
  if (memberships.length === 0) {
    return
  }

  await db.transaction('rw', db.groups, db.groupMembers, async () => {
    for (const membership of memberships) {
      if (membership.id) {
        await db.groupMembers.delete(membership.id)
      }

      const remainingCount = await db.groupMembers.where('groupId').equals(membership.groupId).count()
      if (remainingCount === 0) {
        await db.groups.delete(membership.groupId)
      } else if (membership.isOwner) {
        const nextOwner = await db.groupMembers.where('groupId').equals(membership.groupId).first()
        if (nextOwner?.id) {
          await db.groupMembers.update(nextOwner.id, { isOwner: true })
          await db.groups.update(membership.groupId, {
            ownerUserId: nextOwner.userId,
            updatedAt: new Date().toISOString(),
          })
        }
      }
    }
  })
}

async function replaceLocalGroupMembershipCache(
  userId: string,
  groups: Array<{ id: string; name: string; inviteCode: string; owner: boolean; createdAt: string; memberCount: number }>,
) {
  const remoteGroupIds = new Set(groups.map((group) => String(group.id)))
  const localMemberships = await db.groupMembers.where('userId').equals(userId).toArray()

  await db.transaction('rw', db.groups, db.groupMembers, async () => {
    for (const membership of localMemberships) {
      if (!remoteGroupIds.has(membership.groupId) && membership.id) {
        await db.groupMembers.delete(membership.id)
      }
    }

    for (const group of groups) {
      await db.groups.put(toLocalApiGroup(group, userId))
      const existing = await db.groupMembers.where('[groupId+userId]').equals([String(group.id), userId]).first()
      const member = {
        groupId: String(group.id),
        userId,
        name: '',
        rangeId: '',
        rangeName: '',
        isOwner: group.owner,
        joinedAt: group.createdAt,
      }
      if (existing?.id) {
        await db.groupMembers.update(existing.id, member)
      } else {
        await db.groupMembers.add(member)
      }
    }
  })
}

async function upsertLocalApiGroup(group: { id: string; name: string; inviteCode: string; owner: boolean; createdAt: string }, userId: string) {
  await db.transaction('rw', db.groups, db.groupMembers, async () => {
    await db.groups.put(toLocalApiGroup(group, userId))
    const existing = await db.groupMembers.where('[groupId+userId]').equals([String(group.id), userId]).first()
    const member = {
      groupId: String(group.id),
      userId,
      name: '',
      rangeId: '',
      rangeName: '',
      isOwner: group.owner,
      joinedAt: group.createdAt,
    }
    if (existing?.id) {
      await db.groupMembers.update(existing.id, member)
    } else {
      await db.groupMembers.add(member)
    }
  })
}

async function removeLocalGroupMembership(userId: string, groupId: string) {
  await db.transaction('rw', db.groups, db.groupMembers, async () => {
    const memberships = await db.groupMembers.where('[groupId+userId]').equals([groupId, userId]).toArray()
    for (const membership of memberships) {
      if (membership.id) {
        await db.groupMembers.delete(membership.id)
      }
    }

    const remainingCount = await db.groupMembers.where('groupId').equals(groupId).count()
    if (remainingCount === 0) {
      await db.groups.delete(groupId)
    }
  })
}

function toLocalApiGroup(group: { id: string; name: string; inviteCode: string; owner: boolean; createdAt: string }, userId: string): LocalGroup {
  return {
    id: String(group.id),
    name: group.name,
    inviteCode: group.inviteCode,
    ownerUserId: group.owner ? userId : '',
    createdAt: group.createdAt,
    updatedAt: new Date().toISOString(),
  }
}

function getGroupErrorMessage(error: unknown) {
  if (error instanceof Error) {
    if (error.message === 'DUPLICATE_GROUP_NAME' || error.message.includes('Group name already exists.')) {
      return '이미 사용 중인 그룹명입니다. 다른 이름을 입력해주세요.'
    }
    if (error.message === 'GROUP_LIMIT' || error.message.includes('User group limit reached.')) {
      return `그룹은 최대 ${MAX_USER_GROUPS}개까지 가능합니다.`
    }
    if (error.message === 'GROUP_MEMBER_LIMIT' || error.message.includes('Group member limit reached.')) {
      return '이 그룹은 정원이 가득 찼습니다.'
    }
    if (error.message.includes('Invite code not found.')) {
      return '일치하는 그룹 코드를 찾지 못했습니다.'
    }
    if (error.message.includes('Already joined.')) {
      return '이미 참가한 그룹입니다.'
    }
    if (error.message.includes('Complete onboarding first.')) {
      return '서버 프로필이 아직 준비되지 않았습니다. 프로필을 저장한 뒤 다시 시도해주세요.'
    }
    if (error.message.includes('Invalid Firebase ID token') || error.message.includes('Unauthorized')) {
      return '로그인 인증을 확인하지 못했습니다. 다시 로그인한 뒤 시도해주세요.'
    }
  }

  return '그룹 처리 중 문제가 생겼습니다.'
}

function formatHitRate(value: number) {
  return `${Math.round(value * 100)}%`
}

function AiPage() {
  return (
    <>
      <PageHeader {...pageSummaries.ai} />
      <section className="app-card p-5 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-md bg-[#e6f6ff] text-black">
          <Target aria-hidden="true" size={24} />
        </div>
        <h2 className="text-lg font-bold">추후 업데이트 예정입니다</h2>
        <p className="mt-2 text-sm leading-6 text-[#6b8090]">현재는 기록, 분석, 랭킹 기능을 우선 안정화하고 있습니다.</p>
      </section>
    </>
  )
}

function SettingsPage() {
  const { profile, user } = useAuth()
  const { settingsView } = useHomeHeader()

  if (settingsView === 'profile') {
    return (
      <section className="app-card p-4">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[#e6f6ff] text-black">
            <UserRound aria-hidden="true" size={21} />
          </div>
          <div>
            <h2 className="text-base font-bold">프로필 관리</h2>
            <p className="mt-1 text-sm leading-6 text-[#6b8090]">최초 입력한 기본 정보를 수정할 수 있습니다.</p>
          </div>
        </div>
        <ProfileForm
          buttonLabel="프로필 저장"
          showName={false}
          showRecordMode={false}
          onSaved={() => user && void mergeApiPracticeSummaries(user)}
          initialValues={{
            name: profile?.name ?? user?.displayName ?? '',
            rangeId: profile?.rangeId ?? '',
            grade: profile?.grade ?? '',
            bowHand: profile?.bowHand ?? '',
            defaultRecordMode: profile?.defaultRecordMode ?? '',
          }}
        />
      </section>
    )
  }

  if (settingsView === 'records') {
    return user ? <RecordsManagementPanel user={user} /> : null
  }

  return profile && user ? <PreferencesPanel profile={profile} userId={user.uid} /> : null
}

function PreferencesPanel({ profile, userId }: { profile: UserProfile; userId: string }) {
  const { saveProfile } = useAuth()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [defaultRecordMode, setDefaultRecordMode] = useState<RecordMode>(profile.defaultRecordMode)
  const [isRankingPublic, setIsRankingPublic] = useState(profile.isRankingPublic)
  const [message, setMessage] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  async function savePreferences() {
    setIsSaving(true)
    setMessage('')
    try {
      await saveProfile({
        ...profile,
        defaultRecordMode,
        isRankingPublic,
      })
      await db.practiceSessions.where('userId').equals(userId).modify({ isRankingPublic })
      setMessage('환경 설정을 저장했습니다. 기록 화면에 바로 반영됩니다.')
    } catch (error) {
      console.warn('Preference save failed.', error)
      setMessage('환경 설정을 저장하지 못했습니다. 로그인 상태와 네트워크를 확인해주세요.')
    } finally {
      setIsSaving(false)
    }
  }

  async function exportBackup() {
    const sessions = await db.practiceSessions.where('userId').equals(userId).toArray()
    const localSessionDetails = await db.localSessionDetails.where('userId').equals(userId).toArray()
    const details = await db.shotDetails.where('userId').equals(userId).toArray()
    const backup = {
      app: 'B-log',
      version: 1,
      exportedAt: new Date().toISOString(),
      serverSummaryCache: sessions,
      localSessionDetails,
      shotDetails: details,
    }
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `b-log-backup-${toDateKey(new Date())}.json`
    link.click()
    URL.revokeObjectURL(url)
    setMessage('백업 파일을 만들었습니다.')
  }

  async function importBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) {
      return
    }

    try {
      const parsed = JSON.parse(await file.text()) as {
        serverSummaryCache?: PracticeSession[]
        practiceSessions?: PracticeSession[]
        localSessionDetails?: LocalSessionDetail[]
        shotDetails?: ShotDetail[]
      }
      const summaries = parsed.serverSummaryCache ?? parsed.practiceSessions ?? []
      const localSessionDetails = parsed.localSessionDetails ?? []
      const shotDetails = parsed.shotDetails ?? []

      if (!Array.isArray(summaries) || !Array.isArray(localSessionDetails) || !Array.isArray(shotDetails)) {
        setMessage('백업 파일 형식이 올바르지 않습니다.')
        return
      }

      const confirmed = window.confirm('현재 기기의 내 기록을 백업 파일 기록으로 교체할까요?')
      if (!confirmed) {
        return
      }

      await restoreUserRecords(userId, summaries, localSessionDetails, shotDetails)
      setMessage('로컬 상세 기록을 가져왔습니다.')
    } catch {
      setMessage('백업 파일을 읽지 못했습니다.')
    }
  }

  return (
    <div className="grid gap-3">
      <section className="app-card p-4">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[#e6f6ff] text-black">
            <Settings aria-hidden="true" size={21} />
          </div>
          <div>
            <h2 className="text-base font-bold">환경 설정</h2>
            <p className="mt-1 text-sm leading-6 text-[#6b8090]">기록 방식과 랭킹 공개 여부를 설정합니다.</p>
          </div>
        </div>

        <div className="grid gap-4">
          <fieldset className="grid gap-2">
            <legend className="text-sm font-semibold text-[#1c2d38]">기본 기록 방식</legend>
            <div className="grid grid-cols-2 gap-2 rounded-lg border border-[#c7deeb] bg-[#f8fcff] p-1">
              {recordModeOptions.map((option) => (
                <button
                  className={`min-h-11 rounded-md text-sm font-bold transition ${
                    defaultRecordMode === option.value ? 'bg-[#1b6f9f] text-white shadow-sm' : 'text-[#486272]'
                  }`}
                  key={option.value}
                  onClick={() => {
                    setDefaultRecordMode(option.value)
                    setMessage('')
                  }}
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </fieldset>

          <label className="flex items-center justify-between gap-3 rounded-md border border-[#cfe5f2] bg-[#f8fcff] p-3">
            <span>
              <span className="block text-sm font-bold text-[#1c2d38]">랭킹 공개</span>
              <span className="mt-1 block text-xs font-medium text-[#6b8090]">비공개 시 서버 랭킹 동기화 단계에서 제외할 예정입니다.</span>
            </span>
            <input
              checked={isRankingPublic}
              className="h-5 w-5 accent-[#1b6f9f]"
              onChange={(event) => {
                setIsRankingPublic(event.target.checked)
                setMessage('')
              }}
              type="checkbox"
            />
          </label>

          {message && <p className="rounded-md bg-[#f4efe6] px-3 py-2 text-sm leading-6 text-[#6b5540]">{message}</p>}

          <button className="mobile-button bg-[#1b6f9f] text-white disabled:opacity-60" disabled={isSaving} onClick={savePreferences} type="button">
            {isSaving ? '저장 중' : '설정 저장'}
          </button>
        </div>
      </section>

      <section className="app-card p-4">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[#e6f6ff] text-black">
            <Database aria-hidden="true" size={21} />
          </div>
          <div>
            <h2 className="text-base font-bold">백업 및 가져오기</h2>
            <p className="mt-1 text-sm leading-6 text-[#6b8090]">메모와 탄착군 등 로컬 상세 데이터를 JSON 파일로 관리합니다.</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button className="mobile-button border border-[#c7deeb] bg-white text-[#1c2d38]" onClick={exportBackup} type="button">
            백업
          </button>
          <button className="mobile-button bg-[#1b6f9f] text-white" onClick={() => fileInputRef.current?.click()} type="button">
            가져오기
          </button>
        </div>
        <input accept="application/json" className="hidden" onChange={importBackup} ref={fileInputRef} type="file" />
      </section>
    </div>
  )
}

async function restoreUserRecords(userId: string, summaries: PracticeSession[], localSessionDetails: LocalSessionDetail[], details: ShotDetail[]) {
  const currentSessions = await db.practiceSessions.where('userId').equals(userId).toArray()
  const currentSessionIds = currentSessions.map((session) => session.id).filter((id): id is number => typeof id === 'number')
  const sessionIdMap = new Map<number, number>()
  const now = new Date().toISOString()

  await db.transaction('rw', db.practiceSessions, db.localSessionDetails, db.shotDetails, async () => {
    await db.localSessionDetails.where('userId').equals(userId).delete()
    await Promise.all(currentSessionIds.map((sessionId) => db.shotDetails.where('sessionId').equals(sessionId).delete()))
    await db.practiceSessions.where('userId').equals(userId).delete()

    for (const [index, session] of summaries.entries()) {
      const oldId = typeof session.id === 'number' ? session.id : index
      const sessionData = withoutId(session)
      const newId = await db.practiceSessions.add({
        ...sessionData,
        userId,
        isRankingPublic: session.isRankingPublic ?? true,
        createdAt: session.createdAt ?? now,
        updatedAt: now,
      })

      if (typeof newId === 'number') {
        sessionIdMap.set(oldId, newId)
      }
    }

    const localDetailsForRestore: Array<Omit<LocalSessionDetail, 'id'>> = []
    if (localSessionDetails.length > 0) {
      localSessionDetails.forEach((detail) => {
        localDetailsForRestore.push(withoutId(detail))
      })
    } else {
      summaries.forEach((summary, index) => {
        const note = (summary as PracticeSession & { note?: string }).note
        if (!note) {
          return
        }

        localDetailsForRestore.push({
          sessionId: typeof summary.id === 'number' ? summary.id : index,
          userId,
          note,
          createdAt: summary.createdAt ?? now,
          updatedAt: summary.updatedAt ?? now,
        })
      })
    }

    const restoredLocalDetails = localDetailsForRestore
      .map((detail) => {
        const newSessionId = sessionIdMap.get(detail.sessionId)
        if (!newSessionId) {
          return null
        }

        return {
          ...detail,
          sessionId: newSessionId,
          userId,
          createdAt: detail.createdAt ?? now,
          updatedAt: now,
        }
      })
      .filter((detail): detail is Omit<LocalSessionDetail, 'id'> => detail !== null)

    if (restoredLocalDetails.length > 0) {
      await db.localSessionDetails.bulkAdd(restoredLocalDetails)
    }

    const restoredDetails = details
      .map((detail) => {
        const newSessionId = sessionIdMap.get(detail.sessionId)
        if (!newSessionId) {
          return null
        }

        const detailData = withoutId(detail)
        return {
          ...detailData,
          sessionId: newSessionId,
          userId,
          createdAt: detail.createdAt ?? now,
        }
      })
      .filter((detail): detail is Omit<ShotDetail, 'id'> => detail !== null)

    if (restoredDetails.length > 0) {
      await db.shotDetails.bulkAdd(restoredDetails)
    }
  })
}

function withoutId<T extends { id?: number }>(item: T) {
  const { id, ...rest } = item
  void id
  return rest
}

function RecordsManagementPanel({ user }: { user: User }) {
  const userId = user.uid
  const [records, setRecords] = useState<EditablePracticeRecord[]>([])
  const [selectedYear, setSelectedYear] = useState('')
  const [selectedMonth, setSelectedMonth] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<RecordEditForm>({ totalShots: '', totalHits: '', note: '' })
  const [message, setMessage] = useState('')

  useEffect(() => {
    let isMounted = true

    loadEditableRecords(userId)
      .then((nextRecords) => {
        if (isMounted) {
          setRecords(nextRecords)
          const latestRecord = nextRecords[0]
          if (latestRecord) {
            setSelectedYear((current) => current || latestRecord.practiceDate.slice(0, 4))
            setSelectedMonth((current) => current || latestRecord.practiceDate.slice(5, 7))
          }
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [userId])

  const yearOptions = useMemo(() => [...new Set(records.map((record) => record.practiceDate.slice(0, 4)))], [records])
  const monthOptions = useMemo(
    () =>
      [
        ...new Set(
          records
            .filter((record) => !selectedYear || record.practiceDate.startsWith(`${selectedYear}-`))
            .map((record) => record.practiceDate.slice(5, 7)),
        ),
      ].sort((a, b) => Number(b) - Number(a)),
    [records, selectedYear],
  )
  const effectiveSelectedMonth = selectedMonth && monthOptions.includes(selectedMonth) ? selectedMonth : (monthOptions[0] ?? '')
  const filteredRecords = useMemo(
    () =>
      records.filter((record) => {
        const recordYear = record.practiceDate.slice(0, 4)
        const recordMonth = record.practiceDate.slice(5, 7)

        return (!selectedYear || recordYear === selectedYear) && (!effectiveSelectedMonth || recordMonth === effectiveSelectedMonth)
      }),
    [effectiveSelectedMonth, records, selectedYear],
  )

  function startEdit(record: EditablePracticeRecord) {
    if (typeof record.id !== 'number') {
      return
    }

    setMessage('')
    setEditingId(record.id)
    setEditForm({
      totalShots: roundInputValue(record.totalShots),
      totalHits: String(record.totalHits),
      note: record.note ?? '',
    })
  }

  function cancelEdit() {
    setEditingId(null)
    setEditForm({ totalShots: '', totalHits: '', note: '' })
    setMessage('')
  }

  async function saveRecord(record: EditablePracticeRecord) {
    if (typeof record.id !== 'number') {
      return
    }

    const now = new Date().toISOString()
    const note = editForm.note.trim() || undefined

    const totalRounds = Number(editForm.totalShots)
    const totalShots = totalRounds * SHOTS_PER_ROUND
    const totalHits = Number(editForm.totalHits)

    if (!Number.isFinite(totalRounds) || totalRounds <= 0 || totalRounds > MAX_DAILY_ROUNDS) {
      setMessage(`순은 1순 이상 ${MAX_DAILY_ROUNDS}순 이하로 입력해주세요.`)
      return
    }

    if (!Number.isFinite(totalHits) || totalHits < 0 || totalHits > totalShots) {
      setMessage('관중 수는 0 이상, 입력한 순의 총 화살 수 이하로 입력해주세요.')
      return
    }

    const updatedSummary = {
      ...record,
      totalShots,
      totalHits,
      updatedAt: now,
    }
    if (record.serverId && record.clientSessionId) {
      try {
        await updateApiPracticeSummary(user, {
          ...updatedSummary,
          serverId: record.serverId,
          clientSessionId: record.clientSessionId,
        })
      } catch {
        setMessage('서버 요약 기록을 수정하지 못했습니다.')
        return
      }
    }

    await db.practiceSessions.update(record.id, {
      totalShots,
      totalHits,
      updatedAt: now,
    })
    await upsertLocalSessionDetail(record.id, userId, note, now)

    setRecords((current) =>
      current.map((item) =>
        item.id === record.id
          ? {
              ...item,
              totalShots,
              totalHits,
              note,
              updatedAt: now,
            }
          : item,
      ),
    )
    setEditingId(null)
    setMessage('기록을 수정했습니다.')
  }

  async function deleteRecord(record: EditablePracticeRecord) {
    if (typeof record.id !== 'number') {
      return
    }

    const confirmed = window.confirm(`${formatDateTimeLabel(record.practicedAt)} 기록을 삭제할까요?`)
    if (!confirmed) {
      return
    }

    if (record.serverId) {
      try {
        await deleteApiPracticeSummary(user, record.serverId)
      } catch {
        setMessage('서버 요약 기록을 삭제하지 못했습니다.')
        return
      }
    }

    await db.transaction('rw', db.practiceSessions, db.localSessionDetails, db.shotDetails, async () => {
      await db.localSessionDetails.where('sessionId').equals(record.id as number).delete()
      await db.shotDetails.where('sessionId').equals(record.id as number).delete()
      await db.practiceSessions.delete(record.id as number)
    })

    setRecords((current) => current.filter((item) => item.id !== record.id))
    setEditingId(null)
    setMessage('기록을 삭제했습니다.')
  }

  return (
    <section className="app-card p-4">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[#e6f6ff] text-black">
          <ClipboardList aria-hidden="true" size={21} />
        </div>
        <div>
          <h2 className="text-base font-bold">기록 수정</h2>
          <p className="mt-1 text-sm leading-6 text-[#6b8090]">과거 기록을 수정하거나 삭제합니다.</p>
        </div>
      </div>

      {message && <p className="mb-3 rounded-md bg-[#f4efe6] px-3 py-2 text-sm leading-6 text-[#6b5540]">{message}</p>}

      {isLoading ? (
        <p className="rounded-md bg-[#f8fcff] p-4 text-sm font-bold text-[#6b8090]">기록을 불러오는 중입니다.</p>
      ) : records.length === 0 ? (
        <p className="rounded-md border border-dashed border-[#c7deeb] bg-[#f8fcff] p-4 text-sm text-[#6b8090]">아직 저장된 기록이 없습니다.</p>
      ) : (
        <div className="grid gap-3">
          <div className="grid grid-cols-[1fr_1fr_auto] items-center gap-2 rounded-md border border-[#c7deeb] bg-[#f8fcff] p-2">
            <select
              className="h-9 min-w-0 rounded-md border border-[#c7deeb] bg-white px-2 text-sm font-bold text-[#1c2d38] outline-none"
              onChange={(event) => {
                setSelectedYear(event.target.value)
                setEditingId(null)
              }}
              value={selectedYear}
            >
              {yearOptions.map((year) => (
                <option key={year} value={year}>
                  {year}년
                </option>
              ))}
            </select>
            <select
              className="h-9 min-w-0 rounded-md border border-[#c7deeb] bg-white px-2 text-sm font-bold text-[#1c2d38] outline-none"
              onChange={(event) => {
                setSelectedMonth(event.target.value)
                setEditingId(null)
              }}
              value={effectiveSelectedMonth}
            >
              {monthOptions.map((month) => (
                <option key={month} value={month}>
                  {Number(month)}월
                </option>
              ))}
            </select>
            <span className="whitespace-nowrap px-1 text-xs font-black text-black">{filteredRecords.length}건</span>
          </div>

          {filteredRecords.length === 0 ? (
            <p className="rounded-md border border-dashed border-[#c7deeb] bg-[#f8fcff] p-4 text-sm text-[#6b8090]">선택한 월에는 기록이 없습니다.</p>
          ) : (
            <div className="grid max-h-[52dvh] gap-3 overflow-y-auto pr-1">
              {filteredRecords.map((record) => {
            const isEditing = editingId === record.id

            return (
              <article
                className={`rounded-md border p-3 transition ${isEditing ? 'border-[#1b6f9f] bg-white' : 'border-[#cfe5f2] bg-[#f8fcff] active:border-[#1b6f9f]'}`}
                key={record.id}
              >
                <button className="flex w-full items-start justify-between gap-3 text-left" onClick={() => startEdit(record)} type="button">
                  <div className="min-w-0">
                    <p className="text-sm font-black text-[#1c2d38]">{formatDateTimeLabel(record.practicedAt)}</p>
                    <p className="mt-1 truncate text-xs font-semibold text-[#6b8090]">{record.rangeName}</p>
                  </div>
                  <span className="rounded-md bg-white px-2 py-1 text-xs font-black text-black">
                    {record.totalHits}중 / {formatRoundCount(record.totalShots)}
                  </span>
                </button>

                {isEditing ? (
                  <div className="mt-3 grid gap-2">
                    <div className="grid grid-cols-2 gap-2">
                      <label className="grid gap-1 text-xs font-bold text-[#1c2d38]">
                        순
                        <input
                          className="mobile-input"
                          inputMode="numeric"
                          max={MAX_DAILY_ROUNDS}
                          min={1}
                          onChange={(event) => setEditForm((current) => ({ ...current, totalShots: event.target.value }))}
                          type="number"
                          value={editForm.totalShots}
                        />
                      </label>
                      <label className="grid gap-1 text-xs font-bold text-[#1c2d38]">
                        관중 수
                        <input
                          className="mobile-input"
                          inputMode="numeric"
                          max={MAX_DAILY_ROUNDS * SHOTS_PER_ROUND}
                          min={0}
                          onChange={(event) => setEditForm((current) => ({ ...current, totalHits: event.target.value }))}
                          type="number"
                          value={editForm.totalHits}
                        />
                      </label>
                    </div>
                    {record.mode === 'detail' && (
                      <p className="text-xs font-medium text-[#8a938c]">탄착 좌표는 유지하고 랭킹/로그에 쓰이는 순과 관중 수만 수정합니다.</p>
                    )}
                    <label className="grid gap-1 text-xs font-bold text-[#1c2d38]">
                      메모
                      <input
                        className="mobile-input"
                        onChange={(event) => setEditForm((current) => ({ ...current, note: event.target.value }))}
                        placeholder="메모 없음"
                        value={editForm.note}
                      />
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button className="mobile-button bg-[#1b6f9f] text-white" onClick={() => saveRecord(record)} type="button">
                        <Save aria-hidden="true" className="mr-2" size={16} />
                        저장
                      </button>
                      <button className="mobile-button border border-[#c7deeb] bg-white text-[#1c2d38]" onClick={cancelEdit} type="button">
                        <X aria-hidden="true" className="mr-2" size={16} />
                        취소
                      </button>
                    </div>
                    <button className="mobile-button border border-[#ead0c7] bg-white text-[#8b3a2c]" onClick={() => deleteRecord(record)} type="button">
                      <Trash2 aria-hidden="true" className="mr-2" size={16} />
                      기록 삭제
                    </button>
                  </div>
                ) : (
                  record.note && <p className="mt-3 rounded-md bg-white px-3 py-2 text-sm leading-6 text-[#486272]">{record.note}</p>
                )}
              </article>
            )
              })}
            </div>
          )}
        </div>
      )}
    </section>
  )
}

async function loadEditableRecords(userId: string): Promise<EditablePracticeRecord[]> {
  const [summaries, details] = await Promise.all([
    db.practiceSessions.where('userId').equals(userId).toArray(),
    db.localSessionDetails.where('userId').equals(userId).toArray(),
  ])
  const detailBySessionId = new Map(details.map((detail) => [detail.sessionId, detail]))
  return summaries
    .map((summary) => ({
      ...summary,
      note: (typeof summary.id === 'number' ? detailBySessionId.get(summary.id)?.note : undefined) ?? (summary as PracticeSession & { note?: string }).note,
    }))
    .sort((a, b) => b.practicedAt.localeCompare(a.practicedAt))
}

async function upsertLocalSessionDetail(sessionId: number, userId: string, note: string | undefined, updatedAt: string) {
  const existing = await db.localSessionDetails.where('sessionId').equals(sessionId).first()
  if (!note) {
    if (existing?.id) {
      await db.localSessionDetails.delete(existing.id)
    }
    return
  }

  if (existing?.id) {
    await db.localSessionDetails.update(existing.id, {
      note,
      updatedAt,
    })
    return
  }

  await db.localSessionDetails.add({
    sessionId,
    userId,
    note,
    createdAt: updatedAt,
    updatedAt,
  })
}

function formatDateTimeLabel(value: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export default App


