"""Sentences the engine writes for people, in English and Turkish.

Only wording changes between languages; every number is computed once and formatted here. Turkish uses a decimal
comma, a space between thousands and a leading percent sign (%34). Ids, units, `method` and provenance stay English.
"""

from __future__ import annotations

from typing import Literal

Language = Literal["en", "tr"]

CROP_NAMES_TR = {
    "winter_wheat": "kışlık buğday",
    "barley": "arpa",
    "lentil": "mercimek",
    "faba_bean": "bakla (kuru tane)",
    "maize": "dane mısır",
    "sorghum": "sorgum (dane)",
    "cotton": "pamuk",
    "sunflower": "ayçiçeği",
    "sugar_beet": "şeker pancarı",
    "tomato": "domates",
    "soybean": "soya",
    "alfalfa": "yonca (kuru ot)",
}


def num(x: float, digits: int, lang: Language, *, sign: bool = False) -> str:
    spec = f"{'+' if sign else ''}.{digits}f"
    if lang == "en":
        return format(x, spec)
    grouped = format(x, spec.replace(".", ",.", 1))
    return grouped.replace(",", " ").replace(".", ",")


def pct(x: float, lang: Language) -> str:
    value = num(100 * x, 0, lang)
    return f"{value} %" if lang == "en" else f"%{value}"


def crop_name(crop_id: str, english: str, lang: Language) -> str:
    return english.lower() if lang == "en" else CROP_NAMES_TR.get(crop_id, english.lower())


def interval(ci: tuple[float, float], lang: Language) -> str:
    lo, hi = (num(v, 2, lang, sign=True) for v in ci)
    return f"{lo} to {hi}" if lang == "en" else f"{lo} ile {hi} arası"


# Rotation explanations (POST /v1/rotations/explore)


def water_summary(
    lang: Language, *, windows: int, years: int, span: str, demand: float, deficit: float, irrigated: bool
) -> str:
    share = pct(deficit / max(demand, 1e-9), lang)
    d, u = num(demand, 0, lang), num(deficit, 0, lang)
    if lang == "tr":
        head = (
            f"Kayıttaki {windows} adet {years} yıllık dönemde (tarım yılları {span}) bitkilerin su ihtiyacının "
            f"ortancası {d} mm oldu; "
        )
        if irrigated:
            return head + f"bunun {u} mm'sinin ({share}) sulamayla karşılanması gerekti."
        return head + f"kuru tarımda yağış ve topraktaki su bunun {u} mm'sini ({share}) karşılayamadı."
    head = (
        f"Across {windows} historical {years}-year windows (agricultural years {span}), the median crop water "
        f"demand was {d} mm"
    )
    if irrigated:
        return head + f", of which {u} mm ({share}) had to come from irrigation."
    return head + f" and rain plus stored soil water left {u} mm ({share}) unmet under rain-fed management."


def driest_seasons(
    lang: Language, *, p90: float, crop: str, ag_year: int, worst: float, irrigated: bool
) -> str:
    season = f"{ag_year - 1}/{ag_year}"
    if lang == "tr":
        what = "sulamayla karşılanmak zorunda kaldı" if irrigated else "karşılanamadı"
        return (
            f"Benzetimi yapılan sezonların en kurak onda birinde bitki su ihtiyacının {pct(p90, lang)} veya daha "
            f"fazlası {what}; en uç sezon {season} tarım yılındaki {crop} sezonuydu ({pct(worst, lang)})."
        )
    what = "had to be irrigated" if irrigated else "went unmet"
    return (
        f"In the driest tenth of simulated seasons at least {pct(p90, lang)} of crop water demand {what}; the most "
        f"extreme season was {crop} in {season} ({pct(worst, lang)})."
    )


def nitrogen_credit(lang: Language, *, legumes: list[str], kg_ha: float) -> str:
    names, n = ", ".join(legumes), num(kg_ha, 0, lang)
    if lang == "tr":
        return (
            f"Baklagiller ({names}) kendilerinden sonra gelen ürünlere tahminen {n} kg N/ha azot katkısı sağlar "
            "(ABD Ortabatı denemelerinden UW-Extension A3517 değerleri; yerel tepkiler farklı olabilir)."
        )
    return (
        f"Legumes ({names}) earn an estimated {n} kg N/ha of nitrogen credit for the crops that follow them "
        "(UW-Extension A3517 values from Midwest US trials; local responses may differ)."
    )


def no_nitrogen_credit(lang: Language, *, legumes: list[str], coarse_soil: bool) -> str:
    names = ", ".join(legumes)
    if lang == "tr":
        where = " bu kaba bünyeli toprakta" if coarse_soil else ""
        return (
            f"Baklagil yılının ({names}) ardından dönem içinde baklagil olmayan bir ürün gelmiyor ya da baklagil"
            f"{where} azot katkısı sağlamıyor; bu yüzden azot katkısı sayılmadı."
        )
    where = " on this coarse-textured soil" if coarse_soil else ""
    return (
        f"The legume year ({names}) is not followed by a non-legume crop within the horizon, or earns no "
        f"credit{where}, so no nitrogen credit is counted."
    )


def diversity(lang: Language, *, families: int, root_range_m: float, cover: float) -> str:
    roots, share = num(root_range_m, 2, lang), pct(cover, lang)
    if lang == "tr":
        return (
            f"Rotasyonda {families} botanik familya var, kök derinlikleri {roots} m'lik bir aralığa yayılıyor ve "
            f"tarlada zamanın {share} kadarında ürün bulunuyor."
        )
    return (
        f"The rotation uses {families} botanical families, its rooting depths span {roots} m and a crop is in the "
        f"field {share} of the time."
    )


def income_note(lang: Language, *, weighted: bool = False) -> str:
    if weighted:
        if lang == "tr":
            return (
                "Gelir endeksi her ürün yılını, o ürün için girdiğiniz değerin en yüksek değere oranıyla ve "
                "ürünün su ihtiyacının karşılanan payıyla ağırlıklandırır; maliyet ve verim kullanmaz, bu yüzden "
                "onu kâr tahmini olarak değil, değerle ağırlıklandırılmış bir üretim endeksi olarak okuyun."
            )
        return (
            "The income index weights each crop year by the value you gave for that crop, relative to the highest "
            "value, times the share of its water demand that was met; it uses no costs or yields, so treat it as a "
            "value-weighted production index, not a profit estimate."
        )
    if lang == "tr":
        return (
            "Gelir endeksi yalnızca her ürünün su ihtiyacının ne kadarının karşılandığını yansıtır; fiyat "
            "kullanmaz, bu yüzden onu kâr tahmini olarak değil, suyla sınırlı bir üretim endeksi olarak okuyun."
        )
    return (
        "The income index only reflects how much of each crop's water demand was met; it uses no prices, so treat "
        "it as a water-limited production index, not a profit estimate."
    )


# The farmer's current rotation as the baseline (POST /v1/rotations/explore, `current_rotation`)


def baseline_intro(lang: Language, *, entered: int, years: int) -> str:
    if lang == "tr":
        fill = (
            f" Girdiğiniz {entered} yıllık sıra, {years} yılı dolduracak şekilde tekrarlandı."
            if entered < years
            else ""
        )
        return (
            "Bu, girdiğiniz mevcut rotasyondur; seçeneklerle aynı su dengesi ve aynı göstergelerle, aynı geçmiş "
            "yıllar üzerinde puanlandı." + fill
        )
    fill = (
        f" The {entered}-year sequence you entered was repeated to fill {years} years."
        if entered < years
        else ""
    )
    return (
        "This is the current rotation you entered, scored with the same water balance and the same indicators as "
        "the alternatives, over the same historical years." + fill
    )


def same_family(lang: Language, *, year: int, crop: str, previous: str, family: str) -> str:
    if lang == "tr":
        return (
            f"{year}. yıl: {crop}, {previous} ürününün ardından geliyor ve ikisi de {family} familyasından. Motorun "
            "önerdiği rotasyonlarda aynı botanik familya art arda iki yıl yer almaz; bu sıra yine de puanlandı."
        )
    return (
        f"Year {year}: {crop} follows {previous} and both are {family}. The rotations the engine proposes never "
        "place the same botanical family in two consecutive years; this sequence was scored anyway."
    )


def no_legume(lang: Language) -> str:
    if lang == "tr":
        return (
            "Sırada baklagil yok. Motorun önerdiği her rotasyonda en az bir baklagil bulunur; bu sıra için "
            "baklagil azot katkısı 0 olarak sayıldı."
        )
    return (
        "The sequence has no legume. Every rotation the engine proposes includes at least one; the legume "
        "nitrogen credit of this sequence is counted as 0."
    )


def perennial_single_year(lang: Language, *, year: int, crop: str) -> str:
    if lang == "tr":
        return (
            f"{year}. yıl: {crop} yalnızca bir yıl yer alıyor. Motorun önerdiği rotasyonlarda çok yıllık bir "
            "bitki en az iki yıl üst üste tarlada kalır; bu sıra yine de puanlandı."
        )
    return (
        f"Year {year}: {crop} is grown for a single year. In the rotations the engine proposes a perennial stand "
        "stays for at least two consecutive years; this sequence was scored anyway."
    )


# Structured reasoning per strategy (POST /v1/rotations/explore, `reasoning`)

MONTHS: dict[Language, list[str]] = {
    "en": [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
    ],
    "tr": [
        "Ocak",
        "Şubat",
        "Mart",
        "Nisan",
        "Mayıs",
        "Haziran",
        "Temmuz",
        "Ağustos",
        "Eylül",
        "Ekim",
        "Kasım",
        "Aralık",
    ],
}
SCORE_NAMES: dict[Language, dict[str, str]] = {
    "en": {"water": "water", "income": "income", "soil": "soil", "risk": "risk"},
    "tr": {"water": "su", "income": "gelir", "soil": "toprak", "risk": "risk"},
}


def _cap(sentence: str) -> str:
    return sentence[:1].upper() + sentence[1:]


def why_rank(lang: Language, *, rank: int, n: int, priorities: object) -> str:
    w, i, s, r = (
        num(float(getattr(priorities, name)), 2, lang) for name in ("water", "income", "soil", "risk")
    )
    count = num(n, 0, lang)
    if lang == "tr":
        return (
            f"Önceliklerinize göre (su {w}, gelir {i}, toprak {s}, risk {r}) rotasyon kurallarını sağlayan "
            f"{count} rotasyon arasında {rank}. sırada."
        )
    return (
        f"Ranked {rank} of {count} rotations that satisfy the rotation rules, under your priorities "
        f"(water {w}, income {i}, soil {s}, risk {r})."
    )


def why_strongest(lang: Language, *, score: str, value: float, share: float) -> str:
    name, v = SCORE_NAMES[lang][score], num(value, 3, lang)
    if lang == "tr":
        return f"{_cap(name)} puanı ({v}), bu rotasyonların {pct(share, lang)} kadarınınkinden yüksek."
    return f"Its {name} score ({v}) is higher than that of {pct(share, lang)} of those rotations."


def why_vs_current(lang: Language, *, total: float, current: float) -> str:
    a, b = num(total, 3, lang), num(current, 3, lang)
    d = num(abs(total - current), 3, lang)
    if total > current:
        if lang == "tr":
            return f"Toplam puanı mevcut rotasyonunuzunkinden {d} yüksek ({b} yerine {a})."
        return f"Its total score is {d} higher than your current rotation's ({a} against {b})."
    if lang == "tr":
        return f"Toplam puanı mevcut rotasyonunuzunkinden yüksek değil ({b} karşısında {a})."
    return f"Its total score is not higher than your current rotation's ({a} against {b})."


def evidence_demand(lang: Language, *, windows: int) -> str:
    if lang == "tr":
        return f"Rotasyon boyunca bitki su ihtiyacının ortancası ({windows} geçmiş dönem üzerinden)"
    return f"Median crop water demand over the rotation, across {windows} historical windows"


def evidence_deficit(lang: Language, *, irrigated: bool) -> str:
    if lang == "tr":
        if irrigated:
            return "Rotasyon boyunca sulama suyu ihtiyacının ortancası"
        return "Yağışın ve topraktaki suyun karşılayamadığı su ihtiyacının ortancası"
    if irrigated:
        return "Median irrigation requirement over the rotation"
    return "Median water demand left unmet by rain and stored soil water"


def evidence_worst(lang: Language, *, crop: str, season: str, irrigated: bool) -> str:
    if lang == "tr":
        what = "sulamayla karşılanması gereken" if irrigated else "karşılanamayan"
        return f"Tek bir sezonda su ihtiyacının {what} en büyük payı ({crop}, {season})"
    what = "that had to come from irrigation" if irrigated else "left unmet"
    return f"Largest share of one season's water demand {what} ({crop}, {season})"


def evidence_awc(lang: Language) -> str:
    if lang == "tr":
        return "Toprağın bitkiye yarayışlı su tutma kapasitesi"
    return "Plant-available water capacity of the soil"


def evidence_nitrogen(lang: Language) -> str:
    if lang == "tr":
        return "Baklagillerin kendilerinden sonraki ürünlere tahmini azot katkısı"
    return "Estimated legume nitrogen credit to the crops that follow"


def benefit_less_deficit(lang: Language, *, deficit: float, current: float, irrigated: bool) -> str:
    a, b, d = num(deficit, 0, lang), num(current, 0, lang), num(current - deficit, 0, lang)
    if lang == "tr":
        what = "sulama suyu ihtiyacının" if irrigated else "karşılanamayan su ihtiyacının"
        return (
            f"Rotasyon boyunca {what} ortancası, mevcut rotasyonunuza göre {d} mm daha düşük "
            f"({b} mm yerine {a} mm)."
        )
    what = "irrigation requirement" if irrigated else "unmet water demand"
    return (
        f"Over the rotation, the median {what} is {d} mm lower than with your current rotation "
        f"({a} mm against {b} mm)."
    )


def gap_soil_dataset(lang: Language, *, awc: float) -> str:
    value = num(awc, 0, lang)
    if lang == "tr":
        return (
            f"Toprağın su tutma kapasitesi ({value} mm/m) bu tarlada yapılmış bir ölçüm değil, 250 m çözünürlüklü "
            "SoilGrids tahminidir; çiftçi girdisi olarak girilen bir toprak analizi bunun yerini alır."
        )
    return (
        f"The soil's water capacity ({value} mm/m) is a SoilGrids prediction at 250 m, not a measurement of this "
        "field; a soil test entered as farmer input replaces it."
    )


def gap_soil_default(lang: Language) -> str:
    if lang == "tr":
        return (
            "SoilGrids bu nokta için toprak verisi vermedi; bu yüzden genel bir tın toprak kullanıldı. Bir toprak "
            "analizi girilene kadar buradaki bütün su değerleri buna bağlı olarak belirsizdir."
        )
    return (
        "SoilGrids gave no soil data for this point, so a generic loam was used; every water figure here is "
        "correspondingly uncertain until a soil test is entered."
    )


def gap_no_crop_values(lang: Language) -> str:
    if lang == "tr":
        return "Ürün değeri girilmedi; bu yüzden gelir endeksi her ürünü eşit sayar, fiyat ya da verim kullanmaz."
    return "No crop values were given, so the income index counts every crop equally and uses no prices or yields."


def gap_borrowed_credit(lang: Language, *, crops: list[str]) -> str:
    names = ", ".join(crops)
    if lang == "tr":
        return (
            f"Azot katkısında {names} için, kaynaktaki en yakın sınıf olan bezelye ve kuru fasulye değeri "
            f"(UW-Extension A3517) kullanıldı; {names} için ölçülmüş bir değer kullanılmadı."
        )
    return (
        f"The nitrogen credit for {names} uses the UW-Extension A3517 value for pea and dry bean, the closest "
        f"category in that source; no value measured for {names} was used."
    )


def gap_irrigation_supply(lang: Language) -> str:
    if lang == "tr":
        return (
            "Sulama suyu ihtiyacı, bitkinin ihtiyaç duyduğu her an suyun bulunduğunu varsayar; motorun bu tarlanın "
            "su kaynağı hakkında bilgisi yoktur."
        )
    return (
        "The irrigation requirement assumes water is available whenever the crop needs it; the engine has no "
        "information on the water supply of this field."
    )


def review_stressed_crop(lang: Language, *, crop: str, year: int, unmet: float) -> str:
    share = pct(unmet, lang)
    if lang == "tr":
        return (
            f"{_cap(crop)} ({year}. yıl): ortanca geçmiş dönemde kuru tarımda su ihtiyacının {share} kadarı "
            "karşılanamadı; bu ürünün burada sulamasız yetiştirilip yetiştirilmediğini yerelde doğrulayın."
        )
    return (
        f"{_cap(crop)} (year {year}): in the median historical window {share} of its water demand was unmet under "
        "rain-fed management; check locally whether it is grown without irrigation here."
    )


def review_worst_season(lang: Language, *, crop: str, season: str, unmet: float, irrigated: bool) -> str:
    share = pct(unmet, lang)
    if lang == "tr":
        if irrigated:
            return (
                f"{season} tarım yılında {crop} ürününün su ihtiyacının {share} kadarının sulamayla karşılanması "
                "gerekti; kurak bir yılda bu kadar suyun bulunup bulunmadığını doğrulayın."
            )
        return (
            f"{season} tarım yılında {crop} ürününün su ihtiyacının {share} kadarı karşılanamadı; işletmenin "
            "böyle bir sezonu kaldırıp kaldıramayacağını değerlendirin."
        )
    if irrigated:
        return (
            f"In {season}, {crop} needed {share} of its water demand from irrigation; check that such a volume is "
            "available in a dry year."
        )
    return (
        f"In {season}, {crop} had {share} of its water demand unmet; consider whether the farm could carry a "
        "season like that."
    )


def review_sowing_dates(lang: Language, *, sowing: list[tuple[str, int, int]]) -> str:
    dates = ", ".join(f"{crop} {day} {MONTHS[lang][month - 1]}" for crop, day, month in sowing)
    if lang == "tr":
        return (
            f"Takvim şu ekim tarihlerini varsayar: {dates} (FAO-56 Tablo 11); bunları yerel ekim tarihleri ve "
            "çeşitlerle karşılaştırın."
        )
    return (
        f"The calendar assumes sowing on these dates: {dates} (FAO-56 Table 11); compare them with local sowing "
        "dates and varieties."
    )


# Validation caveats (GET /v1/validation)


def verdict(ci_diff: tuple[float, float], lang: Language = "en") -> str:
    lo, hi = ci_diff
    if lang == "tr":
        if hi < 0:
            return (
                "Modelin korelasyonu karşılaştırma ölçütününkinden daha negatif ve fark ortaya konmuş durumda: "
                "farkın aralığı 0'ın altında."
            )
        if lo > 0:
            return (
                "Karşılaştırma ölçütünün korelasyonu modelinkinden daha negatif ve fark ortaya konmuş durumda: "
                "farkın aralığı 0'ın üstünde."
            )
        return "Model ile karşılaştırma ölçütü arasında bir fark ortaya konmuş değil: farkın aralığı 0'ı içeriyor."
    if hi < 0:
        return (
            "The model's correlation is more negative than the baseline's, and the difference is established: "
            "its interval lies below 0."
        )
    if lo > 0:
        return (
            "The baseline's correlation is more negative than the model's, and the difference is established: "
            "its interval lies above 0."
        )
    return "A difference between the model and the baseline is not established: the interval of the difference includes 0."


def correlations(
    lang: Language,
    *,
    r_model: float,
    ci_model: tuple[float, float],
    r_base: float,
    ci_base: tuple[float, float],
    ci_diff: tuple[float, float],
) -> str:
    r_m, r_b = num(r_model, 2, lang, sign=True), num(r_base, 2, lang, sign=True)
    diff = num(r_model - r_base, 2, lang, sign=True)
    if lang == "tr":
        return (
            f"Model (kışlık buğday su dengesi): r = {r_m}, %95 aralığı {interval(ci_model, lang)}. "
            f"Karşılaştırma ölçütü (Nisan–Eylül 1 − P/ET0): r = {r_b}, %95 aralığı {interval(ci_base, lang)}. "
            f"Fark (model − ölçüt): {diff}, %95 aralığı {interval(ci_diff, lang)}. {verdict(ci_diff, lang)}"
        )
    return (
        f"Model (winter-wheat water balance): r = {r_m}, 95 % interval {interval(ci_model, lang)}. "
        f"Baseline (April–September 1 − P/ET0): r = {r_b}, 95 % interval {interval(ci_base, lang)}. "
        f"Difference model − baseline: {diff}, 95 % interval {interval(ci_diff, lang)}. {verdict(ci_diff, lang)}"
    )


VALIDATION_FIXED: dict[Language, list[str]] = {
    "en": [
        "The land use of the pixel is not known. The model assumes rain-fed winter wheat; if the pixel holds an "
        "irrigated or summer crop, orchard, pasture or a mix, its greenness follows other drivers.",
        "Irrigation is not represented: irrigated fields can stay green in dry years, which weakens the relationship.",
        "NDVI is a single 250 m pixel; it may mix several fields and land uses.",
    ],
    "tr": [
        "Pikselin arazi kullanımı bilinmiyor. Model kuru tarımda yetiştirilen kışlık buğday varsayıyor; pikselde sulanan ya da "
        "yazlık bir ürün, meyve bahçesi, mera veya bunların karışımı varsa yeşilliği başka etkenlere bağlıdır.",
        "Sulama modelde yer almıyor: sulanan tarlalar kurak yıllarda da yeşil kalabilir ve bu, ilişkiyi zayıflatır.",
        "NDVI tek bir 250 m pikseldir; birkaç tarlayı ve arazi kullanımını bir arada içerebilir.",
    ],
}


def small_sample(lang: Language, n: int) -> str:
    if lang == "tr":
        return f"{n} yıl küçük bir örneklem; korelasyon belirsizdir ve nedensellik değil, ilişki gösterir."
    return f"{n} years is a small sample; the correlation is uncertain and shows association, not causation."


def skipped_years(lang: Language, years: list[int]) -> str:
    listed = ", ".join(map(str, years))
    if lang == "tr":
        return f"Bulutsuz NDVI kompoziti az olduğu için dışarıda bırakılan yıllar: {listed}."
    return f"Years left out for too few cloud-free NDVI composites: {listed}."


# Crop calendar caveats (POST /v1/field/calendar)


def calendar_caveats(lang: Language, *, first: int, last: int) -> list[str]:
    if lang == "tr":
        return [
            f"Paylar {first}–{last} NASA POWER kaydından hesaplandı; bunlar geçmiş yılların sıklıklarıdır, tahmin "
            "değildir.",
            "Su açığı yalnızca iklime dayalıdır (yağış ile tablo Kc × ET0 karşılaştırması); topraktaki su dikkate "
            "alınmaz, bu yüzden derin topraklarda gerçek stres daha düşük olabilir.",
            "Ekim tarihleri FAO-56 Tablo 11'den alındı; yerel ekim tarihleri farklıysa aylar kayar.",
            "Sıcak gün eşiği kaydın kendi aylık 90. yüzdelik değeridir; ürüne özgü bir sıcaklık stresi eşiği "
            "değildir.",
        ]
    return [
        f"Shares are computed from the {first}–{last} NASA POWER record; they are past frequencies, not a forecast.",
        "The water deficit is climatic only (precipitation against table Kc × ET0); soil water is not counted, so "
        "on deep soils the actual stress can be lower.",
        "Sowing dates are FAO-56 Table 11 dates; if local sowing differs, the months shift.",
        "The warm-day threshold is the record's own monthly 90th percentile, not a crop-specific heat-stress "
        "threshold.",
    ]


def scenario_label(lang: Language, *, factor: float, delta: float) -> str:
    share = pct(factor, lang)
    change = num(delta, 1, lang, sign=True)
    if lang == "tr":
        return (
            f"Duyarlılık testi: geçmiş yılların yağışı {share} ölçeğinde alındı ve sıcaklıklara {change} °C "
            "eklendi. Sonuçlar bu değişiklikle geçmiş yılların nasıl puanlanacağını gösterir; gelecek iklim için "
            "bir tahmin değildir."
        )
    return (
        f"Sensitivity test: past years' precipitation scaled to {share} and {change} °C added to temperatures. "
        "The results show how those past years would have scored with that change; they are not a forecast of "
        "future climate."
    )
