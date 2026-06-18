const admin = require('firebase-admin')
const { defineSecret } = require('firebase-functions/params')
const { HttpsError, onCall } = require('firebase-functions/v2/https')
const { logger } = require('firebase-functions')

admin.initializeApp()

const db = admin.firestore()
const auth = admin.auth()
const region = 'asia-northeast3'
const adminAccounts = db.collection('adminAccounts')
const adminRequests = db.collection('adminRequests')
const archeryRanges = db.collection('archeryRanges')
const profiles = db.collection('profiles')
const practiceSummaries = db.collection('practiceSummaries')
const groups = db.collection('groups')
const maxPageSize = 100
const bootstrapSuperAdminKey = defineSecret('BOOTSTRAP_SUPER_ADMIN_KEY')

exports.bootstrapSuperAdmin = onCall({ region, secrets: [bootstrapSuperAdminKey] }, async (request) => {
  const bootstrapKey = bootstrapSuperAdminKey.value()
  const { email, password, displayName, setupKey } = request.data ?? {}

  if (!bootstrapKey || setupKey !== bootstrapKey) {
    throw new HttpsError('permission-denied', 'Bootstrap key is invalid.')
  }
  if (!isValidEmail(email) || !isSafePassword(password)) {
    throw new HttpsError('invalid-argument', 'Valid email and password are required.')
  }

  const user = await getOrCreateAuthUser(email, password, displayName || '최고 관리자')
  await auth.setCustomUserClaims(user.uid, { adminRole: 'SUPER_ADMIN' })
  await adminAccounts.doc(user.uid).set(
    {
      uid: user.uid,
      email,
      username: email,
      displayName: displayName || '최고 관리자',
      role: 'SUPER_ADMIN',
      rangeId: null,
      rangeName: null,
      active: true,
      mustChangePassword: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  )

  return { uid: user.uid, email, role: 'SUPER_ADMIN' }
})

exports.requestAdminApproval = onCall({ region }, async (request) => {
  const { email, displayName, rangeId, message } = request.data ?? {}

  if (!isValidEmail(email) || !isNonEmptyString(displayName) || !isNonEmptyString(rangeId)) {
    throw new HttpsError('invalid-argument', 'Email, name, and range are required.')
  }

  const range = await requireRange(rangeId)
  const existing = await adminRequests
    .where('emailLower', '==', email.toLowerCase())
    .where('status', '==', 'PENDING')
    .limit(1)
    .get()

  if (!existing.empty) {
    throw new HttpsError('already-exists', 'Already requested.')
  }

  const requestRef = await adminRequests.add({
    email,
    emailLower: email.toLowerCase(),
    displayName: String(displayName).trim(),
    rangeId,
    rangeName: range.name,
    message: typeof message === 'string' ? message.trim().slice(0, 500) : '',
    status: 'PENDING',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  })

  return { id: requestRef.id, status: 'PENDING' }
})

exports.adminMe = onCall({ region }, async (request) => {
  const current = await requireAdmin(request, { allowMustChangePassword: true })
  await adminAccounts.doc(current.uid).set(
    {
      lastLoginAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  )

  return toAdminCurrent(current)
})

exports.adminChangePasswordComplete = onCall({ region }, async (request) => {
  const current = await requireAdmin(request, { allowMustChangePassword: true })
  await adminAccounts.doc(current.uid).set(
    {
      mustChangePassword: false,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  )

  return toAdminCurrent({ ...current, mustChangePassword: false })
})

exports.adminOverview = onCall({ region }, async (request) => {
  const current = await requireAdmin(request)

  if (current.role === 'RANGE_ADMIN') {
    const [users, summaries] = await Promise.all([
      profiles.where('rangeId', '==', current.rangeId).count().get(),
      practiceSummaries.where('rangeId', '==', current.rangeId).count().get(),
    ])

    return {
      users: users.data().count,
      practiceSummaries: summaries.data().count,
      ranges: 1,
      groups: 0,
      groupMembers: 0,
    }
  }

  const [users, summaries, ranges, groupDocs, groupMembers] = await Promise.all([
    countCollection(profiles),
    countCollection(practiceSummaries),
    countCollection(archeryRanges),
    countCollection(groups),
    db.collectionGroup('members').count().get(),
  ])

  return {
    users,
    practiceSummaries: summaries,
    ranges,
    groups: groupDocs,
    groupMembers: groupMembers.data().count,
  }
})

exports.adminSearchRanges = onCall({ region }, async (request) => {
  const current = await requireAdmin(request)
  const queryText = normalizeSearchText(request.data?.query)

  if (current.role === 'RANGE_ADMIN') {
    const range = await requireRange(current.rangeId)
    return [toAdminRange(range.id, range)]
  }

  const snapshot = await archeryRanges.limit(600).get()
  return snapshot.docs
    .map((doc) => toAdminRange(doc.id, doc.data()))
    .filter((range) => !queryText || normalizeSearchText(`${range.region} ${range.city ?? ''} ${range.name} ${range.address ?? ''}`).includes(queryText))
    .slice(0, maxPageSize)
})

exports.adminRangeStats = onCall({ region }, async (request) => {
  const current = await requireAdmin(request)
  const rangeId = String(request.data?.rangeId ?? '')
  assertRangeAccess(current, rangeId)
  const range = await requireRange(rangeId)
  const [memberProfiles, summaries] = await Promise.all([
    profiles.where('rangeId', '==', rangeId).get(),
    practiceSummaries.where('rangeId', '==', rangeId).get(),
  ])
  const totals = summaries.docs.reduce(
    (acc, doc) => {
      const data = doc.data()
      acc.practiceSummaries += 1
      acc.totalShots += readNumber(data.totalShots)
      acc.totalHits += readNumber(data.totalHits)
      return acc
    },
    { practiceSummaries: 0, totalShots: 0, totalHits: 0 },
  )

  return {
    rangeId,
    rangeName: range.name,
    members: memberProfiles.size,
    ...totals,
    hitRate: totals.totalShots ? totals.totalHits / totals.totalShots : 0,
  }
})

exports.adminRangeMembers = onCall({ region }, async (request) => {
  const current = await requireAdmin(request)
  const rangeId = String(request.data?.rangeId ?? '')
  const queryText = normalizeSearchText(request.data?.query)
  assertRangeAccess(current, rangeId)

  const profileDocs = await profiles.where('rangeId', '==', rangeId).limit(300).get()
  const filteredProfiles = profileDocs.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .filter((profile) => !queryText || normalizeSearchText(`${profile.name ?? ''} ${profile.email ?? ''}`).includes(queryText))
    .slice(0, maxPageSize)

  return Promise.all(filteredProfiles.map((profile) => buildAdminUser(profile)))
})

exports.adminUserSummaries = onCall({ region }, async (request) => {
  const current = await requireAdmin(request)
  const userId = String(request.data?.userId ?? '')
  const profile = await profiles.doc(userId).get()

  if (!profile.exists) {
    throw new HttpsError('not-found', 'User not found.')
  }
  if (current.role === 'RANGE_ADMIN' && profile.data().rangeId !== current.rangeId) {
    throw new HttpsError('permission-denied', 'Cannot view this user.')
  }

  const summaries = await practiceSummaries.where('userId', '==', userId).limit(200).get()
  return summaries.docs
    .map((doc) => toAdminPracticeSummary(doc.id, doc.data()))
    .sort((a, b) => b.practicedAt.localeCompare(a.practicedAt))
})

exports.adminListAccounts = onCall({ region }, async (request) => {
  await requireAdmin(request, { role: 'SUPER_ADMIN' })
  const snapshot = await adminAccounts.limit(300).get()
  return snapshot.docs
    .map((doc) => toAdminAccount(doc.id, doc.data()))
    .filter((account) => account.role === 'RANGE_ADMIN')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
})

exports.adminCreateAccount = onCall({ region }, async (request) => {
  await requireAdmin(request, { role: 'SUPER_ADMIN' })
  const { email, password, rangeId, displayName } = request.data ?? {}

  if (!isValidEmail(email) || !isSafePassword(password) || !isNonEmptyString(rangeId)) {
    throw new HttpsError('invalid-argument', 'Email, temporary password, and range are required.')
  }

  const range = await requireRange(rangeId)
  const user = await getOrCreateAuthUser(email, password, displayName || `${range.name} 관리자`)
  await auth.updateUser(user.uid, { password, disabled: false, displayName: displayName || `${range.name} 관리자` })
  await setRangeAdmin(user.uid, email, displayName || `${range.name} 관리자`, range)

  return toAdminAccount(user.uid, (await adminAccounts.doc(user.uid).get()).data())
})

exports.adminResetAccountPassword = onCall({ region }, async (request) => {
  await requireAdmin(request, { role: 'SUPER_ADMIN' })
  const { accountId, password } = request.data ?? {}

  if (!isNonEmptyString(accountId) || !isSafePassword(password)) {
    throw new HttpsError('invalid-argument', 'Account and temporary password are required.')
  }

  await auth.updateUser(accountId, { password, disabled: false })
  await adminAccounts.doc(accountId).set(
    {
      active: true,
      mustChangePassword: true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  )

  return toAdminAccount(accountId, (await adminAccounts.doc(accountId).get()).data())
})

exports.adminSetAccountActive = onCall({ region }, async (request) => {
  await requireAdmin(request, { role: 'SUPER_ADMIN' })
  const { accountId, active } = request.data ?? {}

  if (!isNonEmptyString(accountId) || typeof active !== 'boolean') {
    throw new HttpsError('invalid-argument', 'Account and active state are required.')
  }

  await auth.updateUser(accountId, { disabled: !active })
  await adminAccounts.doc(accountId).set(
    {
      active,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  )

  return toAdminAccount(accountId, (await adminAccounts.doc(accountId).get()).data())
})

exports.adminListApprovalRequests = onCall({ region }, async (request) => {
  await requireAdmin(request, { role: 'SUPER_ADMIN' })
  const snapshot = await adminRequests.where('status', '==', 'PENDING').limit(100).get()
  return snapshot.docs.map((doc) => toAdminApprovalRequest(doc.id, doc.data())).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
})

exports.adminApproveRequest = onCall({ region }, async (request) => {
  const current = await requireAdmin(request, { role: 'SUPER_ADMIN' })
  const { requestId, password } = request.data ?? {}

  if (!isNonEmptyString(requestId) || !isSafePassword(password)) {
    throw new HttpsError('invalid-argument', 'Request and temporary password are required.')
  }

  const requestRef = adminRequests.doc(requestId)
  const requestDoc = await requestRef.get()
  if (!requestDoc.exists || requestDoc.data().status !== 'PENDING') {
    throw new HttpsError('not-found', 'Pending request not found.')
  }

  const data = requestDoc.data()
  const range = await requireRange(data.rangeId)
  const user = await getOrCreateAuthUser(data.email, password, data.displayName)
  await auth.updateUser(user.uid, { password, disabled: false, displayName: data.displayName })
  await setRangeAdmin(user.uid, data.email, data.displayName, range)
  await requestRef.set(
    {
      status: 'APPROVED',
      approvedBy: current.uid,
      approvedAccountId: user.uid,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  )

  return toAdminAccount(user.uid, (await adminAccounts.doc(user.uid).get()).data())
})

exports.adminRejectRequest = onCall({ region }, async (request) => {
  const current = await requireAdmin(request, { role: 'SUPER_ADMIN' })
  const { requestId, reason } = request.data ?? {}

  if (!isNonEmptyString(requestId)) {
    throw new HttpsError('invalid-argument', 'Request is required.')
  }

  await adminRequests.doc(requestId).set(
    {
      status: 'REJECTED',
      rejectedBy: current.uid,
      rejectReason: typeof reason === 'string' ? reason.trim().slice(0, 500) : '',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  )

  return { id: requestId, status: 'REJECTED' }
})

async function requireAdmin(request, options = {}) {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Login is required.')
  }

  const accountDoc = await adminAccounts.doc(request.auth.uid).get()
  if (!accountDoc.exists) {
    throw new HttpsError('permission-denied', 'Admin account is not approved.')
  }

  const account = { uid: request.auth.uid, ...accountDoc.data() }
  if (account.active === false) {
    throw new HttpsError('permission-denied', 'Admin account is disabled.')
  }
  if (options.role && account.role !== options.role) {
    throw new HttpsError('permission-denied', 'Not enough permission.')
  }
  if (!options.allowMustChangePassword && account.mustChangePassword) {
    throw new HttpsError('failed-precondition', 'Password change is required.')
  }

  return account
}

function assertRangeAccess(current, rangeId) {
  if (!rangeId) {
    throw new HttpsError('invalid-argument', 'Range is required.')
  }
  if (current.role === 'RANGE_ADMIN' && current.rangeId !== rangeId) {
    throw new HttpsError('permission-denied', 'Cannot view another range.')
  }
}

async function setRangeAdmin(uid, email, displayName, range) {
  await auth.setCustomUserClaims(uid, { adminRole: 'RANGE_ADMIN', rangeId: range.id })
  await adminAccounts.doc(uid).set(
    {
      uid,
      email,
      username: email,
      displayName,
      role: 'RANGE_ADMIN',
      rangeId: range.id,
      rangeName: range.name,
      active: true,
      mustChangePassword: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  )
}

async function getOrCreateAuthUser(email, password, displayName) {
  try {
    return await auth.getUserByEmail(email)
  } catch (error) {
    if (error.code !== 'auth/user-not-found') {
      throw error
    }

    return auth.createUser({
      email,
      password,
      displayName,
      emailVerified: true,
      disabled: false,
    })
  }
}

async function requireRange(rangeId) {
  const rangeDoc = await archeryRanges.doc(rangeId).get()
  if (!rangeDoc.exists) {
    throw new HttpsError('not-found', 'Range not found.')
  }

  return { id: rangeDoc.id, ...rangeDoc.data() }
}

async function buildAdminUser(profile) {
  const summaries = await practiceSummaries.where('userId', '==', profile.id).get()
  const totals = summaries.docs.reduce(
    (acc, doc) => {
      const data = doc.data()
      acc.practiceSummaries += 1
      acc.totalShots += readNumber(data.totalShots)
      acc.totalHits += readNumber(data.totalHits)
      return acc
    },
    { practiceSummaries: 0, totalShots: 0, totalHits: 0 },
  )

  return {
    id: profile.id,
    userId: profile.id,
    email: profile.email ?? null,
    name: profile.name ?? '궁사',
    rangeId: profile.rangeId ?? '',
    rangeName: profile.rangeName ?? '',
    grade: profile.grade ?? '',
    rankingPublic: profile.isRankingPublic !== false,
    ...totals,
    hitRate: totals.totalShots ? totals.totalHits / totals.totalShots : 0,
  }
}

async function countCollection(collectionRef) {
  const result = await collectionRef.count().get()
  return result.data().count
}

function toAdminCurrent(account) {
  return {
    username: account.username ?? account.email ?? '',
    role: account.role,
    rangeId: account.rangeId ?? null,
    rangeName: account.rangeName ?? null,
    active: account.active !== false,
    mustChangePassword: account.mustChangePassword === true,
  }
}

function toAdminRange(id, data) {
  return {
    id,
    region: data.region ?? '',
    city: data.city ?? null,
    name: data.name ?? '',
    representative: data.representative ?? null,
    address: data.address ?? null,
    phone: data.phone ?? null,
    postalCode: data.postalCode ?? null,
    latitude: typeof data.latitude === 'number' ? data.latitude : null,
    longitude: typeof data.longitude === 'number' ? data.longitude : null,
    distanceKm: null,
  }
}

function toAdminPracticeSummary(id, data) {
  return {
    id,
    userId: data.userId ?? '',
    userName: data.userName ?? '',
    rangeId: data.rangeId ?? '',
    rangeName: data.rangeName ?? '',
    practiceDate: data.practiceDate ?? '',
    practicedAt: data.practicedAt ?? '',
    recordMode: data.mode === 'simple' ? 'simple' : 'detail',
    totalShots: readNumber(data.totalShots),
    totalHits: readNumber(data.totalHits),
    rankingPublic: data.isRankingPublic !== false,
  }
}

function toAdminAccount(id, data = {}) {
  return {
    id,
    username: data.username ?? data.email ?? '',
    role: data.role ?? 'RANGE_ADMIN',
    rangeId: data.rangeId ?? '',
    rangeName: data.rangeName ?? '',
    active: data.active !== false,
    mustChangePassword: data.mustChangePassword === true,
    lastLoginAt: timestampToIso(data.lastLoginAt),
    createdAt: timestampToIso(data.createdAt) ?? '',
  }
}

function toAdminApprovalRequest(id, data = {}) {
  return {
    id,
    email: data.email ?? '',
    displayName: data.displayName ?? '',
    rangeId: data.rangeId ?? '',
    rangeName: data.rangeName ?? '',
    message: data.message ?? '',
    status: data.status ?? 'PENDING',
    createdAt: timestampToIso(data.createdAt) ?? '',
  }
}

function timestampToIso(value) {
  return value?.toDate ? value.toDate().toISOString() : null
}

function normalizeSearchText(value) {
  return String(value ?? '').trim().toLowerCase()
}

function isValidEmail(value) {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function isSafePassword(value) {
  return typeof value === 'string' && value.length >= 6
}

function readNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

process.on('unhandledRejection', (error) => {
  logger.error('Unhandled rejection', error)
})
