import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const files=[
  ['ui/src/components/AnnouncementWell.tsx',['Bostan announcements']],
  ['ui/src/components/IssueChatThread.tsx',['runAgentName ?? "Bostan"','authorName ?? runAgentName ?? "Bostan"']],
  ['ui/src/components/IssueThreadInteractionCard.tsx',['Bostan is retrying the agent resume','Bostan needs attention before the agent','Bostan is re-checking authority']],
  ['ui/src/components/StandaloneBrowserControls.tsx',['document.title || "Bostan"']],
  ['ui/src/components/WorkspaceRuntimeControls.tsx',['Long-running commands that Bostan can supervise']],
  ['ui/src/components/SubscriptionCostCard.tsx',['their Bostan usage','including use outside Bostan']],
  ['ui/src/components/DevRestartBanner.tsx',['Restart Bostan now?']],
  ['ui/src/components/IssueBlockedNotice.tsx',['Bostan will ask the assignee','Bostan needs someone to choose']],
  ['ui/src/components/AgentLifecycleStatus.tsx',['Bostan retries automatically']],
  ['ui/src/pages/BoardChat.tsx',['manages their Bostan company']],
  ['ui/src/pages/PluginManager.tsx',['management UI for the Bostan plugin system']],
];
test('Bostan owns its first-party runtime and agent notice wording',()=>{
  for(const [relative,fragments] of files){
    const source=readFileSync(root+relative,'utf8');
    for(const fragment of fragments){
      assert.ok(source.includes(fragment),`Missing first-party Bostan copy in ${relative}: ${fragment}`);
      const legacy=fragment.replaceAll('Bostan','Paperclip');
      assert.ok(!source.includes(legacy),`Old product copy leaked in ${relative}: ${legacy}`);
    }
  }
});
test('attached-file icon and native adapter compatibility symbols stay intact',()=>{
  const source=readFileSync(root+'ui/src/components/IssueChatThread.tsx','utf8');
  assert.match(source,/usePaperclipIssueRuntime/);
  assert.match(source,/<Paperclip className=/);
});
