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
- 7 hazır egzersiz, 8 mini ders, rastgele nota antrenmanı
- Kullanıcı tarafından düzenlenebilir TAB alanı
- LocalStorage tabanlı ilerleme ve XP
- Web Audio mikrofon, frekans algılama ve nota eşleştirme servisleri
- Uygulama kabuğu için service worker, manifest ve SVG ikon

Mikrofon, yalnızca kullanıcının düğmeye basmasıyla ve localhost/HTTPS üzerinde istenir. Ham ses depolanmaz veya gönderilmez. Pitch algılama temel otokorelasyon prototipidir; gürültülü ortamda doğruluk sınırlıdır.
