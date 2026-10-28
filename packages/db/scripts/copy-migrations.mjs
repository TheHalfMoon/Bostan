#!/usr/bin/env node
/**
 * Portable, owned Bostan database migration asset build.
 * Copy original SQL/journal bytes; never rewrite or relicense donor assets.
 */
import {
  copyFileSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync,
  readdirSync, realpathSync, renameSync, rmSync, statSync,
} from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const inside = (root, item) => {
  const r = relative(root, item);
  return r === '' || (r !== '..' && !r.startsWith('..' + sep) && !isAbsolute(r));
};
function ownedDirectory(dir, parent) {
  if (!existsSync(dir)) return false;
  const st = lstatSync(dir);
  if (!st.isDirectory() || st.isSymbolicLink() || !inside(parent, realpathSync(dir))) {
    throw new Error('Bostan migration asset directory must be owned and not a symlink');
  }
  return true;
}
function ownedFile(file, parent) {
  const st = lstatSync(file);
  if (!st.isFile() || st.isSymbolicLink() || !inside(parent, realpathSync(file))) {
    throw new Error('Bostan migration source must be a regular owned file');
  }
}
export function copyBostanDbMigrations(packageRoot) {
  if (!isAbsolute(packageRoot)) throw new Error('Bostan DB package root must be absolute');
  const root = realpathSync(packageRoot);
  const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  if (manifest.name !== '@bostan/db' || manifest.private !== true) {
    throw new Error('Not a private @bostan/db build');
  }
  const source = join(root, 'src', 'migrations');
  if (!ownedDirectory(source, root)) throw new Error('Bostan migration sources missing');
  const meta = join(source, 'meta');
  if (!ownedDirectory(meta, root)) throw new Error('Bostan migration journal directory missing');
  const names = readdirSync(source).filter(name => name.endsWith('.sql')).sort();
  if (!names.length || names.some(name => !/^[0-9]{4}_[A-Za-z0-9_-]+\.sql$/.test(name))) {
    throw new Error('Invalid Bostan SQL migration filenames');
  }
  const journalFile = join(meta, '_journal.json');
  ownedFile(journalFile, root);
  const journal = JSON.parse(readFileSync(journalFile, 'utf8'));
  const tags = journal.entries?.map(entry => entry?.tag);
  if (!Array.isArray(tags) || tags.length !== names.length ||
      new Set(tags).size !== names.length ||
      tags.some(tag => typeof tag !== 'string' || !names.includes(tag + '.sql'))) {
    throw new Error('SQL migration files do not match the Bostan journal');
  }
  for (const name of names) ownedFile(join(source, name), root);

  const dist = join(root, 'dist');
  if (!ownedDirectory(dist, root)) {
    if (existsSync(dist)) throw new Error('Bostan dist must not be a symlink');
    mkdirSync(dist);
  }
  const target = join(dist, 'migrations');
  const hadTarget = ownedDirectory(target, root);
  const staging = mkdtempSync(join(dist, '.bostan-migrations-next-'));
  const backup = join(dist, '.bostan-migrations-old-' + randomUUID());
  let movedOld = false;
  try {
    mkdirSync(join(staging, 'meta'));
    for (const name of names) copyFileSync(join(source, name), join(staging, name));
    copyFileSync(journalFile, join(staging, 'meta', '_journal.json'));
    if (hadTarget) {
      renameSync(target, backup);
      movedOld = true;
    }
    try {
      renameSync(staging, target);
    } catch (error) {
      if (movedOld) renameSync(backup, target);
      throw error;
    }
    if (movedOld) rmSync(backup, { recursive: true });
    // Report quantity, not source contents or private filesystem paths.
    return { schema: 'bostan.db-portable-migrations.v1', files: names.length, journalEntries: tags.length, bytePreserved: true };
  } finally {
    if (existsSync(staging)) rmSync(staging, { recursive: true });
  }
}
const direct = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (direct) {
  if (process.argv.length !== 2) {
    console.error('Usage: node scripts/copy-migrations.mjs');
    process.exitCode = 2;
  } else {
    const root = dirname(dirname(fileURLToPath(import.meta.url)));
    console.log(JSON.stringify(copyBostanDbMigrations(root)));
    console.log('BOSTAN_DB_PORTABLE_MIGRATIONS_VERIFIED');
  }
}
