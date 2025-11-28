import { LatLng } from './map';
import { Route, PathfindingOptions } from './route';

// Pathfinding API
export interface PathfindingRequest {
  start: LatLng;
  end: LatLng;
  waypoints?: LatLng[];
  options?: PathfindingOptions;
}

export interface PathfindingResponse {
  success: boolean;
  route?: Route;
  error?: string;
}

// Elevation API
export interface ElevationRequest {
  points: LatLng[];
}

export interface ElevationResponse {
  success: boolean;
  elevations?: number[];
  error?: string;
}

// OSM API
export interface OSMRequest {
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
}

export interface OSMResponse {
  success: boolean;
  data?: any; // OSM GeoJSON data
  error?: string;
}

// Routes CRUD API
export interface SaveRouteRequest {
  name: string;
  route: Route;
}

export interface SaveRouteResponse {
  success: boolean;
  id?: string;
  error?: string;
}

export interface GetRouteResponse {
  success: boolean;
  route?: Route;
  error?: string;
}

export interface ListRoutesResponse {
  success: boolean;
  routes?: Array<{
    id: string;
    name: string;
    distance: number;
    duration: number;
    createdAt: Date;
  }>;
  error?: string;
}
