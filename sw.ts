import { defaultCache } from '@serwist/next/worker'
import { Serwist, StaleWhileRevalidate } from 'serwist'

declare const self: ServiceWorkerGlobalScope & typeof globalThis & { __SW_MANIFEST: any }

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
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
  ],
})

serwist.addEventListeners()
