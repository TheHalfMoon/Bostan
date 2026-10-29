/** Return ONLY a fixed site class for a Windows QA packed-module exit.
 * Never return a source path, third-party package ID or stack.
 */
import {win32} from "node:path";
export function classifyPrivatePackedExitSite(stack,root) {
  if(typeof stack!=="string"||typeof root!=="string"||
    !/^[a-z]:\\/i.test(root))return "unknown";
  const rootPath=win32.resolve(root);
  for(const frame of stack.split(/\r?\n/).slice(1,18)){
    const match=frame.match(/(?:file:\/\/\/)?([a-z]:[\\/][^\s()]*?\.(?:js|mjs)):\d{1,7}:\d{1,7}/i);
    if(!match)continue;
    const absolute=win32.resolve(match[1].replaceAll("/","\\"));
    const rel=win32.relative(rootPath,absolute).replaceAll("\\","/");
    if(rel==="server/dist-runtime/index.mjs")return "packed_entry";
    if(rel==="server/dist-runtime/server.mjs")return "packed_server";
    if(/^server\/dist-runtime\/chunk-[a-z0-9_-]+\.mjs$/i.test(rel))return "packed_chunk";
    if(/^server\/dist\/[a-zA-Z0-9_./-]+\.(?:js|mjs)$/.test(rel) &&
      !rel.includes("../"))return "compiled_server";
    if(/^scripts\/bostan-private-[a-zA-Z0-9_-]+\.mjs$/.test(rel))return "qa_preload";
    if(rel.startsWith("node_modules/")||rel.includes("/node_modules/"))return "third_party";
    if(rel.startsWith("../")||rel.includes("/../"))continue;
    if(/^packages\/[a-zA-Z0-9_./-]+\.(?:js|mjs)$/.test(rel))return "workspace";
  }
  return "unknown";
}
