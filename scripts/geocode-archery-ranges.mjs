import { readFile, writeFile } from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dataPath = path.join(rootDir, 'src/data/archeryRanges.ts')
const failurePath = path.join(rootDir, 'src/data/archeryRangeGeocodeFailures.json')
const approximationPath = path.join(rootDir, 'src/data/archeryRangeGeocodeApproximations.json')

const apiKey = readEnvValue('KAKAO_REST_API_KEY') ?? readEnvValue('VITE_KAKAO_REST_API_KEY')

if (!apiKey) {
  throw new Error('KAKAO_REST_API_KEY 값을 .env에 넣어주세요.')
}

const source = await readFile(dataPath, 'utf8')
const ranges = parseRanges(source)
const updatedRanges = []
const failures = []
const approximations = []

for (const [index, range] of ranges.entries()) {
  if (Number.isFinite(range.latitude) && Number.isFinite(range.longitude)) {
    updatedRanges.push(range)
    continue
  }

  const result = await geocodeRange(range)
  if (result) {
    updatedRanges.push({
      ...range,
      latitude: Number(result.y),
      longitude: Number(result.x),
    })

    if (result.isApproximate) {
      approximations.push({
        id: range.id,
        region: range.region,
        name: range.name,
        address: range.address,
        query: result.query,
        matchedName: result.matchedName,
        matchedAddress: result.matchedAddress,
        latitude: Number(result.y),
        longitude: Number(result.x),
      })
    }
  } else {
    updatedRanges.push(range)
    failures.push({
      id: range.id,
      region: range.region,
      name: range.name,
      address: range.address,
      queries: [...buildExactAddressQueries(range), ...buildLocalApproximationQueries(range)],
    })
  }

  if ((index + 1) % 25 === 0 || index + 1 === ranges.length) {
    console.log(`${index + 1}/${ranges.length} processed`)
  }

  await delay(80)
}

await writeFile(dataPath, buildSource(updatedRanges), 'utf8')
await writeFile(failurePath, `${JSON.stringify(failures, null, 2)}\n`, 'utf8')
await writeFile(approximationPath, `${JSON.stringify(approximations, null, 2)}\n`, 'utf8')

console.log(`Done. success=${updatedRanges.length - failures.length}, failed=${failures.length}, approximate=${approximations.length}`)
console.log(`Failure list: ${path.relative(rootDir, failurePath)}`)
console.log(`Approximation list: ${path.relative(rootDir, approximationPath)}`)

function readEnvValue(key) {
  for (const fileName of ['.env.local', '.env']) {
    const filePath = path.join(rootDir, fileName)
    if (!existsSync(filePath)) {
      continue
    }

    const lines = readFileSync(filePath, 'utf8').split(/\r?\n/)
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) {
        continue
      }

      const separatorIndex = trimmed.indexOf('=')
      if (separatorIndex === -1) {
        continue
      }

      const name = trimmed.slice(0, separatorIndex).trim()
      const value = trimmed.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, '')
      if (name === key) {
        return value
      }
    }
  }

  return undefined
}

function parseRanges(fileSource) {
  const start = fileSource.indexOf('[')
  const end = fileSource.lastIndexOf('] as const')

  if (start === -1 || end === -1) {
    throw new Error('활터 데이터 배열을 찾지 못했습니다.')
  }

  return JSON.parse(fileSource.slice(start, end + 1))
}

function buildSource(ranges) {
  return `export type ArcheryRange = {
  id: string
  region: string
  name: string
  representative: string
  address: string
  phone: string
  postalCode: string
  latitude?: number
  longitude?: number
}

export const domesticArcheryRanges = ${JSON.stringify(ranges, null, 2)} as const satisfies readonly ArcheryRange[]
`
}

async function geocodeRange(range) {
  for (const query of buildExactAddressQueries(range)) {
    const addressDocument = await getFirstDocument('/v2/local/search/address.json', query)
    if (addressDocument?.x && addressDocument?.y) {
      return toResult(addressDocument, query, false)
    }

    await delay(80)
  }

  for (const query of buildKeywordQueries(range)) {
    const keywordDocument = await getFirstDocument('/v2/local/search/keyword.json', query)
    if (keywordDocument?.x && keywordDocument?.y && isLocalMatch(keywordDocument, range)) {
      return toResult(keywordDocument, query, false)
    }

    await delay(80)
  }

  for (const query of buildLocalApproximationQueries(range)) {
    const addressDocument = await getFirstDocument('/v2/local/search/address.json', query)
    if (addressDocument?.x && addressDocument?.y) {
      return toResult(addressDocument, query, true)
    }

    const keywordDocument = await getFirstDocument('/v2/local/search/keyword.json', query)
    if (keywordDocument?.x && keywordDocument?.y && isLocalMatch(keywordDocument, range)) {
      return toResult(keywordDocument, query, true)
    }

    await delay(80)
  }

  return null
}

function toResult(document, query, isApproximate) {
  return {
    x: document.x,
    y: document.y,
    query,
    isApproximate,
    matchedName: document.place_name ?? document.address_name ?? '',
    matchedAddress: document.address_name ?? document.road_address?.address_name ?? document.road_address_name ?? '',
  }
}

function buildExactAddressQueries(range) {
  const cleanedAddress = cleanAddress(range.address)
  const compactAddress = cleanedAddress.replace(/\s+/g, ' ').trim()
  return unique([`${range.region} ${compactAddress}`, compactAddress, `${range.region} ${range.postalCode}`].filter(Boolean))
}

function buildKeywordQueries(range) {
  const cleanedAddress = cleanAddress(range.address)
  return unique([
    `${range.region} ${range.name}`,
    `${getFirstToken(range.address)} ${range.name}`,
    `${range.name} ${cleanedAddress}`,
  ].filter(Boolean))
}

function buildLocalApproximationQueries(range) {
  const tokens = cleanAddress(range.address).split(/\s+/).filter(Boolean)
  const queries = []

  for (let size = Math.min(tokens.length, 4); size >= 1; size -= 1) {
    const prefix = tokens.slice(0, size).join(' ')
    queries.push(`${range.region} ${prefix}`)
    queries.push(prefix)
  }

  queries.push(range.region)
  return unique(queries.filter(Boolean))
}

function cleanAddress(address) {
  return address
    .replace(/\(.*?\)/g, '')
    .replace(/우편물\s*:.*/g, '')
    .replace(/사서함.*/g, '')
    .replace(/제\d+\s*보병사단/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function getFirstToken(address) {
  return address.split(/\s+/)[0] ?? ''
}

function isLocalMatch(document, range) {
  const address = `${document.address_name ?? ''} ${document.road_address_name ?? ''}`.trim()
  const regionPrefix = range.region.slice(0, 2)
  const firstToken = getFirstToken(range.address).replace(/시$|군$|구$/, '')
  return address.includes(regionPrefix) || (firstToken.length >= 2 && address.includes(firstToken))
}

async function getFirstDocument(endpoint, query) {
  const result = await requestKakao(endpoint, { query, size: '5' })
  return result?.documents?.[0]
}

async function requestKakao(endpoint, params) {
  const url = new URL(endpoint, 'https://dapi.kakao.com')
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value))

  const response = await fetch(url, {
    headers: {
      Authorization: `KakaoAK ${apiKey}`,
    },
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Kakao API error ${response.status}: ${body}`)
  }

  return response.json()
}

function unique(items) {
  return [...new Set(items)]
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}
