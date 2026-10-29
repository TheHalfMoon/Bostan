import {test} from 'node:test';
import assert from 'node:assert/strict';
import {qualifyPrivateSharedWindowsPostgres} from './bostan-private-windows-shared-db-concurrency.mjs';
const first={id:'d5f790a6-8dbc-48ea-bba3-50b320cf6475'};
const second={id:'98691832-49a1-40aa-8a2a-8e5fb12f5245'};
const makeId=i=>'a0010000-1234-4abc-8def-'+(i+1).toString(16).padStart(12,'0');
function fixture({duplicate=false,leak=false,allowForbidden=false,failOne=false,overlap=true}={}){
  const data=new Map([[first.id,[]],[second.id,[]]]);
  let n=0,clock=0;
  async function req(path,{method='GET',cookie,body}={}){
    const match=/^\/api\/companies\/([a-f0-9-]{36})\/issues$/.exec(path);
    if(!match)throw Error('Unexpected API route');
    const company=match[1];
    if(method==='GET'){
      const items=[...(data.get(company)??[])];
      if(leak&&company===first.id)items.push(...data.get(second.id));
      return {status:200,body:{issues:items}};
    }
    if(company===first.id&&cookie==='second')
      return {status:allowForbidden?201:403,body:{}};
    if(company===second.id&&cookie!=='second'||company===first.id&&cookie!=='first')
      return {status:403,body:{}};
    const index=n++;
    const id=duplicate?makeId(0):makeId(index);
    if(failOne&&index===7)return {status:409,body:{}};
    if(!overlap)await new Promise(r=>setTimeout(r,1));
    const row={id,companyId:company,title:body.title};
    data.get(company).push(row);
    return {status:201,body:row};
  }
  return {requestFn:req,firstCompany:first,secondCompany:second,
    firstCookie:'first',secondCookie:'second',
    now:()=>overlap?clock++:clock+=2};
}
test('genuine helper checks unique writes, readbacks, forbiddens, no release promotion',async()=>{
  const result=await qualifyPrivateSharedWindowsPostgres(fixture());
  assert.equal(result.realConcurrentWrites,12);
  assert.equal(result.crossCompanyWriteDenied,true);
  assert.equal(result.releaseQualified,false);
});
test('missing/identical credentials, company and count cannot qualify',async()=>{
  for(const patch of [
    {firstCookie:'second'}, {firstCompany:second},{count:6},
    {requestFn:null},{firstCompany:null},{now:null},
  ])await assert.rejects(qualifyPrivateSharedWindowsPostgres({
    ...fixture(),...patch}),/inputs rejected/);
});
test('foreign company leak, duplicate IDs, non-201 and forbidden write all fail closed',async()=>{
  for(const patch of [{leak:true},{duplicate:true},
    {failOne:true},{allowForbidden:true}]){
    await assert.rejects(qualifyPrivateSharedWindowsPostgres(fixture(patch)));
  }
});
