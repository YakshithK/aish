#!/usr/bin/env node
import { handlePayload } from '../src/hook-bash.js';

let raw = '';
for await (const chunk of process.stdin) raw += chunk;

let payload;
try {
  payload = JSON.parse(raw);
} catch {
  process.exit(0);
}

const output = handlePayload(payload);
if (output) process.stdout.write(JSON.stringify(output));
process.exit(0);
