/**
 * Private Windows diagnostic only. Keep a bounded, privacy-sensitive capture
 * in memory. Stdout and stderr are independent streams: never concatenate a
 * partial marker from one stream with bytes from the other and claim a trace.
 * Never log or persist capture.text (it may contain sensitive runtime output).
 */
export function appendPrivateWindowsImportCapture(capture,chunk,{limit=65536,source}={}){
  if(!capture||typeof capture.text!=='string'||
     typeof capture.truncated!=='boolean'||
     (capture.interleaved!==undefined&&typeof capture.interleaved!=='boolean')||
     (capture.lastSource!==undefined&&capture.lastSource!==null&&
       !['stdout','stderr'].includes(capture.lastSource))||
     (source!==undefined&&!['stdout','stderr'].includes(source))||
     !Number.isSafeInteger(limit)||limit<1||limit>65536)
    throw Error('Private Windows import capture refused invalid configuration');
  const changedSource=source!==undefined&&capture.lastSource!=null&&
    capture.lastSource!==source;
  const partialBoundary=changedSource&&capture.text.length>0&&
    !capture.text.endsWith('\n');
  // A delimiter prevents a marker being forged across stdout/stderr. A
  // partial switch also permanently invalidates completeness of the trace.
  const combined=capture.text+(partialBoundary?'\n':'')+String(chunk);
  return {
    text:combined.slice(-limit),
    truncated:capture.truncated||combined.length>limit,
    interleaved:Boolean(capture.interleaved||partialBoundary),
    lastSource:source??capture.lastSource??null,
  };
}
