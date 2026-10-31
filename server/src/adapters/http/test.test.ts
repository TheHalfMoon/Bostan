import {afterEach,describe,expect,it,vi} from "vitest";
import {testEnvironment} from "./test.js";
const mockedFetch=vi.hoisted(()=>vi.fn());
vi.mock("./remote-fetch.js",()=>({guardedHttpAdapterFetch:mockedFetch}));
afterEach(()=>mockedFetch.mockReset());
const run=(url:string,method="POST")=>testEnvironment({
 companyId:"company-private",adapterType:"http",config:{url,method},
});
describe("HTTP adapter setup error privacy",()=>{
 it("does not expose URL userinfo, path, query or fragment in setup checks",async()=>{
  const url="https://user:PRIVATE_PASSWORD@public.example/PRIVATE_PATH?token=PRIVATE_QUERY#PRIVATE_FRAGMENT";
  mockedFetch.mockResolvedValue(new Response(null,{status:204}));
  const result=await run(url,"POST\nBearer PRIVATE_METHOD");
  expect(mockedFetch).toHaveBeenCalledOnce();
  expect(JSON.stringify(result)).not.toMatch(/PRIVATE_PASSWORD|PRIVATE_PATH|PRIVATE_QUERY|PRIVATE_FRAGMENT|PRIVATE_METHOD|public\.example/);
 });
 it("redacts invalid URLs and unsupported schemes without echoing user content",async()=>{
  const invalid=await run("PRIVATE_INVALID_URL");
  const unsupported=await run("secretPRIVATE_SCHEME://host/PRIVATE_PATH");
  expect(JSON.stringify(invalid)).not.toContain("PRIVATE_INVALID_URL");
  expect(JSON.stringify(unsupported)).not.toMatch(/PRIVATE_SCHEME|PRIVATE_PATH/);
 });
 it("never copies external probe exception payloads into setup results",async()=>{
  mockedFetch.mockRejectedValue(new Error("external provider token PRIVATE_SECRET at /PRIVATE_PATH"));
  const result=await run("https://example.test/hook");
  expect(result.checks.some(c=>c.code==="http_endpoint_probe_failed")).toBe(true);
  expect(JSON.stringify(result)).not.toMatch(/PRIVATE_SECRET|PRIVATE_PATH/);
 });
});

it("provider error getters cannot inject unexpected diagnostic data",async()=>{
  const err=Object.defineProperty(new Error("PRIVATE_SECRET"),"code",{
    get(){throw Error("PRIVATE_GETTER_SECRET")},
  });
  mockedFetch.mockRejectedValue(err);
  const result=await run("https://host.example/PRIVATE_PATH");
  expect(JSON.stringify(result)).not.toMatch(/PRIVATE_SECRET|PRIVATE_GETTER_SECRET|PRIVATE_PATH/);
  expect(result.checks.find(c=>c.code==="http_endpoint_probe_failed")?.message)
    .toBe("HTTP adapter endpoint probe failed (unclassified)");
});
