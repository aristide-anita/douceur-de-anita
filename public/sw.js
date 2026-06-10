// DouceurDeANITA — Service worker minimal
// - Cache de la coque (HTML, icônes, manifest)
// - Stratégie network-first pour le HTML (toujours fraîche en ligne)
// - Stratégie cache-first pour les assets versionnés (/assets/...)
// - Bypass total pour les requêtes vers Supabase (API + Storage)

const CACHE_NAME = 'douceur-v1'
const ASSETS_COQUE = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icon-192.svg',
  '/icon-512.svg',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_COQUE))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Bypass total pour Supabase / sources cross-origin → réseau direct
  if (url.origin !== self.location.origin) {
    return
  }

  // Bypass pour les requêtes non-GET
  if (request.method !== 'GET') {
    return
  }

  // Stratégie cache-first pour les assets versionnés
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
          }
          return response
        })
      })
    )
    return
  }

  // Stratégie network-first pour le reste (HTML, manifest, icônes)
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
        }
        return response
      })
      .catch(() => caches.match(request).then((c) => c ?? caches.match('/')))
  )
})
