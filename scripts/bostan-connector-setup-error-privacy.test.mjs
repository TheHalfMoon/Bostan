import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source = readFileSync(new URL("../ui/src/features/connections/ConnectionSetupFlow.tsx",import.meta.url),"utf8");

test("Bostan connection setup never reflects upstream OAuth or connector enrollment exceptions",()=>{
  assert.match(source,/setOAuthError\(safeBostanConnectionOAuthStartError\(error\)\)/);
  assert.equal((source.match(/setOAuthError\(safeBostanConnectionOAuthStartError\(error, details\?\.code\)\)/g)||[]).length,2);
  assert.match(source,/setConnectorEnrollmentError\(safeBostanConnectorEnrollmentError\(target\.message\)\)/);
  assert.match(source,/setConnectorEnrollmentError\(safeBostanConnectorEnrollmentError\(error\)\)/);
  assert.doesNotMatch(source,/setOAuthError\(error instanceof Error \? error\.message/);
  assert.doesNotMatch(source,/setConnectorEnrollmentError\(target\.message\)/);
  assert.doesNotMatch(source,/error instanceof Error \? error\.message : "Paperclip couldn.t start secure sign-in/);
});
