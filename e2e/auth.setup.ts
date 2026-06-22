import { test as setup } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import WebSocket from 'ws'
import { AUTH_FILE, TEST_EMAIL } from './helpers/constants'

setup('authenticate test user', async ({ page }) => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!serviceRoleKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is required for e2e tests.\n' +
      'Add it to .env.local from Supabase Dashboard → Settings → API → service_role key.'
    )
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    // Node.js 20 has no native WebSocket; provide the ws polyfill
    realtime: { transport: WebSocket as unknown as typeof global.WebSocket },
  })

  const { data, error } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: TEST_EMAIL,
    options: { redirectTo: 'http://localhost:3000/auth/callback' },
  })

  if (error || !data?.properties?.action_link) {
    throw new Error(`Failed to generate magic link: ${error?.message ?? 'no action_link'}`)
  }

  // Navigate to action_link. Without a PKCE verifier in this headless context,
  // Supabase falls back to implicit flow and redirects to /login#access_token=...
  await page.goto(data.properties.action_link)
  await page.waitForLoadState('networkidle')

  const currentUrl = page.url()

  if (currentUrl.includes('#access_token=')) {
    const hashParams = new URLSearchParams(currentUrl.split('#')[1] ?? '')
    const accessToken = hashParams.get('access_token')!
    const refreshToken = hashParams.get('refresh_token')!
    const expiresAt = parseInt(hashParams.get('expires_at') ?? '0')

    // Decode JWT payload (URL-safe base64) to get the user ID
    const payloadB64 = accessToken.split('.')[1]
    const payload = JSON.parse(
      Buffer.from(payloadB64.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
    )

    const { data: { user }, error: userErr } = await admin.auth.admin.getUserById(payload.sub)
    if (userErr || !user) throw new Error(`Could not fetch test user: ${userErr?.message}`)

    // Build the session object in the exact format @supabase/ssr stores in cookies
    const session = {
      access_token: accessToken,
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: expiresAt,
      refresh_token: refreshToken,
      user,
    }

    // Write cookie(s), chunking if the session JSON exceeds the browser limit
    const projectRef = new URL(supabaseUrl).hostname.split('.')[0]
    const CHUNK_SIZE = 3180
    const sessionStr = JSON.stringify(session)

    if (sessionStr.length <= CHUNK_SIZE) {
      await page.context().addCookies([{
        name: `sb-${projectRef}-auth-token`,
        value: sessionStr,
        domain: 'localhost',
        path: '/',
      }])
    } else {
      for (let i = 0; i * CHUNK_SIZE < sessionStr.length; i++) {
        await page.context().addCookies([{
          name: `sb-${projectRef}-auth-token.${i}`,
          value: sessionStr.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE),
          domain: 'localhost',
          path: '/',
        }])
      }
    }

    await page.goto('http://localhost:3000/')
  }

  // Should now be on dashboard or onboarding
  await page.waitForURL(/localhost:3000(\/onboarding|\/)?$/, { timeout: 15_000 })
  await page.context().storageState({ path: AUTH_FILE })
})
