#!/usr/bin/env node
/** Explicit, fully disposable API CRUD E2E for the Bostan private localhost stage. */
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
export function validatePrivateUrl(address){
  let parsed;
  try{parsed=new URL(address)}catch{throw Error('Invalid Bostan local URL')}
  if(parsed.protocol!=='http:'||parsed.hostname!=='127.0.0.1'||!/^\d{4,5}$/.test(parsed.port)||Number(parsed.port)<1024||Number(parsed.port)>65535||parsed.pathname!=='/'||parsed.search||parsed.hash||parsed.username||parsed.password)throw Error('Only explicit http://127.0.0.1:<high-port>/ may run synthetic CRUD');
  return parsed.origin;
}
export async function runPrivateStagedCrud(address,{request=fetch,uuid=randomUUID}={}){
  const origin=validatePrivateUrl(address);
  const trace=uuid();
  if(!/^[a-f0-9-]{16,64}$/i.test(trace))throw Error('Invalid disposable scenario identity');
  let requests=0;
  const json=async(method,route,body,expected)=>{
    if(route!=='/api/companies/issues'&&!/^\/api\/(?:companies(?:\/[a-f0-9-]+(?:\/issues)?)?)$/.test(route))throw Error('Unexpected private CRUD endpoint');
    const response=await request(origin+route,{method,headers:{'content-type':'application/json','cache-control':'no-store'},...(body===undefined?{}:{body:JSON.stringify(body)}),redirect:'error',signal:AbortSignal.timeout(12000)});
    requests++;
    if(!expected.includes(response.status))throw Error(`Private Bostan CRUD unexpected HTTP ${response.status} for ${method} ${route}`);
    if(method==='GET' && response.headers?.get?.('content-type')?.includes('text/html'))throw Error('Bostan CRUD got HTML SPA fallback instead of API JSON');
    return await response.json();
  };
  const nameA=`Bostan disposable company A ${trace}`;
  const nameB=`Bostan disposable company B ${trace}`;
  const createdA=await json('POST','/api/companies',{name:nameA},[201]);
  const createdB=await json('POST','/api/companies',{name:nameB},[201]);
  if(!/^[a-f0-9-]{36}$/i.test(createdA?.id||'')||!/^[a-f0-9-]{36}$/i.test(createdB?.id||'')||createdA.id===createdB.id)throw Error('Private stage returned invalid or duplicate company identities');
  for(const [company,name] of [[createdA,nameA],[createdB,nameB]]){
    const detail=await json('GET',`/api/companies/${company.id}`,undefined,[200]);
    if(detail.id!==company.id||detail.name!==name)throw Error('Private stage company detail roundtrip failed');
  }
  const companyList=await json('GET','/api/companies',undefined,[200]);
  const companies=Array.isArray(companyList)?companyList:companyList?.companies;
  if(!Array.isArray(companies)||![createdA,createdB].every(item=>companies.some(c=>c.id===item.id)))throw Error('Private stage company list does not include created records');
  const firstTitle=`Bostan private local task A ${trace}`;
  const secondTitle=`Bostan private local task B ${trace}`;
  const issueA=await json('POST',`/api/companies/${createdA.id}/issues`,{title:firstTitle,status:'todo'},[201]);
  const issueB=await json('POST',`/api/companies/${createdB.id}/issues`,{title:secondTitle,status:'todo'},[201]);
  if(!issueA?.id||!issueB?.id||issueA.id===issueB.id||issueA.companyId!==createdA.id||issueB.companyId!==createdB.id||issueA.title!==firstTitle||issueB.title!==secondTitle)throw Error('Private Bostan issue creation crossed company boundaries');
  const badName=await json('POST','/api/companies',{name:''},[400,422]);
  if(!badName||typeof badName!=='object')throw Error('Invalid company input not rejected with JSON error');
  const missingCompanyId=await json('GET','/api/companies/issues',undefined,[400]);
  if(!missingCompanyId?.error)throw Error('Missing-company task route was not rejected');
  return {schema:'bostan.private-staged-crud.v1',qualified:true,releaseQualified:false,syntheticOnly:true,companyRecords:2,companyDetailReads:2,issueRecords:2,invalidInputsRejected:2,requests,remoteModelCalls:0,privateLocalhostOnly:true};
}
const direct=process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(direct){
  const args=process.argv.slice(2);
  if(args.length===0||(args.length===1&&args[0]==='--plan'))console.log('Bostan private staged CRUD: --run --url http://127.0.0.1:<private-port>/; writes synthetic records only to the caller-provided disposable local PostgreSQL. No model provider or publishing.');
  else if(args.length===3&&args[0]==='--run'&&args[1]==='--url'){
    try{console.log(JSON.stringify(await runPrivateStagedCrud(args[2]),null,2));console.log('BOSTAN_PORTABLE_STAGED_COMPANY_TASK_CRUD_PASS');}catch(err){console.error('Bostan private staged CRUD failed:',err.message);process.exitCode=1;}
  }else{console.error('Usage: --plan | --run --url http://127.0.0.1:<private-port>/');process.exitCode=2;}
}
