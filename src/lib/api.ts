import type { User } from 'firebase/auth'
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
  type DocumentData,
  type Firestore,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import type { PracticeSession } from './db'
import { firebaseDb } from './firebase'

export type ApiProfile = {
  name: string
  rangeId: string
  rangeName: string
  grade: string
  bowHand: 'left' | 'right'
  defaultRecordMode: 'simple' | 'detail'
  isRankingPublic: boolean
  disabled?: boolean
}

export type ApiPracticeSummary = Omit<PracticeSession, 'id' | 'serverId'> & {
  id: string
  serverId: string
  clientSessionId: string
}

export type ApiRankingRow = {
  rank: number
  userId: string
  name: string
  rangeId: string
  rangeName: string
  totalShots: number
  totalHits: number
  hitRate: number
}

export type ApiGroup = {
  id: string
  name: string
  inviteCode: string
  owner: boolean
  memberCount: number
  createdAt: string
}

type GroupMemberDocument = {
  userId: string
  name: string
  rangeId: string
  rangeName: string
  isOwner: boolean
  joinedAt: string
}

type RankingScope = {
  period: 'weekly' | 'monthly'
  type: 'accuracy' | 'total'
  rangeId?: string
  memberIds?: Set<string>
}

type RankingAccumulator = Omit<ApiRankingRow, 'rank'> & {
  fallbackName: string
  fallbackRangeId: string
  fallbackRangeName: string
}

const minRankingShots = 45
const maxUserGroups = 3
const maxGroupMembers = 50

export async function loadApiProfile(user: User) {
  return readApiProfile(ensureFirestore(), user.uid)
}

export async function saveApiProfile(user: User, profile: ApiProfile) {
  const firestore = ensureFirestore()
  const now = new Date().toISOString()
  const profilePayload = { ...profile }
  delete profilePayload.disabled

  await setDoc(
    doc(firestore, 'profiles', user.uid),
    {
      ...profilePayload,
      userId: user.uid,
      email: user.email ?? '',
      updatedAt: now,
      updatedAtServer: serverTimestamp(),
      createdAtServer: serverTimestamp(),
    },
    { merge: true },
  )

  return profile
}

export async function loadApiPracticeSummaries(user: User) {
  const firestore = ensureFirestore()
  const summaries = await getDocs(query(collection(firestore, 'practiceSummaries'), where('userId', '==', user.uid)))

  return summaries.docs
    .map(mapPracticeSummary)
    .sort((a, b) => b.practicedAt.localeCompare(a.practicedAt))
}

export async function createApiPracticeSummary(user: User, summary: PracticeSession & { clientSessionId: string }) {
  const firestore = ensureFirestore()
  const profile = await readApiProfile(firestore, user.uid)
  const summaryRef = doc(firestore, 'practiceSummaries', summary.clientSessionId)
  const now = new Date().toISOString()
  const payload = toSummaryPayload(user, summary, profile, now)

  await setDoc(
    summaryRef,
    {
      ...payload,
      createdAt: summary.createdAt || now,
      createdAtServer: serverTimestamp(),
      updatedAtServer: serverTimestamp(),
    },
    { merge: true },
  )

  return { ...payload, id: summaryRef.id, createdAt: summary.createdAt || now, updatedAt: now }
}

export async function updateApiPracticeSummary(user: User, summary: PracticeSession & { serverId: string; clientSessionId: string }) {
  const firestore = ensureFirestore()
  const summaryRef = doc(firestore, 'practiceSummaries', summary.serverId)
  const current = await getDoc(summaryRef)

  if (!current.exists() || current.data().userId !== user.uid) {
    throw new Error('Practice summary not found.')
  }

  const profile = await readApiProfile(firestore, user.uid)
  const now = new Date().toISOString()
  const payload = toSummaryPayload(user, summary, profile, now)

  await setDoc(
    summaryRef,
    {
      ...payload,
      updatedAtServer: serverTimestamp(),
    },
    { merge: true },
  )

  return { ...payload, id: summaryRef.id, createdAt: readString(current.data().createdAt, now), updatedAt: now }
}

export async function deleteApiPracticeSummary(user: User, serverId: string) {
  const firestore = ensureFirestore()
  const summaryRef = doc(firestore, 'practiceSummaries', serverId)
  const current = await getDoc(summaryRef)

  if (!current.exists()) {
    return
  }

  if (current.data().userId !== user.uid) {
    throw new Error('Practice summary not found.')
  }

  await deleteDoc(summaryRef)
}

export async function loadApiRankingRows(
  _user: User,
  view: 'overall' | 'range',
  rangeId: string,
  period: 'weekly' | 'monthly',
  type: 'accuracy' | 'total',
) {
  return buildRankingRows(ensureFirestore(), {
    period,
    type,
    rangeId: view === 'range' ? rangeId : undefined,
  })
}

export async function loadApiGroupRankingRows(
  _user: User,
  groupId: string,
  period: 'weekly' | 'monthly',
  type: 'accuracy' | 'total',
) {
  const firestore = ensureFirestore()
  const members = await getDocs(collection(firestore, 'groups', groupId, 'members'))
  const memberIds = new Set(members.docs.map((member) => readString(member.data().userId, member.id)))

  if (memberIds.size === 0) {
    return []
  }

  return buildRankingRows(firestore, { period, type, memberIds })
}

export async function loadApiGroups(user: User) {
  const firestore = ensureFirestore()
  const groupSnapshots = await getDocs(query(collection(firestore, 'groups'), limit(100)))
  const groups = await Promise.all(
    groupSnapshots.docs.map(async (group) => {
      const membership = await getDoc(doc(firestore, 'groups', group.id, 'members', user.uid))
      if (!membership.exists()) {
        return null
      }

      return mapGroup(group.id, group.data(), membership.data())
    }),
  )

  return groups
    .filter((group): group is ApiGroup => group !== null)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

export async function createApiGroup(user: User, name: string) {
  const firestore = ensureFirestore()
  const normalizedName = name.trim()
  if (!normalizedName) {
    throw new Error('Group name is required.')
  }

  const [currentGroups, duplicateName] = await Promise.all([
    loadApiGroups(user),
    getDocs(query(collection(firestore, 'groups'), where('name', '==', normalizedName), limit(1))),
  ])

  if (currentGroups.length >= maxUserGroups) {
    throw new Error('GROUP_LIMIT')
  }

  if (!duplicateName.empty) {
    throw new Error('DUPLICATE_GROUP_NAME')
  }

  const profile = await requireProfile(firestore, user)
  const now = new Date().toISOString()
  const inviteCode = await createUniqueInviteCode(firestore)
  const groupRef = doc(collection(firestore, 'groups'))
  const memberRef = doc(groupRef, 'members', user.uid)
  const batch = writeBatch(firestore)

  batch.set(groupRef, {
    name: normalizedName,
    inviteCode,
    ownerUserId: user.uid,
    memberCount: 1,
    createdAt: now,
    updatedAt: now,
    createdAtServer: serverTimestamp(),
    updatedAtServer: serverTimestamp(),
  })
  batch.set(memberRef, {
    userId: user.uid,
    name: profile.name,
    rangeId: profile.rangeId,
    rangeName: profile.rangeName,
    isOwner: true,
    joinedAt: now,
  })

  await batch.commit()

  return {
    id: groupRef.id,
    name: normalizedName,
    inviteCode,
    owner: true,
    memberCount: 1,
    createdAt: now,
  }
}

export async function joinApiGroup(user: User, inviteCode: string) {
  const firestore = ensureFirestore()
  const profile = await requireProfile(firestore, user)
  const normalizedInviteCode = inviteCode.trim().toUpperCase()
  const matchedGroups = await getDocs(query(collection(firestore, 'groups'), where('inviteCode', '==', normalizedInviteCode), limit(1)))
  const currentGroups = await loadApiGroups(user)

  if (currentGroups.length >= maxUserGroups) {
    throw new Error('GROUP_LIMIT')
  }

  if (matchedGroups.empty) {
    throw new Error('Invite code not found.')
  }

  const groupSnapshot = matchedGroups.docs[0]
  const groupRef = groupSnapshot.ref
  const memberRef = doc(groupRef, 'members', user.uid)
  const now = new Date().toISOString()

  await runTransaction(firestore, async (transaction) => {
    const [freshGroup, existingMember] = await Promise.all([transaction.get(groupRef), transaction.get(memberRef)])
    if (!freshGroup.exists()) {
      throw new Error('Invite code not found.')
    }
    if (existingMember.exists()) {
      throw new Error('Already joined.')
    }

    const memberCount = readNumber(freshGroup.data().memberCount, 0)
    if (memberCount >= maxGroupMembers) {
      throw new Error('GROUP_MEMBER_LIMIT')
    }

    transaction.set(memberRef, {
      userId: user.uid,
      name: profile.name,
      rangeId: profile.rangeId,
      rangeName: profile.rangeName,
      isOwner: false,
      joinedAt: now,
    })
    transaction.update(groupRef, {
      memberCount: memberCount + 1,
      updatedAt: now,
      updatedAtServer: serverTimestamp(),
    })
  })

  const joinedGroup = await getDoc(groupRef)
  return mapGroup(groupRef.id, joinedGroup.data() ?? groupSnapshot.data(), {
    userId: user.uid,
    name: profile.name,
    rangeId: profile.rangeId,
    rangeName: profile.rangeName,
    isOwner: false,
    joinedAt: now,
  })
}

export async function leaveApiGroup(user: User, groupId: string) {
  const firestore = ensureFirestore()
  const groupRef = doc(firestore, 'groups', groupId)
  const memberRef = doc(groupRef, 'members', user.uid)
  const [group, currentMember, allMembers] = await Promise.all([getDoc(groupRef), getDoc(memberRef), getDocs(collection(groupRef, 'members'))])

  if (!group.exists() || !currentMember.exists()) {
    return
  }

  const currentData = currentMember.data() as GroupMemberDocument
  const remainingMembers = allMembers.docs.filter((member) => member.id !== user.uid)
  const nextOwner = currentData.isOwner ? remainingMembers[0] : null
  const now = new Date().toISOString()

  await runTransaction(firestore, async (transaction) => {
    const freshGroup = await transaction.get(groupRef)
    const freshMember = await transaction.get(memberRef)
    if (!freshGroup.exists() || !freshMember.exists()) {
      return
    }

    transaction.delete(memberRef)

    if (remainingMembers.length === 0) {
      transaction.delete(groupRef)
      return
    }

    const updates: Record<string, unknown> = {
      memberCount: Math.max(0, readNumber(freshGroup.data().memberCount, allMembers.size) - 1),
      updatedAt: now,
      updatedAtServer: serverTimestamp(),
    }

    if (nextOwner) {
      transaction.update(nextOwner.ref, { isOwner: true })
      updates.ownerUserId = nextOwner.id
    }

    transaction.update(groupRef, updates)
  })
}

async function buildRankingRows(firestore: Firestore, scope: RankingScope) {
  const periodStart = getPeriodStartDateKey(scope.period)
  const summaries = await getDocs(query(collection(firestore, 'practiceSummaries'), where('isRankingPublic', '==', true)))
  const rowByUser = new Map<string, RankingAccumulator>()

  summaries.docs.forEach((snapshot) => {
    const summary = mapPracticeSummary(snapshot)
    if (summary.practiceDate < periodStart) {
      return
    }
    if (scope.memberIds && !scope.memberIds.has(summary.userId)) {
      return
    }

    const existing = rowByUser.get(summary.userId)
    if (existing) {
      existing.totalShots += summary.totalShots
      existing.totalHits += summary.totalHits
      existing.hitRate = existing.totalShots ? existing.totalHits / existing.totalShots : 0
      if (!existing.fallbackRangeId && summary.rangeId) {
        existing.fallbackRangeId = summary.rangeId
        existing.fallbackRangeName = summary.rangeName
      }
      return
    }

    rowByUser.set(summary.userId, {
      userId: summary.userId,
      name: '',
      rangeId: '',
      rangeName: '',
      totalShots: summary.totalShots,
      totalHits: summary.totalHits,
      hitRate: summary.totalShots ? summary.totalHits / summary.totalShots : 0,
      fallbackName: readString(snapshot.data().userName, '궁사'),
      fallbackRangeId: summary.rangeId,
      fallbackRangeName: summary.rangeName,
    })
  })

  const profiles = await loadProfilesByUserIds(firestore, [...rowByUser.keys()])
  const rows = [...rowByUser.values()]
    .map((row) => {
      const profile = profiles.get(row.userId)
      return {
        ...row,
        rank: 0,
        name: profile?.name ?? row.fallbackName,
        rangeId: profile?.rangeId ?? row.fallbackRangeId,
        rangeName: profile?.rangeName ?? row.fallbackRangeName,
        disabled: profile?.disabled === true,
      }
    })
    .filter((row) => !row.disabled)
    .filter((row) => row.totalShots >= minRankingShots)
    .filter((row) => (scope.rangeId ? row.rangeId === scope.rangeId : true))
    .sort((a, b) =>
      scope.type === 'total'
        ? b.totalShots - a.totalShots || b.totalHits - a.totalHits || b.hitRate - a.hitRate
        : b.hitRate - a.hitRate || b.totalShots - a.totalShots || b.totalHits - a.totalHits,
    )
    .slice(0, 10)

  return rows.map((row, index) => ({ ...row, rank: index + 1 }))
}

async function readApiProfile(firestore: Firestore, userId: string) {
  const profile = await getDoc(doc(firestore, 'profiles', userId))
  if (!profile.exists()) {
    return null
  }

  return mapProfile(profile.data())
}

async function requireProfile(firestore: Firestore, user: User) {
  const profile = await readApiProfile(firestore, user.uid)
  if (!profile) {
    throw new Error('Complete onboarding first.')
  }

  return profile
}

async function loadProfilesByUserIds(firestore: Firestore, userIds: string[]) {
  const profiles = new Map<string, ApiProfile>()
  await Promise.all(
    userIds.map(async (userId) => {
      const profile = await readApiProfile(firestore, userId)
      if (profile) {
        profiles.set(userId, profile)
      }
    }),
  )

  return profiles
}

async function createUniqueInviteCode(firestore: Firestore) {
  for (let attempts = 0; attempts < 10; attempts += 1) {
    const inviteCode = createInviteCode()
    const existing = await getDocs(query(collection(firestore, 'groups'), where('inviteCode', '==', inviteCode), limit(1)))
    if (existing.empty) {
      return inviteCode
    }
  }

  throw new Error('Failed to create invite code.')
}

function createInviteCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const values = crypto.getRandomValues(new Uint32Array(6))
  return [...values].map((value) => alphabet[value % alphabet.length]).join('')
}

function toSummaryPayload(user: User, summary: PracticeSession & { clientSessionId: string }, profile: ApiProfile | null, now: string) {
  return {
    clientSessionId: summary.clientSessionId,
    userId: user.uid,
    rangeId: summary.rangeId,
    rangeName: summary.rangeName,
    homeRangeId: profile?.rangeId ?? summary.rangeId,
    homeRangeName: profile?.rangeName ?? summary.rangeName,
    userName: profile?.name ?? user.displayName ?? user.email ?? '궁사',
    practiceDate: summary.practiceDate,
    practicedAt: summary.practicedAt,
    mode: summary.mode,
    totalShots: summary.totalShots,
    totalHits: summary.totalHits,
    isRankingPublic: summary.isRankingPublic,
    updatedAt: now,
  }
}

function mapPracticeSummary(snapshot: QueryDocumentSnapshot<DocumentData>): ApiPracticeSummary {
  const data = snapshot.data()
  const now = new Date().toISOString()
  const practicedAt = readString(data.practicedAt, now)

  return {
    id: snapshot.id,
    serverId: snapshot.id,
    clientSessionId: readString(data.clientSessionId, snapshot.id),
    userId: readString(data.userId),
    rangeId: readString(data.rangeId),
    rangeName: readString(data.rangeName),
    practiceDate: readString(data.practiceDate, practicedAt.slice(0, 10)),
    practicedAt,
    mode: data.mode === 'simple' ? 'simple' : 'detail',
    totalShots: readNumber(data.totalShots),
    totalHits: readNumber(data.totalHits),
    isRankingPublic: data.isRankingPublic !== false,
    createdAt: readString(data.createdAt, practicedAt),
    updatedAt: readString(data.updatedAt, practicedAt),
  }
}

function mapProfile(data: DocumentData): ApiProfile {
  return {
    name: readString(data.name),
    rangeId: readString(data.rangeId),
    rangeName: readString(data.rangeName),
    grade: readString(data.grade),
    bowHand: data.bowHand === 'left' ? 'left' : 'right',
    defaultRecordMode: data.defaultRecordMode === 'simple' ? 'simple' : 'detail',
    isRankingPublic: data.isRankingPublic !== false,
    disabled: data.disabled === true,
  }
}

function mapGroup(id: string, data: DocumentData, membershipData: DocumentData): ApiGroup {
  return {
    id,
    name: readString(data.name),
    inviteCode: readString(data.inviteCode),
    owner: membershipData.isOwner === true,
    memberCount: readNumber(data.memberCount, 1),
    createdAt: readString(data.createdAt, new Date().toISOString()),
  }
}

function getPeriodStartDateKey(period: 'weekly' | 'monthly') {
  const date = new Date()
  date.setHours(0, 0, 0, 0)

  if (period === 'monthly') {
    date.setDate(1)
    return toDateKey(date)
  }

  const day = date.getDay()
  const mondayOffset = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + mondayOffset)
  return toDateKey(date)
}

function toDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function ensureFirestore() {
  if (!firebaseDb) {
    throw new Error('Firebase Firestore is not configured.')
  }

  return firebaseDb
}

function readString(value: unknown, fallback = '') {
  return typeof value === 'string' && value ? value : fallback
}

function readNumber(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}
