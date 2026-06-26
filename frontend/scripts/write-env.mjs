import { writeFileSync } from 'node:fs';

const signalingUrl = process.env.SIGNALING_URL?.trim() || 'https://your-api.onrender.com';

const contents = `export const environment = {
  production: true,
  signalingUrl: '${signalingUrl.replace(/'/g, "\\'")}',
};
`;

writeFileSync(new URL('../src/environments/environment.prod.ts', import.meta.url), contents, 'utf8');
console.log(`environment.prod.ts → signalingUrl: ${signalingUrl}`);
