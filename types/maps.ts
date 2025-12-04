/**
 * Типы для различных картографических провайдеров
 */

export type MapProvider = 'leaflet' | 'yandex' | 'tomtom';

export interface MapProviderConfig {
  id: MapProvider;
  name: string;
  description: string;
  apiKey?: string;
  available: boolean;
}

export interface YandexMapOptions {
  center: [number, number];
  zoom: number;
  controls: string[];
}

export interface TomTomMapOptions {
  center: { lat: number; lng: number };
  zoom: number;
  style?: string;
}
