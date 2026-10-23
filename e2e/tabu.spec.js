import {test,expect,openPractice,wav} from './fixtures.js';

async function saveTabTo(page,category='solo'){
  await page.locator('[data-action="save-tab"]').click();
  const dialog=page.getByRole('dialog',{name:'TAB nereye kaydedilsin?'});
  await expect(dialog).toBeVisible();
  await dialog.locator('[data-action="save-tab-category"][data-category="'+category+'"]').click();
}

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
  await saveTabTo(page,'solo');await expect(page.locator('.time-note')).toHaveCount(3);
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
  await page.locator('[data-action="sync-back"]').click();await saveTabTo(page,'solo');
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

test('portrait TAB entry prompt offers direct TAB creation',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/#practice');
  await expect(page.locator('.portrait-rotate-prompt')).toBeVisible();
  await page.locator('.portrait-rotate-prompt').getByRole('button',{name:/TAB oluştur/}).click();
  await expect(page.locator('#edit-title')).toBeVisible();
  await expect(page.locator('[data-action="add-note"]')).toHaveText('＋ TAB oluştur');
});

test('practice screen labels the new TAB entry clearly',async({page})=>{
  await openPractice(page);
  await expect(page.locator('.editor-shortcut[data-route="editor"]')).toHaveText('＋ TAB oluştur');
  await page.locator('.editor-shortcut[data-route="editor"]').click();
  await expect(page.locator('[data-action="add-note"]')).toHaveText('＋ TAB oluştur');
});

test('TAB editor exposes create, mark, tempo delete, save, and selected-note delete actions',async({page})=>{
  await openPractice(page);
  await page.locator('.editor-shortcut[data-route="editor"]').click();
  await expect(page.getByRole('button',{name:/TAB oluştur/})).toBeVisible();
  await expect(page.getByRole('button',{name:'İşaretle'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Tempoyu sil'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Kaydet'})).toBeVisible();
  await expect(page.locator('.editor-save-destination')).toContainText('Kaydet’e dokun');
  await expect(page.getByRole('button',{name:'Seçili notayı sil'})).toBeVisible();

  await page.locator('#edit-string').selectOption('e');await page.locator('#edit-fret').fill('0');
  await page.getByRole('button',{name:/TAB oluştur/}).click();
  await page.locator('[data-action="save-tab"]').click();
  await expect(page.getByRole('dialog',{name:'TAB nereye kaydedilsin?'})).toBeVisible();
  await expect(page.locator('#save-category-dialog .save-category-option')).toHaveCount(4);
  await page.locator('[data-action="cancel-save-category"]').click();
  await page.locator('#edit-string').selectOption('B');await page.locator('#edit-fret').fill('1');
  await page.getByRole('button',{name:/TAB oluştur/}).click();
  await page.locator('#editor-audio-file').setInputFiles({name:'editor-actions.wav',mimeType:'audio/wav',buffer:wav()});
  await page.getByRole('button',{name:'İşaretle'}).click();
  await expect(page.locator('[data-action="sync-mark"]')).toBeEnabled();
  await page.locator('[data-action="sync-mark"]').click();
  await page.locator('[data-action="sync-back"]').click();
  await page.locator('#editor-sequence-list [data-editor-index="0"]').click();
  await page.getByRole('button',{name:'Tempoyu sil'}).click();
  await expect(page.locator('#toast')).toHaveText('Seçili notanın temposu silindi');
  await page.locator('#editor-sequence-list [data-editor-index="1"]').click();
  await page.getByRole('button',{name:'Seçili notayı sil'}).click();
  await expect(page.locator('#editor-sequence-list [data-editor-index]')).toHaveCount(1);
});

test('custom TABs save to the selected practice category and remain filterable',async({page})=>{
  await openPractice(page);
  await page.locator('.editor-shortcut[data-route="editor"]').click();
  await page.locator('#edit-title').fill('Ritm kaydı');
  await page.locator('#edit-string').selectOption('e');await page.locator('#edit-fret').fill('0');
  await page.locator('[data-action="add-note"]').click();
  await saveTabTo(page,'rhythm');
  await expect(page.locator('.practice-category[data-category="rhythm"]')).toHaveClass(/active/);
  await expect(page.locator('#exercise-select option[value^="custom-"]')).toHaveText('Ritm kaydı');
  const rhythm=await page.evaluate(()=>JSON.parse(localStorage.getItem('tabu-custom-tabs')||'[]').find(item=>item.title==='Ritm kaydı'));
  expect(rhythm.category).toBe('rhythm');

  await page.locator('.editor-shortcut[data-route="editor"]').click();
  await page.locator('#edit-title').fill('Arpej kaydı');
  await page.locator('#edit-string').selectOption('B');await page.locator('#edit-fret').fill('1');
  await page.locator('[data-action="add-note"]').click();
  await expect(page.locator('#edit-mode')).toHaveValue('solo');
  await saveTabTo(page,'arpeggio');
  await expect(page.locator('.practice-category[data-category="arpeggio"]')).toHaveClass(/active/);
  await expect(page.locator('#exercise-select option[value^="custom-"]')).toHaveText('Arpej kaydı');
  const arpeggio=await page.evaluate(()=>JSON.parse(localStorage.getItem('tabu-custom-tabs')||'[]').find(item=>item.title==='Arpej kaydı'));
  expect(arpeggio.category).toBe('arpeggio');expect(arpeggio.mode).toBe('arpeggio');

  await page.locator('.practice-category[data-category="rhythm"]').click();
  await expect(page.locator('#exercise-select option[value^="custom-"]')).toHaveText('Ritm kaydı');
});

test('practice category arrows expand all exercises and let the learner choose one',async({page})=>{
  await openPractice(page);
  const titles=['Solo liste 1','Solo liste 2','Solo liste 3'];
  for(const [index,title] of titles.entries()){
    await page.locator('.editor-shortcut[data-route="editor"]').click();
    await page.locator('#edit-title').fill(title);
    await page.locator('#edit-string').selectOption(index===1?'B':'e');
    await page.locator('#edit-fret').fill(String(index));
    await page.locator('[data-action="add-note"]').click();
    await saveTabTo(page,'solo');
  }

  const soloTab=page.locator('.practice-category[data-category="solo"]');
  await soloTab.click();
  await expect(soloTab).toHaveAttribute('aria-expanded','true');
  const menu=page.locator('[data-category-menu="solo"]');
  await expect(menu).toBeVisible();
  for(const title of titles)await expect(menu.locator('.practice-exercise-option',{hasText:title})).toHaveCount(1);
  await menu.locator('.practice-exercise-option',{hasText:'Solo liste 2'}).click();
  await expect(soloTab).toHaveAttribute('aria-expanded','false');
  await expect(page.locator('#exercise-select')).toHaveValue(/custom-/);
  await expect(page.locator('.classroom-title h1')).toHaveText('Solo liste 2');

  await soloTab.click();
  await expect(menu.locator('.practice-exercise-delete')).toHaveCount(3);
  const builtInRow=menu.locator('.practice-exercise-option:not([data-id^="custom-"])').first().locator('xpath=..');
  await expect(builtInRow.locator('.practice-exercise-delete')).toHaveCount(0);
  page.once('dialog',dialog=>dialog.accept());
  await menu.locator('.practice-exercise-option',{hasText:'Solo liste 1'}).locator('xpath=..').locator('.practice-exercise-delete').click();
  await expect(menu.locator('.practice-exercise-option',{hasText:'Solo liste 1'})).toHaveCount(0);
  const savedTitles=await page.evaluate(()=>JSON.parse(localStorage.getItem('tabu-custom-tabs')||'[]').map(tab=>tab.title));
  expect(savedTitles).not.toContain('Solo liste 1');
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
  await saveTabTo(page,'chord');
  await expect(page.locator('#exercise-select')).toBeVisible();
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('tabu-custom-tabs')||'[]').find(tab=>tab.title==='Chord mode E2E'));
  expect(saved.mode).toBe('chord');
  expect(saved.data.e[0].timeBeats).toBe(saved.data.B[0].timeBeats);
  await expect(page.locator('#expected-note')).toHaveText('E4 + C4');
  await expect(page.locator('[data-action="take-turn"]')).toBeEnabled();
  await page.locator('[data-action="edit-tab"]').click();
  await expect(page.locator('#edit-mode')).toHaveValue('chord');
});
