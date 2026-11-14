import type { components, paths } from "@travertine/contract/schema";

export type { paths };
type S = components["schemas"];
export type Crop = S["Crop"];
export type FieldAnalyzeRequest = S["FieldAnalyzeRequest"];
export type FieldAnalysis = S["FieldAnalysis"];
export type ClimateYear = S["ClimateYear"];
export type Soil = S["Soil"];
export type NdviYear = S["NdviYear"];
export type Provenance = S["Provenance"];
export type PolygonGeometry = S["PolygonGeometry"];
export type Priorities = S["Priorities"];
export type RotationExploreRequest = S["RotationExploreRequest"];
export type RotationExploreResponse = S["RotationExploreResponse"];
export type Rotation = S["Rotation"];
export type Validation = S["Validation"];
export type Health = S["Health"];
export type ApiError = S["Error"];
