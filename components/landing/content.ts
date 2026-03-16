import type { LucideIcon } from 'lucide-react';
import {
  Bot,
  BotMessageSquare,
  Eye,
  FileText,
  GitBranch,
  LayoutGrid,
  Rocket,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

export type LandingSectionId =
  | 'hero'
  | 'proof'
  | 'workflow'
  | 'capabilities'
  | 'pricing'
  | 'final-cta';

export interface LandingCta {
  id: 'primary-sign-in' | 'secondary-workflow';
  label: string;
  href: string;
}

export interface LandingSectionContent {
  id: LandingSectionId;
  eyebrow?: string;
  heading: string;
  supportingText: string;
}

export interface TrustSignal {
  title: string;
  description: string;
}

export interface CapabilityItem {
  icon: LucideIcon;
  iconClassName: string;
  title: string;
  description: string;
}

export interface WorkflowStepContent {
  stage: 'INBOX' | 'SPECIFY' | 'PLAN' | 'BUILD' | 'VERIFY';
  title: string;
  description: string;
}

export const LANDING_CTAS: Record<LandingCta['id'], LandingCta> = {
  'primary-sign-in': {
    id: 'primary-sign-in',
    label: 'Get Started Free',
    href: '/auth/signin',
  },
  'secondary-workflow': {
    id: 'secondary-workflow',
    label: 'Explore Workflow',
    href: '#workflow',
  },
};

export const LANDING_SECTIONS: LandingSectionContent[] = [
  {
    id: 'hero',
    eyebrow: 'AI-first delivery for product teams',
    heading: 'Turn one ticket into a reviewed, shippable change.',
    supportingText:
      'AI Board gives product teams a clear path from issue to specification, plan, implementation, and verification without losing the paper trail.',
  },
  {
    id: 'proof',
    eyebrow: 'Why teams trust the flow',
    heading: 'Every stage leaves artifacts your team can review.',
    supportingText:
      'Instead of asking a model for a blob of code, you get specs, plans, task breakdowns, workflow jobs, and preview-ready handoffs that stay attached to the ticket.',
  },
  {
    id: 'workflow',
    eyebrow: 'From intake to review',
    heading: 'A delivery workflow built for AI agents and humans.',
    supportingText:
      'Move work through the same sequence every time so contributors can inspect what happened, what is next, and where approval belongs.',
  },
  {
    id: 'capabilities',
    eyebrow: 'What the product actually does',
    heading: 'The board keeps scope, execution, and review connected.',
    supportingText:
      'Each section below focuses on a concrete part of the journey so visitors understand the product without wading through generic platform claims.',
  },
  {
    id: 'pricing',
    eyebrow: 'Pricing that matches the workflow',
    heading: 'Start free, then unlock more throughput and collaboration.',
    supportingText:
      'Choose the plan that fits your delivery rhythm. The upgrade path stays simple because the workflow stays the same.',
  },
  {
    id: 'final-cta',
    eyebrow: 'Start with the next ticket',
    heading: 'See what a structured AI delivery loop feels like in practice.',
    supportingText:
      'Sign in, create a ticket, and watch AI Board turn it into a sequence your team can inspect, discuss, and ship.',
  },
];

export const LANDING_SECTION_ORDER: LandingSectionId[] = LANDING_SECTIONS.map((section) => section.id);

export function getLandingSectionContent(id: LandingSectionId): LandingSectionContent {
  const section = LANDING_SECTIONS.find((item) => item.id === id);

  if (!section) {
    throw new Error(`Landing section content missing for ${id}`);
  }

  return section;
}

export const PROOF_SIGNALS: TrustSignal[] = [
  {
    title: 'Specs before code',
    description: 'Tickets expand into a specification and task plan before implementation starts.',
  },
  {
    title: 'Visible stage progression',
    description: 'The kanban flow shows whether work is waiting on clarification, building, verifying, or ready to ship.',
  },
  {
    title: 'Workflow-backed execution',
    description: 'Jobs run through repeatable automation steps instead of one-off prompts that disappear.',
  },
];

export const CAPABILITY_ITEMS: CapabilityItem[] = [
  {
    icon: FileText,
    iconClassName: 'text-primary',
    title: 'Generate a spec the team can inspect',
    description: 'Capture scope, edge cases, and success criteria before the implementation branch starts moving.',
  },
  {
    icon: LayoutGrid,
    iconClassName: 'text-ctp-blue',
    title: 'Track every ticket through a fixed stage model',
    description: 'Keep inbox, planning, build, verify, and ship state visible so status is not inferred from chat history.',
  },
  {
    icon: GitBranch,
    iconClassName: 'text-ctp-green',
    title: 'Connect repository workflows to the ticket lifecycle',
    description: 'Dispatch implementation, verification, preview, and rollback flows from the board instead of juggling scripts manually.',
  },
  {
    icon: Sparkles,
    iconClassName: 'text-ctp-lavender',
    title: 'Use AI assistance where it helps, not where it obscures',
    description: 'Chat, automation, and review points are explicit, so the workflow still makes sense when humans step in.',
  },
  {
    icon: ShieldCheck,
    iconClassName: 'text-ctp-yellow',
    title: 'Keep verification in the path to ship',
    description: 'Verification stays a named stage with tests and review, so “done” means more than code generated successfully.',
  },
  {
    icon: Rocket,
    iconClassName: 'text-ctp-sapphire',
    title: 'Hand off a clearer final step',
    description: 'Previews, status, and closing actions stay tied to the ticket so teams know what to merge, ship, or reopen.',
  },
];

export const WORKFLOW_STEPS: WorkflowStepContent[] = [
  {
    stage: 'INBOX',
    title: 'Collect the ticket and define what is actually being asked.',
    description: 'Pull in work from your tracker or create it directly in AI Board, then decide whether it needs a full workflow, a quick implementation, or cleanup.',
  },
  {
    stage: 'SPECIFY',
    title: 'Generate a specification before implementation begins.',
    description: 'The workflow writes the acceptance criteria, clarifies scope, and records decisions so reviewers can inspect the plan before code appears.',
  },
  {
    stage: 'PLAN',
    title: 'Turn the specification into ordered tasks.',
    description: 'AI Board breaks the work into concrete tasks, dependencies, and validation steps that match the repository’s conventions.',
  },
  {
    stage: 'BUILD',
    title: 'Run implementation against the approved plan.',
    description: 'The build stage executes the work and keeps artifacts attached to the ticket instead of scattering them across chat threads.',
  },
  {
    stage: 'VERIFY',
    title: 'Review what changed before shipping it onward.',
    description: 'Verification focuses on tests, regressions, and reviewer-visible output so the last step is confidence, not guesswork.',
  },
];

export const WORKFLOW_HIGHLIGHTS = [
  {
    icon: Eye,
    title: 'Review stays visible',
    description: 'Human checkpoints remain part of the flow instead of being implied.',
  },
  {
    icon: BotMessageSquare,
    title: 'Chat has a place',
    description: 'Assistive conversations support the ticket without replacing the workflow record.',
  },
  {
    icon: Bot,
    title: 'Automation keeps moving',
    description: 'When work is ready, automated steps advance it through the next stage.',
  },
];

export const PRICING_CALLOUTS = [
  'Free for solo evaluation and BYOK experimentation',
  'Pro for higher-volume execution with built-in trial onboarding',
  'Team for shared projects, members, and broader workflow visibility',
];
