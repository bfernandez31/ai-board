import { NextResponse } from 'next/server';
import { PLANS } from '@/lib/billing/plans';

export async function GET() {
  const plans = Object.values(PLANS).map((plan) => ({
    plan: plan.plan,
    name: plan.name,
    priceMonthly: plan.priceMonthly,
    features: plan.features,
    limits: plan.limits,
  }));

  return NextResponse.json({ plans });
}
