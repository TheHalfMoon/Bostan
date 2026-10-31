import {describe,expect,it,vi} from "vitest";
import {execute} from "./execute.js";

describe("process adapter pre-spawn diagnostics",()=>{
  it("redacts an onMeta bootstrap error before an owned child is spawned",async()=>{
    const onSpawn=vi.fn();
    const onMeta=vi.fn(async()=>{throw Error(
      "Failed for PRIVATE_COMMAND_TOKEN and /PRIVATE_CWD_TOKEN?api_key=PRIVATE_AUTH",
    );});
    const result=await execute({
      runId:"synthetic-run",agent:{
        id:"synthetic-agent",companyId:"synthetic-company",name:"Synthetic Agent",
        adapterType:"process",adapterConfig:{},
      },
      runtime:{sessionId:null,sessionParams:null,sessionDisplayId:null,taskKey:null},
      config:{command:process.execPath,cwd:process.cwd()},
      context:{},onLog:async()=>{},onMeta,onSpawn,
    });
    expect(onMeta).toHaveBeenCalledOnce();
    expect(onSpawn).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      exitCode:1,executionRecovery:{kind:"bootstrap",providerWorkStarted:false},
    });
    expect(JSON.stringify(result)).not.toMatch(/PRIVATE_COMMAND_TOKEN|PRIVATE_CWD_TOKEN|PRIVATE_AUTH/);
  });
});
