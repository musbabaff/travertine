"""Provenance and note text in English and Turkish.

Every value is computed once by the caller and formatted here with the language's number style (text.num), so the
two languages carry the same numbers. Names of external datasets, providers and publications stay as published;
Travertine's own dataset names are translated.
"""

from __future__ import annotations

from travertine_engine.text import Language, num


def _pick(lang: Language, en: str, tr: str) -> str:
    return tr if lang == "tr" else en


def years_list(years: list[int]) -> str:
    return ", ".join(map(str, years))


# Bundled snapshot


def snapshot_note(lang: Language, fetched: str, host: str) -> str:
    return _pick(
        lang,
        f" Served from the engine's bundled snapshot of this source, fetched {fetched} from {host}; no live request "
        "was made for it.",
        f" Bu kaynağın motorla birlikte gelen anlık kopyasından sunuldu; {fetched} tarihinde {host} adresinden "
        "alındı, bunun için canlı istek yapılmadı.",
    )


# NASA POWER


def power_resolution(lang: Language) -> str:
    return _pick(
        lang,
        "0.5° × 0.625° (meteorology), 1° × 1° (solar radiation)",
        "0,5° × 0,625° (meteoroloji), 1° × 1° (güneş radyasyonu)",
    )


def daily_coverage(lang: Language, first: int, last: int) -> str:
    return _pick(lang, f"{first}–{last}, daily", f"{first}–{last}, günlük")


def power_note(lang: Language, *, elevation_m: float, hargreaves_days: int, dropped: list[int]) -> list[str]:
    elev = num(elevation_m, 0, lang)
    days = num(hargreaves_days, 0, lang)
    if lang == "tr":
        notes = [
            "Tarlayı içeren ızgara hücresi için ızgaralı, modele dayalı yeniden analiz değerleri; tarla ölçümü "
            "değildir: MERRA-2 meteorolojisi (0,5° × 0,625°) ve CERES SYN1deg güneş radyasyonu (1° × 1°).",
            "Parametreler: T2M, T2M_MAX, T2M_MIN, T2MDEW, WS2M, PS, ALLSKY_SFC_SW_DWN, PRECTOTCORR, GWETROOT.",
            "Günlük referans evapotranspirasyon FAO-56 Penman-Monteith'tir (denklem 6); gerçek buhar basıncı çiy "
            "noktasından (denklem 14), net radyasyon POWER ızgara hücresi yüksekliğiyle "
            f"({elev} m) denklem 37–40'tan hesaplanır; yıllık ET0 günlük değerlerin toplamıdır.",
            f"Penman-Monteith girdilerinin eksik olduğu {days} günde Hargreaves (denklem 52) kullanıldı.",
            "Kök bölgesi nemi, MERRA-2 kara modelinin GWETROOT doygunluk oranıdır; ölçülmüş toprak nemi değildir.",
        ]
        if dropped:
            notes.append(f"Günlük kaydı eksik olan yıllar dışarıda bırakıldı: {years_list(dropped)}.")
        return notes
    notes = [
        "Gridded, model-based reanalysis values for the grid cell containing the field, not field measurements: "
        "MERRA-2 meteorology (0.5° × 0.625°) and CERES SYN1deg solar radiation (1° × 1°).",
        "Parameters T2M, T2M_MAX, T2M_MIN, T2MDEW, WS2M, PS, ALLSKY_SFC_SW_DWN, PRECTOTCORR, GWETROOT.",
        "Daily reference evapotranspiration is FAO-56 Penman-Monteith (eq. 6) with actual vapour pressure from the "
        "dew point (eq. 14) and net radiation from eqs. 37–40 using the POWER grid-cell elevation "
        f"({elev} m); annual ET0 is the sum of daily values.",
        f"Hargreaves (eq. 52) was used on {days} day(s) where Penman-Monteith inputs were missing.",
        "Root-zone wetness is the GWETROOT fraction of saturation from the MERRA-2 land model, not a measured soil "
        "moisture.",
    ]
    if dropped:
        notes.append(f"Years with incomplete daily records were left out: {years_list(dropped)}.")
    return notes


# SoilGrids and the default soil


def soil_method(lang: Language) -> str:
    return _pick(
        lang,
        "Texture class (USDA), organic carbon and pH are depth-weighted means of 0–30 cm. Available water capacity is "
        "the 0–100 cm sum of field capacity (−33 kPa) minus wilting point (−1500 kPa) from the Saxton & Rawls (2006) "
        "pedotransfer functions (Soil Sci. Soc. Am. J. 70:1569–1578), with organic matter = 1.724 × organic carbon; "
        "gravel and salinity are not accounted for.",
        "Bünye sınıfı (USDA), organik karbon ve pH, 0–30 cm'nin derinlik ağırlıklı ortalamalarıdır. Yarayışlı su "
        "kapasitesi, Saxton & Rawls (2006) pedotransfer fonksiyonlarıyla (Soil Sci. Soc. Am. J. 70:1569–1578) "
        "hesaplanan tarla kapasitesi (−33 kPa) eksi solma noktasının (−1500 kPa) 0–100 cm toplamıdır; organik madde "
        "= 1,724 × organik karbon alınır; çakıl ve tuzluluk hesaba katılmaz.",
    )


def soilgrids_coverage(lang: Language) -> str:
    return _pick(
        lang,
        "Static; predictions from soil profiles collected over several decades",
        "Durağan; onlarca yıl boyunca toplanmış toprak profillerinden tahminler",
    )


def soilgrids_note(lang: Language, *, clay: tuple[float, float], soc: tuple[float, float]) -> str:
    c0, c1 = num(clay[0], 0, lang), num(clay[1], 0, lang)
    s0, s1 = num(soc[0], 1, lang), num(soc[1], 1, lang)
    if lang == "tr":
        return (
            f" Bu noktada 0–30 cm için SoilGrids %90 tahmin aralığı: kil %{c0}–{c1}, organik karbon {s0}–{s1} g/kg; "
            "ortalama tahminden türetilen değerler bu belirsizliği taşır."
        )
    return (
        f" SoilGrids 90 % prediction interval for 0–30 cm at this point: clay {c0}–{c1} %, organic carbon {s0}–{s1} "
        "g/kg; values derived from the mean prediction carry that uncertainty."
    )


def default_soil(lang: Language, *, no_prediction: bool) -> dict[str, str]:
    if lang == "tr":
        reason = "bu noktada tahmin vermiyor" if no_prediction else "yanıt vermedi"
        return {
            "dataset": "VARSAYILAN TOPRAK — ölçülmedi (SoilGrids 2.0 kullanılamadı)",
            "provider": "Travertine motoru varsayılanı",
            "spatial_resolution": "Yok (genel yer tutucu)",
            "temporal_coverage": "Uygulanamaz",
            "note": (
                f"SoilGrids {reason}; bu yüzden bu toprak değerleri genel bir tın yer tutucusudur (%40 kum, %40 silt, "
                "%20 kil, 10 g/kg organik karbon, pH 7,0) ve bu tarlanın verisi DEĞİLDİR. Yarayışlı su kapasitesine "
                "bağlı su dengesi sonuçları buna göre belirsizdir. " + soil_method(lang)
            ),
        }
    reason = "has no prediction at this point" if no_prediction else "did not respond"
    return {
        "dataset": "DEFAULT SOIL — not measured (SoilGrids 2.0 unavailable)",
        "provider": "Travertine engine default",
        "spatial_resolution": "None (generic placeholder)",
        "temporal_coverage": "Not applicable",
        "note": (
            f"SoilGrids {reason}, so these soil values are a generic loam placeholder (40 % sand, 40 % silt, "
            "20 % clay, 10 g/kg organic carbon, pH 7.0), NOT data for this field. Water-balance results that "
            "depend on available water capacity are correspondingly uncertain. " + soil_method(lang)
        ),
    }


# MODIS and HLS


def modis_coverage(lang: Language, first: int, last: int) -> str:
    return _pick(
        lang,
        f"{first}–{last}, 16-day composites, April–September",
        f"{first}–{last}, 16 günlük kompozitler, Nisan–Eylül",
    )


def modis_note(lang: Language, *, composites: int, min_composites: int, skipped: list[int]) -> str:
    if lang == "tr":
        note = (
            "Tarla merkezini içeren tek bir 250 m piksel; komşu tarlaları, yolları veya binaları içerebilir. "
            f"Yetişme dönemi değeri = yılın 97. ile 241. günleri arasında başlayan {composites} kompozitten (Nisan "
            "başından Eylül sonuna) piksel güvenilirliği 0 (iyi) veya 1 (orta) olanların ortalama NDVI'sı; kar, bulut "
            f"ve dolgu atılır ve bir yılın en az {min_composites} kullanılabilir kompoziti olmalıdır."
        )
        if skipped:
            note += (
                f" Yeterli kullanılabilir kompoziti olmayan yıllar dışarıda bırakıldı: {years_list(skipped)}."
            )
        return note
    note = (
        "Single 250 m pixel containing the field centre; it may include neighbouring fields, roads or buildings. "
        f"Growing-season value = mean NDVI of the {composites} composites starting day-of-year 97 to 241 "
        "(early April to late September) whose pixel reliability is 0 (good) or 1 (marginal); snow, cloud and fill "
        f"are dropped and a year needs at least {min_composites} usable composites."
    )
    if skipped:
        note += f" Years without enough usable composites were left out: {years_list(skipped)}."
    return note


def hls_coverage(lang: Language, first: int, last: int) -> str:
    return _pick(
        lang,
        f"{first}–{last}, every 2–3 days before clouds",
        f"{first}–{last}, bulutlardan önce 2–3 günde bir",
    )


def hls_note(lang: Language, *, max_cloud: float, min_obs: int) -> str:
    cloud = num(max_cloud, 0, lang)
    if lang == "tr":
        return (
            "Tarla merkezini içeren 30 m piksel. NDVI = (NIR − kırmızı)/(NIR + kırmızı); nadir BRDF düzeltmeli "
            "yansımadan: Landsat 8/9 bantları B05 ve B04, Sentinel-2 bantları B8A ve B04, HLS tarafından Landsat'a "
            "bant geçişi uyarlanmış. Fmask bit 1–5'in (bulut, buluta veya gölgeye bitişik, bulut gölgesi, kar/buz, su) "
            "hepsi 0 ve aerosol düzeyi yüksek değilse gözlem açıktır (HLS v2.0 kullanım kılavuzu, Tablo 9). Paftanın "
            f"%{cloud}'inden fazlası bulutlu sahneler okunmaz; örtüşen paftalar her tarih için bir kez sayılır. Sezon = "
            f"Nisan–Eylül; ortalama yalnızca en az {min_obs} gözlem açıksa verilir."
        )
    return (
        "The 30 m pixel containing the field centre. NDVI = (NIR − red)/(NIR + red) from nadir BRDF-adjusted "
        "reflectance: Landsat 8/9 bands B05 and B04, Sentinel-2 bands B8A and B04, bandpass-adjusted to Landsat "
        "by HLS. An observation is clear when Fmask bits 1–5 (cloud, adjacent to cloud or shadow, cloud shadow, "
        "snow/ice, water) are all 0 and the aerosol level is not high (HLS v2.0 user guide, Table 9). Scenes "
        f"with more than {cloud} % cloud over the tile are not read; overlapping tiles are counted "
        f"once per date. Season = April–September, with a mean only when at least {min_obs} observations "
        "are clear."
    )


def hls_caveats(lang: Language, first_year: int) -> list[str]:
    if lang == "tr":
        return [
            f"Tarla ölçeğindeki kayıt {first_year}'de başlıyor: Microsoft Planetary Computer'daki anonim HLS v2.0 "
            "kopyası o yıl başlar. Tam arşiv (2013'ten itibaren) NASA Earthdata girişi gerektirir.",
            "Tarla merkezinde tek bir 30 m piksel; o pikselin içindeki tarla kenarı, yol ya da ağaç değeri değiştirir.",
            "NDVI yeşil örtüyü gösterir, verimi ya da ürün türünü değil; hasattan sonraki çıplak toprak da yabani "
            "otlar da onu etkiler.",
        ]
    return [
        f"Field-scale record starts in {first_year}: the anonymous HLS v2.0 copy on Microsoft Planetary "
        "Computer begins then. The full archive (2013 onwards) needs a NASA Earthdata login.",
        "One 30 m pixel at the field centre; a field edge, track or tree inside that pixel changes the value.",
        "NDVI shows green cover, not yield or crop type; bare soil after harvest and weeds both affect it.",
    ]


def modis_unavailable(lang: Language) -> str:
    return _pick(
        lang,
        "The MODIS 250 m record could not be read just now, so no comparison with it is given.",
        "MODIS 250 m kaydı şu anda okunamadı; bu yüzden onunla karşılaştırma verilmiyor.",
    )


def modis_no_overlap(lang: Language) -> str:
    return _pick(
        lang,
        "No year has a season mean in both this record and the MODIS 250 m record, so they are not compared.",
        "Hiçbir yılın hem bu kayıtta hem de MODIS 250 m kaydında sezon ortalaması yok; bu yüzden karşılaştırılmıyor.",
    )


def modis_comparison(lang: Language, *, years: list[int], mean: float, lo: float, hi: float) -> str:
    n = len(years)
    m, a, b = num(mean, 3, lang, sign=True), num(lo, 3, lang, sign=True), num(hi, 3, lang, sign=True)
    if lang == "tr":
        return (
            f"Aynı noktanın aynı yıllardaki MODIS 250 m sezon ortalamalarıyla karşılaştırıldığında ({years_list(years)}; "
            f"n = {n}), 30 m ortalamalar ortalamada {m} NDVI farklı (yıllara göre {a} ile {b} arası). İkisi ayak izi "
            "(tek bir 30 m piksel ile birkaç tarlayı karıştırabilen bir 250 m piksel), algılayıcılar ve sezon tanımı "
            "(burada Nisan–Eylül açık gözlemleri; MODIS için Nisan başından Eylül sonuna 16 günlük kompozitler) "
            "bakımından farklıdır; bu yüzden bir fark beklenir ve hiçbiri referans değildir."
        )
    return (
        f"Compared with the MODIS 250 m season means of the same point in the same years ({years_list(years)}; n = {n}), "
        f"the 30 m means are {m} NDVI on average (per year {a} to {b}). The two "
        "differ in footprint (one 30 m pixel against a 250 m pixel that may mix fields), in sensors and in season "
        "definition (clear April–September observations here; 16-day composites from early April to late "
        "September for MODIS), so a difference is expected and neither is the reference."
    )


# Methods and published sources


def not_spatial(lang: Language, what_en: str, what_tr: str) -> str:
    return _pick(lang, f"Not spatial ({what_en})", f"Mekânsal değil ({what_tr})")


def published(lang: Language, year: int) -> str:
    return _pick(lang, f"Published {year}", f"{year} yılında yayımlandı")


def fao56_note(lang: Language) -> str:
    return _pick(
        lang,
        "Crop coefficients (Table 12, adjusted for local wind and humidity with eqs. 62 and 65), stage lengths "
        "(Table 11), rooting depth and depletion fraction (Table 22), daily root-zone water balance and water-stress "
        "coefficient Ks (chapter 8, eqs. 84–85) and bare-soil evaporation between crops (chapter 7, eqs. 73–74, "
        "Table 19). Runoff and capillary rise are not modelled.",
        "Ürün katsayıları (Tablo 12; denklem 62 ve 65 ile yerel rüzgâr ve neme göre düzeltilmiş), dönem uzunlukları "
        "(Tablo 11), kök derinliği ve tükenme oranı (Tablo 22), günlük kök bölgesi su dengesi ve su stresi katsayısı "
        "Ks (bölüm 8, denklem 84–85) ve ürünler arasında çıplak toprak buharlaşması (bölüm 7, denklem 73–74, Tablo "
        "19). Yüzey akışı ve kılcal yükselme modellenmez.",
    )


def a3517_note(lang: Language) -> str:
    return _pick(
        lang,
        "Legume nitrogen credits to the following crop (alfalfa fair stand 160 and 50 lb N/acre in the first and "
        "second year, soybean 40, pea and dry bean 20, applied to lentil and faba bean as the closest category). Used "
        "only as one of four relative soil-health indicators, not as a fertilizer recommendation for this field.",
        "Baklagillerin sonraki ürüne azot katkısı (orta yoğunlukta yonca birinci ve ikinci yılda 160 ve 50 lb N/acre, "
        "soya 40, bezelye ve kuru fasulye 20; en yakın kategori olarak mercimek ve baklaya uygulandı). Yalnızca dört "
        "göreli toprak sağlığı göstergesinden biri olarak kullanılır; bu tarla için gübre önerisi değildir.",
    )


def etccdi_note(lang: Language) -> str:
    return _pick(
        lang,
        "FD, SU, TXx, R10mm, R20mm, Rx1day and CDD as defined by ETCCDI (Zhang et al. 2011, doi:10.1002/wcc.147), "
        "computed on NASA POWER grid-cell daily values. Warm days are a simplified TX90p: threshold = 90th "
        "percentile of daily maximum temperature per calendar month over this record. CDD is counted within each "
        "calendar year.",
        "FD, SU, TXx, R10mm, R20mm, Rx1day ve CDD, ETCCDI tanımlarıyla (Zhang ve diğ. 2011, doi:10.1002/wcc.147) "
        "NASA POWER ızgara hücresinin günlük değerleri üzerinden hesaplandı. Sıcak günler basitleştirilmiş bir "
        "TX90p'dir: eşik = bu kayıtta her takvim ayı için günlük en yüksek sıcaklığın 90. yüzdeliği. CDD her takvim "
        "yılı içinde sayılır.",
    )


def etccdi_coverage(lang: Language) -> str:
    return _pick(lang, "Definitions published 2011", "Tanımlar 2011 yılında yayımlandı")


# Travertine's own computations


def scoring_dataset(lang: Language) -> str:
    return _pick(
        lang, "Travertine rotation back-cast and scoring", "Travertine nöbet geriye dönük testi ve puanlaması"
    )


def engine_provider(lang: Language) -> str:
    return _pick(lang, "Travertine engine", "Travertine motoru")


def field_point(lang: Language) -> str:
    return _pick(
        lang,
        "Field point (inputs at the resolutions listed above)",
        "Tarla noktası (girdiler yukarıdaki çözünürlüklerde)",
    )


def windows_coverage(lang: Language, *, n_windows: int, horizon: int, first: int, last: int) -> str:
    return _pick(
        lang,
        f"{n_windows} overlapping {horizon}-year windows of agricultural years {first}–{last}",
        f"{first}–{last} tarım yıllarının örtüşen {n_windows} adet {horizon} yıllık dönemi",
    )


def scoring_note(lang: Language) -> str:
    return _pick(
        lang,
        "Each rotation is simulated through every historical window with soil water carried between crops. "
        "Yearly figures are medians across windows. Scores are relative indices between 0 and 1 under the given "
        "priorities, not forecasts. water = median share of crop water demand met by rain and stored soil water; "
        "risk = 1 − (0.5 × 90th-percentile unmet share of a season + 0.5 × its 10th–90th percentile spread); "
        "soil = mean of legume nitrogen credit, family diversity, rooting-depth range and share of the year under "
        "a crop, each scaled to the candidates considered; income = mean water-limited relative "
        "evapotranspiration with every crop valued equally — no price or market data is used.",
        "Her nöbet, ürünler arasında toprak suyu taşınarak her geçmiş dönem boyunca benzetilir. Yıllık değerler "
        "dönemler üzerinden ortancalardır. Puanlar, verilen önceliklerle 0 ile 1 arasında göreli endekslerdir; "
        "tahmin değildir. su = bitki su ihtiyacının yağış ve topraktaki depolanmış suyla karşılanan ortanca payı; "
        "risk = 1 − (0,5 × bir sezonun karşılanmayan payının 90. yüzdeliği + 0,5 × 10.–90. yüzdelik aralığı); "
        "toprak = baklagil azot katkısı, familya çeşitliliği, kök derinliği aralığı ve yılın ürünle geçen payının "
        "ortalaması, her biri değerlendirilen adaylara göre ölçeklenmiş; gelir = her ürüne eşit değer verilen, suyla "
        "sınırlı göreli evapotranspirasyonun ortalaması — fiyat ya da piyasa verisi kullanılmaz.",
    )


def baseline_note(lang: Language) -> str:
    return _pick(
        lang,
        " The baseline is the rotation the user entered as their current one, repeated to fill the horizon if shorter. "
        "It is simulated through the same windows with the same water balance; its soil indicators are divided by the "
        "same candidate maxima (limited to 1) and its total uses the same priorities. It is scored even when it breaks "
        "the rotation rules the candidates obey, and `rule_violations` lists every rule it breaks. `vs_baseline` is an "
        "alternative's score minus the baseline's.",
        " Temel, kullanıcının mevcut nöbeti olarak girdiği rotasyondur; daha kısaysa süreyi dolduracak şekilde "
        "tekrarlanır. Aynı dönemler boyunca aynı su dengesiyle benzetilir; toprak göstergeleri aynı aday en "
        "yüksek değerlerine bölünür (en fazla 1) ve toplamı aynı öncelikleri kullanır. Adayların uyduğu nöbet "
        "kurallarını bozsa bile puanlanır ve `rule_violations` bozduğu her kuralı listeler. `vs_baseline`, bir "
        "seçeneğin puanı eksi temelin puanıdır.",
    )


def scenario_dataset(lang: Language) -> str:
    return _pick(
        lang,
        "Sensitivity test on the NASA POWER record (not a forecast)",
        "NASA POWER kaydı üzerinde duyarlılık testi (tahmin değildir)",
    )


def same_as_power(lang: Language) -> tuple[str, str]:
    if lang == "tr":
        return "NASA POWER ile aynı", "NASA POWER kaydıyla aynı yıllar"
    return "Same as NASA POWER", "Same years as the NASA POWER record"


def scenario_note(lang: Language, factor: float, delta: float) -> str:
    f, d = format(factor, "g"), format(delta, "+g")
    if lang == "tr":
        f, d = f.replace(".", ","), d.replace(".", ",")
    if lang == "tr":
        return (
            f"Her günün yağışı {f} ile çarpıldı ve günlük ortalama, en yüksek, en düşük ve çiy noktası sıcaklıklarına "
            f"{d} °C eklendi; rüzgâr, radyasyon ve basınç kaydedildiği gibi. Ardından FAO-56 Penman-Monteith ET0, ürün "
            "katsayılarının iklim düzeltmesi ve toprak su dengesi yeniden hesaplandı. Sonuçlar geçmiş yılların bu "
            "değişiklikle nasıl puanlanacağını gösterir; gelecek iklimin bir projeksiyonu değildir."
        )
    return (
        f"Every day's precipitation was multiplied by {f} and {d} °C was added to daily mean, "
        "maximum, minimum and dew-point temperature; wind, radiation and pressure are as recorded. FAO-56 "
        "Penman-Monteith ET0, the crop coefficients' climate adjustment and the soil water balance were then "
        "recomputed. Results show how the past years would have scored under that change; they are not a "
        "projection of future climate."
    )


# Hazards


def hazard_caveats(lang: Language, *, southern: bool) -> list[str]:
    if lang == "tr":
        out = [
            "Değerler tarla için değil, NASA POWER ızgara hücresi (yaklaşık 50 km genişliğinde) içindir: vadi "
            "tabanındaki don ya da güney yamaçtaki sıcaklık hücre ortalamasından farklı olabilir.",
            "Ürüne özgü sıcaklık stresi eşikleri kullanılmaz: motorun ürün tablosunda doğrulanmış yayımlanmış bir eşik "
            "yok; bu yüzden sıcak günler kaydın kendi 90. yüzdeliğine göre sayılır.",
        ]
        if southern:
            out.append("Don tarihleri yalnızca kuzey yarımküre için hesaplanır.")
        return out
    out = [
        "Values are for the NASA POWER grid cell (about 50 km across), not the field: frost in a valley bottom "
        "or heat on a south slope can differ from the cell average.",
        "Crop-specific heat-stress thresholds are not used: no verified published threshold is in the engine's "
        "crop table, so warm days are counted against the record's own 90th percentile.",
    ]
    if southern:
        out.append("Frost dates are only computed for the northern hemisphere.")
    return out
