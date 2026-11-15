# Glossary / Sözlük

The same definitions Cosmo gives in the app (locale keys `cosmo.gloss.*`). Each says what Travertine does and does not
compute today.

Cosmo'nun uygulamada verdiği tanımların aynısı (`cosmo.gloss.*` anahtarları). Her biri Travertine'in bugün neyi
hesapladığını ve neyi hesaplamadığını söyler.

## English

**Evapotranspiration (ET, ET₀).** The water that leaves a field as vapour: evaporation from the soil plus transpiration
through crop leaves. Reference evapotranspiration (ET₀) is the rate for a standard, well-watered grass, computed in
Travertine with the FAO-56 Penman-Monteith equation from NASA POWER weather. A crop's need is ET₀ multiplied by its crop
coefficient (Kc).

**Soil-moisture anomaly.** How much wetter or drier the soil is than usual for that place and time of year, measured
against the long-term average. Travertine does not compute soil-moisture anomalies yet. It shows NASA POWER root-zone
wetness (0 dry, 1 saturated), a modelled value for a grid cell of about 55 × 55 km, not a probe reading from your field.

**NDVI.** The Normalised Difference Vegetation Index compares the near-infrared and red light a surface reflects:
(NIR − Red) / (NIR + Red). Green, dense vegetation gives high values; bare soil gives low values. Travertine uses MODIS
NDVI at 250 m and, where the engine provides it, 30 m HLS NDVI.

**Frost risk.** The chance that the temperature falls to 0 °C or below while a crop is sensitive, for example at
flowering. It is judged from daily minimum temperatures on record. Travertine does not show a frost-risk figure yet; it
will appear only when the engine computes it from the climate record.

**Water balance.** Tracks the water in the root zone day by day: rain and irrigation add water, crop evapotranspiration
removes it, and water beyond what the soil can hold drains away. When stored water runs low the crop is stressed.
Travertine's rotation scores come from this FAO-56 daily balance replayed over past seasons.

**Satellite observations versus ground measurements.** Satellites and models give averages over an area, not a point:
a 250 m pixel for MODIS NDVI and a grid cell of about 55 × 55 km for NASA POWER weather. A ground station or soil probe
measures one spot precisely. Satellite and model data cover every field and many years; ground measurements are more
exact where they are taken. A farmer's own field records are better where they exist.

## Türkçe

**Evapotranspirasyon (ET, ET₀).** Tarladan buhar olarak ayrılan sudur: topraktan buharlaşma ile bitki yapraklarından
terleme. Referans evapotranspirasyon (ET₀), iyi sulanmış standart bir çim yüzeyin su kaybıdır; Travertine'de NASA POWER
hava verisinden FAO-56 Penman-Monteith denklemiyle hesaplanır. Bir ürünün ihtiyacı, ET₀'ın ürün katsayısıyla (Kc)
çarpımıdır.

**Toprak nemi anomalisi.** Toprağın o yer ve yılın o zamanı için olağandan ne kadar ıslak ya da kuru olduğunu uzun
dönem ortalamasına göre gösterir. Travertine henüz toprak nemi anomalisi hesaplamıyor. NASA POWER kök bölgesi nemini
(0 kuru, 1 doygun) gösterir; bu, yaklaşık 55 × 55 km'lik bir ızgara hücresi için modellenmiş bir değerdir, tarladaki
bir sensörün ölçümü değildir.

**NDVI.** Normalleştirilmiş Fark Bitki İndeksi, yüzeyin yansıttığı yakın kızılötesi ve kırmızı ışığı karşılaştırır:
(YKÖ − Kırmızı) / (YKÖ + Kırmızı). Yeşil ve sık bitki örtüsü yüksek, çıplak toprak düşük değer verir. Travertine 250 m
MODIS NDVI'yi ve motor sağladığında 30 m HLS NDVI'yi kullanır.

**Don riski.** Ürün hassasken (örneğin çiçeklenmede) sıcaklığın 0 °C ya da altına düşme olasılığıdır. Kayıttaki günlük
en düşük sıcaklıklardan değerlendirilir. Travertine henüz bir don riski değeri göstermiyor; bu değer ancak motor iklim
kaydından hesapladığında görünecek.

**Su dengesi.** Kök bölgesindeki suyu gün gün izler: yağış ve sulama su ekler, ürünün evapotranspirasyonu su çeker,
toprağın tutabileceğinden fazlası süzülüp gider. Depolanan su azalınca ürün strese girer. Travertine'in nöbet puanları,
geçmiş sezonlar üzerinde yeniden oynatılan bu FAO-56 günlük dengeden gelir.

**Uydu gözlemleri ile yer ölçümleri.** Uydular ve modeller bir noktayı değil bir alanın ortalamasını verir: MODIS NDVI
için 250 m'lik bir piksel, NASA POWER hava verisi için yaklaşık 55 × 55 km'lik bir ızgara hücresi. Bir meteoroloji
istasyonu ya da toprak sensörü tek bir noktayı hassas ölçer. Uydu ve model verisi her tarlayı ve uzun yılları kapsar;
yer ölçümleri alındıkları yerde daha kesindir. Çiftçinin kendi tarla kayıtları, varsa, daha iyidir.
