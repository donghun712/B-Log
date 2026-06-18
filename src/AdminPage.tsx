import type { ReactNode } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  Database,
  LayoutDashboard,
  LoaderCircle,
  Search,
  Shield,
  UserRound,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut, type User } from 'firebase/auth'
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
  type DocumentData,
} from 'firebase/firestore'
import { domesticArcheryRanges, type ArcheryRange } from './data/archeryRanges'
import { createKakaoProvider, firebaseAuth, firebaseDb, googleProvider, isFirebaseConfigured } from './lib/firebase'

const SHOTS_PER_ROUND = 5
const operatorPhone = '010-9145-4181'
const operatorEmail = import.meta.env.VITE_OPERATOR_EMAIL ?? 'nkehdgns@naver.com'
const adminAuthRedirectKey = 'b-log:admin-auth-redirect'

type AdminRole = 'SUPER_ADMIN' | 'RANGE_ADMIN'

type AdminAccount = {
  role: AdminRole
  rangeId: string | null
  rangeName: string | null
  active: boolean
}

type AdminTab = 'overview' | 'range' | 'permissions'

type UserProfileRow = {
  userId: string
  email: string
  name: string
  rangeId: string
  rangeName: string
  grade: string
  disabled: boolean
}

type PracticeSummaryRow = {
  id: string
  userId: string
  rangeId: string
  rangeName: string
  practiceDate: string
  practicedAt: string
  totalShots: number
  totalHits: number
}

type AdminRequestRow = {
  userId: string
  name: string
  rangeName: string
  position: string
  contact: string
  status: 'PENDING' | 'REJECTED'
  createdAt: string
}

type RangeStats = {
  members: number
  practiceSummaries: number
  totalShots: number
  totalHits: number
  hitRate: number
}

export default function AdminPage() {
  const [user, setUser] = useState<User | null>(null)
  const [adminAccount, setAdminAccount] = useState<AdminAccount | null>(null)
  const [isLoading, setIsLoading] = useState(() => Boolean(firebaseAuth))
  const [message, setMessage] = useState(() =>
    new URLSearchParams(window.location.search).has('kakaoError')
      ? '카카오 로그인을 완료하지 못했습니다. 다시 시도해주세요.'
      : '',
  )
  const [loginProvider, setLoginProvider] = useState<'google' | 'kakao' | null>(null)

  useAdminBackButtonExitGuard()

  useEffect(() => {
    if (!firebaseAuth) {
      return
    }

    const unsubscribe = onAuthStateChanged(firebaseAuth, async (nextUser) => {
      setUser(nextUser)
      setMessage('')
      if (!nextUser) {
        setAdminAccount(null)
        setIsLoading(false)
        return
      }

      try {
        setAdminAccount(await loadAdminAccount(nextUser.uid))
      } catch (error) {
        console.warn('Admin account load failed.', error)
        setAdminAccount(null)
        setMessage('운영자 권한을 확인하지 못했습니다. 잠시 후 다시 시도해주세요.')
      } finally {
        setIsLoading(false)
      }
    })

    return unsubscribe
  }, [])

  async function handleGoogleLogin() {
    if (!firebaseAuth || !isFirebaseConfigured) {
      setMessage('Firebase 설정을 확인할 수 없습니다.')
      return
    }

    setMessage('')
    setLoginProvider('google')
    window.sessionStorage.setItem(adminAuthRedirectKey, '1')
    googleProvider.setCustomParameters({ prompt: 'select_account' })

    try {
      await signInWithPopup(firebaseAuth, googleProvider)
    } catch (error) {
      const code = getFirebaseErrorCode(error)
      if (code === 'auth/popup-blocked' || code === 'auth/cancelled-popup-request') {
        await signInWithRedirect(firebaseAuth, googleProvider)
        return
      }

      window.sessionStorage.removeItem(adminAuthRedirectKey)
      setMessage(getAdminLoginErrorMessage(error))
    } finally {
      setLoginProvider(null)
    }
  }

  async function handleKakaoLogin() {
    if (!firebaseAuth || !isFirebaseConfigured) {
      setMessage('Firebase 설정을 확인할 수 없습니다.')
      return
    }

    setMessage('')
    setLoginProvider('kakao')

    try {
      const kakaoProvider = createKakaoProvider()
      try {
        await signInWithPopup(firebaseAuth, kakaoProvider)
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
    } catch (error) {
      window.sessionStorage.removeItem(adminAuthRedirectKey)
      setMessage(getAdminLoginErrorMessage(error))
      setLoginProvider(null)
    }
  }

  async function handleLogout() {
    if (!firebaseAuth) {
      return
    }

    await signOut(firebaseAuth)
    setAdminAccount(null)
  }

  if (isLoading) {
    return <AdminShell><LoadingPanel /></AdminShell>
  }

  if (!user) {
    return (
      <AdminShell>
        <AdminLoginPanel
          loginProvider={loginProvider}
          message={message}
          onGoogleLogin={() => void handleGoogleLogin()}
          onKakaoLogin={() => void handleKakaoLogin()}
        />
      </AdminShell>
    )
  }

  if (!adminAccount?.active) {
    return (
      <AdminShell>
        <AccessGuide onLogout={() => void handleLogout()} user={user} />
        {message && <p className="rounded-md bg-[#f4efe6] px-3 py-2 text-sm font-bold leading-6 text-[#6b5540]">{message}</p>}
      </AdminShell>
    )
  }

  return (
    <AdminDashboard
      account={adminAccount}
      user={user}
    />
  )
}

function useAdminBackButtonExitGuard() {
  const isConfirmingRef = useRef(false)
  const isRestoringGuardRef = useRef(false)
  const hasPushedGuardRef = useRef(false)

  useEffect(() => {
    const guardState = {
      ...(typeof window.history.state === 'object' && window.history.state !== null ? window.history.state : {}),
      bLogAdminExitGuard: true,
    }

    if (!hasPushedGuardRef.current && !window.history.state?.bLogAdminExitGuard) {
      window.history.pushState(guardState, '', window.location.href)
      hasPushedGuardRef.current = true
      return
    }

    window.history.replaceState(guardState, '', window.location.href)
    hasPushedGuardRef.current = true
  }, [])

  useEffect(() => {
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
  }, [])
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

function AdminLoginPanel({
  loginProvider,
  message,
  onGoogleLogin,
  onKakaoLogin,
}: {
  loginProvider: 'google' | 'kakao' | null
  message: string
  onGoogleLogin: () => void
  onKakaoLogin: () => void
}) {
  const isSubmitting = loginProvider !== null

  return (
    <section className="app-card grid gap-4 border-[#cfe5f2] bg-white/95 p-4 shadow-[0_8px_24px_rgba(51,124,164,0.08)]">
      <div className="flex items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-[#e8f4fb] text-[#2f8fc7]">
          <Shield aria-hidden="true" size={22} />
        </div>
        <div>
          <h2 className="text-lg font-black text-[#102a3a]">관리자 로그인</h2>
          <p className="mt-2 text-sm font-medium leading-6 text-[#526b7a]">
            일반 로그인과 같은 계정으로 로그인한 뒤 관리자 권한을 확인합니다
          </p>
        </div>
      </div>

      <div className="grid gap-3">
        <button
          className="mobile-button gap-3 border-2 border-[#b7d8ea] bg-white text-[#1c2d38] shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isSubmitting}
          onClick={onGoogleLogin}
          type="button"
        >
          {loginProvider === 'google' ? (
            <>
              <LoaderCircle aria-hidden="true" className="mr-2 animate-spin" size={17} />
              Google 로그인 중
            </>
          ) : (
            <>
              <span className="grid h-8 w-8 place-items-center">
                <img alt="" aria-hidden="true" className="h-5 w-5 object-contain" src="/google.png" />
              </span>
              <span className="min-w-[106px] text-left">Google로 로그인</span>
            </>
          )}
        </button>
        <button
          className="mobile-button gap-3 border-2 border-[#d7c83a] bg-[#f6e843] text-[#201b00] shadow-[0_3px_10px_rgba(184,165,25,0.16)] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isSubmitting}
          onClick={onKakaoLogin}
          type="button"
        >
          {loginProvider === 'kakao' ? (
            <>
              <LoaderCircle aria-hidden="true" className="mr-2 animate-spin" size={17} />
              Kakao 로그인 중
            </>
          ) : (
            <>
              <span className="grid h-8 w-8 place-items-center">
                <img alt="" aria-hidden="true" className="h-6 w-6 object-contain" src="/kakao.png" />
              </span>
              <span className="min-w-[106px] text-left">Kakao로 로그인</span>
            </>
          )}
        </button>
      </div>

      {message && <p className="rounded-md bg-[#e8f4fb] px-3 py-2 text-sm font-bold leading-6 text-[#315b72]">{message}</p>}
    </section>
  )
}

function AdminDashboard({ account, user }: { account: AdminAccount; user: User }) {
  const [activeTab, setActiveTab] = useState<AdminTab>(account.role === 'SUPER_ADMIN' ? 'overview' : 'range')
  const tabs = account.role === 'SUPER_ADMIN'
    ? [
        { label: '전체', value: 'overview' as const, icon: LayoutDashboard },
        { label: '활터', value: 'range' as const, icon: Database },
        { label: '권한', value: 'permissions' as const, icon: Shield },
      ]
    : [{ label: '활터', value: 'range' as const, icon: Database }]

  return (
    <AdminShell subtitle={account.role === 'SUPER_ADMIN' ? '최고 관리자' : account.rangeName ?? '활터 관리자'}>
      <nav className="grid grid-cols-3 gap-2 rounded-lg border border-[#d9d4c8] bg-white p-1">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.value
          return (
            <button
              className={`mobile-button min-h-11 gap-1 px-2 text-xs ${isActive ? 'bg-[#254336] text-white' : 'bg-transparent text-[#38423c]'}`}
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              type="button"
            >
              <Icon aria-hidden="true" size={15} />
              {tab.label}
            </button>
          )
        })}
      </nav>

      {activeTab === 'overview' && account.role === 'SUPER_ADMIN' && <OverviewPanel />}
      {activeTab === 'range' && <RangePanel account={account} currentUser={user} />}
      {activeTab === 'permissions' && account.role === 'SUPER_ADMIN' && <PermissionPanel currentUser={user} />}
    </AdminShell>
  )
}

function AccessGuide({ onLogout, user }: { onLogout: () => void; user: User }) {
  const [copyMessage, setCopyMessage] = useState('')
  const [hasPendingRequest, setHasPendingRequest] = useState(false)
  const [form, setForm] = useState({
    name: user.displayName ?? '',
    rangeName: '',
    position: '',
    contact: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    let ignore = false

    async function loadPendingRequest() {
      try {
        const snapshot = await getDoc(doc(requireFirestore(), 'adminRequests', user.uid))
        if (ignore || !snapshot.exists()) {
          return
        }

        const data = snapshot.data()
        setHasPendingRequest(data.status !== 'REJECTED')
        setForm({
          name: readString(data.name, user.displayName ?? ''),
          rangeName: readString(data.rangeName),
          position: readString(data.position),
          contact: readString(data.contact),
        })
      } catch (error) {
        console.warn('Admin request load failed.', error)
      }
    }

    void loadPendingRequest()

    return () => {
      ignore = true
    }
  }, [user.displayName, user.uid])

  async function submitRequest() {
    if (hasPendingRequest) {
      setCopyMessage('요청이 보내졌습니다.')
      return
    }

    const name = form.name.trim()
    const rangeName = form.rangeName.trim()
    const position = form.position.trim()
    const contact = form.contact.trim()
    if (!name || !rangeName || !position || !contact) {
      setCopyMessage('성함, 소속 활터, 직책, 연락처를 모두 입력해주세요.')
      return
    }

    setIsSubmitting(true)
    setCopyMessage('')
    try {
      const now = new Date().toISOString()
      await setDoc(
        doc(requireFirestore(), 'adminRequests', user.uid),
        {
          userId: user.uid,
          name,
          rangeName,
          position,
          contact,
          status: 'PENDING',
          createdAt: now,
          updatedAt: now,
        },
        { merge: true },
      )
      setHasPendingRequest(true)
      setCopyMessage('요청이 보내졌습니다.')
    } catch (error) {
      console.warn('Admin request failed.', error)
      setCopyMessage('승인 요청을 저장하지 못했습니다. 잠시 후 다시 시도해주세요.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="app-card grid gap-4 p-4">
      <div className="flex items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-[#edf4ef] text-[#254336]">
          <Shield aria-hidden="true" size={22} />
        </div>
        <div>
          <h2 className="text-lg font-black text-[#1e2521]">운영자 권한이 없습니다</h2>
          <p className="mt-2 text-sm font-medium leading-6 text-[#667069]">
            관리자 권한은 실제 활터 관계자 확인 후 승인됩니다. 아래 정보를 남기면 최고 관리자가 확인 후 권한을 부여합니다.
          </p>
        </div>
      </div>

      <div className="grid gap-2">
        <label className="grid gap-1 text-xs font-black text-[#38423c]">
          로그인 UID
          <input className="mobile-input bg-[#faf9f5] text-sm" readOnly value={user.uid} />
        </label>
        <label className="grid gap-1 text-xs font-black text-[#38423c]">
          성함
          <input
            className="mobile-input"
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            placeholder="본명"
            value={form.name}
          />
        </label>
        <label className="grid gap-1 text-xs font-black text-[#38423c]">
          소속 활터
          <input
            className="mobile-input"
            onChange={(event) => setForm((current) => ({ ...current, rangeName: event.target.value }))}
            placeholder="예: 전주 전북대학교"
            value={form.rangeName}
          />
        </label>
        <label className="grid gap-1 text-xs font-black text-[#38423c]">
          직책
          <input
            className="mobile-input"
            onChange={(event) => setForm((current) => ({ ...current, position: event.target.value }))}
            placeholder="예: 사두, 사범, 총무"
            value={form.position}
          />
        </label>
        <label className="grid gap-1 text-xs font-black text-[#38423c]">
          확인을 위한 연락처
          <input
            className="mobile-input"
            onChange={(event) => setForm((current) => ({ ...current, contact: event.target.value }))}
            placeholder="전화번호, 카카오톡 ID, 이메일 등"
            value={form.contact}
          />
        </label>
      </div>

      <button
        className="mobile-button bg-[#254336] text-white disabled:opacity-60"
        disabled={isSubmitting || hasPendingRequest}
        onClick={() => void submitRequest()}
        type="button"
      >
        {hasPendingRequest ? '승인 대기중' : isSubmitting ? '요청 저장 중' : '운영자 승인 요청'}
      </button>

      <div className="rounded-md bg-[#f4efe6] px-3 py-2 text-sm font-bold leading-6 text-[#6b5540]">
        <p>추가 확인을 위해 운영자가 아래 연락처 또는 이메일로 연락을 드릴 수 있습니다.</p>
        <p className="mt-2">{operatorPhone}</p>
        <p>{operatorEmail}</p>
      </div>

      <button className="mobile-button border border-[#d9d4c8] bg-white text-[#254336]" onClick={onLogout} type="button">
        다른 계정으로 로그인
      </button>

      {copyMessage && <p className="rounded-md bg-[#edf4ef] px-3 py-2 text-sm font-black text-[#254336]">{copyMessage}</p>}
    </section>
  )
}

function OverviewPanel() {
  const [stats, setStats] = useState<RangeStats & { ranges: number; groups: number; admins: number } | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let ignore = false
    async function load() {
      setIsLoading(true)
      const [profiles, summaries, groups, accounts] = await Promise.all([
        loadProfiles(),
        loadPracticeSummaries(),
        loadGroups(),
        loadAdminAccounts(),
      ])
      if (ignore) {
        return
      }

      const totals = aggregateSummaries(summaries)
      setStats({
        ...totals,
        members: profiles.length,
        ranges: domesticArcheryRanges.length,
        groups,
        admins: accounts.length,
      })
      setIsLoading(false)
    }

    void load()
    return () => {
      ignore = true
    }
  }, [])

  if (isLoading) {
    return <LoadingPanel />
  }

  return (
    <section className="grid grid-cols-2 gap-2">
      <AdminMetric label="회원" value={`${stats?.members ?? 0}`} />
      <AdminMetric label="기록" value={`${stats?.practiceSummaries ?? 0}`} />
      <AdminMetric label="활터" value={`${stats?.ranges ?? 0}`} />
      <AdminMetric label="그룹" value={`${stats?.groups ?? 0}`} />
      <AdminMetric label="총 기록 순" value={formatRoundCount(stats?.totalShots ?? 0)} />
      <AdminMetric label="관리자 수" value={`${stats?.admins ?? 0}`} />
    </section>
  )
}

function RangePanel({ account, currentUser }: { account: AdminAccount; currentUser: User }) {
  const [rangeQuery, setRangeQuery] = useState('')
  const [selectedRangeId, setSelectedRangeId] = useState(account.role === 'RANGE_ADMIN' ? account.rangeId ?? '' : '')
  const [memberQuery, setMemberQuery] = useState('')
  const [members, setMembers] = useState<UserProfileRow[]>([])
  const [summaries, setSummaries] = useState<PracticeSummaryRow[]>([])
  const [selectedMember, setSelectedMember] = useState<UserProfileRow | null>(null)
  const [memberSummaries, setMemberSummaries] = useState<PracticeSummaryRow[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const rangeOptions = useMemo(() => {
    const queryText = rangeQuery.trim().toLowerCase()
    return domesticArcheryRanges
      .filter((range) => {
        if (account.role === 'RANGE_ADMIN') {
          return range.id === account.rangeId
        }
        if (!queryText) {
          return true
        }
        return [range.region, range.name, range.address].join(' ').toLowerCase().includes(queryText)
      })
      .slice(0, 80)
  }, [account.rangeId, account.role, rangeQuery])
  const selectedRange = domesticArcheryRanges.find((range) => range.id === selectedRangeId) ?? null
  const filteredMembers = members.filter((member) => {
    const queryText = memberQuery.trim().toLowerCase()
    if (!queryText) {
      return true
    }
    return [member.name, member.email, member.grade].join(' ').toLowerCase().includes(queryText)
  })
  const stats = aggregateSummaries(summaries)

  useEffect(() => {
    if (!selectedRangeId) {
      return
    }

    let ignore = false
    async function load() {
      setIsLoading(true)
      const [profiles, rangeSummaries] = await Promise.all([
        loadProfiles(selectedRangeId),
        loadPracticeSummaries(selectedRangeId),
      ])
      if (ignore) {
        return
      }

      setMembers(profiles)
      setSummaries(rangeSummaries)
      setSelectedMember(null)
      setMemberSummaries([])
      setIsLoading(false)
    }

    void load()
    return () => {
      ignore = true
    }
  }, [selectedRangeId])

  async function selectMember(member: UserProfileRow) {
    setSelectedMember(member)
    setMemberSummaries((await loadPracticeSummaries(selectedRangeId, member.userId)).sort((a, b) => b.practicedAt.localeCompare(a.practicedAt)))
  }

  async function toggleUserDisabled(member: UserProfileRow) {
    if (member.userId === currentUser.uid) {
      return
    }

    const nextDisabled = !member.disabled
    const now = new Date().toISOString()
    await setDoc(
      doc(requireFirestore(), 'profiles', member.userId),
      {
        disabled: nextDisabled,
        disabledAt: nextDisabled ? now : null,
        disabledBy: nextDisabled ? currentUser.uid : null,
        updatedAt: now,
      },
      { merge: true },
    )
    setMembers((current) => current.map((item) => (item.userId === member.userId ? { ...item, disabled: nextDisabled } : item)))
    setSelectedMember((current) => (current?.userId === member.userId ? { ...current, disabled: nextDisabled } : current))
  }

  return (
    <section className="grid gap-3">
      <section className="app-card p-4">
        <div className="mb-3 flex items-center gap-3">
          <Database aria-hidden="true" className="text-[#254336]" size={22} />
          <div>
            <h2 className="text-base font-black">활터 조회</h2>
            <p className="text-xs font-bold text-[#667069]">
              {account.role === 'RANGE_ADMIN' ? '승인된 활터만 조회할 수 있습니다.' : '최고 관리자는 전체 활터를 조회할 수 있습니다.'}
            </p>
          </div>
        </div>

        {account.role === 'SUPER_ADMIN' && (
          <input
            className="mobile-input mb-2"
            onChange={(event) => setRangeQuery(event.target.value)}
            placeholder="활터 검색"
            value={rangeQuery}
          />
        )}
        <select className="mobile-input w-full" onChange={(event) => setSelectedRangeId(event.target.value)} value={selectedRangeId}>
          <option value="">활터 선택</option>
          {rangeOptions.map((range) => (
            <option key={range.id} value={range.id}>
              {formatRangeLabel(range)}
            </option>
          ))}
        </select>
      </section>

      {selectedRange && (
        <>
          <section className="grid grid-cols-2 gap-2">
            <AdminMetric label="회원" value={`${members.length}`} />
            <AdminMetric label="기록" value={`${stats.practiceSummaries}`} />
            <AdminMetric label="순" value={formatRoundCount(stats.totalShots)} />
            <AdminMetric label="관중률" value={`${Math.round(stats.hitRate * 100)}%`} />
          </section>

          <section className="grid gap-3 md:grid-cols-2">
            <section className="app-card min-h-[320px] p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-black">{formatRangeLabel(selectedRange)}</h2>
                  <p className="text-xs font-bold text-[#667069]">소속 회원</p>
                </div>
                {isLoading && <LoaderCircle aria-hidden="true" className="animate-spin text-[#254336]" size={20} />}
              </div>
              <div className="mb-3 flex items-center gap-2">
                <Search aria-hidden="true" className="text-[#667069]" size={17} />
                <input
                  className="mobile-input min-h-10 flex-1"
                  onChange={(event) => setMemberQuery(event.target.value)}
                  placeholder="회원 검색"
                  value={memberQuery}
                />
              </div>
              <div className="grid max-h-[42dvh] gap-2 overflow-y-auto pr-1">
                {filteredMembers.length === 0 ? (
                  <p className="rounded-md bg-[#faf9f5] p-4 text-center text-sm font-bold text-[#667069]">회원이 없습니다.</p>
                ) : (
                  filteredMembers.map((member) => (
                    <article
                      className={`rounded-md border p-3 ${selectedMember?.userId === member.userId ? 'border-[#254336] bg-[#edf4ef]' : 'border-[#e5ddcf] bg-[#faf9f5]'}`}
                      key={member.userId}
                    >
                      <button className="w-full text-left" onClick={() => void selectMember(member)} type="button">
                        <p className="text-sm font-black text-[#27352f]">{member.name}</p>
                        <p className="mt-1 text-xs font-bold text-[#667069]">{member.grade || '등급 없음'} · {member.email || '이메일 없음'}</p>
                        {member.disabled && <p className="mt-1 text-xs font-black text-[#8b3a2c]">비활성화됨</p>}
                      </button>
                      {account.role === 'SUPER_ADMIN' && (
                        <button
                          className={`mobile-button mt-3 min-h-9 w-full text-xs ${
                            member.disabled ? 'bg-[#254336] text-white' : 'border border-[#ead0c7] bg-white text-[#8b3a2c]'
                          }`}
                          disabled={member.userId === currentUser.uid}
                          onClick={() => void toggleUserDisabled(member)}
                          type="button"
                        >
                          {member.disabled ? '활성화' : '비활성화'}
                        </button>
                      )}
                    </article>
                  ))
                )}
              </div>
            </section>

            <section className="app-card min-h-[320px] p-4">
              <div className="mb-3 flex items-center gap-3">
                <UserRound aria-hidden="true" className="text-[#254336]" size={22} />
                <div>
                  <h2 className="text-base font-black">회원 기록</h2>
                  <p className="text-xs font-bold text-[#667069]">{selectedMember ? `${selectedMember.name}님의 요약 기록` : '회원을 선택해주세요.'}</p>
                </div>
              </div>
              <div className="grid max-h-[42dvh] gap-2 overflow-y-auto pr-1">
                {memberSummaries.length === 0 ? (
                  <p className="rounded-md bg-[#faf9f5] p-4 text-center text-sm font-bold text-[#667069]">표시할 기록이 없습니다.</p>
                ) : (
                  memberSummaries.map((summary) => (
                    <article className="rounded-md border border-[#e5ddcf] bg-[#faf9f5] p-3" key={summary.id}>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-black text-[#27352f]">{formatDateTimeLabel(summary.practicedAt)}</p>
                        <p className="rounded-md bg-white px-2 py-1 text-xs font-black text-[#254336]">
                          {summary.totalHits}중 / {formatRoundCount(summary.totalShots)}
                        </p>
                      </div>
                      <p className="mt-1 text-xs font-bold text-[#667069]">{summary.rangeName}</p>
                    </article>
                  ))
                )}
              </div>
            </section>
          </section>
        </>
      )}
    </section>
  )
}

function PermissionPanel({ currentUser }: { currentUser: User }) {
  const [profiles, setProfiles] = useState<UserProfileRow[]>([])
  const [accounts, setAccounts] = useState<Array<AdminAccount & { userId: string }>>([])
  const [requests, setRequests] = useState<AdminRequestRow[]>([])
  const [requestRangeByUserId, setRequestRangeByUserId] = useState<Record<string, string>>({})
  const [queryText, setQueryText] = useState('')
  const [selectedUserId, setSelectedUserId] = useState('')
  const [selectedRangeId, setSelectedRangeId] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    let ignore = false
    async function load() {
      const [nextProfiles, nextAccounts, nextRequests] = await Promise.all([loadProfiles(), loadAdminAccounts(), loadAdminRequests()])
      if (ignore) {
        return
      }
      setProfiles(nextProfiles)
      setAccounts(nextAccounts)
      setRequests(nextRequests)
      setRequestRangeByUserId((current) => {
        const next = { ...current }
        nextRequests.forEach((request) => {
          if (!next[request.userId]) {
            const range = findRangeByName(request.rangeName)
            if (range) {
              next[request.userId] = range.id
            }
          }
        })
        return next
      })
    }

    void load()
    return () => {
      ignore = true
    }
  }, [])

  const filteredProfiles = profiles
    .filter((profile) => {
      const value = queryText.trim().toLowerCase()
      if (!value) {
        return true
      }
      return [profile.name, profile.email, profile.rangeName, profile.userId].join(' ').toLowerCase().includes(value)
    })
    .slice(0, 50)

  const pendingRequests = requests.filter((request) => request.status === 'PENDING')

  async function grantRangeAdmin() {
    const profile = profiles.find((item) => item.userId === selectedUserId)
    const range = domesticArcheryRanges.find((item) => item.id === selectedRangeId)
    if (!profile || !range) {
      setMessage('사용자와 활터를 선택해주세요.')
      return
    }

    await setDoc(doc(requireFirestore(), 'adminAccounts', profile.userId), {
      role: 'RANGE_ADMIN',
      rangeId: range.id,
      rangeName: range.name,
      active: true,
      approvedBy: currentUser.uid,
      approvedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    setAccounts(await loadAdminAccounts())
    setSelectedUserId('')
    setSelectedRangeId('')
    setMessage(`${profile.name}님에게 ${range.name} 운영자 권한을 부여했습니다.`)
  }

  async function approveRequest(request: AdminRequestRow) {
    const rangeId = requestRangeByUserId[request.userId]
    const range = domesticArcheryRanges.find((item) => item.id === rangeId)
    if (!range) {
      setMessage('승인할 활터를 선택해주세요.')
      return
    }

    const now = new Date().toISOString()
    await setDoc(doc(requireFirestore(), 'adminAccounts', request.userId), {
      role: 'RANGE_ADMIN',
      rangeId: range.id,
      rangeName: range.name,
      active: true,
      approvedBy: currentUser.uid,
      approvedAt: now,
      updatedAt: now,
      requestName: request.name,
      requestContact: request.contact,
      requestPosition: request.position,
    })
    await deleteDoc(doc(requireFirestore(), 'adminRequests', request.userId))
    const [nextAccounts, nextRequests] = await Promise.all([loadAdminAccounts(), loadAdminRequests()])
    setAccounts(nextAccounts)
    setRequests(nextRequests)
    setMessage(`${request.name}님에게 ${range.name} 운영자 권한을 부여했습니다.`)
  }

  async function rejectRequest(request: AdminRequestRow) {
    await deleteDoc(doc(requireFirestore(), 'adminRequests', request.userId))
    setRequests(await loadAdminRequests())
    setMessage('승인 요청을 삭제했습니다.')
  }

  async function revoke(account: AdminAccount & { userId: string }) {
    await deleteDoc(doc(requireFirestore(), 'adminAccounts', account.userId))
    setAccounts(await loadAdminAccounts())
    setMessage('운영자 권한을 해제했습니다.')
  }

  return (
    <section className="grid gap-3">
      {message && <p className="rounded-md bg-[#f4efe6] px-3 py-2 text-sm font-bold leading-6 text-[#6b5540]">{message}</p>}
      <section className="app-card grid gap-3 p-4">
        <div>
          <h2 className="text-base font-black">승인 대기</h2>
          <p className="mt-1 text-xs font-bold text-[#667069]">운영자 권한을 요청한 계정을 확인하고 활터를 지정해 승인합니다.</p>
        </div>
        {pendingRequests.length === 0 ? (
          <p className="rounded-md bg-[#faf9f5] p-4 text-center text-sm font-bold text-[#667069]">대기 중인 승인 요청이 없습니다.</p>
        ) : (
          <div className="grid gap-2">
            {pendingRequests.map((request) => (
              <article className="grid gap-3 rounded-md border border-[#e5ddcf] bg-[#faf9f5] p-3" key={request.userId}>
                <div>
                  <p className="text-sm font-black text-[#27352f]">{request.name}</p>
                  <p className="mt-1 text-xs font-bold leading-5 text-[#667069]">UID: {request.userId}</p>
                  <p className="text-xs font-bold leading-5 text-[#667069]">소속 활터: {request.rangeName}</p>
                  <p className="text-xs font-bold leading-5 text-[#667069]">직책: {request.position}</p>
                  <p className="text-xs font-bold leading-5 text-[#667069]">연락처: {request.contact}</p>
                </div>
                <select
                  className="mobile-input w-full"
                  onChange={(event) => setRequestRangeByUserId((current) => ({ ...current, [request.userId]: event.target.value }))}
                  value={requestRangeByUserId[request.userId] ?? ''}
                >
                  <option value="">승인할 활터 선택</option>
                  {domesticArcheryRanges.map((range) => (
                    <option key={range.id} value={range.id}>
                      {formatRangeLabel(range)}
                    </option>
                  ))}
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    className="mobile-button bg-[#254336] text-white disabled:opacity-60"
                    disabled={!requestRangeByUserId[request.userId]}
                    onClick={() => void approveRequest(request)}
                    type="button"
                  >
                    승인
                  </button>
                  <button className="mobile-button border border-[#ead0c7] bg-white text-[#8b3a2c]" onClick={() => void rejectRequest(request)} type="button">
                    삭제
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      <section className="app-card grid gap-3 p-4">
        <div>
          <h2 className="text-base font-black">운영자 권한 부여</h2>
          <p className="mt-1 text-xs font-bold text-[#667069]">메일로 신분 확인을 마친 사용자에게 활터 운영자 권한을 부여합니다.</p>
        </div>
        <input className="mobile-input" onChange={(event) => setQueryText(event.target.value)} placeholder="이름, 이메일, UID 검색" value={queryText} />
        <select className="mobile-input w-full" onChange={(event) => setSelectedUserId(event.target.value)} value={selectedUserId}>
          <option value="">사용자 선택</option>
          {filteredProfiles.map((profile) => (
            <option key={profile.userId} value={profile.userId}>
              {profile.name} · {profile.email || profile.userId}
            </option>
          ))}
        </select>
        <select className="mobile-input w-full" onChange={(event) => setSelectedRangeId(event.target.value)} value={selectedRangeId}>
          <option value="">활터 선택</option>
          {domesticArcheryRanges.map((range) => (
            <option key={range.id} value={range.id}>
              {formatRangeLabel(range)}
            </option>
          ))}
        </select>
        <button className="mobile-button bg-[#254336] text-white disabled:opacity-60" disabled={!selectedUserId || !selectedRangeId} onClick={() => void grantRangeAdmin()} type="button">
          운영자 권한 부여
        </button>
      </section>

      <section className="app-card p-4">
        <h2 className="mb-3 text-base font-black">운영자 목록</h2>
        <div className="grid gap-2">
          {accounts.length === 0 ? (
            <p className="rounded-md bg-[#faf9f5] p-4 text-center text-sm font-bold text-[#667069]">등록된 운영자가 없습니다.</p>
          ) : (
            accounts.map((account) => (
              <article className="rounded-md border border-[#e5ddcf] bg-[#faf9f5] p-3" key={account.userId}>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-black text-[#27352f]">{account.role}</p>
                    <p className="mt-1 text-xs font-bold text-[#667069]">{account.rangeName ?? account.userId}</p>
                  </div>
                  {account.role !== 'SUPER_ADMIN' && (
                    <button className="mobile-button min-h-10 border border-[#ead0c7] bg-white px-3 text-xs text-[#8b3a2c]" onClick={() => void revoke(account)} type="button">
                      해제
                    </button>
                  )}
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </section>
  )
}

function AdminShell({ children, subtitle = '운영자 페이지' }: { children: ReactNode; subtitle?: string }) {
  return (
    <main className="mobile-screen bg-[#eef8ff] text-[#1c2d38]">
      <section className="mx-auto flex min-h-dvh w-full max-w-[860px] flex-col gap-3 px-4 pb-[calc(28px+env(safe-area-inset-bottom))] pt-[calc(18px+env(safe-area-inset-top))]">
        <header className="flex items-center justify-between gap-3">
          <div>
            <Link className="mb-3 inline-flex items-center gap-1 text-xs font-black text-[#638296]" to="/">
              <ArrowLeft aria-hidden="true" size={15} />
              로그인 화면
            </Link>
            <h1 className="text-2xl font-black text-[#102a3a]">운영자</h1>
            <p className="mt-1 text-sm font-medium text-[#526b7a]">{subtitle}</p>
          </div>
        </header>
        {children}
      </section>
    </main>
  )
}

function LoadingPanel() {
  return (
    <section className="app-card grid place-items-center p-8">
      <LoaderCircle aria-hidden="true" className="animate-spin text-[#254336]" size={28} />
    </section>
  )
}

function AdminMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[#e4ded3] bg-white p-3">
      <p className="text-xs font-black text-[#667069]">{label}</p>
      <p className="mt-1 text-lg font-black text-[#1e2521]">{value}</p>
    </div>
  )
}

async function loadAdminAccount(userId: string): Promise<AdminAccount | null> {
  const snapshot = await getDoc(doc(requireFirestore(), 'adminAccounts', userId))
  if (!snapshot.exists()) {
    return null
  }

  const data = snapshot.data()
  return {
    role: data.role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'RANGE_ADMIN',
    rangeId: typeof data.rangeId === 'string' ? data.rangeId : null,
    rangeName: typeof data.rangeName === 'string' ? data.rangeName : null,
    active: data.active !== false,
  }
}

async function loadAdminAccounts() {
  const snapshot = await getDocs(collection(requireFirestore(), 'adminAccounts'))
  return snapshot.docs.map((item) => {
    const data = item.data()
    return {
      userId: item.id,
      role: data.role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' as const : 'RANGE_ADMIN' as const,
      rangeId: typeof data.rangeId === 'string' ? data.rangeId : null,
      rangeName: typeof data.rangeName === 'string' ? data.rangeName : null,
      active: data.active !== false,
    }
  })
}

async function loadAdminRequests() {
  const snapshot = await getDocs(collection(requireFirestore(), 'adminRequests'))
  return snapshot.docs
    .map((item) => {
      const data = item.data()
      return {
        userId: readString(data.userId, item.id),
        name: readString(data.name),
        rangeName: readString(data.rangeName),
        position: readString(data.position),
        contact: readString(data.contact),
        status: data.status === 'REJECTED' ? 'REJECTED' as const : 'PENDING' as const,
        createdAt: readString(data.createdAt),
      }
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

async function loadProfiles(rangeId?: string) {
  const firestore = requireFirestore()
  const snapshot = await getDocs(rangeId ? query(collection(firestore, 'profiles'), where('rangeId', '==', rangeId)) : collection(firestore, 'profiles'))
  return snapshot.docs.map((item) => mapProfile(item.id, item.data())).sort((a, b) => a.name.localeCompare(b.name, 'ko-KR'))
}

async function loadPracticeSummaries(rangeId?: string, userId?: string) {
  const firestore = requireFirestore()
  const constraints = []
  if (rangeId) {
    constraints.push(where('rangeId', '==', rangeId))
  }
  if (userId) {
    constraints.push(where('userId', '==', userId))
  }
  const snapshot = await getDocs(constraints.length ? query(collection(firestore, 'practiceSummaries'), ...constraints) : collection(firestore, 'practiceSummaries'))
  return snapshot.docs.map((item) => mapSummary(item.id, item.data()))
}

async function loadGroups() {
  return (await getDocs(collection(requireFirestore(), 'groups'))).size
}

function aggregateSummaries(summaries: PracticeSummaryRow[]) {
  const totalShots = summaries.reduce((sum, summary) => sum + summary.totalShots, 0)
  const totalHits = summaries.reduce((sum, summary) => sum + summary.totalHits, 0)
  return {
    members: 0,
    practiceSummaries: summaries.length,
    totalShots,
    totalHits,
    hitRate: totalShots ? totalHits / totalShots : 0,
  }
}

function mapProfile(userId: string, data: DocumentData): UserProfileRow {
  return {
    userId,
    email: readString(data.email),
    name: readString(data.name, '이름 없음'),
    rangeId: readString(data.rangeId),
    rangeName: readString(data.rangeName),
    grade: readString(data.grade),
    disabled: data.disabled === true,
  }
}

function mapSummary(id: string, data: DocumentData): PracticeSummaryRow {
  return {
    id,
    userId: readString(data.userId),
    rangeId: readString(data.rangeId),
    rangeName: readString(data.rangeName),
    practiceDate: readString(data.practiceDate),
    practicedAt: readString(data.practicedAt),
    totalShots: readNumber(data.totalShots),
    totalHits: readNumber(data.totalHits),
  }
}

function formatRangeLabel(range: ArcheryRange) {
  return `${getShortAreaName(range)} / ${range.name}`
}

function findRangeByName(value: string) {
  const normalized = normalizeText(value)
  if (!normalized) {
    return null
  }

  return domesticArcheryRanges.find((range) => {
    const candidates = [
      range.name,
      formatRangeLabel(range),
      `${getShortAreaName(range)} ${range.name}`,
      `${range.region} ${range.address} ${range.name}`,
    ]

    return candidates.some((candidate) => {
      const normalizedCandidate = normalizeText(candidate)
      return normalizedCandidate.includes(normalized) || normalized.includes(normalizedCandidate)
    })
  }) ?? null
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, '').toLowerCase()
}

function getShortAreaName(range: ArcheryRange) {
  if (range.region.endsWith('광역시')) {
    return range.region.replace('광역시', '')
  }
  if (range.region === '서울특별시') {
    return '서울'
  }
  if (range.region === '세종특별자치시') {
    return '세종'
  }
  const firstToken = range.address.split(' ')[0] ?? ''
  const match = firstToken.match(/.+?(시|군|구)/)
  return (match?.[0] ?? firstToken ?? range.region).replace(/시$/, '')
}

function formatRoundCount(totalShots: number) {
  const rounds = totalShots / SHOTS_PER_ROUND
  return Number.isInteger(rounds) ? `${rounds}순` : `${rounds.toFixed(1)}순`
}

function formatDateTimeLabel(value: string) {
  if (!value) {
    return '-'
  }
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

function getFirebaseErrorCode(error: unknown) {
  if (typeof error === 'object' && error && 'code' in error && typeof error.code === 'string') {
    return error.code
  }

  return ''
}

function getAdminLoginErrorMessage(error: unknown) {
  const code = getFirebaseErrorCode(error)
  const message = error instanceof Error ? error.message : ''
  if (message.includes('redirect_uri_mismatch')) {
    return '로그인 Redirect URI가 맞지 않습니다. Firebase authDomain과 제공자 콘솔의 승인된 리디렉션 URI를 확인해주세요.'
  }
  if (code === 'auth/popup-closed-by-user') {
    return '로그인이 취소되었습니다.'
  }
  if (code === 'auth/unauthorized-domain') {
    return '현재 주소가 Firebase 승인 도메인에 등록되어 있는지 확인해주세요.'
  }
  if (code === 'auth/operation-not-allowed') {
    return 'Firebase Authentication에서 Kakao OIDC 제공자가 아직 사용 설정되지 않았습니다.'
  }
  if (code === 'auth/network-request-failed') {
    return '네트워크 요청이 실패했습니다. 인터넷 연결이나 브라우저 차단 설정을 확인해주세요.'
  }
  if (code === 'auth/internal-error') {
    return '로그인 요청을 완료하지 못했습니다. 브라우저 팝업 또는 네트워크 차단 설정을 확인해주세요.'
  }

  if (message) {
    return `관리자 로그인 오류: ${message}`
  }

  return '관리자 로그인을 완료하지 못했습니다. 다시 시도해주세요.'
}

function requireFirestore() {
  if (!firebaseDb) {
    throw new Error('Firebase Firestore 설정이 필요합니다.')
  }
  return firebaseDb
}

function readString(value: unknown, fallback = '') {
  return typeof value === 'string' && value ? value : fallback
}

function readNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}
