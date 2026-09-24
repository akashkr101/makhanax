import { readFileSync } from 'node:fs';

const envFiles = [
  'src/environments/environment.ts',
  'src/environments/environment.development.ts',
  'src/environments/environment.test.ts',
  'src/environments/environment.production.ts'
];

const offendingFiles = envFiles.filter((file) => /demoMode:\s*true/i.test(readFileSync(file, 'utf8')));

if (offendingFiles.length > 0) {
  console.error('Demo mode is still enabled in live environment files:');
  for (const file of offendingFiles) {
    console.error(` - ${file}`);
  }
  process.exit(1);
}

console.log('Demo mode is disabled in all environment configs.');
