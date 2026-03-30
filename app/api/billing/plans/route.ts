import { NextResponse } from 'next/server';
import { PLANS } from '@/lib/billing/plans';

export async function GET() {
  try {
    const plans = Object.values(PLANS).map((plan) => ({
      plan: plan.plan,
      name: plan.name,
      priceMonthly: plan.priceMonthly,
      features: plan.features,
      limits: plan.limits,
    }));

    return NextResponse.json({ plans });
  } catch (error) {
    console.error('Failed to fetch plans:', error);
    return NextResponse.json(
      { error: 'Failed to fetch plans' },
      { status: 500 }
    );
  }
}
