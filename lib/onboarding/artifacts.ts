export const PROTECTED_GUIDANCE_PATHS = new Set([
  'CLAUDE.md',
  'AGENTS.md',
  '.ai-board/memory/constitution.md',
]);

export type ArtifactKind =
  | 'config'
  | 'guidance'
  | 'constitution'
  | 'agent-entry'
  | 'command'
  | 'script'
  | 'analysis';

export interface ArtifactRecord {
  path: string;
  kind: ArtifactKind;
  reason?: string;
}

export interface GeneratedArtifact {
  path: string;
  kind: ArtifactKind;
  content: string;
}

export interface OnboardingArtifactSummary {
  created: ArtifactRecord[];
  preserved: ArtifactRecord[];
  missing: ArtifactRecord[];
  analysisPath?: string;
  partialReason?: string;
}

export interface AssembleArtifactsInput {
  existingPaths: Iterable<string>;
  deterministicArtifacts: GeneratedArtifact[];
  guidanceArtifacts?: GeneratedArtifact[];
  analysisPath?: string;
  partialReason?: string;
}

export interface AssembleArtifactsResult {
  filesToWrite: GeneratedArtifact[];
  summary: OnboardingArtifactSummary;
}

function classifyProtectedArtifact(path: string): ArtifactKind {
  if (path === '.ai-board/memory/constitution.md') return 'constitution';
  if (path === 'AGENTS.md') return 'agent-entry';
  return 'guidance';
}

export function assembleOnboardingArtifacts(input: AssembleArtifactsInput): AssembleArtifactsResult {
  const existing = new Set(input.existingPaths);
  const created: ArtifactRecord[] = [];
  const preserved: ArtifactRecord[] = [];
  const missing: ArtifactRecord[] = [];
  const filesToWrite: GeneratedArtifact[] = [];

  for (const artifact of input.deterministicArtifacts) {
    filesToWrite.push(artifact);
    created.push({ path: artifact.path, kind: artifact.kind });
  }

  const guidanceArtifacts = input.guidanceArtifacts ?? [];
  for (const artifact of guidanceArtifacts) {
    if (PROTECTED_GUIDANCE_PATHS.has(artifact.path) && existing.has(artifact.path)) {
      preserved.push({
        path: artifact.path,
        kind: classifyProtectedArtifact(artifact.path),
        reason: 'existing file preserved',
      });
      continue;
    }

    filesToWrite.push(artifact);
    created.push({ path: artifact.path, kind: artifact.kind });
  }

  if (input.partialReason) {
    for (const protectedPath of PROTECTED_GUIDANCE_PATHS) {
      if (existing.has(protectedPath)) {
        preserved.push({
          path: protectedPath,
          kind: classifyProtectedArtifact(protectedPath),
          reason: 'existing file preserved',
        });
      } else if (!guidanceArtifacts.some((artifact) => artifact.path === protectedPath)) {
        missing.push({
          path: protectedPath,
          kind: classifyProtectedArtifact(protectedPath),
          reason: input.partialReason,
        });
      }
    }
  }

  const summary: OnboardingArtifactSummary = {
    created,
    preserved,
    missing,
  };

  if (input.analysisPath) {
    summary.analysisPath = input.analysisPath;
  }

  if (input.partialReason) {
    summary.partialReason = input.partialReason;
  }

  return {
    filesToWrite,
    summary,
  };
}
