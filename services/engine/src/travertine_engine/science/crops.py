"""Crop table loader. The table itself lives in `data/crops.yaml` with a citation for every value."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal

import yaml
from pydantic import BaseModel, ConfigDict, Field, model_validator

CROPS_PATH = Path(__file__).resolve().parents[3] / "data" / "crops.yaml"


class Stages(BaseModel):
    model_config = ConfigDict(frozen=True)
    ini: int = Field(ge=1)
    dev: int = Field(ge=1)
    mid: int = Field(ge=1)
    late: int = Field(ge=0)

    @property
    def total(self) -> int:
        return self.ini + self.dev + self.mid + self.late


class Kc(BaseModel):
    model_config = ConfigDict(frozen=True)
    ini: float = Field(ge=0)
    mid: float = Field(ge=0)
    end: float = Field(ge=0)


class CropSources(BaseModel):
    model_config = ConfigDict(frozen=True)
    stages: str
    kc: str
    root_depth: str
    p: str
    ky: str
    n_credit: str | None = None


class NCredit(BaseModel):
    model_config = ConfigDict(frozen=True)
    first_year_kg_ha: float = Field(ge=0)
    second_year_kg_ha: float = Field(ge=0)


class CropParams(BaseModel):
    model_config = ConfigDict(frozen=True)

    id: str = Field(pattern=r"^[a-z0-9_]+$")
    name: str
    family: str
    is_legume: bool
    season: Literal["winter", "summer", "perennial"]
    sowing_month: int = Field(ge=1, le=12)
    sowing_day: int = Field(ge=1, le=28)
    stages: Stages
    kc: Kc
    kc_mid_range: tuple[float, float] | None = None
    kc_end_range: tuple[float, float] | None = None
    height_m: float = Field(gt=0)
    root_depth_m: float = Field(gt=0)
    root_depth_range_m: tuple[float, float]
    p: float = Field(gt=0, lt=1)
    ky: float | None = Field(default=None, gt=0)
    n_credit: NCredit | None = None
    sources: CropSources

    @model_validator(mode="after")
    def _ranges_contain_values(self) -> CropParams:
        lo, hi = self.root_depth_range_m
        if not lo <= self.root_depth_m <= hi:
            raise ValueError(f"{self.id}: root_depth_m outside its published range")
        if (self.n_credit is not None) != (self.sources.n_credit is not None):
            raise ValueError(f"{self.id}: n_credit and its source must be given together")
        if self.n_credit is not None and not self.is_legume:
            raise ValueError(f"{self.id}: only legumes carry an n_credit")
        for rng, value in ((self.kc_mid_range, self.kc.mid), (self.kc_end_range, self.kc.end)):
            if rng is not None and not rng[0] <= value <= rng[1]:
                raise ValueError(f"{self.id}: Kc outside its published range")
        return self

    @property
    def growing_days(self) -> int:
        return self.stages.total

    def citation(self) -> str:
        s = self.sources
        return (
            f"Stage lengths: {s.stages}. Kc: {s.kc}. Rooting depth: {s.root_depth}. "
            f"Depletion fraction p: {s.p}. Yield response Ky: {s.ky}."
        )


class _CropFile(BaseModel):
    crops: list[CropParams]


@lru_cache(maxsize=1)
def load_crops(path: Path = CROPS_PATH) -> tuple[CropParams, ...]:
    with path.open(encoding="utf-8") as fh:
        parsed = _CropFile.model_validate(yaml.safe_load(fh))
    ids = [c.id for c in parsed.crops]
    if len(ids) != len(set(ids)):
        raise ValueError("duplicate crop id in crops.yaml")
    return tuple(parsed.crops)


def crops_by_id() -> dict[str, CropParams]:
    return {c.id: c for c in load_crops()}
