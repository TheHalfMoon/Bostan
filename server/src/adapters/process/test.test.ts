import {describe,expect,it} from "vitest";
import {testEnvironment} from "./test.js";

describe("process adapter environment diagnostic privacy",()=>{
  it("never persists configured command or working directory with secrets",async()=>{
    const command="run-PRIVATE_COMMAND_TOKEN";
    const cwd="/this-directory-PRIVATE_CWD_TOKEN/does-not-exist";
    const result=await testEnvironment({
      companyId:"company-synthetic",adapterType:"process",
      config:{command,cwd},
    });
    expect(result.status).toBe("fail");
    expect(result.checks.some(c=>c.code==="process_cwd_invalid")).toBe(true);
    expect(result.checks.some(c=>c.code==="process_command_unresolvable")).toBe(true);
    expect(JSON.stringify(result)).not.toMatch(/PRIVATE_COMMAND_TOKEN|PRIVATE_CWD_TOKEN/);
  });
  it("never exposes configured args, commands or cwd in successful setup checks",async()=>{
    const result=await testEnvironment({
      companyId:"company-synthetic",adapterType:"process",
      config:{command:process.execPath,cwd:process.cwd()},
    });
    expect(result.status).toBe("pass");
    expect(JSON.stringify(result)).not.toContain(process.execPath);
    expect(JSON.stringify(result)).not.toContain(process.cwd());
  });
});
