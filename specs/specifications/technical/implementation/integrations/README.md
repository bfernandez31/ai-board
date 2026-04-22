# External Integrations

GitHub Actions, Stripe billing, Cloudinary CDN, and Vercel deployment integrations.

## Documents in This Section

- [GitHub Actions](./github.md) — Workflow architecture, multi-repo support, webhooks, credential guard
- [Stripe Billing](./stripe.md) — Checkout, Customer Portal, webhooks, plan enforcement
- [Cloudinary CDN](./cloudinary.md) — Image upload, transformation, storage
- [Vercel Deployment](./vercel.md) — Preview deployments, production deployment

## Error Handling Patterns

### Retry with Exponential Backoff

```typescript
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;

      const delay = Math.min(1000 * 2 ** attempt, 30000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw new Error('Max retries exceeded');
}

// Usage
const result = await retryWithBackoff(() =>
  octokit.rest.actions.createWorkflowDispatch({ ... })
);
```

### Graceful Degradation

```typescript
try {
  await deleteImage(publicId);
} catch (error) {
  // Log but don't throw - continue with database operation
  console.error('Cloudinary deletion failed:', error);
  // Image becomes orphaned but database stays consistent
}
```

### Circuit Breaker (Future Enhancement)

```typescript
class CircuitBreaker {
  private failures = 0;
  private lastFailureTime?: number;

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.isOpen()) {
      throw new Error('Circuit breaker open');
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private isOpen(): boolean {
    if (this.failures >= 5) {
      const timeSinceFailure = Date.now() - (this.lastFailureTime || 0);
      return timeSinceFailure < 60000;  // 1 minute cooldown
    }
    return false;
  }

  private onSuccess() {
    this.failures = 0;
  }

  private onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();
  }
}
```
