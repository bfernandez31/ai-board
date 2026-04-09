import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { detectStackFromRepository } from '@/lib/onboarding/detect-stack';
import { generateProjectConfigYaml } from '@/lib/onboarding/generate-config';

function readArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const repoRoot = readArg('--repo') ?? process.cwd();
  const outputDir = readArg('--output-dir') ?? path.join(repoRoot, '.ai-board/onboarding');
  const agent = (readArg('--agent') as 'CLAUDE' | 'CODEX' | undefined) ?? 'CLAUDE';
  const defaultBranch = readArg('--default-branch') ?? 'main';

  const analysis = await detectStackFromRepository(repoRoot, { agent, defaultBranch });
  const generatedConfig = generateProjectConfigYaml(analysis);

  await mkdir(outputDir, { recursive: true });
  await writeFile(
    path.join(outputDir, 'repository-analysis.json'),
    `${JSON.stringify(analysis, null, 2)}\n`,
    'utf8',
  );
  await writeFile(path.join(outputDir, 'config.yml'), generatedConfig.yaml, 'utf8');

  process.stdout.write(`${JSON.stringify({
    analysisPath: path.join(outputDir, 'repository-analysis.json'),
    configPath: path.join(outputDir, 'config.yml'),
    analysis,
  })}\n`);
}

main().catch((error) => {
  console.error('[onboard/detect-stack] Failed:', error);
  process.exitCode = 1;
});
