import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { resolveFamilyId } from '@/lib/mcp/auth'
import { createMcpServer } from '@/lib/mcp/server'
import { type NextRequest, NextResponse } from 'next/server'

// Shared auth + transport sequence for all three MCP handlers below (POST/GET/DELETE). Extracted
// so there's exactly one place implementing "extract Bearer token -> resolve family -> build a
// stateless transport" rather than three copies drifting out of sync.
async function handleMcpRequest(request: NextRequest): Promise<Response> {
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!token) {
    console.warn('[mcp] 401 missing bearer token', { at: new Date().toISOString() })
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const familyId = await resolveFamilyId(token)
  if (!familyId) {
    console.warn('[mcp] 401 invalid or unknown api key', {
      keyPrefix: token.slice(0, 8),
      at: new Date().toISOString(),
    })
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const server = createMcpServer(familyId)
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless
  })

  await server.connect(transport)
  return transport.handleRequest(request)
}

export async function POST(request: NextRequest) {
  return handleMcpRequest(request)
}

// MCP protocol also uses GET for SSE streams and DELETE to close sessions
export async function GET(request: NextRequest) {
  return handleMcpRequest(request)
}

export async function DELETE(request: NextRequest) {
  return handleMcpRequest(request)
}
