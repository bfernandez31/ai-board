# AI Chat Assistant for Project Context

AI-powered chat interface enabling users to ask questions about project documentation (specs) and codebase.

## Overview

**Vision**: Provide an intelligent assistant that can answer questions about:
1. Project specifications (`/specs/*/spec.md` files)
2. Codebase structure and implementation details
3. Feature history and design decisions

**Use Cases**:
- "What does ticket #023 specify about authentication?"
- "Show me the database schema for the Job model"
- "How does the drag-and-drop transition workflow work?"
- "What API endpoints exist for ticket management?"

## Vercel Free Tier Compatibility

### ✅ Requirements
- **Timeout**: Edge Functions have no 10-second limit (unlike Node.js runtime)
- **Invocations**: 100k/month free (sufficient for personal/prototype use)
- **Streaming**: Fully supported in Edge runtime
- **Database**: PostgreSQL via Prisma (existing infrastructure)

### ⚠️ Limitations
- **Context Size**: Must optimize token usage to avoid long LLM responses
- **Budget**: OpenAI API costs (~$0.01/message with GPT-4 Turbo)
- **No Vector DB**: Free tier doesn't include pgvector or external vector services

### ✅ Verdict
**YES - Fully compatible with Vercel Free using Edge Functions + lightweight context strategy**

---

## Solution Comparison Matrix

| Aspect | Minimalist (MVP) | Optimal (Full RAG) |
|--------|------------------|---------------------|
| **Development Time** | 5-8 hours | 15-20 hours |
| **Complexity** | Low | High |
| **Context Source** | Specs only (3 max) | Specs + full codebase |
| **Search Method** | Simple concatenation | Semantic vector search |
| **Database** | None (in-memory) | pgvector or Pinecone |
| **Streaming** | ✅ Yes (Edge) | ✅ Yes (Edge) |
| **Vercel Free Compatible** | ✅ Yes | ⚠️ Partial (needs external vector DB) |
| **Monthly Cost** | ~$1 (API only) | ~$10-20 (API + vector DB) |
| **Quality** | Good for specs | Excellent for entire codebase |
| **Recommended For** | MVP, personal projects | Production, teams |

---

## Minimalist Option (Recommended for MVP) ⭐

### Architecture

```
┌──────────────┐
│   Frontend   │
│  Chat Sheet  │
└──────┬───────┘
       │
       ▼
┌─────────────────────────────────┐
│  Edge Function (Vercel)         │
│  /api/projects/[id]/chat        │
│                                 │
│  1. Auth validation             │
│  2. Load specs (max 3 files)   │
│  3. Streaming proxy to LLM     │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────┐
│   OpenAI API    │
│  (GPT-4 Turbo)  │
└─────────────────┘
```

### Implementation Steps

#### 1. Backend - Edge API Route

**File**: `app/api/projects/[projectId]/chat/route.ts`

```typescript
import { StreamingTextResponse } from 'ai'
import { OpenAIStream } from 'ai'
import OpenAI from 'openai'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'

export const runtime = 'edge'
export const maxDuration = 60 // Edge allows longer duration

const chatSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string()
  })),
  projectId: z.number()
})

export async function POST(
  req: Request,
  { params }: { params: { projectId: string } }
) {
  // 1. Authentication
  const session = await getServerSession()
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 })
  }

  // 2. Parse and validate
  const body = await req.json()
  const { messages } = chatSchema.parse(body)
  const projectId = parseInt(params.projectId)

  // 3. Authorization - verify project ownership
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      userId: session.user.id
    }
  })

  if (!project) {
    return new Response('Forbidden', { status: 403 })
  }

  // 4. Fetch project specs (lightweight context)
  const specs = await getProjectSpecs(projectId)

  // 5. Build context prompt
  const systemPrompt = buildSystemPrompt(project.name, specs)

  // 6. Call OpenAI with streaming
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  })

  const response = await openai.chat.completions.create({
    model: 'gpt-4-turbo-preview',
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages
    ],
    stream: true,
    temperature: 0.7,
    max_tokens: 1000 // Limit response length
  })

  // 7. Return streaming response
  const stream = OpenAIStream(response)
  return new StreamingTextResponse(stream)
}

// Helper: Fetch latest 3 specs for context
async function getProjectSpecs(projectId: number) {
  const tickets = await prisma.ticket.findMany({
    where: { projectId },
    orderBy: { updatedAt: 'desc' },
    take: 3,
    select: {
      id: true,
      title: true,
      description: true,
      stage: true
    }
  })

  return tickets
}

// Helper: Build system prompt
function buildSystemPrompt(projectName: string, specs: any[]) {
  const specsText = specs.map(s =>
    `Ticket #${s.id}: ${s.title}\nDescription: ${s.description}\nStage: ${s.stage}`
  ).join('\n\n')

  return `You are an AI assistant for the project "${projectName}".

You have access to the following recent tickets:

${specsText}

Instructions:
- Answer questions concisely and accurately
- Cite ticket numbers when referencing information (e.g., "According to ticket #023...")
- If information is not in the provided context, say so clearly
- Provide actionable suggestions when appropriate

Respond in a helpful, professional tone.`
}
```

#### 2. Database Schema Extension

**Add to**: `prisma/schema.prisma`

```prisma
model ChatMessage {
  id        Int      @id @default(autoincrement())
  projectId Int
  userId    String
  role      String   @db.VarChar(20) // 'user' or 'assistant'
  content   String   @db.Text
  createdAt DateTime @default(now())

  project   Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([projectId, createdAt])
  @@index([userId])
}
```

**Add relations**:
```prisma
model Project {
  // ... existing fields
  chatMessages ChatMessage[]
}

model User {
  // ... existing fields
  chatMessages ChatMessage[]
}
```

#### 3. Frontend - Chat Interface

**File**: `components/chat/project-chat.tsx`

```typescript
'use client'

import { useChat } from 'ai/react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { MessageSquare, Send } from 'lucide-react'
import { useSession } from 'next-auth/react'

interface ProjectChatProps {
  projectId: number
  projectName: string
}

export function ProjectChat({ projectId, projectName }: ProjectChatProps) {
  const { data: session } = useSession()
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: `/api/projects/${projectId}/chat`,
    body: { projectId },
    onError: (error) => {
      console.error('Chat error:', error)
    }
  })

  if (!session) return null

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon">
          <MessageSquare className="h-4 w-4" />
        </Button>
      </SheetTrigger>

      <SheetContent side="right" className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle>AI Assistant - {projectName}</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col h-full pt-6">
          {/* Messages */}
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-4">
              {messages.length === 0 && (
                <div className="text-center text-muted-foreground py-8">
                  <p>Ask me anything about this project!</p>
                  <p className="text-sm mt-2">I have access to recent specifications and tickets.</p>
                </div>
              )}

              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`rounded-lg px-4 py-2 max-w-[80%] ${
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-lg px-4 py-2">
                    <div className="flex space-x-2">
                      <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" />
                      <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce [animation-delay:0.2s]" />
                      <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce [animation-delay:0.4s]" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Input */}
          <form onSubmit={handleSubmit} className="flex gap-2 pt-4 border-t">
            <Input
              value={input}
              onChange={handleInputChange}
              placeholder="Ask about this project..."
              disabled={isLoading}
            />
            <Button type="submit" size="icon" disabled={isLoading}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  )
}
```

#### 4. Integration in Header

**Update**: `components/layout/header.tsx`

```typescript
import { ProjectChat } from '@/components/chat/project-chat'

// ... existing code

export function Header({ projectId, projectName }: HeaderProps) {
  return (
    <header>
      {/* ... existing header content */}

      {/* Add chat button */}
      {projectId && (
        <ProjectChat projectId={projectId} projectName={projectName} />
      )}
    </header>
  )
}
```

#### 5. Dependencies

**Add to**: `package.json`

```json
{
  "dependencies": {
    "ai": "^3.0.0",
    "openai": "^4.20.0"
  }
}
```

### Configuration

**Add to**: `.env.local`

```bash
# OpenAI API Key (required)
OPENAI_API_KEY=sk-...

# Optional: Rate limiting
CHAT_MAX_MESSAGES_PER_MINUTE=10
```

### Features

✅ **Streaming responses** - Real-time word-by-word display
✅ **Context-aware** - Uses latest 3 ticket specs
✅ **Authenticated** - NextAuth session validation
✅ **Authorized** - Project ownership check
✅ **Optimized** - Lightweight context (<2K tokens)
✅ **Cost-effective** - ~$0.01 per message

### Limitations

- ⚠️ **Context**: Only 3 most recent specs (no full codebase search)
- ⚠️ **No history persistence**: Messages not saved to database (optional enhancement)
- ⚠️ **No semantic search**: Simple concatenation (no embeddings)
- ⚠️ **No file content**: Cannot read actual spec.md files (only ticket metadata)

### Cost Estimate

**Per 100 messages/month**:
- OpenAI API (GPT-4 Turbo): ~$1.00
- Vercel Edge Functions: $0 (free tier)
- Total: **~$1/month**

---

## Optimal Solution (Full RAG)

### Architecture

```
┌──────────────┐
│   Frontend   │
│  Chat Sheet  │
└──────┬───────┘
       │
       ▼
┌─────────────────────────────────────┐
│  Edge Function (Vercel)             │
│  /api/projects/[id]/chat            │
│                                     │
│  1. Auth validation                 │
│  2. Semantic search (embeddings)    │
│  3. Retrieve relevant chunks        │
│  4. Streaming proxy to LLM          │
└────────┬───────────────┬────────────┘
         │               │
         ▼               ▼
┌─────────────────┐   ┌──────────────┐
│   OpenAI API    │   │  Vector DB   │
│  (GPT-4 Turbo)  │   │  (pgvector)  │
└─────────────────┘   └──────────────┘
```

### Key Enhancements

#### 1. Vector Database (pgvector)

**Add to**: `prisma/schema.prisma`

```prisma
model CodeEmbedding {
  id         Int      @id @default(autoincrement())
  projectId  Int
  type       String   @db.VarChar(20) // 'spec', 'code', 'api'
  path       String   @db.VarChar(500)
  content    String   @db.Text
  embedding  Unsupported("vector(1536)")
  metadata   Json?
  createdAt  DateTime @default(now())

  project    Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([projectId, type])
}
```

**Enable pgvector**:
```sql
-- Run in PostgreSQL
CREATE EXTENSION IF NOT EXISTS vector;
```

#### 2. Indexing Service

**File**: `app/lib/embeddings/indexer.ts`

```typescript
import OpenAI from 'openai'
import { prisma } from '@/lib/db'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function indexProjectSpecs(projectId: number) {
  // 1. Read all spec.md files
  const specsDir = join(process.cwd(), 'specs')
  const specFiles = readdirSync(specsDir)
    .filter(dir => dir.match(/^\d{3}-/))
    .map(dir => join(specsDir, dir, 'spec.md'))

  // 2. Generate embeddings for each spec
  for (const filePath of specFiles) {
    const content = readFileSync(filePath, 'utf-8')

    // Split into chunks (max 8K tokens)
    const chunks = splitIntoChunks(content, 8000)

    for (const chunk of chunks) {
      const embedding = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: chunk
      })

      await prisma.$executeRaw`
        INSERT INTO "CodeEmbedding" (
          "projectId", "type", "path", "content", "embedding"
        ) VALUES (
          ${projectId},
          'spec',
          ${filePath},
          ${chunk},
          ${embedding.data[0].embedding}::vector
        )
      `
    }
  }
}

function splitIntoChunks(text: string, maxTokens: number): string[] {
  // Simple chunking by paragraphs (improve with token counting)
  const paragraphs = text.split('\n\n')
  const chunks: string[] = []
  let currentChunk = ''

  for (const para of paragraphs) {
    if ((currentChunk + para).length > maxTokens * 4) { // ~4 chars per token
      chunks.push(currentChunk)
      currentChunk = para
    } else {
      currentChunk += '\n\n' + para
    }
  }

  if (currentChunk) chunks.push(currentChunk)
  return chunks
}
```

#### 3. Semantic Search

**File**: `app/lib/embeddings/search.ts`

```typescript
import OpenAI from 'openai'
import { prisma } from '@/lib/db'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function semanticSearch(
  projectId: number,
  query: string,
  topK: number = 5
) {
  // 1. Generate query embedding
  const queryEmbedding = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: query
  })

  // 2. Perform vector similarity search
  const results = await prisma.$queryRaw`
    SELECT
      id,
      type,
      path,
      content,
      metadata,
      1 - (embedding <=> ${queryEmbedding.data[0].embedding}::vector) AS similarity
    FROM "CodeEmbedding"
    WHERE "projectId" = ${projectId}
    ORDER BY embedding <=> ${queryEmbedding.data[0].embedding}::vector
    LIMIT ${topK}
  `

  return results
}
```

#### 4. Enhanced API Route

**Update**: `app/api/projects/[projectId]/chat/route.ts`

```typescript
import { semanticSearch } from '@/app/lib/embeddings/search'

export async function POST(req: Request, { params }: { params: { projectId: string } }) {
  // ... authentication and validation

  // Get last user message
  const lastMessage = messages[messages.length - 1]

  // Semantic search for relevant context
  const relevantChunks = await semanticSearch(
    projectId,
    lastMessage.content,
    5 // Top 5 most relevant chunks
  )

  // Build enhanced context
  const contextPrompt = buildEnhancedPrompt(project.name, relevantChunks)

  // ... OpenAI streaming response
}

function buildEnhancedPrompt(projectName: string, chunks: any[]) {
  const context = chunks.map((c, i) =>
    `[Source ${i + 1}: ${c.path}]\n${c.content}`
  ).join('\n\n---\n\n')

  return `You are an AI assistant for "${projectName}".

Relevant context from the codebase:

${context}

Instructions:
- Answer based on the provided context
- Cite sources using [Source N] format
- If context is insufficient, acknowledge limitations
- Provide code examples when relevant

Respond professionally and concisely.`
}
```

### Features

✅ **Semantic search** - Retrieves most relevant context
✅ **Full codebase access** - Specs + code files
✅ **Source citations** - Links to exact file paths
✅ **Intelligent chunking** - Handles large files
✅ **Scalable** - Works with 1000+ files
✅ **Production-ready** - Vector indexing + caching

### Setup Requirements

1. **Enable pgvector** in PostgreSQL database
2. **Index codebase** on deployment (GitHub Actions)
3. **Update embeddings** when files change
4. **Monitor costs** (embedding generation)

### Cost Estimate

**Per month**:
- OpenAI API (GPT-4 Turbo): ~$10 (200 messages)
- OpenAI Embeddings: ~$2 (indexing + search)
- PostgreSQL (pgvector): $0 (included in Neon free tier)
- Total: **~$12/month**

**One-time indexing**:
- 100 files × $0.0001/file = ~$0.01
- Re-index on file changes

---

## Implementation Phases

### Phase 1: MVP (Week 1) - 5-8h ⭐
```
✅ Edge API route with streaming
✅ Simple spec concatenation (max 3)
✅ Frontend chat sheet UI
✅ Basic authentication/authorization
✅ OpenAI GPT-4 Turbo integration
💰 Cost: ~$1/month
```

### Phase 2: Enhanced Context (Week 2-3) - +8h
```
✅ Read actual spec.md files (not just metadata)
✅ Include ticket jobs/history
✅ Add conversation history (database)
✅ Rate limiting middleware
✅ Usage analytics
💰 Cost: ~$3/month
```

### Phase 3: Full RAG (Week 4-6) - +12h
```
✅ pgvector integration
✅ Codebase indexing service
✅ Semantic search implementation
✅ Source citation system
✅ Automatic re-indexing on changes
💰 Cost: ~$12/month
```

---

## Security Considerations

### Authentication & Authorization
- ✅ NextAuth session validation required
- ✅ Project ownership verification (userId match)
- ✅ No anonymous access allowed

### Rate Limiting
```typescript
// Middleware: app/middleware.ts
import { ratelimit } from '@/lib/rate-limit'

export async function middleware(req: NextRequest) {
  if (req.nextUrl.pathname.includes('/chat')) {
    const session = await getServerSession()
    const { success } = await ratelimit.limit(session.user.id)

    if (!success) {
      return new Response('Rate limit exceeded', { status: 429 })
    }
  }
}
```

### Data Privacy
- ✅ User messages scoped to projectId
- ✅ No cross-project data leakage
- ✅ Optional: Auto-delete history after 30 days
- ✅ Optional: End-to-end encryption for sensitive projects

### Prompt Injection Protection
```typescript
function sanitizeUserInput(input: string): string {
  // Remove system-like instructions
  return input
    .replace(/\[SYSTEM\]/gi, '')
    .replace(/\[ASSISTANT\]/gi, '')
    .slice(0, 2000) // Max 2K chars per message
}
```

---

## Monitoring & Analytics

### Key Metrics
- **Usage**: Messages per project per day
- **Performance**: Average response time (p50, p95)
- **Quality**: User feedback (thumbs up/down)
- **Cost**: Token usage per message
- **Errors**: LLM failures, timeout rate

### Dashboard (Future)
```sql
-- Example queries
SELECT
  DATE(created_at) as date,
  COUNT(*) as messages,
  AVG(LENGTH(content)) as avg_length
FROM "ChatMessage"
WHERE role = 'user'
GROUP BY DATE(created_at)
ORDER BY date DESC
LIMIT 30;
```

---

## Testing Strategy

### Unit Tests
```typescript
describe('Chat API', () => {
  it('should require authentication', async () => {
    const res = await fetch('/api/projects/1/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    })
    expect(res.status).toBe(401)
  })

  it('should validate project ownership', async () => {
    // Test with session.userId !== project.userId
  })

  it('should stream response correctly', async () => {
    // Test streaming with ReadableStream
  })
})
```

### E2E Tests
```typescript
test('User can chat with AI assistant', async ({ page }) => {
  await page.goto('/projects/3/board')
  await page.click('[data-testid="chat-button"]')
  await page.fill('[data-testid="chat-input"]', 'What is ticket #023 about?')
  await page.click('[data-testid="send-button"]')

  // Wait for streaming response
  await expect(page.locator('[data-testid="assistant-message"]')).toBeVisible()
})
```

---

## Troubleshooting

### Common Issues

**1. "Rate limit exceeded" error**
- Cause: Too many requests per minute
- Solution: Wait 60 seconds or increase rate limit

**2. Streaming not working**
- Cause: Missing `runtime = 'edge'` in API route
- Solution: Ensure Edge runtime is configured

**3. Empty responses**
- Cause: Insufficient context or API key issue
- Solution: Check OpenAI API key and context loading

**4. Slow responses (>10s)**
- Cause: Large context or slow LLM model
- Solution: Reduce context size, use faster model (GPT-3.5)

---

## Migration Path

### From MVP to Full RAG

**Step 1**: Deploy MVP (1 week)
```
✅ Basic chat working
✅ Specs-only context
✅ User feedback collected
```

**Step 2**: Monitor usage (2-4 weeks)
```
📊 Measure:
- Messages per day
- User satisfaction
- Context quality issues
```

**Step 3**: Decide on upgrade
```
🎯 Triggers for Full RAG:
- >100 messages/day
- Users request code search
- Context quality <70%
```

**Step 4**: Implement pgvector (1-2 weeks)
```
✅ Add vector column
✅ Index existing specs
✅ Deploy semantic search
✅ A/B test with 10% traffic
```

**Step 5**: Full rollout
```
✅ Monitor performance
✅ Tune relevance scoring
✅ Expand to code indexing
```

---

## References

### Documentation
- [Vercel AI SDK](https://sdk.vercel.ai/docs)
- [OpenAI API](https://platform.openai.com/docs/api-reference)
- [pgvector](https://github.com/pgvector/pgvector)
- [NextAuth.js](https://next-auth.js.org/)

### Related Files
- `app/api/projects/[projectId]/chat/route.ts` - API endpoint
- `components/chat/project-chat.tsx` - UI component
- `prisma/schema.prisma` - Database schema
- `specs/vision/README.md` - Vision documentation

---

**Last Updated**: 2025-10-15
**Status**: Design phase - ready for implementation
**Recommended Approach**: Start with Minimalist MVP, upgrade to Full RAG if usage grows
