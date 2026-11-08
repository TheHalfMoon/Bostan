import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {isOwnedClusterDirectory} from './bostan-local-postgres-cluster-ownership.mjs';
import {captureOwnedLocalPostgresScratch} from './bostan-local-postgres-scratch-identity.mjs';
const content='This directory belongs only to Bostan local qualification.\n';
test('old pathname-and-marker qualification accepts a copied replacement, new identity refuses',t=>{
 const parent=fs.mkdtempSync(path.join(os.tmpdir(),'bostan-b227-baseline-'));
 t.after(()=>fs.rmSync(parent,{recursive:true,force:true}));
 const scratch=fs.mkdtempSync(path.join(parent,'bostan-pg-qualification-'));
 const marker=path.join(scratch,'BOSTAN_OWNED_DISPOSABLE_CLUSTER');
 const cluster=path.join(scratch,'cluster');
 fs.writeFileSync(marker,content);
 const originallyOwned=captureOwnedLocalPostgresScratch({scratch,marker,markerText:content});
 const canonicalScratch=fs.realpathSync(scratch),canonicalMarker=path.join(canonicalScratch,'BOSTAN_OWNED_DISPOSABLE_CLUSTER');
 fs.renameSync(scratch,path.join(parent,'original'));
 fs.mkdirSync(scratch);fs.writeFileSync(marker,content);fs.mkdirSync(cluster);
 fs.writeFileSync(path.join(scratch,'KEEP.txt'),'do not remove');
 const directory=fs.lstatSync(scratch),proof=fs.lstatSync(marker);
 const oldAccepted=directory.isDirectory()&&!directory.isSymbolicLink()&&proof.isFile()&&!proof.isSymbolicLink()&&
 fs.realpathSync(scratch)===canonicalScratch&&fs.realpathSync(marker)===canonicalMarker&&
 fs.readFileSync(marker,'utf8')===content&&isOwnedClusterDirectory(canonicalScratch,cluster,{allowMissing:true});
 assert.equal(oldAccepted,true,'prior current GitHub source really accepts copied marker and cluster');
 assert.equal(originallyOwned(),false,'new guard denies replaced inode');
 assert.equal(fs.readFileSync(path.join(scratch,'KEEP.txt'),'utf8'),'do not remove');
});
