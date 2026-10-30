/**
 * Private Windows diagnostic only. The rolling stdout/stderr capture is not
 * lossless once 64 KiB is exceeded. Make that fact explicit so a suffix-only
 * trace can never be mistaken for complete ESM evaluation evidence.
 * Never log or persist capture.text (it may contain sensitive runtime output).
 */
export function appendPrivateWindowsImportCapture(capture,chunk,{limit=65536}={}){
  if(!capture||typeof capture.text!=='string'||
     typeof capture.truncated!=='boolean'||
     !Number.isSafeInteger(limit)||limit<1||limit>65536)
    throw Error('Private Windows import capture refused invalid configuration');
  const combined=capture.text+String(chunk);
  return {
    text:combined.slice(-limit),
    truncated:capture.truncated||combined.length>limit,
  };
}
