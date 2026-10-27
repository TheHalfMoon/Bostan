import assert from 'node:assert/strict';
import {test} from 'node:test';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {validatePrivateUrl,runPrivateStagedCrud} from './bostan-private-staged-crud.mjs';
const script=fileURLToPath(new URL('./bostan-private-staged-crud.mjs',import.meta.url));
const host='http://127.0.0.1:47895/';
const aid='11111111-1111-4111-8111-111111111111',bid='22222222-2222-4222-8222-222222222222';
const trace='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
test('only explicit isolated private loopback URL can trigger synthetic mutation',()=>{
  assert.equal(validatePrivateUrl(host),'http://127.0.0.1:47895');
  for(const invalid of ['http://localhost:47895/','https://127.0.0.1:47895/','http://127.0.0.2:47895/','http://127.0.0.1:80/','http://127.0.0.1:47895/staging','http://127.0.0.1:47895/?key=test','http://user:pass@127.0.0.1:47895/','https://example.com/','not a url'])assert.throws(()=>validatePrivateUrl(invalid));
});
test('synthetic company and task create/read, two-company boundaries and malformed route acceptance',async()=>{
  const calls=[];
  const request=async(url,opts)=>{
    const pathname=new URL(url).pathname;calls.push({pathname,method:opts.method,redirect:opts.redirect});
    const make=(status,value)=>({status,headers:{get:()=> 'application/json'},json:async()=>value});
    if(pathname==='/api/companies'&&opts.method==='POST'){
      const body=JSON.parse(opts.body);
      if(body.name==='')return make(422,{error:'Invalid name'});
      return make(201,{id:body.name.includes('company A')?aid:bid,name:body.name});
    }
    if(pathname==='/api/companies'&&opts.method==='GET')return make(200,[{id:aid},{id:bid}]);
    if(pathname==='/api/companies/issues')return make(400,{error:'Missing companyId'});
    for(const id of [aid,bid]){
      if(pathname===`/api/companies/${id}`)return make(200,{id,name:`Bostan disposable company ${id===aid?'A':'B'} ${trace}`});
      if(pathname===`/api/companies/${id}/issues`){const input=JSON.parse(opts.body);return make(201,{id:id===aid?'issue_a':'issue_b',companyId:id,title:input.title,status:'todo'});}
    }
    throw Error('Unexpected mocked Bostan private URL');
  };
  const outcome=await runPrivateStagedCrud(host,{request,uuid:()=>trace});
  assert.equal(outcome.qualified,true);
  assert.equal(outcome.releaseQualified,false);
  assert.equal(outcome.companyRecords,2);
  assert.equal(outcome.issueRecords,2);
  assert.equal(outcome.invalidInputsRejected,2);
  assert.equal(outcome.requests,9);
  assert.equal(outcome.remoteModelCalls,0);
  assert.equal(calls.every(c=>c.redirect==='error'),true);
});
test('rejects misattributed company task across company boundary',async()=>{
  const request=async(url,opts)=>{
    const name=opts?.body?JSON.parse(opts.body).name:'';
    const path=new URL(url).pathname;
    let status=200,data;
    if(path==='/api/companies'&&opts.method==='POST'){status=201;data={id:name?.includes('A')?aid:bid,name};}
    else if(path==='/api/companies')data=[{id:aid},{id:bid}];
    else if(path===`/api/companies/${aid}`)data={id:aid,name:`Bostan disposable company A ${trace}`};
    else if(path===`/api/companies/${bid}`)data={id:bid,name:`Bostan disposable company B ${trace}`};
    else if(path.endsWith('/issues')){status=201;data={id:'wrong',companyId:bid,title:JSON.parse(opts.body).title};}
    else throw Error('Unknown mock path');
    return {status,headers:{get:()=> 'application/json'},json:async()=>data};
  };
  await assert.rejects(()=>runPrivateStagedCrud(host,{request,uuid:()=>trace}),/crossed company boundaries/);
});
test('read-only CLI default and unsupported invocation have no side effects',()=>{
  const plan=spawnSync(process.execPath,[script],{encoding:'utf8'});assert.equal(plan.status,0);assert.match(plan.stdout,/No model provider/);
  for(const args of [['--publish'],['--run'],['--run','--url','https://example.com']]){
    const r=spawnSync(process.execPath,[script,...args],{encoding:'utf8',timeout:5000});assert.notEqual(r.status,0);
  }
});
