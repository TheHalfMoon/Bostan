#!/usr/bin/env node
/** Actual signed-in Chromium acceptance for Bostan's private Members page. */
import {chromium} from '@playwright/test';
import {installPrivateBrowserNetworkCapture,assertPrivateBrowserEgressEvidence} from '../../scripts/bostan-local-browser-qa.mjs';

export function validateMemberBrowserTarget({origin,cookie,companyId,companyPrefix}){
  const u=new URL(origin);
  if(u.protocol!=='http:'||u.hostname!=='127.0.0.1'||!/^\d{4,5}$/.test(u.port)||Number(u.port)<1024||Number(u.port)>65535||u.pathname!=='/'||u.search||u.hash||u.username||u.password)throw Error('Private member browser requires explicit localhost URL');
  if(typeof companyId!=='string'||!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(companyId))throw Error('Private member browser requires valid disposable company UUID');
  if(typeof companyPrefix!=='string'||!/^[A-Z][A-Z0-9-]{1,15}$/.test(companyPrefix))throw Error('Private member browser requires a verified company URL prefix');
  // Better Auth encodes its signed cookie value (including % and =). Keep
  // only a single session-token cookie; reject every header/attribute delimiter.
  if(typeof cookie!=='string'||!/^([a-zA-Z0-9_.-]+)=([^\s;\r\n]{16,8192})$/.test(cookie)||!cookie.split('=',1)[0].endsWith('session_token'))throw Error('Private member browser requires real signed-in session cookie');
  const split=cookie.indexOf('=');
  return {origin:u.origin,name:cookie.slice(0,split),value:cookie.slice(split+1),companyId,companyPrefix};
}

// An enumerated, privacy-preserving page error category. Never include
// browser exception messages, source URLs, stack traces, user data or tokens.
export function classifyPrivateMembersPageError(error){
  const message=typeof error?.message==='string'?error.message:'';
  if(/Cannot read properties of undefined/.test(message))return 'undefined_property';
  if(/Cannot read properties of null/.test(message))return 'null_property';
  if(/is not a function/.test(message))return 'not_function';
  if(/Unrecognized extension value/.test(message))return 'editor_extension';
  if(/Failed to fetch dynamically imported module|Importing a module script failed/.test(message))return 'module_load';
  if(/Minified React error|React error #/.test(message))return 'react_runtime';
  if(/Failed to fetch|NetworkError/.test(message))return 'network_error';
  if(error?.name==='SyntaxError')return 'syntax_error';
  return 'unclassified';
}


/** A bounded, non-reversible, fixed-vocabulary view of browser exceptions.
 * No source URL, stack, email, session key, arbitrary function, or message.
 */
export function summarizePrivateMembersPageError(error){
  const name=['Error','TypeError','ReferenceError','SyntaxError',
    'RangeError','AggregateError','DOMException'].includes(error?.name)
    ?error.name:'other';
  const message=typeof error?.message==='string'?error.message.slice(0,4000):'';
  const terms=['react','component','render','invalid','invariant','failed',
    'cannot','could','read','property','properties','undefined','null',
    'missing','provider','context','query','router','route','navigate',
    'hook','module','load','import','export','script','syntax','reference',
    'fetch','network','promise','rejection','object','array','function',
    'json','parse','element','type','dom','access','member','invite',
    'company','organization','editor','extension','lazy','chunk','error',
    'update','state','loop','redirect','abort','unexpected','token',
    'storage','localstorage','map','filter','find','length','default'];
  const matches=terms.filter(term=>
    new RegExp('(?:^|[^a-z])'+term+'(?:$|[^a-z])','i').test(message))
    .slice(0,8);
  return {kind:name,category:classifyPrivateMembersPageError(error),
    lexicon:matches.join('_'),lengthBand:message.length===0?'empty':
      message.length<80?'short':message.length<250?'medium':'long'};
}

/** Playwright serializes this pure function into every new document, including
 * sandboxed/opaque-origin subframes. Touch storage only on the exact verified
 * localhost *top-level* app document; never suppress errors on that document.
 */
export function selectPrivateMembersCompanyOnMatchingTopLevelDocument({origin,companyId}){
  if(window.top!==window || window.location.origin!==origin)return;
  window.localStorage.setItem('paperclip.selectedCompanyId',companyId);
}

export async function withPrivateMemberBrowser(input,callback,{launch=chromium.launch.bind(chromium)}={}){
  const settings=validateMemberBrowserTarget(input);
  const browser=await launch({headless:true});
  try{
    const context=await browser.newContext({serviceWorkers:'block',permissions:['clipboard-read','clipboard-write']});
    await context.addCookies([{name:settings.name,value:settings.value,url:settings.origin,httpOnly:true,sameSite:'Lax'}]);
    await context.addInitScript(selectPrivateMembersCompanyOnMatchingTopLevelDocument,{
      origin:settings.origin,companyId:settings.companyId,
    });
    // Reuse the existing QA-wide network firewall, including new pages and
    // WebSockets; page.route alone misses first popup navigation requests.
    let firstPageError=null;
    const evidence=await installPrivateBrowserNetworkCapture(context,settings.origin,{
      onPageError:error=>{
        if(firstPageError===null)
          firstPageError=summarizePrivateMembersPageError(error);
      },
    });
    const assertCapture=()=>{
      // Fixed, non-sensitive failure classes; never log blocked URLs, query
      // strings, page text, session cookies or browser exception stacks.
      if(evidence.blockedHttp>0)
        throw Error('Bostan Members Chromium blocked external HTTP request');
      if(evidence.blockedWebSockets>0)
        throw Error('Bostan Members Chromium blocked external WebSocket');
      if(evidence.pageErrors>0){
        const safe=firstPageError??{
          category:'unclassified',kind:'other',lexicon:'',lengthBand:'empty'};
        // Every interpolated field is selected from a finite static allowlist.
        throw Error('Bostan Members Chromium JS class: '+safe.category+
          ';kind='+safe.kind+';words='+safe.lexicon+';size='+safe.lengthBand);
      }
      assertPrivateBrowserEgressEvidence(evidence);
    };
    const page=await context.newPage();
    const sessionStatuses=[];
    page.on('response',response=>{if(new URL(response.url()).pathname==='/api/auth/get-session')sessionStatuses.push(response.status())});
    const visit=async(tab)=>{
      const response=await page.goto(`${settings.origin}/${settings.companyPrefix}/company/settings/members?tab=${tab}`,{waitUntil:'domcontentloaded',timeout:25000});
      if(!response||response.status()!==200)throw Error('Bostan private Members UI failed to load');
      try{await page.getByRole('heading',{name:'Organization Members'}).waitFor({timeout:22000})}
      catch{
        const currentPath=new URL(page.url()).pathname;
        const headingCount=await page.locator('h1,h2').count();
        const bodyText=await page.locator('body').innerText();
        const visibleFlags=['Sign in','Welcome','Setup','Select organization','Organization Members','Loading','No organization','Error','Authentication'].filter(flag=>bodyText.includes(flag));
        throw Error(`Private Members UI not reached: path=${currentPath},headingCount=${headingCount},visibleFlags=${visibleFlags.join('|')},sessionHttpStatuses=${sessionStatuses.join('|')},jsErrors=${evidence.pageErrors},blockedHttp=${evidence.blockedHttp},blockedWebSockets=${evidence.blockedWebSockets}`);
      }
      assertCapture();
    };
    const createInvite=async()=>{
      await visit('invites');
      await page.getByText('Invite a person',{exact:true}).waitFor({timeout:20000});
      await page.locator('input[name="invite-role"][value="viewer"]').check();
      const responsePromise=page.waitForResponse(r=>r.request().method()==='POST'&&r.url()===`${settings.origin}/api/companies/${settings.companyId}/invites`,{timeout:20000});
      await page.getByRole('button',{name:'Create invite',exact:true}).click();
      const response=await responsePromise;
      if(response.status()!==201)throw Error(`Browser invite creation rejected with ${response.status()}`);
      const result=await response.json();
      if(result.companyId!==settings.companyId||!/^pcp_invite_[a-zA-Z0-9_-]{16,}$/.test(result.token||''))throw Error('Browser invite scope or token invalid');
      await page.getByText('Latest invite link',{exact:true}).waitFor({timeout:12000});
      const visible=await page.getByRole('textbox',{name:'Latest invite URL'}).inputValue();
      if(visible!==result.inviteUrl)throw Error('Browser did not render exact generated invite URL');
      return {token:result.token,companyId:result.companyId,uiCreated:true};
    };
    const updateMember=async(email,{role,status}={})=>{
      await visit('members');
      const row=page.locator('tbody tr').filter({hasText:email});
      await row.waitFor({timeout:20000});
      if(await row.count()!==1)throw Error('Ambiguous user row in real Members UI');
      await row.getByRole('button',{name:'Edit',exact:true}).click();
      const dialog=page.getByRole('dialog',{name:'Edit member'});
      await dialog.waitFor({timeout:12000});
      if(role)await dialog.getByLabel('Organization role').selectOption(role);
      if(status)await dialog.getByLabel('Membership status').selectOption(status);
      const responsePromise=page.waitForResponse(r=>r.request().method()==='PATCH'&&r.url().includes(`/api/companies/${settings.companyId}/members/`),{timeout:20000});
      await dialog.getByRole('button',{name:'Save member'}).click();
      const response=await responsePromise;
      if(response.status()!==200)throw Error(`Browser member update rejected ${response.status()}`);
      const member=await response.json();
      if(role&&member.membershipRole!==role||status&&member.status!==status)throw Error('Browser member role/status did not persist');
      await dialog.waitFor({state:'hidden',timeout:12000});
      return {memberId:member.id,role:member.membershipRole,status:member.status,uiUpdated:true};
    };
    const result=await callback({createInvite,updateMember});
    assertCapture();
    return {...result,browserJsErrors:0,externalBrowserRequests:0};
  }finally{await browser.close()}
}
