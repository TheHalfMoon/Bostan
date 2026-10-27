import assert from 'node:assert/strict';
import {test} from 'node:test';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {validatePrivateUrl,runPrivateStagedCrud} from './bostan-private-staged-crud.mjs';
const script=fileURLToPath(new URL('./bostan-private-staged-crud.mjs',import.meta.url));
const host='http://127.0.0.1:47895/';
const aid='11111111-1111-4111-8111-111111111111',bid='22222222-2222-4222-8222-222222222222';
const trace='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const iidA='33333333-3333-4333-8333-333333333333',iidB='44444444-4444-4444-8444-444444444444';
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
      if(pathname===`/api/companies/${id}/issues`){
        const title=`Bostan private local task ${id===aid?'A':'B'} ${trace}`;
        const task={id:id===aid?iidA:iidB,companyId:id,title,status:'todo'};
        return opts.method==='GET'?make(200,[task]):make(201,{...task,title:JSON.parse(opts.body).title});
      }
    }
    if(pathname===`/api/issues/${iidA}`)return make(200,{id:iidA,companyId:aid,title:`Bostan private local task A ${trace}`});
    if(pathname===`/api/issues/${iidB}`)return make(200,{id:iidB,companyId:bid,title:`Bostan private local task B ${trace}`});
    throw Error('Unexpected mocked Bostan private URL');
  };
  const outcome=await runPrivateStagedCrud(host,{request,uuid:()=>trace});
  assert.equal(outcome.qualified,true);
  assert.equal(outcome.releaseQualified,false);
  assert.equal(outcome.companyRecords,2);
  assert.equal(outcome.issueRecords,2);
  assert.equal(outcome.issueListReads,2);
  assert.equal(outcome.issueDetailReads,2);
  assert.equal(outcome.invalidInputsRejected,2);
  assert.equal(outcome.requests,13);
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

test('company-scoped issue list rejects rows from a different company',async()=>{
  const make=(status,value)=>({status,headers:{get:()=> 'application/json'},json:async()=>value});
  const issueFor=(id)=>({id:id===aid?iidA:iidB,companyId:id,title:`Bostan private local task ${id===aid?'A':'B'} ${trace}`});
  const request=async(url,opts)=>{
    const path=new URL(url).pathname;
    if(path==='/api/companies'&&opts.method==='POST'){
      const name=JSON.parse(opts.body).name;
      return make(201,{id:name.includes('company A')?aid:bid,name});
    }
    if(path==='/api/companies')return make(200,[{id:aid},{id:bid}]);
    if(path===`/api/companies/${aid}`)return make(200,{id:aid,name:`Bostan disposable company A ${trace}`});
    if(path===`/api/companies/${bid}`)return make(200,{id:bid,name:`Bostan disposable company B ${trace}`});
    for(const id of [aid,bid]){
      if(path===`/api/companies/${id}/issues`){
        if(opts.method==='POST')return make(201,{...issueFor(id),title:JSON.parse(opts.body).title});
        return make(200,id===aid?[issueFor(aid),issueFor(bid)]:[issueFor(bid)]);
      }
    }
    throw Error(`Unexpected mocked Bostan route ${path}`);
  };
  await assert.rejects(()=>runPrivateStagedCrud(host,{request,uuid:()=>trace}),/task list leaked or omitted/);
});
