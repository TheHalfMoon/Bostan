/** Native Windows test fixture: gracefully stop owned PostgreSQL. */
import {execFile} from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {promisify} from "node:util";

const execAsync=promisify(execFile);
type Runner=(binary:string,args:readonly string[])=>Promise<void>;
const actualRun:Runner=async(binary,args)=>{
  await execAsync(binary,[...args],{windowsHide:true,shell:false,timeout:45000,maxBuffer:131072});
};
export async function stopOwnedWindowsEmbeddedPostgres(
  dataDir:string,pgCtlExe:string,run:Runner=actualRun,
):Promise<"stopped"|"already-stopped"> {
  if(process.platform!=="win32"&&run===actualRun)throw Error("Windows-only native database test teardown");
  const temp=fs.realpathSync(os.tmpdir());
  const data=fs.realpathSync(dataDir);
  const rel=path.relative(temp,data);
  if(!rel||rel===".."||rel.startsWith(".."+path.sep)||path.isAbsolute(rel)
      ||fs.lstatSync(dataDir).isSymbolicLink())
    throw Error("Refusing database shutdown outside an owned scratch directory");
  if(!fs.existsSync(path.join(data,"PG_VERSION")))
    throw Error("Refusing non-PostgreSQL database directory");
  if(!path.isAbsolute(pgCtlExe)||path.basename(pgCtlExe).toLowerCase()!=="pg_ctl.exe")
    throw Error("Refusing unknown PostgreSQL shutdown binary");
  if(!fs.existsSync(path.join(data,"postmaster.pid")))return "already-stopped";
  await run(pgCtlExe,["-D",data,"-m","fast","-w","-t","40","stop"]);
  if(fs.existsSync(path.join(data,"postmaster.pid")))
    throw Error("PostgreSQL PID marker survived graceful shutdown");
  return "stopped";
}
