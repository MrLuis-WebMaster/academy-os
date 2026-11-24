export const MAX_FILE_BYTES=5*1024*1024;
export const MAX_WORKSPACE_BYTES=100*1024*1024;
export type MaterialMime='application/pdf'|'image/png'|'image/jpeg';
export class InvalidPrivateMaterial extends Error{}
export class PrivateMaterialDenied extends Error{}
export class PrivateMaterialMissing extends Error{}
export class PrivateMaterialQuota extends Error{}
export class PrivateMaterialDisabled extends Error{}
export type PrivateMaterialInput={courseId:string;title:string;filename:string;mimeType:MaterialMime;content:Uint8Array;sizeBytes:number};
const signatures:ReadonlyArray<{mime:MaterialMime;ext:string;magic:number[]}>= [
 {mime:'application/pdf',ext:'pdf',magic:[37,80,68,70,45]},
 {mime:'image/png',ext:'png',magic:[137,80,78,71,13,10,26,10]},
 {mime:'image/jpeg',ext:'jpg',magic:[255,216,255]},
];
export function parsePrivateMaterial(raw:unknown,file:unknown):PrivateMaterialInput{
 if(!raw||typeof raw!=='object'||!file||typeof file!=='object')throw new InvalidPrivateMaterial('Course, title and file are required');
 const body=raw as Record<string,unknown>,f=file as Record<string,unknown>;
 if(typeof body.courseId!=='string'||!body.courseId.trim()||body.courseId.length>128||
  typeof body.title!=='string'||body.title.trim().length<3||body.title.trim().length>140||
  !(f.buffer instanceof Uint8Array)||!f.buffer.byteLength||f.buffer.byteLength>MAX_FILE_BYTES)
  throw new InvalidPrivateMaterial('Invalid course, title or file size (maximum 5 MiB)');
 const content=f.buffer;
 const format=signatures.find(s=>s.magic.every((b,i)=>content[i]===b));
 if(!format||f.mimetype!==format.mime)throw new InvalidPrivateMaterial('Only PDF, PNG and JPEG files with matching signatures are accepted');
 const name=typeof f.originalname==='string'?f.originalname:'material';
 const safe=name.split(/[\\/]/).pop()?.replace(/\.[^.]*$/,'').normalize('NFKD').replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,100)||'material';
 return {courseId:body.courseId.trim(),title:body.title.trim(),filename:safe+'.'+format.ext,mimeType:format.mime,content,sizeBytes:content.byteLength};
}
export function privateMaterialId(raw:unknown):string{
 if(typeof raw!=='string'||!raw||raw.length>128)throw new InvalidPrivateMaterial('Invalid material identifier');
 return raw;
}
export function filePublication(raw:unknown):boolean{
 if(!raw||typeof raw!=='object'||typeof (raw as Record<string,unknown>).published!=='boolean')throw new InvalidPrivateMaterial('Publication preference required');
 return (raw as {published:boolean}).published;
}
