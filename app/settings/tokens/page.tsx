import { TokenListCard } from '@/components/settings/token-list-card';

export const dynamic = 'force-dynamic';

export default function TokensPage() {
  return (
    <main className="container mx-auto py-10 max-w-4xl">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Personal Access Tokens</h1>
          <p className="text-muted-foreground mt-2">
            Generate tokens to authenticate external tools with the AI-Board API.
          </p>
        </div>

        <TokenListCard />
      </div>
    </main>
  );
}
