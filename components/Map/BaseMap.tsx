'use client';

import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, LayersControl } from 'react-leaflet';
import type { LatLng } from '@/types/map';
import 'leaflet/dist/leaflet.css';

interface BaseMapProps {
  center: LatLng;
  zoom: number;
  children?: React.ReactNode;
}

export default function BaseMap({ center, zoom, children }: BaseMapProps) {
  const [mapKey] = useState(() => `map-${Date.now()}-${Math.random()}`);
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  const containerRef = useRef<HTMLDivElement>(null);

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
      >
        <LayersControl position="topleft">
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
