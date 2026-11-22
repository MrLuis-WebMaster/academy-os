import test from 'node:test';
import assert from 'node:assert/strict';
import {hasRoom} from './bookings.controller.js';
test('room capacity rejects overbooking and zero cap',()=>{
 assert.equal(hasRoom(3,2),true);
 assert.equal(hasRoom(3,3),false);
 assert.equal(hasRoom(0,0),false);
 assert.equal(hasRoom(3,5),false);
});
