import {test} from "node:test";
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {buildPrivateWindowsHttpQaEnvironment as build} from "./bostan-private-windows-qa-env.mjs";

const params={inherited:{SystemRoot:"C:\\Windows"},home:"D:\\Bostan-B100-temp\\bostan-private-auth-http-test",origin:"http://127.0.0.1:43001",port:43001,connectionString:"postgres://synthetic:temporary@127.0.0.1:54329/paperclip",marker:"D:\\Bostan-B100-temp\\bostan-private-auth-http-test\\BOSTAN_QA_OWNED",secret:"synthetic-only-long-random-secret"};
test("never inherits tokens, provider keys, user config, cloud URLs or NODE_OPTIONS",()=>{
  const env=build({...params,inherited:{SystemRoot:"C:\\Windows",PATH:"C:\\Windows\\System32",OPENAI_API_KEY:"opaque",GITHUB_TOKEN:"opaque",GH_TOKEN:"opaque",AZURE_CLIENT_SECRET:"opaque",AWS_SECRET_ACCESS_KEY:"opaque",SENTRY_DSN:"opaque",NODE_OPTIONS:"--require=untrusted",PAPERCLIP_CLOUD_URL:"opaque",PAPERCLIP_PUBLIC_URL:"opaque",DATABASE_URL:"postgres://prod",APPDATA:"C:\\Users\\Person\\AppData",LOCALAPPDATA:"C:\\Users\\Person\\AppData\\Local",TEMP:"C:\\Users\\Person\\Temp",npm_config_user_agent:"opaque",BOSTAN_PRIVATE_QA_ENTRY:"forged"}});
  assert.equal(env.SystemRoot,"C:\\Windows");
  assert.equal(env.PATH,"C:\\Windows\\System32");
  for(const key of ["OPENAI_API_KEY","GITHUB_TOKEN","GH_TOKEN","AZURE_CLIENT_SECRET","AWS_SECRET_ACCESS_KEY","SENTRY_DSN","NODE_OPTIONS","PAPERCLIP_CLOUD_URL","PAPERCLIP_PUBLIC_URL","npm_config_user_agent"]){assert.equal(Object.hasOwn(env,key),false,key);}
  assert.equal(env.TEMP,params.home);assert.equal(env.TMP,params.home);
  assert.equal(env.APPDATA,params.home+"\\AppData\\Roaming");
  assert.equal(env.LOCALAPPDATA,params.home+"\\AppData\\Local");
  assert.equal(env.PAPERCLIP_HOME,params.home);
  assert.equal(env.DATABASE_URL,params.connectionString);
  assert.equal(env.BOSTAN_PRIVATE_QA_ENTRY,"B087_TEST_ONLY");
});
test("allowed environment has no unrecognized inherited operator variable",()=>{
  const inherited=Object.fromEntries(Array.from({length:100},(_,i)=>["PERSONAL_SECRET_"+i,"value"]));
  const env=build({...params,inherited:{SystemRoot:"C:\\Windows",...inherited}});
  assert.equal(Object.keys(env).some(k=>k.startsWith("PERSONAL_SECRET_")),false);
  assert.equal(env.HOST,"127.0.0.1");assert.equal(env.PORT,"43001");
  assert.equal(env.PAPERCLIP_DEPLOYMENT_MODE,"authenticated");
});
test("refuse production or remote HTTP/DB even when inherited env is valid",()=>{
  for(const update of [{origin:"https://127.0.0.1:43001"},{origin:"http://localhost:43001"},{port:0},{port:65536},{connectionString:"postgres://user:pw@db.production:5432/production"},{connectionString:"postgres://user:pw@localhost:5432/dev"},{connectionString:"https://127.0.0.1:5432"},{connectionString:"garbage"},{home:""},{marker:""},{secret:""}]){
    assert.throws(()=>build({...params,...update}),/private QA|Private Windows QA|Invalid private QA|Missing isolated/);
  }
});

test("real child process cannot observe inherited operator tokens",()=>{
  const env=build({...params,inherited:{SystemRoot:"C:\\Windows",Path:"C:\\Windows\\System32",GITHUB_TOKEN:"secret",OPENAI_API_KEY:"secret",NODE_OPTIONS:"--trace-warnings",PAPERCLIP_PUBLIC_URL:"https://production.example.invalid"}});
  const result=spawnSync(process.execPath,["-e",'process.stdout.write(JSON.stringify({keys:Object.keys(process.env),home:process.env.HOME,path:process.env.PATH,db:process.env.DATABASE_URL?.includes("127.0.0.1")}))'],{env,encoding:"utf8",timeout:5000});
  assert.equal(result.status,0);
  const output=JSON.parse(result.stdout);
  assert.equal(output.home,params.home);
  assert.equal(output.db,true);
  assert.equal(output.path,"C:\\Windows\\System32");
  for(const key of ["GITHUB_TOKEN","OPENAI_API_KEY","NODE_OPTIONS","PAPERCLIP_PUBLIC_URL"]){
    assert.equal(output.keys.some(k=>k.toUpperCase()===key),false,key);
  }
});


test('real Windows UI is enabled only by explicit booleans and never by inherited env',()=>{
  assert.equal(build({...params,inherited:{SystemRoot:"C:\\Windows",SERVE_UI:'true'}}).SERVE_UI,'false');
  assert.equal(build({...params,serveUi:true}).SERVE_UI,'true');
  assert.throws(()=>build({...params,serveUi:'true'}),/UI flag invalid/);
});
