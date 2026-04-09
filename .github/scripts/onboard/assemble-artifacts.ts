import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  assembleOnboardingArtifacts,
  type GeneratedArtifact,
} from '@/lib/onboarding/artifacts';

function readArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const repoRoot = readArg('--repo') ?? process.cwd();
  const summaryPath = readArg('--summary-path') ?? path.join(repoRoot, '.ai-board/onboarding/artifact-summary.json');
  const configPath = readArg('--config-path');
  const analysisPath = readArg('--analysis-path');
  const guidanceDir = readArg('--guidance-dir');
  const partialReason = readArg('--partial-reason');
  const existingPaths = (readArg('--existing-protected') ?? 'CLAUDE.md,AGENTS.md,.ai-board/memory/constitution.md')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  if (!configPath || !analysisPath) {
    throw new Error('config-path and analysis-path are required');
  }

  const deterministicArtifacts: GeneratedArtifact[] = [
    { path: '.ai-board/config.yml', kind: 'config', content: await readFile(configPath, 'utf8') },
    { path: '.ai-board/onboarding/repository-analysis.json', kind: 'analysis', content: await readFile(analysisPath, 'utf8') },
  ];

  const guidanceArtifacts: GeneratedArtifact[] = [];
  if (guidanceDir) {
    const guidanceFiles: Array<[string, GeneratedArtifact['kind']]> = [
      ['CLAUDE.md', 'guidance'],
      ['AGENTS.md', 'agent-entry'],
      ['.ai-board/memory/constitution.md', 'constitution'],
    ];

    for (const [fileName, kind] of guidanceFiles) {
      const artifactPath = path.join(guidanceDir, fileName);
      try {
        guidanceArtifacts.push({
          path: fileName,
          kind,
          content: await readFile(artifactPath, 'utf8'),
        });
      } catch {
        // Missing guidance file is represented in summary during partial runs.
      }
    }
  }

  const assembled = assembleOnboardingArtifacts({
    existingPaths,
    deterministicArtifacts,
    guidanceArtifacts,
    analysisPath: '.ai-board/onboarding/repository-analysis.json',
    partialReason,
  });

  for (const file of assembled.filesToWrite) {
    const destination = path.join(repoRoot, file.path);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, file.content, 'utf8');
  }

  await mkdir(path.dirname(summaryPath), { recursive: true });
  await writeFile(summaryPath, `${JSON.stringify(assembled.summary, null, 2)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify({ summaryPath, summary: assembled.summary })}\n`);
}

main().catch((error) => {
  console.error('[onboard/assemble-artifacts] Failed:', error);
  process.exitCode = 1;
});
