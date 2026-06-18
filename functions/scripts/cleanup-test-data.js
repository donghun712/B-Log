const admin = require('firebase-admin')
const fs = require('node:fs')
const path = require('node:path')

const projectId = process.env.FIREBASE_PROJECT_ID || 'b-log-ffa4d'
const isConfirmed = process.argv.includes('--confirm')
const isDryRun = process.argv.includes('--dry-run') || !isConfirmed
const collectionsToClear = ['practiceSummaries', 'groups']

admin.initializeApp(createAppOptions())

const db = admin.firestore()

async function main() {
  console.log(`Project: ${projectId}`)
  console.log(`Mode: ${isDryRun ? 'dry-run' : 'delete'}`)
  console.log(`Collections: ${collectionsToClear.join(', ')}`)
  console.log('Protected: auth users, auth providers, profiles, adminAccounts, adminRequests, archeryRanges')

  const practiceSummaryCount = await countCollection('practiceSummaries')
  const groups = await db.collection('groups').get()
  let groupMemberCount = 0

  for (const groupDoc of groups.docs) {
    groupMemberCount += await countSubcollection(groupDoc.ref, 'members')
  }

  console.log(`practiceSummaries: ${practiceSummaryCount}`)
  console.log(`groups: ${groups.size}`)
  console.log(`group members: ${groupMemberCount}`)

  if (isDryRun) {
    console.log('Dry run only. Re-run with --confirm to delete these records.')
    return
  }

  await deleteCollection('practiceSummaries')

  for (const groupDoc of groups.docs) {
    await deleteSubcollection(groupDoc.ref, 'members')
    await groupDoc.ref.delete()
  }

  console.log('Cleanup complete.')
}

async function countCollection(collectionPath) {
  const snapshot = await db.collection(collectionPath).count().get()
  return snapshot.data().count
}

async function countSubcollection(docRef, subcollectionPath) {
  const snapshot = await docRef.collection(subcollectionPath).count().get()
  return snapshot.data().count
}

async function deleteCollection(collectionPath) {
  const collectionRef = db.collection(collectionPath)
  while (true) {
    const snapshot = await collectionRef.limit(400).get()
    if (snapshot.empty) {
      return
    }
    await deleteSnapshot(snapshot)
  }
}

async function deleteSubcollection(docRef, subcollectionPath) {
  const collectionRef = docRef.collection(subcollectionPath)
  while (true) {
    const snapshot = await collectionRef.limit(400).get()
    if (snapshot.empty) {
      return
    }
    await deleteSnapshot(snapshot)
  }
}

async function deleteSnapshot(snapshot) {
  const batch = db.batch()
  snapshot.docs.forEach((doc) => batch.delete(doc.ref))
  await batch.commit()
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})

function createAppOptions() {
  const serviceAccountPath = readServiceAccountPath()
  if (!serviceAccountPath) {
    return { projectId }
  }

  return {
    projectId,
    credential: admin.credential.cert(serviceAccountPath),
  }
}

function readServiceAccountPath() {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return process.env.GOOGLE_APPLICATION_CREDENTIALS
  }
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    return process.env.FIREBASE_SERVICE_ACCOUNT
  }

  const localSecretsPath = path.resolve(__dirname, '../../backend/config/local-secrets.properties')
  if (!fs.existsSync(localSecretsPath)) {
    return ''
  }

  const properties = fs.readFileSync(localSecretsPath, 'utf8')
  const match = properties.match(/^FIREBASE_SERVICE_ACCOUNT=(.+)$/m)
  return match?.[1]?.trim() ?? ''
}
