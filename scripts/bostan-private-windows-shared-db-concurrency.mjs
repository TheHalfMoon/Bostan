/**
 * Synthetic-only Windows Chromium Members QA companion.
 * Real requestFn is injected by the already-qualified Bostan+PostgreSQL
 * browser runner; this module never starts a service or handles raw tokens.
 */
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const validCompany=value=>value&&typeof value==='object'&&uuid.test(value.id);
const records=body=>Array.isArray(body)?body:body?.issues;
export async function qualifyPrivateSharedWindowsPostgres({
  requestFn,firstCompany,secondCompany,firstCookie,secondCookie,
  count=12,now=()=>performance.now(),
}={}){
  if(typeof requestFn!=='function'||!validCompany(firstCompany)||
     !validCompany(secondCompany)||firstCompany.id===secondCompany.id||
     typeof firstCookie!=='string'||!firstCookie||
     typeof secondCookie!=='string'||!secondCookie||
     firstCookie===secondCookie||count!==12||typeof now!=='function')
    throw Error('Bostan Windows concurrent QA inputs rejected');
  // Promise.all dispatch is intentional: all 12 requests use the SAME real
  // migrated PostgreSQL instance and already-authenticated Bostan server.
  const jobs=Array.from({length:count},(_,i)=>({
    company:i%2===0?firstCompany:secondCompany,
    cookie:i%2===0?firstCookie:secondCookie,
    title:'Bostan private same-DB concurrency '+String(i),
  }));
  const receipts=await Promise.all(jobs.map(async job=>{
    const start=now();
    const response=await requestFn('/api/companies/'+job.company.id+'/issues',{
      method:'POST',cookie:job.cookie,body:{title:job.title,status:'todo'},
    });
    const end=now();
    if(response?.status!==201||!uuid.test(response?.body?.id??'')||
       response.body.companyId!==job.company.id||!(end>=start))
      throw Error('Bostan concurrent private issue write rejected or mis-scoped');
    return {id:response.body.id,company:job.company.id,start,end};
  }));
  if(new Set(receipts.map(item=>item.id)).size!==count||
     !(Math.max(...receipts.map(r=>r.start))<
       Math.min(...receipts.map(r=>r.end))))
    throw Error('Bostan concurrent private issues lack unique IDs or HTTP overlap');
  const [first,second]=await Promise.all([
    requestFn('/api/companies/'+firstCompany.id+'/issues',{cookie:firstCookie}),
    requestFn('/api/companies/'+secondCompany.id+'/issues',{cookie:secondCookie}),
  ]);
  const listA=records(first?.body),listB=records(second?.body);
  if(first?.status!==200||second?.status!==200||
     !Array.isArray(listA)||!Array.isArray(listB))
    throw Error('Bostan concurrent private readback incomplete');
  const ownedA=receipts.filter(r=>r.company===firstCompany.id);
  const ownedB=receipts.filter(r=>r.company===secondCompany.id);
  if(ownedA.length!==6||ownedB.length!==6||
     !ownedA.every(r=>listA.some(row=>row.id===r.id&&row.companyId===firstCompany.id))||
     !ownedB.every(r=>listB.some(row=>row.id===r.id&&row.companyId===secondCompany.id))||
     listA.some(row=>ownedB.some(r=>r.id===row.id))||
     listB.some(row=>ownedA.some(r=>r.id===row.id)))
    throw Error('Bostan concurrent private company isolation failed');
  // The second cookie is only a member of secondCompany. It must not write
  // the firstCompany. Never log the email, session, generated IDs or values.
  const forbidden=await requestFn('/api/companies/'+firstCompany.id+'/issues',{
    method:'POST',cookie:secondCookie,
    body:{title:'Denied cross-company synthetic write'},
  });
  if(forbidden?.status!==403)throw Error('Bostan concurrent cross-company write authorized');
  return Object.freeze({
    sameRealDatabase:true,overlappingHttpRequests:true,
    realConcurrentWrites:12,distinctIssueIds:12,
    twoCompanyReadback:true,crossCompanyWriteDenied:true,
    releaseQualified:false,
  });
}
