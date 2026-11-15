"""Pydantic models mirroring `packages/contract/openapi.yaml`. Field names, types and units follow the contract;
contract tests in `tests/test_contract.py` validate responses against the YAML itself."""

from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field

from travertine_engine.text import Language

Latitude = Annotated[float, Field(ge=-90, le=90)]
Longitude = Annotated[float, Field(ge=-180, le=180)]
Unit01 = Annotated[float, Field(ge=0, le=1)]


class _Model(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Health(_Model):
    status: Literal["ok", "degraded"]
    version: str


class Provenance(_Model):
    dataset: str
    provider: str
    spatial_resolution: str
    temporal_coverage: str
    access_url: str
    note: str


class Crop(_Model):
    id: str
    name: str
    family: str
    is_legume: bool
    season: Literal["winter", "summer", "perennial"]
    growing_days: int = Field(ge=1)
    kc_ini: float = Field(ge=0)
    kc_mid: float = Field(ge=0)
    kc_end: float = Field(ge=0)
    root_depth_m: float = Field(ge=0)
    source: str


class PolygonGeometry(_Model):
    type: Literal["Polygon"]
    coordinates: list[
        Annotated[list[Annotated[list[float], Field(min_length=2, max_length=3)]], Field(min_length=4)]
    ] = Field(min_length=1)


class FieldAnalyzeRequest(_Model):
    lat: Latitude
    lon: Longitude
    geometry: PolygonGeometry | None = None
    irrigated: bool


class ClimateYear(_Model):
    year: int
    precipitation_mm: float = Field(ge=0)
    et0_mm: float = Field(ge=0)
    mean_temp_c: float
    root_zone_wetness: Unit01


class Soil(_Model):
    texture: str
    organic_carbon: float = Field(ge=0)
    ph: float = Field(ge=0, le=14)
    awc_mm: float = Field(ge=0)


class NdviYear(_Model):
    year: int
    mean_ndvi: float = Field(ge=-1, le=1)


class FieldClimate(_Model):
    field_id: str
    climate: list[ClimateYear]
    provenance: list[Provenance]


class FieldSoil(_Model):
    soil: Soil
    provenance: list[Provenance]


class FieldVegetation(_Model):
    ndvi_history: list[NdviYear]
    provenance: list[Provenance]


class FieldAnalysis(_Model):
    field_id: str
    climate: list[ClimateYear]
    soil: Soil
    ndvi_history: list[NdviYear] | None = None
    provenance: list[Provenance]


class Priorities(_Model):
    water: Unit01
    income: Unit01
    soil: Unit01
    risk: Unit01


class FarmerSoil(_Model):
    sand_pct: float | None = Field(default=None, ge=0, le=100)
    clay_pct: float | None = Field(default=None, ge=0, le=100)
    organic_carbon_pct: float | None = Field(default=None, ge=0, le=20)
    available_water_mm_per_m: float | None = Field(default=None, ge=20, le=400)


class FarmerInputs(_Model):
    soil: FarmerSoil | None = None
    crop_values: dict[str, Annotated[float, Field(ge=0)]] | None = None


class InputSource(_Model):
    name: str
    value: float | str
    unit: str
    source: Literal["farmer", "dataset", "default"]
    replaces: str


class RotationExploreRequest(_Model):
    field_id: str | None = None
    lat: Latitude | None = None
    lon: Longitude | None = None
    horizon_years: Literal[3, 4, 5]
    priorities: Priorities
    irrigated: bool
    crop_ids: list[str] | None = None
    language: Language = "en"
    farmer_inputs: FarmerInputs | None = None


class RotationScores(_Model):
    water: Unit01
    income: Unit01
    soil: Unit01
    risk: Unit01
    total: Unit01


class RotationYear(_Model):
    year_index: int = Field(ge=1)
    crop_id: str
    water_demand_mm: float = Field(ge=0)
    water_deficit_mm: float = Field(ge=0)
    stress_index: Unit01


class Rotation(_Model):
    sequence: list[str]
    scores: RotationScores
    yearly: list[RotationYear]
    explanation: list[str]


class RotationExploreResponse(_Model):
    rotations: list[Rotation]
    inputs: list[InputSource]
    provenance: list[Provenance]


class NdviObservation(_Model):
    date: str
    ndvi: float = Field(ge=-1, le=1)
    sensor: Literal["L30", "S30"]


class NdviSeason(_Model):
    year: int
    mean_ndvi: float | None = Field(default=None, ge=-1, le=1)
    n_clear: int = Field(ge=0)
    n_scenes: int = Field(ge=0)


class FieldNdvi(_Model):
    observations: list[NdviObservation]
    seasons: list[NdviSeason]
    caveats: list[str]
    provenance: list[Provenance]


class ValidationYear(_Model):
    year: int
    modelled_stress: Unit01
    observed_ndvi_anomaly: float


class BaselineValue(_Model):
    year: int
    value: float


class ValidationBaseline(_Model):
    name: str
    correlation: float = Field(ge=-1, le=1)
    correlation_ci95: tuple[float, float]
    values: list[BaselineValue]


class Validation(_Model):
    years: list[ValidationYear]
    correlation: float = Field(ge=-1, le=1)
    n: int = Field(ge=0)
    correlation_ci95: tuple[float, float] | None = None
    baseline: ValidationBaseline | None = None
    difference_ci95: tuple[float, float] | None = None
    verdict: Literal["model_better", "baseline_better", "no_detectable_difference"] | None = None
    method: str
    caveats: list[str]
    provenance: list[Provenance]


class ShowcaseValidation(_Model):
    status: Literal["ok", "not_computed"]
    reason: str | None = None
    n: int | None = Field(default=None, ge=0)
    correlation: float | None = Field(default=None, ge=-1, le=1)
    correlation_ci95: tuple[float, float] | None = None
    baseline_correlation: float | None = Field(default=None, ge=-1, le=1)
    baseline_correlation_ci95: tuple[float, float] | None = None
    difference: float | None = None
    difference_ci95: tuple[float, float] | None = None
    verdict: Literal["model_better", "baseline_better", "no_detectable_difference"] | None = None


class ShowcaseField(_Model):
    id: str
    name: str
    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)
    field_id: str
    validation: ShowcaseValidation


class ShowcasePooled(_Model):
    sites: int = Field(ge=0)
    mean_correlation: float
    mean_correlation_ci95: tuple[float, float]
    mean_baseline_correlation: float
    mean_baseline_correlation_ci95: tuple[float, float]
    mean_difference: float
    mean_difference_ci95: tuple[float, float]
    verdict: Literal["model_better", "baseline_better", "no_detectable_difference"]


class Showcase(_Model):
    fields: list[ShowcaseField]
    pooled: ShowcasePooled | None = None
    protocol: str
    computed_at: str


class ErrorBody(_Model):
    code: str
    message: str
    details: dict[str, object] | None = None
