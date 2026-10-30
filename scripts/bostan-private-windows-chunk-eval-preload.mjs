/** Strictly guarded Windows QA preload, never enabled in a production launch. */
import {fileURLToPath} from 'node:url';
import {isPrivateWindowsQaEntryAllowed} from './bostan-private-windows-entry-admission.mjs';
import {installPrivateRuntimeEvaluationTrace} from './bostan-private-windows-chunk-eval-trace.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
if(process.platform!=='win32'||!isPrivateWindowsQaEntryAllowed({root})){
  console.error('BOSTAN_WIN_CHUNK_EVAL_TRACE_REFUSED');
  process.exit(2);
}
installPrivateRuntimeEvaluationTrace({root});
