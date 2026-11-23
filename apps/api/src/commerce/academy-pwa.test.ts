import test from 'node:test';
import assert from 'node:assert/strict';
import {publicAcademyManifest,publicAcademyIcon} from '../modules/commerce/domain/academy-pwa.js';
test('different academies install as distinct PWAs with own name and color',()=>{
 const laura={name:'Laura English Academy',slug:'laura-english',brandColor:'#258af3'};
 const music={name:'Academia Musical',slug:'music-school',brandColor:'#b81f4b'};
 const a=publicAcademyManifest(laura),b=publicAcademyManifest(music);
 assert.notEqual(a.id,b.id);
 assert.equal(a.name,laura.name);
 assert.equal(a.theme_color,'#258af3');
 assert.equal(a.start_url,'/academy/laura-english/');
 assert.equal(a.scope,'/academy/laura-english/');
 assert.equal(a.icons[0]?.src,'/api/v1/studio/public/laura-english/app-icon.svg');
 assert.equal(b.short_name,'Academia Musical');
 assert.ok(publicAcademyIcon(laura).includes('#258af3'));
});
test('academy icon escapes XML and manifest sanitizes invalid stored colors',()=>{
 const sample={name:'<Hola & Músicos>',slug:'safe-brand',brandColor:'url(https://evil.invalid)'};
 const icon=publicAcademyIcon(sample);
 assert.ok(icon.includes('#7059e8'));
 assert.ok(!icon.includes('url('));
 assert.equal(publicAcademyManifest(sample).theme_color,'#7059e8');
});
