'use client';

import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, LayersControl, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { LatLng } from '@/types/map';
import { useTheme } from '@/contexts/ThemeContext';
import 'leaflet/dist/leaflet.css';

// Set Russian locale for Leaflet controls
L.Control.Zoom.prototype.options.zoomInTitle = 'Приблизить';
L.Control.Zoom.prototype.options.zoomOutTitle = 'Отдалить';

interface BaseMapProps {
  center: LatLng;
  zoom: number;
  children?: React.ReactNode;
}

// Component to handle theme-based tile layer switching
function ThemeAwareTileLayer() {
  const { theme } = useTheme();
  const map = useMap();
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

  // URLs for light and dark themes
  const lightUrl = process.env.NEXT_PUBLIC_OSM_TILE_URL || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  const darkUrl = mapboxToken
    ? `https://api.mapbox.com/styles/v1/mapbox/dark-v11/tiles/{z}/{x}/{y}?access_token=${mapboxToken}`
    : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

  useEffect(() => {
    // Apply CSS filter to the map container for dark mode when no dark tiles available
    const container = map.getContainer();
    if (theme === 'dark' && !mapboxToken) {
      container.style.filter = 'invert(1) hue-rotate(180deg)';
    } else {
      container.style.filter = 'none';
    }
  }, [theme, map, mapboxToken]);

  return null;
}

export default function BaseMap({ center, zoom, children }: BaseMapProps) {
  const [mapKey] = useState(() => `map-${Date.now()}-${Math.random()}`);
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  const containerRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();

  useEffect(() => {
    // Cleanup function to remove map container when component unmounts
    return () => {
      if (containerRef.current) {
        const leafletContainer = containerRef.current.querySelector('.leaflet-container');
        if (leafletContainer && (leafletContainer as any)._leaflet_id) {
          // Remove the Leaflet map instance
          delete (leafletContainer as any)._leaflet_id;
        }
      }
    };
  }, []);

  return (
    <div ref={containerRef} className="w-full h-full">
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={zoom}
        scrollWheelZoom={true}
        className="w-full h-full"
        style={{ height: '100%', width: '100%' }}
        key={mapKey}
        attributionControl={false}
        zoomControl={true}
      >
        <ThemeAwareTileLayer />
        <LayersControl position="topleft">
          {/* Light theme layers */}
          {theme === 'light' && (
            <>
              {/* OpenStreetMap */}
              <LayersControl.BaseLayer checked name="Стандартная карта">
                <TileLayer
                  attribution=''
                  url={process.env.NEXT_PUBLIC_OSM_TILE_URL || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'}
                />
              </LayersControl.BaseLayer>

              {/* Mapbox Streets */}
              {mapboxToken && (
                <LayersControl.BaseLayer name="Улицы и дороги">
                  <TileLayer
                    attribution=''
                    url={`https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/{z}/{x}/{y}?access_token=${mapboxToken}`}
                    tileSize={512}
                    zoomOffset={-1}
                  />
                </LayersControl.BaseLayer>
              )}

              {/* Mapbox Outdoors */}
              {mapboxToken && (
                <LayersControl.BaseLayer name="Походная карта">
                  <TileLayer
                    attribution=''
                    url={`https://api.mapbox.com/styles/v1/mapbox/outdoors-v12/tiles/{z}/{x}/{y}?access_token=${mapboxToken}`}
                    tileSize={512}
                    zoomOffset={-1}
                  />
                </LayersControl.BaseLayer>
              )}
            </>
          )}

          {/* Dark theme layers */}
          {theme === 'dark' && (
            <>
              {/* CartoDB Dark */}
              <LayersControl.BaseLayer checked name="Тёмная карта">
                <TileLayer
                  attribution=''
                  url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                />
              </LayersControl.BaseLayer>

              {/* Mapbox Dark */}
              {mapboxToken && (
                <LayersControl.BaseLayer name="Mapbox Dark">
                  <TileLayer
                    attribution=''
                    url={`https://api.mapbox.com/styles/v1/mapbox/dark-v11/tiles/{z}/{x}/{y}?access_token=${mapboxToken}`}
                    tileSize={512}
                    zoomOffset={-1}
                  />
                </LayersControl.BaseLayer>
              )}

              {/* Mapbox Navigation Night */}
              {mapboxToken && (
                <LayersControl.BaseLayer name="Ночная навигация">
                  <TileLayer
                    attribution=''
                    url={`https://api.mapbox.com/styles/v1/mapbox/navigation-night-v1/tiles/{z}/{x}/{y}?access_token=${mapboxToken}`}
                    tileSize={512}
                    zoomOffset={-1}
                  />
                </LayersControl.BaseLayer>
              )}
            </>
          )}

          {/* Common layers for both themes */}
          {/* Mapbox Satellite */}
          {mapboxToken && (
            <LayersControl.BaseLayer name="Спутник">
              <TileLayer
                attribution=''
                url={`https://api.mapbox.com/styles/v1/mapbox/satellite-v9/tiles/{z}/{x}/{y}?access_token=${mapboxToken}`}
                tileSize={512}
                zoomOffset={-1}
              />
            </LayersControl.BaseLayer>
          )}

          {/* Mapbox Satellite Streets */}
          {mapboxToken && (
            <LayersControl.BaseLayer name="Спутник с дорогами">
              <TileLayer
                attribution=''
                url={`https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/tiles/{z}/{x}/{y}?access_token=${mapboxToken}`}
                tileSize={512}
                zoomOffset={-1}
              />
            </LayersControl.BaseLayer>
          )}

          {/* Mapbox Terrain */}
          {mapboxToken && (
            <LayersControl.BaseLayer name="Рельеф местности">
              <TileLayer
                attribution=''
                url={`https://api.mapbox.com/v4/mapbox.terrain-rgb/{z}/{x}/{y}.png?access_token=${mapboxToken}`}
                tileSize={256}
              />
            </LayersControl.BaseLayer>
          )}
        </LayersControl>
        {children}
      </MapContainer>
    </div>
  );
}
