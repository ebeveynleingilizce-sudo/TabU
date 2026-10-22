import {test,expect,openPractice,wav} from './fixtures.js';

test('app loads and navigation renders the main interface',async({page})=>{
  const response=await page.goto('/');expect(response.ok()).toBeTruthy();
  await expect(page.locator('.home-hero')).toBeVisible();
  await page.getByRole('button',{name:/Hemen Çalış/}).click();
  const initialViewport=page.viewportSize();
  if(initialViewport.width<=760){
    await expect(page.locator('.portrait-rotate-prompt')).toBeVisible();
    await page.setViewportSize({width:800,height:600});
  }
  await expect(page.locator('#exercise-select')).toBeVisible();
  await page.locator('.mobile-brand').click();
  await expect(page.locator('.home-hero')).toBeVisible();
  if(initialViewport.width<=760)await page.setViewportSize(initialViewport);
  const nav=page.viewportSize().width<=760?page.locator('.bottom-nav'):page.locator('.side-nav');
  await nav.locator('[data-route="learn"]').click();await expect(page.locator('.lesson-card')).toHaveCount(8);
  await nav.locator('[data-route="progress"]').click();await expect(page.locator('.stat-card')).toHaveCount(4);
  await nav.locator('[data-route="home"]').click();await expect(page.locator('.home-hero')).toBeVisible();
});

test('responsive pages have no horizontal overflow and primary controls are usable',async({page})=>{
  const routeReady={home:'.home-hero',practice:'#exercise-select',editor:'#edit-title',learn:'.lesson-card:first-child',progress:'.stat-card:first-child'};
  for(const route of ['home','practice','editor','learn','progress']){
    const initialViewport=page.viewportSize();
    await page.goto('/#'+route);
    if(route==='practice'&&initialViewport.width<=760){
      await expect(page.locator('.portrait-rotate-prompt')).toBeVisible();
      await page.setViewportSize({width:800,height:600});
    }
    await expect(page.locator(routeReady[route])).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),route+' horizontal overflow '+JSON.stringify(await page.evaluate(()=>({innerWidth,scrollWidth:document.documentElement.scrollWidth,overflow:[...document.querySelectorAll('body *')].map(node=>({tag:node.tagName,className:typeof node.className==='string'?node.className:'',left:Math.round(node.getBoundingClientRect().left),right:Math.round(node.getBoundingClientRect().right)})).filter(node=>node.right>innerWidth+1||node.left< -1).slice(0,8)})))).toBeTruthy();
    const controls=page.locator('#view button:visible, #view select:visible, #view input:visible');
    for(const control of await controls.all()){
      await control.scrollIntoViewIfNeeded();const box=await control.boundingBox();
      expect(box.x,route+' control left').toBeGreaterThanOrEqual(-1);
      expect(box.x+box.width,route+' control right').toBeLessThanOrEqual(page.viewportSize().width+1);
    }
    if(route==='practice'&&initialViewport.width<=760)await page.setViewportSize(initialViewport);
  }
});

test('practice action buttons do not overlap and TAB lane remains visible',async({page})=>{
  await openPractice(page);const lane=page.locator('#fretboard-viewport');await expect(lane).toBeVisible();
  const box=await lane.boundingBox();expect(box.width).toBeGreaterThan(250);expect(box.height).toBeGreaterThan(180);
  const buttons=await page.locator('.fretboard-actions button').all();
  const boxes=await Promise.all(buttons.map(button=>button.boundingBox()));
  for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){
    const a=boxes[i],b=boxes[j];
    const overlapX=Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x);
    const overlapY=Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y);
    expect(overlapX>1&&overlapY>1,'overlapping practice buttons').toBeFalsy();
  }
});

test('single practice button toggles microphone start and stop',async({page})=>{
  await page.addInitScript(()=>{
    window.__micStopped=false;
    Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:()=>new Promise(resolve=>window.__resolvePracticeMic=resolve)}});
  });
  await openPractice(page);
  await expect(page.locator('[data-action="listen"]')).toHaveCount(0);
  const toggle=page.locator('.practice-toggle-button');
  await expect(toggle).toHaveAttribute('data-action','take-turn');
  await toggle.click();
  await expect(toggle).toHaveAttribute('data-action','pause');
  await toggle.click();
  await expect(toggle).toHaveAttribute('data-action','take-turn');
  await page.evaluate(()=>window.__resolvePracticeMic({getTracks:()=>[{stop(){window.__micStopped=true}}]}));
  await expect.poll(()=>page.evaluate(()=>window.__micStopped)).toBe(true);
});
test('editing and creating a new TAB keep separate state; low E survives reload',async({page})=>{
  await openPractice(page);await page.locator('[data-action="edit-tab"]').click();
  await expect(page.locator('#edit-title')).toHaveValue('0–1–2–3–2–1–0');
  await expect(page.locator('.editor-note-chip')).toHaveCount(7);
  await page.locator('#view [data-route="practice"]').click();
  await page.locator('#view [data-route="editor"]').click();
  await expect(page.locator('.editor-note-chip')).toHaveCount(0);
  await page.locator('#edit-title').fill('E2 regression');await page.locator('#edit-string').selectOption('E');
  for(const fret of [0,12,22]){await page.locator('#edit-fret').fill(String(fret));await page.locator('[data-action="add-note"]').click()}
  await page.locator('[data-action="save-tab"]').click();await expect(page.locator('.time-note')).toHaveCount(3);
  await page.reload();await page.locator('#exercise-select').selectOption({label:'E2 regression'});
  await expect(page.locator('.timeboard-row[data-string="E"] .time-note')).toHaveText(['0','12','22']);
});

test('audio upload, irregular timing, save/reload, seeking and playback rate',async({page,browserName})=>{
  test.skip(browserName==='webkit','The installed iPhone WebKit profile advertises WAV support but cannot decode the generated test fixture.');
  await page.goto('/#editor');
  const wavSupported=await page.evaluate(()=>!!document.createElement('audio').canPlayType('audio/wav'));
  test.skip(!wavSupported,'Installed browser has no WAV decoder; real media test requires an OS with supported audio codecs.');
  await page.locator('[data-action="editor-clear"]').click();
  await page.locator('#edit-title').fill('Timing regression');
  for(const fret of [0,1,3]){await page.locator('#edit-fret').fill(String(fret));await page.locator('[data-action="add-note"]').click()}
  await page.locator('#editor-audio-file').setInputFiles({name:'timing.wav',mimeType:'audio/wav',buffer:wav()});
  await page.locator('[data-action="open-sync"]').click();
  await page.locator('[data-action="sync-play-toggle"]').click();
  await expect.poll(()=>page.locator('#sync-audio').evaluate(audio=>audio.readyState)).toBeGreaterThanOrEqual(1);
  await page.locator('#sync-audio').evaluate(audio=>audio.pause());
  for(const time of [0,.28,.93]){
    await page.locator('#sync-audio').evaluate(async(audio,time)=>{if(audio.currentTime===time)return;await new Promise(resolve=>{audio.addEventListener('seeked',resolve,{once:true});audio.currentTime=time})},time);
    await page.locator('[data-action="sync-mark"]').click();
  }
  await expect(page.locator('#sync-progress')).toHaveText('3 / 3');
  await page.locator('[data-action="sync-back"]').click();await page.locator('[data-action="save-tab"]').click();
  await expect(page).toHaveURL(/#practice$/);
  await expect(page.locator('.time-note')).toHaveCount(3);
  await page.setViewportSize({width:844,height:390});await page.reload();await page.locator('#exercise-select').selectOption({label:'Timing regression'});
  await expect(page.locator('#practice-audio')).toBeAttached();
  expect(await page.locator('.time-note').evaluateAll(notes=>notes.map(note=>Number(note.dataset.time)))).toEqual([0,.28,.93]);
  await page.locator('#audio-speed-select').selectOption('0.5');
  expect(await page.locator('#practice-audio').evaluate(audio=>audio.playbackRate)).toBe(.5);
  await page.locator('#practice-audio').evaluate(audio=>audio.currentTime=.5);
  await expect(page.locator('#current-position')).toHaveText('Nota 2 / 3');
  await page.locator('#practice-audio').evaluate(audio=>audio.currentTime=1.1);
  await expect(page.locator('#current-position')).toHaveText('Nota 3 / 3');
  await page.locator('#practice-audio').evaluate(audio=>audio.currentTime=0);
  await expect(page.locator('#current-position')).toHaveText('Nota 1 / 3');
});

test('denied microphone permission leaves the UI recoverable',async({page})=>{
  await page.addInitScript(()=>{Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:async()=>{throw new DOMException('Denied for test','NotAllowedError')}}})});
  await openPractice(page);await page.locator('[data-action="take-turn"]').click();
  await expect(page.locator('#toast')).toHaveText('Mikrofon izni verilmedi');
  await expect(page.locator('[data-action="take-turn"]')).toBeEnabled();
  await expect(page.locator('.practice-toggle-button')).toHaveAttribute('aria-label','Mikrofonla çalışmayı başlat');
});

test('fresh PWA install opens offline with the complete application shell',async({page,context,browserName})=>{
  test.skip(browserName==='webkit','Real PWA/service-worker verification runs in Chromium; WebKit profile covers UI compatibility.');
  await page.goto('/');await page.evaluate(async()=>{await navigator.serviceWorker.ready});
  await context.setOffline(true);await page.reload();
  await expect(page.locator('.home-hero')).toBeVisible();
  await expect(page.locator('.home-hero')).toHaveCSS('display','block');
  const background=await page.locator('body').evaluate(body=>getComputedStyle(body).backgroundColor);
  expect(background).not.toBe('rgba(0, 0, 0, 0)');
  await page.getByRole('button',{name:/Hemen Çalış/}).click();
  const viewport=page.viewportSize();
  if(viewport.width<=760){await expect(page.locator('.portrait-rotate-prompt')).toBeVisible();await page.setViewportSize({width:800,height:600})}
  await expect(page.locator('.time-note')).toHaveCount(7);
});

test('custom TAB saves chord mode, groups same-time notes, and restores the mode for editing',async({page})=>{
  await openPractice(page);
  await page.locator('.editor-shortcut[data-route="editor"]').click();
  await page.locator('#edit-title').fill('Chord mode E2E');
  await page.locator('#edit-mode').selectOption('chord');
  await expect(page.locator('#next-chord')).toBeVisible();
  await page.locator('#edit-string').selectOption('e');await page.locator('#edit-fret').fill('0');
  await page.locator('[data-action="add-note"]').click();
  await page.locator('#edit-string').selectOption('B');await page.locator('#edit-fret').fill('1');
  await page.locator('[data-action="add-note"]').click();
  await page.locator('[data-action="save-tab"]').click();
  await expect(page.locator('#exercise-select')).toBeVisible();
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('tabu-custom-tabs')||'[]').find(tab=>tab.title==='Chord mode E2E'));
  expect(saved.mode).toBe('chord');
  expect(saved.data.e[0].timeBeats).toBe(saved.data.B[0].timeBeats);
  await expect(page.locator('#expected-note')).toHaveText('E4 + C4');
  await expect(page.locator('[data-action="take-turn"]')).toBeEnabled();
  await page.locator('[data-action="edit-tab"]').click();
  await expect(page.locator('#edit-mode')).toHaveValue('chord');
});
