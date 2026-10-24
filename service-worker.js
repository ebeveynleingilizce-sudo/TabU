const CACHE='gitarist-shell-v124';
const FILES=['./','./index.html','./styles.css','./styles.css?v=32','./manifest.json','./app/main.js','./app/main.js?v=67','./app/classroom.js?v=11','./app/classroomPreview.js','./app/firebase-config.js','./assets/gitarist-guitar.png','./app/data.js','./app/data.js?v=3','./app/state.js','./app/router.js','./app/router.js?v=2','./tab/tabParser.js','./tab/tabPlayer.js','./tab/tabRenderer.js?v=14','./practice/practiceEngine.js','./practice/exerciseGenerator.js','./audio/microphone.js','./audio/microphone.js?v=3','./audio/pitchDetector.js','./audio/targetPitchDetector.js','./audio/targetPitchDetector.js?v=3','./audio/noteMatcher.js','./audio/timeline.js','./audio/practiceClock.js','./practice/noteScoring.js','./practice/modeScoring.js','./audio/guitarSynth.js','./icons/icon.svg','./icons/icon-180.png','./icons/icon-192.png','./icons/icon-512.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{if(event.request.method!=='GET')return;const url=new URL(event.request.url);if(url.origin!==location.origin)return;event.respondWith(fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy))}return response}).catch(()=>caches.match(event.request).then(cached=>cached||caches.match('./index.html'))))});







