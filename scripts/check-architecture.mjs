#!/usr/bin/env node
/* Enforces architectural boundaries on new DDD modules and the shared UI package. */
import {readdir,readFile} from 'node:fs/promises';
import path from 'node:path';

async function walk(dir) {
  const files=[];
  for(const item of await readdir(dir,{withFileTypes:true})) {
    const entry=path.join(dir,item.name);
    if(item.isDirectory())files.push(...await walk(entry));
    else if(/\.(?:ts|vue)$/.test(item.name))files.push(entry);
  }
  return files;
}
const roots=['apps/api/src/modules','apps/api/src/shared/domain','packages/ui/src'];
const files=(await Promise.all(roots.map(walk))).flat();
const violations=[];
for(const file of files) {
  const name=file.split(path.sep).join('/');
  const source=await readFile(file,'utf8');
  let forbidden=[];
  if(/apps\/api\/src\/(?:modules\/[^/]+\/domain|shared\/domain)\//.test(name)) {
    forbidden=[/from\s+['"]@nestjs\//,/from\s+['"]@prisma\//,/from\s+['"][^'"]*infrastructure\//,/from\s+['"][^'"]*presentation\//,/from\s+['"][^'"]*application\//,/process\.env/,/\bfetch\(/];
  }else if(/apps\/api\/src\/modules\/[^/]+\/application\//.test(name)) {
    forbidden=[/from\s+['"]@nestjs\//,/from\s+['"]@prisma\//,/from\s+['"][^'"]*infrastructure\//,/from\s+['"][^'"]*presentation\//,/from\s+['"][^'"]*lib\/prisma/,/process\.env/];
  }else if(/packages\/ui\/src\//.test(name)) {
    forbidden=[/from\s+['"][^'"]*apps\/api/,/from\s+['"][^'"]*apps\/web/];
  }
  for(const rule of forbidden)if(rule.test(source))violations.push(name+': '+rule);
}
if(violations.length) {
  process.stderr.write('Architecture boundary violations:\n'+violations.join('\n')+'\n');
  process.exitCode=1;
}else process.stdout.write('Architecture boundaries verified for '+files.length+' source files.\n');
