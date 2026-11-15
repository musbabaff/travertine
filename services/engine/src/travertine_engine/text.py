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
    "maize": "mısır (dane)",
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
        return (
            head + f"yağışa dayalı tarımda yağış ve topraktaki su bunun {u} mm'sini ({share}) karşılayamadı."
        )
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


def income_note(lang: Language) -> str:
    if lang == "tr":
        return (
            "Gelir endeksi yalnızca her ürünün su ihtiyacının ne kadarının karşılandığını yansıtır; fiyat "
            "kullanmaz, bu yüzden onu kâr tahmini olarak değil, suyla sınırlı bir üretim endeksi olarak okuyun."
        )
    return (
        "The income index only reflects how much of each crop's water demand was met; it uses no prices, so treat "
        "it as a water-limited production index, not a profit estimate."
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
        "Pikselin arazi kullanımı bilinmiyor. Model yağışa dayalı kışlık buğday varsayıyor; pikselde sulanan ya da "
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
