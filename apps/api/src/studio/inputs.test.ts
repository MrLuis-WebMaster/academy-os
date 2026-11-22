import test from 'node:test';
import assert from 'node:assert/strict';
import {studioSettingsInput,offeringInput,offeringVisibilityInput} from './inputs.js';
test('storefront is opt-in and has safe contact links',()=>{
 assert.equal(studioSettingsInput.safeParse({publicEnabled:false,contactUrl:'https://wa.me/573001234567'}).success,true);
 assert.equal(studioSettingsInput.safeParse({contactUrl:'javascript:alert(1)'}).success,false);
 assert.equal(studioSettingsInput.safeParse({contactUrl:'http://example.com'}).success,false);
});
test('pricing and durations are validated on the server',()=>{
 const good={title:'Clase individual de inglés',priceCOP:45000,durationMinutes:60,mode:'ONLINE'};
 assert.equal(offeringInput.safeParse(good).success,true);
 assert.equal(offeringInput.safeParse({...good,priceCOP:-50}).success,false);
 assert.equal(offeringInput.safeParse({...good,durationMinutes:0}).success,false);
 assert.equal(offeringVisibilityInput.safeParse({published:'yes'}).success,false);
});
