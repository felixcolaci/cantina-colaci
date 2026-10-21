import { defaultCache } from '@serwist/next/worker'
import { Serwist, StaleWhileRevalidate, CacheFirst, ExpirationPlugin, CacheableResponsePlugin } from 'serwist'

declare const self: ServiceWorkerGlobalScope & typeof globalThis & { __SW_MANIFEST: any }

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: false,   // wait until user confirms update
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    ...defaultCache,
    {
      matcher: ({ request }) =>
        request.destination === 'document' &&
        ['/', '/cellar', '/history'].includes(new URL(request.url).pathname),
      handler: new StaleWhileRevalidate({ cacheName: 'pages-cache' }),
    },
    // Photo bytes behind /api/v1/photos/[...path] are immutable -- the path
    // itself is the identifier, never reused for different bytes (see
    // app/api/v1/photos/[...path]/route.ts) -- so CacheFirst is safe: once
    // cached, never refetched. This is what makes an already-viewed photo
    // available offline (unlike the signed URLs it replaced, whose token
    // changed on every request and so never hit the same cache key twice).
    {
      matcher: ({ url }) => url.pathname.startsWith('/api/v1/photos/'),
      handler: new CacheFirst({
        cacheName: 'photo-cache',
        plugins: [
          new ExpirationPlugin({ maxEntries: 300 }),
          new CacheableResponsePlugin({ statuses: [200] }),
        ],
      }),
    },
  ],
})

serwist.addEventListeners()

// Allow the client to trigger skipWaiting on demand
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})
