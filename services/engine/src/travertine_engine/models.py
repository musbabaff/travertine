"""Pydantic models mirroring `packages/contract/openapi.yaml`. Field names, types and units follow the contract;
contract tests in `tests/test_contract.py` validate responses against the YAML itself."""

from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field

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


class FieldAnalysis(_Model):
    field_id: str
    climate: list[ClimateYear]
    soil: Soil
    ndvi_history: list[NdviYear] | None = None
    provenance: list[Provenance]


class ErrorBody(_Model):
    code: str
    message: str
    details: dict[str, object] | None = None
