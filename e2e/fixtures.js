import {test as base,expect} from '@playwright/test';

export const test=base.extend({
  runtimeGuard:[async({page},use,testInfo)=>{
    const errors=[];
    // Keep tests independent of Google Fonts/network availability; app CSS still loads normally.
    await page.route(/^https:\/\/fonts\.googleapis\.com\//,route=>route.fulfill({status:200,contentType:'text/css',body:''}));
    page.on('pageerror',error=>errors.push(error.message));
    page.on('console',message=>{if(message.type()==='error')errors.push(message.text())});
    await use();
    if(errors.length)await testInfo.attach('javascript-errors',{body:errors.join('\n'),contentType:'text/plain'});
    expect(errors,'Unhandled JavaScript errors / console.error').toEqual([]);
  },{auto:true}]
});
export {expect};

export async function openPractice(page){
  await page.goto('/#practice');
  await expect(page.locator('#exercise-select')).toBeVisible();
  await page.locator('#exercise-select').selectOption('frets-0123');
  await expect(page.locator('.time-note')).toHaveCount(7);
}

export function wav(seconds=4){
  const rate=8000,length=rate*seconds,buffer=Buffer.alloc(44+length*2);
  buffer.write('RIFF',0);buffer.writeUInt32LE(buffer.length-8,4);buffer.write('WAVEfmt ',8);
  buffer.writeUInt32LE(16,16);buffer.writeUInt16LE(1,20);buffer.writeUInt16LE(1,22);
  buffer.writeUInt32LE(rate,24);buffer.writeUInt32LE(rate*2,28);buffer.writeUInt16LE(2,32);buffer.writeUInt16LE(16,34);
  buffer.write('data',36);buffer.writeUInt32LE(length*2,40);
  return buffer;
}
