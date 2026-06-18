import Dexie, { type EntityTable } from 'dexie'
import { domesticArcheryRanges } from '../data/archeryRanges'

export type RecordMode = 'simple' | 'detail'
export type BowHand = 'left' | 'right'
export type ShotDirection = 'hit' | 'high' | 'low' | 'left' | 'right' | 'highLeft' | 'highRight' | 'lowLeft' | 'lowRight'
export type SyncAction = 'create' | 'update' | 'delete'
export type SyncEntity = 'practiceSession' | 'userProfile' | 'group'
export type SyncStatus = 'pending' | 'syncing' | 'failed'

export type LocalUserProfile = {
  userId: string
  name: string
  rangeId: string
  rangeName: string
  grade: string
  bowHand: BowHand
  defaultRecordMode: RecordMode
  isRankingPublic: boolean
  createdAt: string
  updatedAt: string
}

export type LocalArcheryRange = {
  id: string
  region: string
  city: string
  name: string
  representative: string
  address: string
  phone: string
  postalCode: string
  latitude?: number
  longitude?: number
  searchText: string
  seededAt: string
}

export type PracticeSession = {
  id?: number
  serverId?: string
  clientSessionId?: string
  userId: string
  rangeId: string
  rangeName: string
  practiceDate: string
  practicedAt: string
  mode: RecordMode
  totalShots: number
  totalHits: number
  isRankingPublic: boolean
  createdAt: string
  updatedAt: string
  syncedAt?: string
}

export type LocalSessionDetail = {
  id?: number
  sessionId: number
  userId: string
  note?: string
  createdAt: string
  updatedAt: string
}

export type LocalGroup = {
  id: string
  name: string
  inviteCode: string
  ownerUserId: string
  createdAt: string
  updatedAt: string
}

export type LocalGroupMember = {
  id?: number
  groupId: string
  userId: string
  name: string
  rangeId: string
  rangeName: string
  isOwner: boolean
  joinedAt: string
}

export type ShotDetail = {
  id?: number
  sessionId: number
  userId: string
  roundIndex: number
  shotIndex: number
  direction: ShotDirection
  isHit: boolean
  shotTime: string
  note?: string
  createdAt: string
}

export type SyncQueueItem = {
  id?: number
  entity: SyncEntity
  entityId: string
  action: SyncAction
  payload: unknown
  status: SyncStatus
  attempts: number
  lastError?: string
  createdAt: string
  updatedAt: string
}

export class SisuRecordDatabase extends Dexie {
  userProfiles!: EntityTable<LocalUserProfile, 'userId'>
  archeryRanges!: EntityTable<LocalArcheryRange, 'id'>
  practiceSessions!: EntityTable<PracticeSession, 'id'>
  localSessionDetails!: EntityTable<LocalSessionDetail, 'id'>
  groups!: EntityTable<LocalGroup, 'id'>
  groupMembers!: EntityTable<LocalGroupMember, 'id'>
  shotDetails!: EntityTable<ShotDetail, 'id'>
  syncQueue!: EntityTable<SyncQueueItem, 'id'>

  constructor() {
    super('sisu-record-local')

    this.version(1).stores({
      userProfiles: 'userId, rangeId, rangeName, grade, bowHand, updatedAt',
      archeryRanges: 'id, region, city, name, [region+city]',
      practiceSessions: '++id, userId, practicedAt, rangeId, mode, [userId+practicedAt], [userId+rangeId], syncedAt',
      shotDetails: '++id, sessionId, userId, roundIndex, shotIndex, direction, [sessionId+roundIndex], [userId+createdAt]',
      syncQueue: '++id, entity, entityId, action, status, createdAt, [entity+entityId], [status+createdAt]',
    })

    this.version(2).stores({
      userProfiles: 'userId, rangeId, rangeName, grade, bowHand, updatedAt',
      archeryRanges: 'id, region, city, name, [region+city]',
      practiceSessions:
        '++id, userId, practiceDate, practicedAt, rangeId, mode, [userId+practiceDate], [userId+practicedAt], [userId+rangeId], syncedAt',
      shotDetails:
        '++id, sessionId, userId, roundIndex, shotIndex, direction, shotTime, [sessionId+roundIndex], [userId+shotTime], [userId+createdAt]',
      syncQueue: '++id, entity, entityId, action, status, createdAt, [entity+entityId], [status+createdAt]',
    })

    this.version(3).stores({
      userProfiles: 'userId, rangeId, rangeName, grade, bowHand, updatedAt',
      archeryRanges: 'id, region, city, name, [region+city]',
      practiceSessions:
        '++id, userId, practiceDate, practicedAt, rangeId, mode, isRankingPublic, [userId+practiceDate], [userId+practicedAt], [userId+rangeId], syncedAt',
      localSessionDetails: '++id, sessionId, userId, updatedAt, [userId+updatedAt]',
      shotDetails:
        '++id, sessionId, userId, roundIndex, shotIndex, direction, shotTime, [sessionId+roundIndex], [userId+shotTime], [userId+createdAt]',
      syncQueue: '++id, entity, entityId, action, status, createdAt, [entity+entityId], [status+createdAt]',
    })

    this.version(4).stores({
      userProfiles: 'userId, rangeId, rangeName, grade, bowHand, updatedAt',
      archeryRanges: 'id, region, city, name, [region+city]',
      practiceSessions:
        '++id, userId, practiceDate, practicedAt, rangeId, mode, isRankingPublic, [userId+practiceDate], [userId+practicedAt], [userId+rangeId], syncedAt',
      localSessionDetails: '++id, sessionId, userId, updatedAt, [userId+updatedAt]',
      groups: 'id, inviteCode, ownerUserId, updatedAt',
      groupMembers: '++id, groupId, userId, isOwner, joinedAt, [groupId+userId]',
      shotDetails:
        '++id, sessionId, userId, roundIndex, shotIndex, direction, shotTime, [sessionId+roundIndex], [userId+shotTime], [userId+createdAt]',
      syncQueue: '++id, entity, entityId, action, status, createdAt, [entity+entityId], [status+createdAt]',
    })

    this.version(5).stores({
      userProfiles: 'userId, rangeId, rangeName, grade, bowHand, updatedAt',
      archeryRanges: 'id, region, city, name, [region+city]',
      practiceSessions:
        '++id, serverId, clientSessionId, userId, practiceDate, practicedAt, rangeId, mode, isRankingPublic, [userId+practiceDate], [userId+practicedAt], [userId+rangeId], syncedAt',
      localSessionDetails: '++id, sessionId, userId, updatedAt, [userId+updatedAt]',
      groups: 'id, inviteCode, ownerUserId, updatedAt',
      groupMembers: '++id, groupId, userId, isOwner, joinedAt, [groupId+userId]',
      shotDetails:
        '++id, sessionId, userId, roundIndex, shotIndex, direction, shotTime, [sessionId+roundIndex], [userId+shotTime], [userId+createdAt]',
      syncQueue: '++id, entity, entityId, action, status, createdAt, [entity+entityId], [status+createdAt]',
    })
  }
}

export const db = new SisuRecordDatabase()

export async function initializeLocalDatabase() {
  await db.open()
  await seedArcheryRanges()
}

async function seedArcheryRanges() {
  const currentCount = await db.archeryRanges.count()
  if (currentCount === domesticArcheryRanges.length) {
    return
  }

  const seededAt = new Date().toISOString()
  const ranges: LocalArcheryRange[] = domesticArcheryRanges.map((range) => {
    const city = getMiddleArea(range.region, range.address)

    return {
      ...range,
      city,
      searchText: [range.region, city, range.name, range.address, range.phone, range.postalCode]
        .filter(Boolean)
        .join(' ')
        .toLowerCase(),
      seededAt,
    }
  })

  await db.transaction('rw', db.archeryRanges, async () => {
    await db.archeryRanges.clear()
    await db.archeryRanges.bulkPut(ranges)
  })
}

function getMiddleArea(region: string, address: string) {
  if (region === '세종특별자치시') {
    return '세종특별자치시'
  }

  const firstToken = address.split(' ')[0] ?? ''
  const match = firstToken.match(/.+?(시|군|구)/)
  return match?.[0] ?? (firstToken || region)
}
