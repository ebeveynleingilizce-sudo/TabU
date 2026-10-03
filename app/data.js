export const strings=['e','B','G','D','A','E'];
export const exercises=[
 {id:'open-strings',title:'Open Strings',difficulty:'Başlangıç',bpm:72,duration:'2 dk',description:'Altı açık teli sırayla tanı ve temiz sesle çal.',data:{e:[0],B:[0],G:[0],D:[0],A:[0],E:[0]}},
 {id:'frets-0123',title:'0–1–2–3–2–1–0',difficulty:'Başlangıç',bpm:80,duration:'3 dk',description:'İnce Mi telinde yüksel ve kontrollü şekilde geri dön.',data:{e:[0,1,2,3,2,1,0],B:[],G:[],D:[],A:[],E:[]}},
 {id:'frets-0232',title:'0–2–3–2',difficulty:'Kolay',bpm:84,duration:'3 dk',description:'Ritmini koruyarak kısa bir parmak egzersizi yap.',data:{e:[0,2,3,2],B:[],G:[],D:[],A:[],E:[]}},
 {id:'chromatic',title:'Chromatic Exercise',difficulty:'Kolay',bpm:76,duration:'4 dk',description:'Perdelerde kontrollü ilerle; her notayı eşit duyur.',data:{e:[0,1,2,3,4,3,2,1],B:[],G:[],D:[],A:[],E:[]}},
 {id:'simple-melody',title:'Simple Melody',difficulty:'Başlangıç',bpm:88,duration:'3 dk',description:'İlk pozisyonda kısa bir melodi çal.',data:{e:[0,1,3,1,0],B:[1,3,1],G:[0,2,0],D:[],A:[],E:[]}},
 {id:'string-switch',title:'String Switching',difficulty:'Orta',bpm:70,duration:'4 dk',description:'İnce Mi ve Si telleri arasında geçiş çalış.',data:{e:[0,2,0,3],B:[1,0,3,1],G:[],D:[],A:[],E:[]}},
 {id:'beginner-riff',title:'Beginner Riff',difficulty:'Kolay',bpm:92,duration:'3 dk',description:'Kısa riffi yavaşça öğren, sonra tempoyu yükselt.',data:{e:[0,0,3,0,5,3,0],B:[],G:[],D:[],A:[],E:[]}},
 {id:'fikrimin-ince-gulu',title:'Fikrimin İnce Gülü · Giriş',difficulty:'Temel',bpm:72,duration:'2 dk',description:'Giriş melodisi · Si telinde tek nota çalışması (3/4).',data:{e:[],B:[{fret:8,note:'G4',finger:1,timeBeats:0},{fret:10,note:'A4',finger:3,timeBeats:.5},{fret:11,note:'A#4',finger:4,timeBeats:1},{fret:10,note:'A4',finger:3,timeBeats:1.5},{fret:8,note:'G4',finger:1,timeBeats:3},{fret:10,note:'A4',finger:3,timeBeats:3.5},{fret:11,note:'A#4',finger:4,timeBeats:4},{fret:10,note:'A4',finger:3,timeBeats:4.5},{fret:10,note:'A4',finger:3,timeBeats:6},{fret:8,note:'G4',finger:1,timeBeats:6.5},{fret:6,note:'F4',finger:1,timeBeats:7},{fret:5,note:'E4',finger:1,timeBeats:7.5},{fret:3,note:'D4',finger:1,timeBeats:8},{fret:5,note:'E4',finger:3,timeBeats:8.5},{fret:1,note:'C4',finger:1,timeBeats:9},{fret:3,note:'D4',finger:3,timeBeats:9.5},{fret:5,note:'E4',finger:4,timeBeats:10},{fret:1,note:'C4',finger:1,timeBeats:11},{fret:3,note:'D4',finger:3,timeBeats:11.5},{fret:1,note:'C4',finger:1,timeBeats:12},{fret:11,note:'A#4',finger:4,timeBeats:12.5},{fret:11,note:'A#4',finger:4,timeBeats:13},{fret:10,note:'A4',finger:3,timeBeats:13.5,durationBeats:1.5}],G:[],D:[],A:[],E:[]}}
];
try{for(const saved of JSON.parse(localStorage.getItem('tabu-tab-overrides')||'[]')){const original=exercises.find(item=>item.id===saved.id);if(original)Object.assign(original,saved)}}catch{}
try{exercises.push(...JSON.parse(localStorage.getItem('tabu-custom-tabs')||'[]'))}catch{}
export const lessons=[
 ['6 tel nasıl okunur?','TAB satırları gitar tellerini temsil eder. En üstteki e ince Mi, en alttaki E kalın Mi telidir.','e|----------------|\nB|----------------|\nG|----------------|\nD|----------------|\nA|----------------|\nE|----------------|'],
 ['Perde numaraları ne anlama gelir?','Sayı, basman gereken perdeyi söyler. 3 yazıyorsa üçüncü perdeye bas.','e|--1--2--3--4--|'],
 ['0 ne demek?','Sıfır, tele hiçbir perdeye basmadan açık çalman anlamına gelir.','e|--0-----0-----|'],
 ['Basit TAB nasıl okunur?','Soldan sağa ilerle. Her satır bir teli, her sayı o teldeki perdeyi gösterir.','e|--0--1--3--|\nB|-----------|'],
 ['Aynı anda iki nota','Aynı dikey hizadaki sayılar iki telde birlikte çalınır.','e|--0------|\nB|--1------|'],
 ['Slide','/ işareti, notayı basılı tutup perde boyunca kaydırmanı söyler.','e|--3/5----|'],
 ['Hammer-on','h işaretiyle belirtilir: ilk notaya vur, sonra diğer perdeye aynı telde dokundur.','e|--3h5----|'],
 ['Pull-off','p işareti: iki perdeye bas, yüksek perdeyi çekerken alttaki notayı duyur.','e|--5p3----|']
].map((l,i)=>({id:`lesson-${i+1}`,title:l[0],description:l[1],tab:l[2],n:i+1}));
