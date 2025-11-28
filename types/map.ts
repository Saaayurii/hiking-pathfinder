export interface LatLng {
  lat: number;
  lng: number;
}

export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export type MarkerType = 'start' | 'end' | 'waypoint';

export interface MapMarker {
  id: string;
  type: MarkerType;
  position: LatLng;
}

export type MapStyle = 'base' | 'topographic' | 'hiking' | 'surface' | 'visibility' | 'smoothness' | 'zones';

export interface MapSettings {
  style: MapStyle;
  showZones: boolean;
  showPOI: boolean;
  showContours: boolean;
}
