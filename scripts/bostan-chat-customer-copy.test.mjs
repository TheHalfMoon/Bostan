import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const paths = [
 "ChatIdentityConfirm.tsx", "SlackIdentityStep.tsx", "SlackTestMessageButton.tsx",
 "PhotonConnectStep.tsx", "ChatConversationList.tsx", "EmailEndpointSetup.tsx",
 "slack/OwnSlackAppSetup.tsx",
];
for (const name of paths) {
 test("native Bostan chat branding: " + name, () => {
   const content = readFileSync(fileURLToPath(new URL(
     "../ui/src/pages/apps/chat/" + name, import.meta.url)), "utf8");
   assert.match(content, /Bostan/);
   assert.doesNotMatch(content, /\bPaperclip\b/);
 });
}
test("persisted Slack principal label compatibility is unchanged", () => {
 const content = readFileSync(fileURLToPath(new URL(
  "../ui/src/pages/apps/chat/SlackIdentityStep.tsx", import.meta.url)), "utf8");
 assert.match(content, /identity\.paperclipUserLabel/);
 assert.match(content, /another Bostan account/);
});
