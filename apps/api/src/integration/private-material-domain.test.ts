import test from 'node:test';
import assert from 'node:assert/strict';
import {parsePrivateMaterial,InvalidPrivateMaterial,MAX_FILE_BYTES} from '../modules/classroom/domain/private-material.js';
import {PrivateMaterialUseCases} from '../modules/classroom/application/private-material-use-cases.js';
import {PrivateMaterialDisabled,PrivateMaterialDenied} from '../modules/classroom/domain/private-material.js';
import type {PrivateMaterialRepository} from '../modules/classroom/application/private-material-ports.js';

const body={courseId:'course',title:'Private guide'};
const pdf={originalname:'../../guía.pdf',mimetype:'application/pdf',buffer:Buffer.from('%PDF-1.7\nTest fixture')};
test('private file parser checks signature, declared MIME, size and sanitizes names',()=>{
 const input=parsePrivateMaterial(body,pdf);
 assert.match(input.filename,/^[a-zA-Z0-9_-]+\.pdf$/);
 assert.ok(!input.filename.includes('/'));
 assert.equal(input.sizeBytes,pdf.buffer.length);
 assert.throws(()=>parsePrivateMaterial(body,{...pdf,buffer:Buffer.from('<html>')}),InvalidPrivateMaterial);
 assert.throws(()=>parsePrivateMaterial(body,{...pdf,mimetype:'image/png'}),InvalidPrivateMaterial);
 assert.throws(()=>parsePrivateMaterial(body,{...pdf,buffer:Buffer.alloc(MAX_FILE_BYTES+1)}),InvalidPrivateMaterial);
});
test('private upload disabled and student staff access rejected before storage',async()=>{
 const repository={} as PrivateMaterialRepository;
 const disabled=new PrivateMaterialUseCases(repository,{hasAnyRole:async()=>true},false);
 await assert.rejects(()=>disabled.create('w','teacher',body,pdf),PrivateMaterialDisabled);
 await assert.rejects(()=>disabled.publish('w','teacher','id',{published:true}),PrivateMaterialDisabled);
 const student=new PrivateMaterialUseCases(repository,{hasAnyRole:async()=>false},true);
 await assert.rejects(()=>student.create('w','student',body,pdf),PrivateMaterialDenied);
});
