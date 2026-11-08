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

describe("process invocation metadata privacy",()=>{
  it("never sends the process command, cwd, args, or arbitrary env values to persisted onMeta",async()=>{
    const onSpawn=vi.fn();
    // A zero-argument mock is typed as a [] call tuple, but below we verify
    // the first real invocation argument. Declare that callback parameter.
    const onMeta=vi.fn(async(_meta: unknown)=>{throw new Error("SYNTHETIC_DECLINE_BEFORE_SPAWN");});
    const result=await execute({
      runId:"synthetic-metadata-run",agent:{
        id:"synthetic-agent",companyId:"synthetic-company",name:"Synthetic Agent",
        adapterType:"process",adapterConfig:{},
      },
      runtime:{sessionId:null,sessionParams:null,sessionDisplayId:null,taskKey:null},
      config:{
        command:process.execPath,cwd:process.cwd(),
        args:["-e","PRIVATE_ARG_SECRET_TOKEN"],
        env:{NON_SENSITIVE_LABEL:"PRIVATE_ENV_SECRET_TOKEN"},
      },
      context:{},onLog:async()=>{},onMeta,onSpawn,
    });
    expect(onSpawn).not.toHaveBeenCalled();
    expect(result.executionRecovery).toMatchObject({kind:"bootstrap",providerWorkStarted:false});
    expect(onMeta).toHaveBeenCalledOnce();
    const metadata=JSON.stringify(onMeta.mock.calls[0][0]);
    expect(metadata).not.toContain("PRIVATE_ARG_SECRET_TOKEN");
    expect(metadata).not.toContain("PRIVATE_ENV_SECRET_TOKEN");
    expect(metadata).not.toContain(process.execPath);
    expect(metadata).not.toContain(process.cwd());
  });
});

describe("process invocation still receives its original inputs",()=>{
  it("runs a real local child with unchanged argv/env while redacting invocation metadata",async()=>{
    const metadata: Array<unknown>=[];
    const result=await execute({
      runId:"synthetic-real-child",agent:{
        id:"synthetic-agent",companyId:"synthetic-company",name:"Synthetic Agent",
        adapterType:"process",adapterConfig:{},
      },
      runtime:{sessionId:null,sessionParams:null,sessionDisplayId:null,taskKey:null},
      config:{
        command:process.execPath,cwd:process.cwd(),
        args:["-e","process.stdout.write(process.env.SYNTHETIC_MARKER ?? 'missing')"],
        env:{SYNTHETIC_MARKER:"PRIVATE_TEST_MARKER_CONTENT"},
        timeoutSec:10,
      },
      context:{},onLog:async()=>{},onMeta:async meta=>{metadata.push(meta);},
    });
    expect(result.exitCode).toBe(0);
    expect(result.resultJson?.stdout).toBe("PRIVATE_TEST_MARKER_CONTENT");
    expect(metadata).toHaveLength(1);
    const stored=JSON.stringify(metadata);
    expect(stored).not.toMatch(/PRIVATE_TEST_MARKER_CONTENT|SYNTHETIC_MARKER|process\.stdout/);
    expect(stored).not.toContain(process.execPath);
    expect(stored).not.toContain(process.cwd());
  });
});
