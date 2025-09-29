export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 w-full max-w-5xl items-center justify-between text-center">
        <h1 className="text-4xl font-bold mb-4">AI Board</h1>
        <h2 className="text-2xl font-semibold text-green-600 mb-8">
          ✓ Foundation Ready
        </h2>
        <div className="text-left bg-gray-50 dark:bg-gray-900 p-6 rounded-lg">
          <p className="text-lg mb-4">
            Next.js 15 + TypeScript + TailwindCSS + Playwright configured
          </p>
          <h3 className="font-semibold mb-2">Constitutional Compliance:</h3>
          <ul className="space-y-2 text-sm">
            <li>✓ TypeScript Strict Mode Enabled</li>
            <li>✓ Component Structure Ready (/app, /components, /lib)</li>
            <li>✓ Playwright Testing Configured</li>
            <li>✓ Security: Environment Variables Protected</li>
            <li>✓ Database: Prisma Ready for Future Use</li>
          </ul>
        </div>
      </div>
    </main>
  );
}