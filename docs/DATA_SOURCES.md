# Data sources

Every dataset the engine reads, with its resolution, what we use it for and its terms. Datasets marked *planned* are not
read by the engine yet.

| Dataset | Provider | Spatial resolution | Period used | Used for | Access | Terms |
|---|---|---|---|---|---|---|
| NASA POWER daily point data, Agroclimatology (MERRA-2 meteorology, CERES SYN1deg radiation) | NASA Langley Research Center, POWER Project | 0.5° × 0.625° (meteorology), 1° × 1° (solar) | 2001 – last full year, daily | Temperature, dew point, wind, pressure, radiation, precipitation, soil wetness; ET0 | [API docs](https://power.larc.nasa.gov/docs/services/api/temporal/daily/) | Free, no registration. POWER asks users to acknowledge the POWER Project and cite the data source. |
| SoilGrids 2.0 | ISRIC — World Soil Information | 250 m | Static | Texture, organic carbon, pH, available water capacity | [REST API docs](https://rest.isric.org/soilgrids/v2.0/docs) | CC BY 4.0. Fair-use limit of about 5 requests per minute; the engine caches every response. |
| FAO Irrigation and Drainage Paper 56 | FAO | Not spatial | Published 1998 | ET0 equations; Kc, stage lengths, rooting depth, p, Ky (Tables 11, 12, 22, 24) | [Online edition](https://www.fao.org/4/x0490e/x0490e00.htm) | © FAO; values are cited, not redistributed as a dataset. |
| MODIS/Terra Vegetation Indices 16-Day L3 Global 250 m (MOD13Q1 v061), NDVI and pixel reliability | NASA LP DAAC, served by the ORNL DAAC MODIS web service | 250 m (single pixel at the field centre) | 2001 – last full year, ten 16-day composites from early April to late September | `ndvi_history` in field analysis; observed series of the back-test | [Web service](https://modis.ornl.gov/data/modis_webservice.html) | NASA open data policy, no registration. Cite Didan (2021), doi:10.5067/MODIS/MOD13Q1.061, and the ORNL DAAC TESViS Global Subsets Tool, doi:10.3334/ORNLDAAC/1379. |
| Harmonized Landsat Sentinel-2 (HLS) — *planned* | NASA LP DAAC, via Microsoft Planetary Computer STAC | 30 m | 2013 / 2015 – present | Field-scale NDVI history | — | NASA open data policy. |
| GPM IMERG — *planned* | NASA GES DISC | 0.1° | 2001 – present | Independent precipitation cross-check | — | Free NASA Earthdata login required. |

## Resolution and what it means for a field

A field is a small part of a POWER grid cell, which covers roughly 3,000 km² (about 55 × 55 km at the
demo latitude). SoilGrids values are modelled for a 250 m pixel, not sampled in the field, and carry wide prediction
intervals. The engine therefore reports regional climate and modelled soil for the field's location and never presents them as field measurements. Each response's
`provenance[]` repeats the resolution and the caveats.

## Caching

Responses are cached under `services/engine/data/cache/` (git-ignored), each with its fetch time and URL. The one
exception to "no raw downloads in the repo" is `services/engine/data/snapshot/`: the demo field's responses (about
450 KB gzipped) with a manifest of fetch times, URLs and checksums, so the demo works when an upstream is down.
Responses served from it say so in their provenance note.
