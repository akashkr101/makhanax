import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const index = readFileSync('dist/makhana-x/browser/index.html', 'utf8');
assert.ok(index.includes('<app-shell'), 'The built entry page must contain the Angular shell.');
assert.ok(index.includes('src="main'), 'The built entry page must load the application bundle.');
assert.ok(!index.includes('Welcome to Firebase Hosting'), 'A Hosting placeholder must not replace the application.');
assert.ok(!existsSync('public/index.html'), 'Public assets must not override the Angular entry page.');
console.log('Built Angular entry page verified.');