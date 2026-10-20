import type { NextConfig } from 'next'
import withSerwistInit from '@serwist/next'

const withSerwist = withSerwistInit({
  swSrc: 'sw.ts',
  swDest: 'public/sw.js',
  disable: process.env.NODE_ENV === 'development',
})

const nextConfig: NextConfig = {
  turbopack: {},
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        // Signed URLs (createSignedUrl/createSignedUrls against the now-private
        // wine-photos bucket, see lib/storage/wine-photos.ts) are served from
        // the "sign" endpoint, not "public", and always carry a `?token=...`
        // query string whose value is unpredictable (it's a fresh signature
        // each time), unlike the old public-bucket URLs. `search` only
        // supports an exact-match string or being entirely omitted (no
        // wildcard syntax for it, unlike `pathname`/`hostname`) -- per the
        // Next.js docs, omitting it allows any search string, which is what
        // a per-request token requires.
        pathname: '/storage/v1/object/sign/wine-photos/**',
      },
    ],
  },
}

export default withSerwist(nextConfig)
