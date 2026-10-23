# TabU

Mobil öncelikli, statik ve framework kullanmayan gitar TAB çalışma prototipi.

## Yerelde çalıştırma

Service worker ve mikrofon erişimi için `file://` yerine localhost kullanın. Python kuruluysa proje klasöründe:

```bash
python -m http.server 8000
```

Ardından `http://localhost:8000` adresini açın. Alternatif olarak VS Code Live Server kullanılabilir.

## İçerik

- TAB oynatıcı, tempo kontrolü, metronom ve çalışma modları
- 7 hazır egzersiz ve 8 mini ders
- Hazır ve kullanıcı tarafından oluşturulan TAB’ları düzenleme ve yerel kaydetme
- LocalStorage tabanlı ilerleme ve XP
- Web Audio mikrofon, frekans algılama ve nota eşleştirme servisleri
- Uygulama kabuğu için service worker, manifest ve SVG ikon

Mikrofon, yalnızca kullanıcının düğmeye basmasıyla ve localhost/HTTPS üzerinde istenir. Ham ses depolanmaz veya gönderilmez. Pitch algılama temel otokorelasyon prototipidir; gürültülü ortamda doğruluk sınırlıdır.

## Öğretmen ve öğrenci sistemi

TabU hesabı ve öğrenci verileri için TabU’ya özel, Test Arena’dan ayrı bir Firebase projesi kullanılır. Web giriş ayarları `app/firebase-config.js` dosyasına girilmeden portal devreye girmez; yapılandırma eksikken mevcut tek cihazlı uygulama çalışmaya devam eder.

E-posta/şifre ve Google Authentication sağlayıcı ayarları `firebase.json` içindedir ve `firebase deploy --only auth --project gitarist-fa850` ile uygulanır. Firebase Authentication ayarlarında `ebeveynleingilizce-sudo.github.io` yetkili alan adları listesine eklenmelidir. Web uygulamasının yapılandırması `app/firebase-config.js` içindedir. App Check reCAPTCHA v3 isteğe bağlıdır. Sunucu güvenliği Auth, callable rol doğrulaması, öğrenci kodu hız sınırı ve Firestore’un tüm istemci erişimini reddeden kurallarıyla sağlanır.

Proje kimliği belirlendikten sonra yerelde Firebase CLI ile projeyi bağla ve öğrenci kodlarını imzalamak için rastgele bir sunucu sırrı tanımla:

```powershell
firebase use --add
firebase deploy --only auth --project gitarist-fa850
firebase functions:secrets:set STUDENT_CODE_HMAC
npm install --prefix functions
firebase deploy --only functions,firestore:rules
```

GitHub Pages yalnızca statik web uygulamasını yayınlar; Functions ve Firestore ayrı olarak Firebase’e dağıtılır. Öğretmen TAB’ları, öğrenci profilleri ve atamalar Firebase’de tutulur. Öğrenci çalışma sonunda tek bir özet gönderir; nota bazlı geçmiş ve ham mikrofon sesi gönderilmez. Öğretmen paneli toplamları ve seçilen öğrenci/TAB ayrıntısını istek üzerine okur.

**Faturalandırma notu:** Firebase Cloud Functions dağıtımı Blaze planı ve bağlı bir Cloud Billing hesabı gerektirir. Bazı kullanım kotaları ücretsizdir; kotayı aşan kullanım ücretlendirilir. Yayına geçmeden önce bütçe uyarıları ve harcama sınırları ayarlanmalıdır.

