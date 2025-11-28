import { LatLng } from './map';

export interface RoutePoint extends LatLng {
  elevation?: number;
  coefficient?: number;
}

export interface ElevationProfile {
  distance: number; // meters from start
  elevation: number; // meters above sea level
}

export interface ElevationData {
  gain: number; // total elevation gain in meters
  loss: number; // total elevation loss in meters
  max: number; // maximum elevation
  min: number; // minimum elevation
  profile: ElevationProfile[];
}

export interface ZoneStatistics {
  [key: string]: {
    distance: number; // meters
    percentage: number; // 0-100
  };
}

export interface TrailQuality {
  avgVisibility: string;
  avgSmoothness: string;
  officialPercent: number;
  avgWidth: number | null;
}

export interface Route {
  id?: string;
  name: string;
  start: LatLng;
  end: LatLng;
  waypoints?: LatLng[];
  path: RoutePoint[];
  distance: number; // total distance in meters
  duration: number; // estimated duration in seconds
  elevation?: ElevationData;
  zoneStats?: ZoneStatistics;
  trailQuality?: TrailQuality;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface PathfindingOptions {
  maxSlope?: number; // maximum allowed slope in degrees
  coefficients?: Record<string, number>; // custom terrain type coefficients
  avoidTypes?: string[]; // terrain types to avoid
  preferOfficial?: boolean; // prefer official trails
  minVisibility?: string; // minimum trail visibility
}
