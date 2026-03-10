"use client";

import { CreditCard, Check, ExternalLink, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useSubscription, useCheckout, useCustomerPortal } from "@/lib/hooks/mutations/useSubscription";
import { PLANS } from "@/lib/stripe/plans";
import type { SubscriptionPlan } from "@prisma/client";

const PLAN_ORDER: SubscriptionPlan[] = ["FREE", "PRO", "TEAM"];

export default function BillingSettingsPage() {
  const { data, isLoading, error } = useSubscription();
  const checkout = useCheckout();
  const portal = useCustomerPortal();

  const currentPlan = data?.plan || "FREE";

  return (
    <main className="container mx-auto py-10 max-w-4xl">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <CreditCard className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Billing</h1>
            <p className="text-sm text-muted-foreground">
              Manage your subscription and billing
            </p>
          </div>
        </div>

        {/* Current subscription status */}
        {data?.subscription && (
          <div className="rounded-lg border bg-muted/50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">
                  Current plan: <span className="text-primary">{data.planConfig.name}</span>
                </p>
                {data.subscription.trialEnd && new Date(data.subscription.trialEnd) > new Date() && (
                  <p className="text-sm text-muted-foreground">
                    Trial ends on {new Date(data.subscription.trialEnd).toLocaleDateString()}
                  </p>
                )}
                {data.subscription.cancelAtPeriodEnd && (
                  <p className="text-sm text-destructive">
                    Cancels on {new Date(data.subscription.currentPeriodEnd).toLocaleDateString()}
                  </p>
                )}
                {!data.subscription.cancelAtPeriodEnd && data.subscription.status === "ACTIVE" && (
                  <p className="text-sm text-muted-foreground">
                    Renews on {new Date(data.subscription.currentPeriodEnd).toLocaleDateString()}
                  </p>
                )}
              </div>
              <button
                onClick={() => portal.mutate()}
                disabled={portal.isPending}
                className="inline-flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
              >
                {portal.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ExternalLink className="h-4 w-4" />
                )}
                Manage subscription
              </button>
            </div>
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
            <p className="text-sm text-destructive">
              Failed to load subscription information. Please try again.
            </p>
          </div>
        )}

        {/* Plans grid */}
        {!isLoading && (
          <div className="grid gap-6 md:grid-cols-3">
            {PLAN_ORDER.map((planKey) => {
              const plan = PLANS[planKey];
              const isCurrent = currentPlan === planKey;
              const isPaid = planKey !== "FREE";

              return (
                <Card
                  key={planKey}
                  className={isCurrent ? "border-primary" : ""}
                >
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>{plan.name}</CardTitle>
                      {isCurrent && <Badge>Current</Badge>}
                    </div>
                    <CardDescription>
                      {plan.price === 0 ? (
                        <span className="text-2xl font-bold text-foreground">Free</span>
                      ) : (
                        <>
                          <span className="text-2xl font-bold text-foreground">
                            ${plan.price}
                          </span>
                          <span className="text-muted-foreground">/month</span>
                        </>
                      )}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-2 text-sm">
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                    {plan.trialDays > 0 && !data?.subscription && (
                      <p className="mt-3 text-xs text-muted-foreground">
                        {plan.trialDays}-day free trial
                      </p>
                    )}
                  </CardContent>
                  <CardFooter>
                    {isCurrent ? (
                      <button
                        disabled
                        className="w-full rounded-md bg-muted px-3 py-2 text-sm font-medium text-muted-foreground"
                      >
                        Current plan
                      </button>
                    ) : isPaid ? (
                      data?.subscription ? (
                        <button
                          onClick={() => portal.mutate()}
                          disabled={portal.isPending}
                          className="w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                        >
                          {portal.isPending ? (
                            <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                          ) : (
                            currentPlan === "FREE" ? "Subscribe" : "Change plan"
                          )}
                        </button>
                      ) : (
                        <button
                          onClick={() => checkout.mutate({ plan: planKey as "PRO" | "TEAM" })}
                          disabled={checkout.isPending}
                          className="w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                        >
                          {checkout.isPending ? (
                            <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                          ) : (
                            "Subscribe"
                          )}
                        </button>
                      )
                    ) : (
                      <button
                        disabled
                        className="w-full rounded-md bg-muted px-3 py-2 text-sm font-medium text-muted-foreground"
                      >
                        Free
                      </button>
                    )}
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
