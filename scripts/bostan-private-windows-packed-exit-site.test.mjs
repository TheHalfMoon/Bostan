import assert from "node:assert/strict";
import {test} from "node:test";
import {classifyPrivatePackedExitSite as classify} from "./bostan-private-windows-packed-exit-site.mjs";
const root="D:\\Bostan-B144-qa";
test("classifies owned Windows packed entry or chunk without leaking paths",()=>{
  assert.equal(classify("Error\n at kill (file:///D:/Bostan-B144-qa/server/dist-runtime/server.mjs:456:11)",root),"packed_server");
  assert.equal(classify("Error\n at fn (D:\\Bostan-B144-qa\\server\\dist-runtime\\chunk-A33.mjs:1:8)",root),"packed_chunk");
  assert.equal(classify("Error\n at x (D:\\Bostan-B144-qa\\server\\dist-runtime\\index.mjs:1:8)",root),"packed_entry");
});
test("refuses external and forged paths",()=>{
  assert.equal(classify("Error: file:///D:/Bostan-B144-qa/server/dist-runtime/server.mjs:1:1",root),"unknown");
  assert.equal(classify("Error\n at fn (D:\\secret\\server\\dist-runtime\\server.mjs:1:2)",root),"unknown");
  assert.equal(classify("Error\n at fn (D:\\Bostan-B144-qa-copy\\server\\dist-runtime\\server.mjs:1:2)",root),"unknown");
});
