import { useMutation, useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/app/lib/query-keys";
import type { SubscriptionPlan } from "@prisma/client";

interface PlanLimits {
  maxProjects: number;
  maxTicketsPerMonth: number;
  membersAllowed: boolean;
  advancedAnalytics: boolean;
  byokRequired: boolean;
}

interface PlanConfigResponse {
  name: string;
  price: number;
  features: string[];
  limits: PlanLimits;
}

interface SubscriptionDetails {
  status: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  trialEnd: string | null;
}

export interface SubscriptionResponse {
  plan: SubscriptionPlan;
  planConfig: PlanConfigResponse;
  subscription: SubscriptionDetails | null;
}

interface CheckoutResponse {
  url: string;
}

interface PortalResponse {
  url: string;
}

/**
 * Hook to fetch the current user's subscription
 */
export function useSubscription() {
  return useQuery<SubscriptionResponse, Error>({
    queryKey: queryKeys.subscription.current,
    queryFn: async () => {
      const response = await fetch("/api/stripe/subscription", {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to fetch subscription");
      }

      return response.json();
    },
  });
}

/**
 * Hook to create a Stripe Checkout session
 */
export function useCheckout() {
  return useMutation<CheckoutResponse, Error, { plan: "PRO" | "TEAM" }>({
    mutationFn: async ({ plan }) => {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ plan }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create checkout session");
      }

      return response.json();
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
  });
}

/**
 * Hook to create a Stripe Customer Portal session
 */
export function useCustomerPortal() {
  return useMutation<PortalResponse, Error>({
    mutationFn: async () => {
      const response = await fetch("/api/stripe/portal", {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create portal session");
      }

      return response.json();
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
  });
}
