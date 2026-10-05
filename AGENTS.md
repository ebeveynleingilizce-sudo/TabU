# TabU çalışma kuralları

- Değişiklik yapmadan önce ilgili mevcut kodu ve testleri incele.
- Değişiklikten sonra ilgili unit testlerini çalıştır; tamamlamadan önce `npm test` çalıştır.
- UI değişikliklerinde ilgili Playwright testlerini de çalıştır: `npm run test:e2e`.
- Bug düzeltmelerinde mümkünse regression testi ekle. Testi yalnızca geçsin diye beklentileri değiştirme.
- Mikrofon/pitch değişikliklerinde `node --test tests/audio-pitch.test.js tests/maintenance.test.js` çalıştır.
- TAB timing/playback değişikliklerinde `node --test tests/timeline.test.js tests/practiceClock.test.js` ve ilgili browser testlerini çalıştır.
- Çalışan sistemi sırf refactor amacıyla değiştirme.
- Mevcut UI tasarımını kendi zevkine göre yeniden tasarlama.
- CSS'i yalnızca doğrulanmış responsive/kullanılabilirlik problemi varsa değiştir.
- PWA/service worker sistemini gerekmedikçe yeniden yazma.
- Minimum güvenli değişiklik prensibini kullan.
- Mevcut `tests/` ve `node --test` unit katmanını silme, ezme veya Playwright ile değiştirme. Browser testleri `e2e/` altında `.spec.js` olarak tutulur.
- `npm run test:all` iki katmanı çalıştırır; `test:mobile` telefonları, `test:safari` WebKit profilini çalıştırır.
- WebKit gerçek iPhone değildir. Simüle edilmiş mikrofon testleri gerçek gitar/cihaz doğruluğunu kanıtlamaz.
- Testler localhost ve izole browser storage üzerinde çalışmalı; production/kullanıcı verilerini değiştirme.
