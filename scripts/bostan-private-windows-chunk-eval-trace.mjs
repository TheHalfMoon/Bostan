/**
 * PRIVATE synthetic-QA-only Windows ESM evaluation trace.
 * This never changes the production bundle on disk or emits paths/stack data.
 * A fixed 12-hex digest identifies the last *entered* packed module locally.
 * An entry marker is an observation, not proof of a culprit module.
 */
import {createHash} from 'node:crypto';
import {realpathSync,writeSync} from 'node:fs';
import {registerHooks} from 'node:module';
import {join,sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const KEY=Symbol.for('bostan.private.windows.chunk.eval.trace');
const SAFE_FILE=/^(?:index|server|chunk-[A-Z0-9]+)\.mjs$/;

export function instrumentPrivateRuntimeModule({
  url,format,source,root,canonicalize=realpathSync,
}={}){
  if(format!=='module'||typeof url!=='string'||!url.startsWith('file:')||
     typeof root!=='string'||!root)return null;
  const expected=join(root,'server','dist-runtime');
  const pathname=fileURLToPath(url);
  const canonicalRoot=canonicalize(expected);
  // Node may canonicalize a system alias (/tmp -> /private/tmp) before hooks.
  if(!pathname.startsWith(expected+sep) &&
     !pathname.startsWith(canonicalRoot+sep))return null;
  const canonicalFile=canonicalize(pathname);
  if(!canonicalFile.startsWith(canonicalRoot+sep))
    throw Error('Private chunk evaluation trace refused a linked runtime escape');
  const relative=canonicalFile.slice(canonicalRoot.length+1);
  if(!SAFE_FILE.test(relative))return null;
  if(typeof source!=='string' && !(source instanceof Uint8Array))
    throw Error('Private chunk evaluation trace refused an unsupported module source');
  const id=createHash('sha256').update(relative).digest('hex').slice(0,12);
  const prelude='globalThis[Symbol.for("bostan.private.windows.chunk.eval.trace")]?.("'+id+'");\n';
  return {id,source:prelude+(typeof source==='string'?source:Buffer.from(source).toString('utf8'))};
}

/**
 * Observe only SHA-owned packed ESM load boundaries, never source paths.
 * A start without completion means nextLoad did not return during observation;
 * it does not prove which dependency or operation caused the delay.
 */
export function tracePrivateRuntimeLoad({
  url,context,nextLoad,root,canonicalize=realpathSync,emit,
}={}){
  if(typeof nextLoad!=='function'||typeof emit!=='function')
    throw Error('Private chunk load trace refused invalid configuration');
  // Validate the canonical owned path before emitting even a digest marker.
  const admitted=instrumentPrivateRuntimeModule({
    url,format:'module',source:'',root,canonicalize,
  });
  if(admitted)emit('BOSTAN_WIN_CHUNK_LOAD_START='+admitted.id);
  // A throw deliberately leaves an unmatched START for bounded diagnosis.
  const result=nextLoad(url,context);
  if(admitted)emit('BOSTAN_WIN_CHUNK_LOAD_COMPLETE='+admitted.id);
  const transformed=instrumentPrivateRuntimeModule({
    url,format:result.format||context?.format,source:result.source,
    root,canonicalize,
  });
  return transformed?{...result,source:transformed.source}:result;
}

export function installPrivateRuntimeEvaluationTrace({
  root,register=registerHooks,canonicalize=realpathSync,
  emit=token=>writeSync(2,token+'\n'),
}={}){
  if(typeof root!=='string'||!root||typeof register!=='function')
    throw Error('Private chunk evaluation trace refused invalid configuration');
  Object.defineProperty(globalThis,KEY,{configurable:false,writable:false,
    value:id=>{if(/^[a-f0-9]{12}$/.test(id))emit('BOSTAN_WIN_CHUNK_EVAL='+id);}});
  register({load(url,context,nextLoad){
    return tracePrivateRuntimeLoad({url,context,nextLoad,root,canonicalize,emit});
  }});
}
