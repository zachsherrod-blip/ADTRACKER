#!/usr/bin/env tsx
/**
 * Runs scrape then starts the Next.js UI server.
 * Usage: npm run all -- --csv ./seed.csv
 */
import { spawn, execSync } from 'child_process';
import path from 'path';

const args = process.argv.slice(2);
const cwd = process.cwd();

async function main() {
  console.log('🔧 Building Next.js app...');
  try {
    execSync('npx next build', { stdio: 'inherit', cwd });
  } catch (e) {
    console.error('Build failed:', e);
    process.exit(1);
  }

  console.log('\n🕷️  Starting scrape...');
  await new Promise<void>((resolve, reject) => {
    const scrape = spawn(
      'npx',
      ['tsx', path.join(cwd, 'src/cli/run.ts'), ...args],
      { stdio: 'inherit', cwd }
    );
    scrape.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Scraper exited with code ${code}`));
    });
  });

  console.log('\n🌐 Starting UI at http://localhost:3000 ...');
  const ui = spawn('npx', ['next', 'start'], { stdio: 'inherit', cwd });

  process.on('SIGINT', () => {
    ui.kill();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
