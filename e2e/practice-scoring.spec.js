import {test,expect,openPractice} from './fixtures.js';

test('microphone pitch colors correct, wrong and missed TAB notes and summarizes them',async({page,browserName})=>{
  test.skip(browserName==='webkit','The synthetic AnalyserNode microphone fixture does not provide a stable pitch stream in WebKit; microphone scoring is covered in Chromium projects and logic tests.');
  await page.addInitScript(()=>{
    window.__micFrequency=329.63;
    Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:async()=>({getTracks:()=>[]})}});
    window.AudioContext=class{
      constructor(){this.sampleRate=44100;this.state='running'}
      async resume(){}
      async close(){}
      createMediaStreamSource(){return {connect(){}}}
      createAnalyser(){return {fftSize:4096,smoothingTimeConstant:0,getFloatTimeDomainData(buffer){
        const frequency=window.__micFrequency||0,amplitude=frequency ? .12 : 0;
        for(let index=0;index<buffer.length;index++)buffer[index]=amplitude*Math.sin(2*Math.PI*frequency*index/44100)
      },getFloatFrequencyData(buffer){buffer.fill(-100);const frequency=window.__micFrequency||0;if(frequency)buffer[Math.round(frequency/(44100/2048))]=-8}}}
    };
  });
  await openPractice(page);
  await page.evaluate(()=>localStorage.setItem('tabu-custom-tabs',JSON.stringify([{
    id:'custom-e2e-score',title:'Scoring E2E',difficulty:'Test',bpm:100,duration:'test',description:'',
    data:{e:[{fret:0,timeBeats:0,startTime:0},{fret:1,timeBeats:1,startTime:2},{fret:3,timeBeats:2,startTime:4}],B:[],G:[],D:[],A:[],E:[]}
  }])));
  await page.reload();await page.locator('#exercise-select').selectOption('custom-e2e-score');
  await page.locator('[data-action="take-turn"]').click();
  await expect(page.locator('.classroom-meter')).toBeVisible();
  await expect.poll(()=>page.locator('#mic-meter').evaluate(element=>parseFloat(element.style.width)||0)).toBeGreaterThan(0);
  await expect(page.locator('.time-note[data-index="0"]')).toHaveClass(/correct/,{timeout:4000});
  await page.evaluate(()=>window.__micFrequency=0);
  await page.waitForTimeout(220);
  await expect(page.locator('.time-note[data-index="1"]')).toHaveClass(/active/,{timeout:5000});
  await page.evaluate(()=>window.__micFrequency=440);
  await expect(page.locator('.time-note[data-index="1"]')).toHaveClass(/wrong/,{timeout:4000});
  await page.evaluate(()=>window.__micFrequency=0);
  await expect(page.locator('.practice-result')).toBeVisible({timeout:5000});
  await expect(page.locator('.practice-result')).toContainText('1 doğru');
  await expect(page.locator('.practice-result')).toContainText('1 yanlış');
  await expect(page.locator('.practice-result')).toContainText('1 boş');
  await expect(page.locator('.practice-result strong')).toContainText('33%');
  await expect(page.locator('.practice-result-note')).toHaveCount(3);
  await expect(page.locator('.practice-result-note.correct')).toHaveText('0');
  await expect(page.locator('.practice-result-note.wrong')).toHaveText('1');
  await expect(page.locator('.practice-result-note.missed')).toHaveText('3');
});

test('a sustained two-second guitar tone does not answer the following TAB note',async({page})=>{
  await page.addInitScript(()=>{
    window.__micFrequency=329.63;
    Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:async()=>({getTracks:()=>[]})}});
    window.AudioContext=class{
      constructor(){this.sampleRate=44100;this.state='running'}
      async resume(){}
      async close(){}
      createMediaStreamSource(){return {connect(){}}}
      createAnalyser(){return {fftSize:4096,smoothingTimeConstant:0,getFloatTimeDomainData(buffer){
        const frequency=window.__micFrequency,amplitude=frequency ? .12 : 0;
        for(let index=0;index<buffer.length;index++)buffer[index]=amplitude*Math.sin(2*Math.PI*frequency*index/44100)
      },getFloatFrequencyData(buffer){buffer.fill(-100);const frequency=window.__micFrequency||0;if(frequency)buffer[Math.round(frequency/(44100/2048))]=-8}}}
    };
  });
  await openPractice(page);
  await page.evaluate(()=>localStorage.setItem('tabu-custom-tabs',JSON.stringify([{
    id:'custom-sustained-score',title:'Sustained E2E',difficulty:'Test',bpm:100,duration:'test',description:'',
    data:{e:[{fret:0,timeBeats:0,startTime:0},{fret:1,timeBeats:3.5,startTime:2.1}],B:[],G:[],D:[],A:[],E:[]}
  }])));
  await page.reload();await page.locator('#exercise-select').selectOption('custom-sustained-score');
  await page.locator('[data-action="take-turn"]').click();
  await expect(page.locator('.classroom-meter')).toBeVisible();
  await expect.poll(()=>page.locator('#mic-meter').evaluate(element=>parseFloat(element.style.width)||0)).toBeGreaterThan(0);
  await expect(page.locator('.time-note[data-index="0"]')).toHaveClass(/correct/,{timeout:4000});
  await expect(page.locator('.practice-result')).toBeVisible({timeout:5000});
  await expect(page.locator('.practice-result')).toContainText('1 doğru');
  await expect(page.locator('.practice-result')).toContainText('0 yanlış');
  await expect(page.locator('.practice-result')).toContainText('1 boş');
});

test('microphone scoring follows the TAB clock at 0.5x speed',async({page,browserName})=>{
  test.skip(browserName==='webkit','WebKit does not supply a stable synthetic analyser stream.');
  await page.addInitScript(()=>{
    window.__micFrequency=329.63;
    Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:async()=>({getTracks:()=>[]})}});
    window.AudioContext=class{
      constructor(){this.sampleRate=44100;this.state='running'}
      async resume(){}
      async close(){}
      createMediaStreamSource(){return {connect(){}}}
      createAnalyser(){return {fftSize:4096,smoothingTimeConstant:0,getFloatTimeDomainData(buffer){
        const frequency=window.__micFrequency,amplitude=frequency ? .12 : 0;
        for(let index=0;index<buffer.length;index++)buffer[index]=amplitude*Math.sin(2*Math.PI*frequency*index/44100)
      },getFloatFrequencyData(buffer){buffer.fill(-100);const frequency=window.__micFrequency||0;if(frequency)buffer[Math.round(frequency/(44100/2048))]=-8}}}
    };
  });
  await openPractice(page);
  await page.evaluate(()=>localStorage.setItem('tabu-custom-tabs',JSON.stringify([{
    id:'custom-half-speed-score',title:'Half Speed E2E',difficulty:'Test',bpm:100,duration:'test',description:'',
    data:{e:[{fret:0,startTime:0},{fret:1,startTime:1},{fret:3,startTime:2}],B:[],G:[],D:[],A:[],E:[]}
  }])));
  await page.reload();await page.locator('#exercise-select').selectOption('custom-half-speed-score');
  await page.locator('#audio-speed-select').selectOption('0.5');
  await page.locator('[data-action="take-turn"]').click();
  await expect(page.locator('.time-note[data-index="0"]')).toHaveClass(/correct/,{timeout:4000});
  await page.evaluate(()=>window.__micFrequency=0);
  await page.waitForTimeout(220);
  await expect(page.locator('.time-note[data-index="1"]')).toHaveClass(/active/,{timeout:5000});
  await page.evaluate(()=>window.__micFrequency=349.23);
  await expect(page.locator('.time-note[data-index="1"]')).toHaveClass(/correct/,{timeout:4000});
});

test('landscape practice fits the viewport and keeps only core controls',async({page})=>{
  await page.setViewportSize({width:844,height:390});
  await page.goto('/#practice');
  await expect(page.locator('.app-shell.practice-focus')).toBeVisible();
  await expect(page.locator('.sidebar')).toBeHidden();
  await expect(page.locator('.bottom-nav')).toBeHidden();
  await expect(page.locator('.topbar')).toBeHidden();
  await expect(page.locator('.bpm-control')).toBeHidden();
  await expect(page.locator('[data-action="edit-tab"]')).toBeHidden();
  await expect(page.locator('.timeboard-wrap')).toBeVisible();
  await expect(page.locator('#audio-speed-select')).toBeVisible();
  await expect(page.locator('.classroom-meter')).toBeVisible();
  const overflow=await page.evaluate(()=>document.documentElement.scrollHeight>window.innerHeight||document.body.scrollHeight>window.innerHeight);
  expect(overflow).toBe(false);
});
