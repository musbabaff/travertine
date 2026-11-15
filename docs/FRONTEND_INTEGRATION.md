# Arayüz ve motor bağlantısı

Yeni arayüz, `apps/web` içindeki mevcut Next.js uygulamasına yerleştirildi. Motorun uç noktaları, istek tipleri,
önbellek anahtarları ve sözleşme örnekleri değiştirilmedi. Ekranların veri akışı şöyledir:

| Ekran | Yol | Veri kaynağı | Kullanım |
| --- | --- | --- | --- |
| Genel Bakış | `/` | `useField`, `useFieldAnalysis` | Seçili konumun iklim, toprak, NDVI ve su özeti |
| Tarla İzleme | `/app` | `useField`, `useFieldAnalysis` | Haritada nokta/sınır seçimi ve tarla analizi |
| Ekim Önerileri | `/app/explore` | `useRotations`, `useCrops` | Önceliklere göre ekim nöbetlerini sıralama ve karşılaştırma |
| Veri ve Yöntem | `/app/evidence` | `useValidation` | Model doğrulaması, geçmiş yıllar ve sınırlamalar |

Konum ve öncelikler URL parametrelerinde tutulur. Sayfalar arasında geçişte bu parametreler korunur. Motor erişilemezse
uygulamanın mevcut sözleşme örnek verisi mekanizması devreye girer; kaynak rozeti hangi yanıtın kullanıldığını belirtir.
Genel Bakış'taki ilk örnek tarla da ayrıca etiketlenir.

Cosmo'nun model dosyası `apps/web/public/cosmo.glb` içindedir. 3B sahne, pozlar ve animasyonlar
`apps/web/src/components/cosmo` altında korunur. İlk kullanım turu yalnızca yukarıdaki dört ekrana gider; turdaki
hedefler ekran elemanlarına bağlanır. Sohbet, mevcut ekranları anlatan yerel rehber yanıtları verir. Şu an sözleşmede
Cosmo için bir yapay zekâ uç noktası bulunmadığından sohbet motor verisi veya öneri üretmez. Mikrofon ve sesli yanıt
tarayıcının kendi ses özelliklerine bağlıdır.

Üretim, hasat, sulama, bildirim ve profil için bu sürümde motor uç noktası yoktur. Bu bağlantılar menüden gizlendi;
önceki arayüzün kaynak kopyası `design-reference/app` altında tutuldu. Bu ekranlar için veri sözleşmesi belirlendiğinde
kodları oradan yeniden değerlendirilebilir. Mevcut API ile ilgisiz menü bağlantısı görünmez.
