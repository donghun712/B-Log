const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const admin = require('firebase-admin')

admin.initializeApp()

const db = admin.firestore()
const sourcePath = path.resolve(__dirname, '../../src/data/archeryRanges.ts')
const source = fs.readFileSync(sourcePath, 'utf8')
const arraySource = source
  .replace(/export type ArcheryRange[\s\S]*?}\r?\n\r?\n/, '')
  .replace('export const domesticArcheryRanges =', 'const domesticArcheryRanges =')
  .replace(/] as const satisfies readonly ArcheryRange\[]/, ']')

const sandbox = {}
vm.createContext(sandbox)
vm.runInContext(`${arraySource}; this.domesticArcheryRanges = domesticArcheryRanges;`, sandbox)

async function main() {
  const ranges = sandbox.domesticArcheryRanges
  if (!Array.isArray(ranges)) {
    throw new Error('Failed to read archery range data.')
  }

  let batch = db.batch()
  let count = 0
  for (const range of ranges) {
    const city = getMiddleArea(range.region, range.address)
    batch.set(
      db.collection('archeryRanges').doc(range.id),
      {
        ...range,
        city,
        searchText: [range.region, city, range.name, range.address, range.phone, range.postalCode].filter(Boolean).join(' ').toLowerCase(),
        seededAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    )
    count += 1

    if (count % 400 === 0) {
      await batch.commit()
      batch = db.batch()
    }
  }

  await batch.commit()
  console.log(`Seeded ${count} archery ranges.`)
}

function getMiddleArea(region, address) {
  if (region === '세종특별자치시') {
    return '세종특별자치시'
  }

  const firstToken = String(address ?? '').split(' ')[0] ?? ''
  const match = firstToken.match(/.+?(시|군|구)/)
  return match?.[0] ?? (firstToken || region)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
