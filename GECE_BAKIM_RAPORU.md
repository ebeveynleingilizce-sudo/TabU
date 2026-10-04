## Gece Bakım Raporu

Tarih: 4 Ekim 2026, Europe/Istanbul. Depo: ebeveynleingilizce-sudo/TabU. İncelenen ana sürüm: `fa1616c069e71ed05176638ad0357bec12eebced`.

Yerel proje yolu bulunamadığından GitHub kaynağı izinli çıktı klasörüne klonlandı. Düzeltmeler ayrı bakım dalı ve taslak PR için hazırlandı. Ana dal ve canlı sürüm değiştirilmedi. GitHub Pages iş akışı main push ile deploy yapıyor; bakım dalına push bunu tetiklemiyor.

### Bulunan hatalar

| Sorun | Kök neden | Etkilenen dosyalar | Önem derecesi |
| --- | --- | --- | --- |
| Kararlı mikrofon sinyali işlenirken TypeError; nota değerlendirme ve sonraki mikrofon frame'leri kesiliyor | `handleLivePitch`, PracticeClock sınıfında bulunmayan `getTime()` metodunu çağırıyor | app/main.js | Yüksek |
| Kalın Mi telindeki notalar editörün ayrıştırma/kaydetme yolunda kayboluyor | Satır regex'i büyük `E` telini kabul etmiyor | tab/tabParser.js | Yüksek |
| İzin isteği beklenirken stop/ekran değişikliği yapılınca geç gelen mikrofon akışı açık kalıyor | `getUserMedia` sonrasında iptal kontrolü yok | audio/microphone.js, app/main.js | Yüksek |
| AudioContext oluşturma veya audio analizini başlatma hatasında edinilmiş mikrofon akışı serbest bırakılmıyor | start hata yolunda kaynak temizliği yok | audio/microphone.js | Orta |
| Yeni service worker kurulumundan sonra çevrimdışı açılış için gereken sürümlü modüller eksik | index/main sürümlü query adresleri istiyor; önbellek listesi main/data/router için sürümsüz adresleri içeriyor | service-worker.js | Orta |

İlk beş regression senaryosu düzeltmelerden önce başarısız oldu: parser boş kalın Mi listesi, mikrofon clock TypeError, iptal edilmiş istekte AudioContext oluşturma, başlangıç hatasında açık track ve eksik sürümlü offline modül. AudioContext resume sırasında iptal için ayrıca bir test eklendi.

### Düzeltilen hatalar

- Mikrofon frame'i mevcut `getMusicalTime()` API'sini kullanıyor. Gerçek handler kodu VM içinde PracticeClock ile çalıştırılarak hata yolunun kapandığı doğrulandı.
- TAB parser regex'ine büyük E eklendi. İnce/kalın Mi ayrımı ve kalın Mi üzerinde 0, 12, 22 perdeleri regression testiyle korundu.
- Mikrofon başlangıçları generation ile iptal ediliyor. Geç gelen stream'in tüm track'leri durduruluyor; AudioContext resume sonrasında da iptal kontrol ediliyor. İptal edilen başlangıç UI devamını çalıştırmıyor.
- Mikrofon başlatma hataları kaynakları temizleyip hatayı çağırana iletiyor. Frame callback oturumu kapatırsa yeni animation frame planlanmıyor. İzin bekleme, audio initialization failure ve resume sırasında stop senaryoları mock kaynaklarla doğrulandı.
- Service worker listesine `app/main.js?v=29`, `app/data.js?v=2`, `app/router.js?v=2` eklendi; cache sürümü v66 yapıldı. Worker install handler'ını çalıştıran test, index/main içindeki sürümlü modül isteklerinin önbellekte bulunduğunu doğruluyor.

### Düzeltilmeyen sorunlar

- **Dinleme sırasında ekranın yeniden oluşturulması:** renderPractice yeni audio element oluşturuyor; mevcut dinleme sırasında gösterim değişimi gibi render işlemlerinin ses konumu/state üzerindeki etkisi tarayıcıda doğrulanmadı. DOM/media yaşam döngüsünü geniş biçimde değiştirmemek için müdahale edilmedi. Özellikle sesli egzersizde test edilmeli.
- **Çalışma süresi muhasebesi:** practice dışına çıkış ve exercise-select yolları `sessionStarted/sessionElapsed` değerlerini pause/completion kadar kapsamlı sıfırlamıyor. Uzun gezinme/egzersiz değişiminde süre ve ilerleme verisine etkisi uçtan uca doğrulanmadı. Kullanıcı ilerleme verisini etkileyen hesaplama değişikliği otomatik uygulanmadı.
- **Ses dosyası olmayan örneği dinleme:** startPlayer nota/timeline callback'lerini çalıştırıyor; mevcut GuitarSynth modülü bu yola bağlı değil. Ses üretiminin beklenen ürün davranışı ve cihaz autoplay etkileri doğrulanmadan yeni bir bağlantı eklenmedi.
- **Worker kapsamı:** activate bütün diğer origin cache'lerini siliyor; fetch hatasında modül isteklerine de index.html fallback'i dönebiliyor. Aynı origin'deki diğer uygulamalar ve hosting kapsamı doğrulanmadığından cache temizleme/fallback politikası değiştirilmedi.
- **CI test kapısı:** Repoda bulunan GitHub Actions iş akışı Pages deploy yapıyor; test çalıştırma adımı yok. Yeni CI yapılandırması bakım kapsamına eklenmedi.
- Canlı gitar, gerçek mikrofon izni, gerçek browser audio decode, mobil dokunma/yerleşim ve gerçek PWA offline/update uçtan uca testleri yapılmadı. Statik inceleme ve otomatik testler cihaz davranışını bütünüyle doğrulamaz.

### Test sonuçları

- Başlangıç: `node --test` — 18 geçti, 0 başarısız.
- Yeni hata senaryoları ilgili düzeltmelerden önce başarısız olarak doğrulandı; mevcut test beklentileri değiştirilmedi.
- Son durum: `node --test` — **24 geçti, 0 başarısız**, 0 atlanan.
- Yeni regression testleri: **6**; kalın Mi parser, kararlı mikrofon frame/clock, izin beklerken iptal, audio başlatma hatasında temizleme, resume beklerken iptal, sürümlü offline modüller.
- Tüm JavaScript dosyalarında `node --check` geçti. `git diff --check` geçti.
- Önceki pitch/harmonic/octave, fret matrix, irregular timestamp, seek, rate, pause/resume, beş dakikalık deterministik timing ve editor structured model testleri geçmeye devam ediyor.
- Beş dakikalık test simülasyon testidir; cihazda beş dakika gerçek ses oynatımı yapılmadı.

### Değiştirilen dosyalar

- app/main.js
- audio/microphone.js
- tab/tabParser.js
- service-worker.js
- tests/maintenance.test.js
- GECE_BAKIM_RAPORU.md

Dependency, tasarım, Firebase yapısı/kuralları, secret/API key ve production verisi değiştirilmedi. Kullanıcı verisi silinmedi. Mevcut NIGHTLY_REPORT.md geçmiş kayıt olarak korundu.

### Sabah benim kontrol etmem gerekenler

- Taslak PR'ı incele; gerçek cihaz doğrulaması ardından birleştirme kararı ver.
- Kalın Mi telinde 0, 12, 22 perdelerini ekle; kaydet, yeniden aç ve nota sırasını kontrol et.
- Mikrofon izni penceresi açıkken başka sayfaya geç; izin verdikten sonra mikrofonun kapandığını kontrol et.
- Mikrofonla doğru/yanlış ve yanlış oktav çal; konsolda getTime TypeError olmadığını, notaların değerlendirilmesini kontrol et.
- Mikrofon başlat/durdur ve duraklat/devam işlemlerini hızlı tekrarla; cihazın mikrofon göstergesinin kapanmasını izle.
- Ses dosyasıyla dinle, seek yap, hız değiştir; dinleme sırasında gösterim değiştir ve sayfa değiştir. Konum ve buton state'ini kontrol et.
- Egzersiz değişimi ve sayfa gezinmesinden sonra çalışma süresi/sonuç sayımlarını kontrol et.
- Telefonda dikey/yatay yön, kaydırma, editör tel/perde seçimi ve dokunma butonlarını dene.
- Ayrı test ortamında temiz PWA kurulumu yap, worker hazır olduktan sonra ağı kapatıp yeniden aç. Mevcut PWA'yı güncelleyip eski cache'in yenilendiğini de kontrol et.
- Gerçek gitarla tüm altı telde pitch eşleşmesini ve beş dakikalık ses/TAB senkronunu dene.
