import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { resolveFamilyId } from '@/lib/mcp/auth'
import { createMcpServer } from '@/lib/mcp/server'
import { type NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!token) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const familyId = await resolveFamilyId(token)
  if (!familyId) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const server = createMcpServer(familyId)
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless
  })

  await server.connect(transport)
  return transport.handleRequest(request)
}

// MCP protocol also uses GET for SSE streams and DELETE to close sessions
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!token) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const familyId = await resolveFamilyId(token)
  if (!familyId) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const server = createMcpServer(familyId)
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  })

  await server.connect(transport)
  return transport.handleRequest(request)
}

export async function DELETE(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!token) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const familyId = await resolveFamilyId(token)
  if (!familyId) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const server = createMcpServer(familyId)
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  })

  await server.connect(transport)
  return transport.handleRequest(request)
}
