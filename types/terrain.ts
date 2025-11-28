export type TerrainType =
  | 'paved'
  | 'asphalt'
  | 'gravel'
  | 'ground'
  | 'grass'
  | 'sand'
  | 'rock'
  | 'mud'
  | 'wetland'
  | 'water'
  | 'forest'
  | 'path';

export type TrailVisibility =
  | 'excellent'
  | 'good'
  | 'intermediate'
  | 'bad'
  | 'horrible'
  | 'no';

export type Smoothness =
  | 'excellent'
  | 'good'
  | 'intermediate'
  | 'bad'
  | 'very_bad'
  | 'horrible';

export interface TerrainCoefficients {
  [key: string]: number; // terrain type -> coefficient (1.0 - 10.0)
}

export const DEFAULT_COEFFICIENTS: TerrainCoefficients = {
  'paved': 1.0,
  'asphalt': 1.2,
  'gravel': 2.0,
  'ground': 2.5,
  'grass': 3.0,
  'sand': 5.0,
  'rock': 4.5,
  'mud': 6.0,
  'wetland': 7.5,
  'water': 10.0,
  'forest': 4.0,
  'path': 2.0,
};

export interface TerrainZone {
  id: string;
  bounds: GeoJSON.Polygon;
  terrainType: TerrainType;
  coefficient: number;
  avgElevation?: number;
  avgSlope?: number;
  visibility?: TrailVisibility;
  smoothness?: Smoothness;
  width?: number;
  informal: boolean;
  surface?: string;
}
