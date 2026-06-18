const CACHE_VERSION = 'b-log-pwa-v2'
const APP_CACHE = `${CACHE_VERSION}-app`
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`
const APP_SHELL = [
  '/',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/apple-touch-icon.png',
  '/pwa-icon-192.png',
  '/pwa-icon-512.png',
  '/pwa-icon-maskable-512.png',
  '/google.png',
  '/kakao.png',
  '/target-center.jpeg',
]

async function precacheAppShell() {
  const cache = await caches.open(APP_CACHE)
  await Promise.allSettled(APP_SHELL.map((url) => cache.add(url)))
}

self.addEventListener('install', (event) => {
  event.waitUntil(precacheAppShell())
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== APP_CACHE && key !== RUNTIME_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

function shouldIgnoreRequest(requestUrl) {
  if (requestUrl.origin !== self.location.origin) {
    return true
  }

  return requestUrl.pathname.startsWith('/__/') || requestUrl.pathname === '/sw.js'
}

async function networkFirstNavigation(request) {
  try {
    const response = await fetch(request)
    const cache = await caches.open(APP_CACHE)
    cache.put('/', response.clone())
    return response
  } catch {
    const cached = await caches.match('/') || await caches.match('/index.html')
    if (cached) {
      return cached
    }

    return new Response('B-Log를 오프라인에서 불러오지 못했습니다. 네트워크 연결 후 다시 시도해주세요.', {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      status: 503,
    })
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE)
  const cached = await cache.match(request)
  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone())
      }
      return response
    })
    .catch(() => cached)

  return cached || fetchPromise
}

self.addEventListener('fetch', (event) => {
  const { request } = event

  if (request.method !== 'GET') {
    return
  }

  const requestUrl = new URL(request.url)
  if (shouldIgnoreRequest(requestUrl)) {
    return
  }

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request))
    return
  }

  if (['script', 'style', 'image', 'font', 'manifest'].includes(request.destination)) {
    event.respondWith(staleWhileRevalidate(request))
  }
})
