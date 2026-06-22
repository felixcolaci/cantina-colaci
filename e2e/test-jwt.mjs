import { readFileSync } from 'fs'
import https from 'https'

const authState = JSON.parse(readFileSync('e2e/.auth/user.json', 'utf8'))
const cookies = authState.cookies ?? []

// Find auth cookie (may be single or chunked)
const single = cookies.find(c => c.name.match(/sb-.+-auth-token$/) && !c.name.includes('.'))
const chunks = cookies
  .filter(c => c.name.match(/sb-.+-auth-token\.\d+$/))
  .sort((a, b) => a.name.localeCompare(b.name))

let session
if (single) {
  session = JSON.parse(single.value)
} else if (chunks.length > 0) {
  session = JSON.parse(chunks.map(c => c.value).join(''))
} else {
  console.log('Auth cookies:', cookies.map(c => c.name))
  process.exit(1)
}

const token = session.access_token
const [h, p] = token.split('.')
const hdr = JSON.parse(Buffer.from(h, 'base64url').toString())
const payload = JSON.parse(Buffer.from(p, 'base64url').toString())

console.log('JWT alg:  ', hdr.alg)
console.log('JWT role: ', payload.role)
console.log('JWT sub:  ', payload.sub)
console.log('Expired:  ', new Date(payload.exp * 1000) < new Date())

// Test 1: SELECT from families with user JWT
const get = (path, headers) => new Promise(resolve => {
  https.get({ hostname: 'izcqkcyxraqnumztzkzx.supabase.co', path, headers }, res => {
    let d = ''
    res.on('data', c => d += c)
    res.on('end', () => resolve({ status: res.statusCode, body: d }))
  })
})

const result = await get(
  '/rest/v1/families?select=id&limit=1',
  {
    apikey: 'sb_publishable_iiHDg7T_Yk-M7CfqKGg-qg_noZM7t8q',
    Authorization: `Bearer ${token}`,
  }
)

console.log('\nPostgREST SELECT families:')
console.log('  Status:', result.status)
console.log('  Body:  ', result.body.substring(0, 200))

// Test 2: INSERT into families with user JWT
const insertResult = await new Promise(resolve => {
  const body = JSON.stringify({ name: 'JWT-Test-Family', created_by: payload.sub })
  const req = https.request({
    hostname: 'izcqkcyxraqnumztzkzx.supabase.co',
    path: '/rest/v1/families',
    method: 'POST',
    headers: {
      apikey: 'sb_publishable_iiHDg7T_Yk-M7CfqKGg-qg_noZM7t8q',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      'Content-Length': Buffer.byteLength(body),
    },
  }, res => {
    let d = ''
    res.on('data', c => d += c)
    res.on('end', () => resolve({ status: res.statusCode, body: d }))
  })
  req.write(body)
  req.end()
})

console.log('\nPostgREST INSERT into families:')
console.log('  Status:', insertResult.status)
console.log('  Body:  ', insertResult.body.substring(0, 300))

// Test 3: Check auth.uid() via a custom RPC (or via SQL in a test function)
// Use service role to run raw SQL and check what auth.uid() returns with the user JWT
const rpcResult = await new Promise(resolve => {
  const body = JSON.stringify({})
  const req = https.request({
    hostname: 'izcqkcyxraqnumztzkzx.supabase.co',
    path: '/rest/v1/rpc/check_auth_uid',
    method: 'POST',
    headers: {
      apikey: 'sb_publishable_iiHDg7T_Yk-M7CfqKGg-qg_noZM7t8q',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
    },
  }, res => {
    let d = ''
    res.on('data', c => d += c)
    res.on('end', () => resolve({ status: res.statusCode, body: d }))
  })
  req.write(body)
  req.end()
})

console.log('\nRPC check_auth_uid:')
console.log('  Status:', rpcResult.status)
console.log('  Body:  ', rpcResult.body.substring(0, 200))
