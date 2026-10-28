import { expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { stopOwnedWindowsEmbeddedPostgres } from "./windows-embedded-postgres-stop.js";

async function fixture(run:(data:string)=>Promise<void>) {
  const data=fs.mkdtempSync(path.join(os.tmpdir(),"bostan-windows-pg-stop-"));
  fs.writeFileSync(path.join(data,"PG_VERSION"),"18");
  try { await run(data); } finally {fs.rmSync(data,{recursive:true,force:true});}
}
it("uses fixed graceful shutdown arguments and is idempotent",async()=>{
  await fixture(async data=>{
    fs.writeFileSync(path.join(data,"postmaster.pid"),"123\n");
    const binary=path.resolve("pg_ctl.exe");
    let count=0;
    expect(await stopOwnedWindowsEmbeddedPostgres(data,binary,async(file,args)=>{
      expect(file).toBe(binary);
      expect(args).toEqual(["-D",fs.realpathSync(data),"-m","fast","-w","-t","40","stop"]);
      count++;
      fs.unlinkSync(path.join(data,"postmaster.pid"));
    })).toBe("stopped");
    expect(count).toBe(1);
    expect(await stopOwnedWindowsEmbeddedPostgres(data,binary,async()=>{throw Error("must not run");})).toBe("already-stopped");
  });
});
it("refuses an unrelated shutdown binary and incomplete database identity",async()=>{
  await fixture(async data=>{
    fs.writeFileSync(path.join(data,"postmaster.pid"),"123\n");
    await expect(stopOwnedWindowsEmbeddedPostgres(data,path.resolve("different.exe"),async()=>{})).rejects.toThrow(/binary/);
    fs.unlinkSync(path.join(data,"PG_VERSION"));
    await expect(stopOwnedWindowsEmbeddedPostgres(data,path.resolve("pg_ctl.exe"),async()=>{})).rejects.toThrow(/non-PostgreSQL/);
  });
});
it("fails closed when the postmaster marker survives",async()=>{
  await fixture(async data=>{
    fs.writeFileSync(path.join(data,"postmaster.pid"),"123\n");
    await expect(stopOwnedWindowsEmbeddedPostgres(data,path.resolve("pg_ctl.exe"),async()=>{})).rejects.toThrow(/survived/);
  });
});
it("refuses symlinked scratch clusters",async()=>{
  await fixture(async data=>{
    const link=data+"-alias";
    try {
      fs.symlinkSync(data,link,"dir");
      await expect(stopOwnedWindowsEmbeddedPostgres(link,path.resolve("pg_ctl.exe"),async()=>{})).rejects.toThrow(/owned scratch/);
    } catch(e) {
      if(process.platform==="win32"&&["EPERM","EACCES"].includes((e as NodeJS.ErrnoException).code??""))return;
      throw e;
    } finally {try{fs.unlinkSync(link);}catch{}}
  });
});
