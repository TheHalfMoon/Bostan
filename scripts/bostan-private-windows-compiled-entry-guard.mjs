/** Node --import preload: reject an unsafe QA fixture before compiled app code. */
import { fileURLToPath } from 'node:url';
import { isPrivateWindowsQaEntryAllowed } from './bostan-private-windows-entry-admission.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
if (!isPrivateWindowsQaEntryAllowed({root})) {
  // Do not disclose paths, environment values, usernames, DB URLs or secrets.
  console.error('Bostan Windows compiled server refuses unsafe synthetic QA fixture');
  process.exit(2);
}
