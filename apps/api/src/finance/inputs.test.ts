import test from 'node:test';
import assert from 'node:assert/strict';
import {receiptInput,voidReceiptInput} from './inputs.js';
test('manual cash or bank transfer receipts must have a positive integer COP amount',()=>{
 const valid={studentUserId:'student1',amountCOP:60000,method:'BANK_TRANSFER',reference:'TRANS123'};
 assert.equal(receiptInput.safeParse(valid).success,true);
 assert.equal(receiptInput.safeParse({...valid,amountCOP:-100}).success,false);
 assert.equal(receiptInput.safeParse({...valid,amountCOP:10.5}).success,false);
});
test('voiding a receipt requires an audit reason',()=>{
 assert.equal(voidReceiptInput.safeParse({reason:'Doble registro'}).success,true);
 assert.equal(voidReceiptInput.safeParse({reason:''}).success,false);
});
