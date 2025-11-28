'use client';

import { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import type { LatLng, MapMarker } from '@/types/map';
import type { Route } from '@/types/route';
import RouteStats from '../Stats/RouteStats';
import ElevationProfile from '../Stats/ElevationProfile';

// Dynamic import for SSR compatibility
const BaseMap = dynamic(() => import('./BaseMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-gray-100">
      <div className="text-gray-600">Загрузка карты...</div>
    </div>
  ),
});

const MarkerControls = dynamic(() => import('./MarkerControls'), {
  ssr: false,
});

const RouteLayer = dynamic(() => import('./RouteLayer'), {
  ssr: false,
});

interface MapContainerProps {
  onRouteCalculated?: (route: Route) => void;
}

export default function MapContainer({ onRouteCalculated }: MapContainerProps) {
  const [markers, setMarkers] = useState<MapMarker[]>([]);
  const [route, setRoute] = useState<Route | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  const handleMarkerAdd = useCallback((position: LatLng, type: 'start' | 'end') => {
    const newMarker: MapMarker = {
      id: `${type}-${Date.now()}`,
      type,
      position,
    };
    setMarkers(prev => [...prev, newMarker]);

    // Auto-calculate route when both markers are set
    const hasStart = markers.some(m => m.type === 'start') || type === 'start';
    const hasEnd = markers.some(m => m.type === 'end') || type === 'end';

    if (hasStart && hasEnd && !isCalculating) {
      setTimeout(() => calculateRoute([...markers, newMarker]), 100);
    }
  }, [markers, isCalculating]);

  const handleMarkerMove = useCallback((id: string, position: LatLng) => {
    setMarkers(prev =>
      prev.map(marker =>
        marker.id === id ? { ...marker, position } : marker
      )
    );

    // Recalculate route on marker move
    if (!isCalculating) {
      setTimeout(() => {
        const updatedMarkers = markers.map(marker =>
          marker.id === id ? { ...marker, position } : marker
        );
        calculateRoute(updatedMarkers);
      }, 100);
    }
  }, [markers, isCalculating]);

  const calculateRoute = async (currentMarkers: MapMarker[]) => {
    const start = currentMarkers.find(m => m.type === 'start');
    const end = currentMarkers.find(m => m.type === 'end');

    if (!start || !end) return;

    setIsCalculating(true);

    try {
      const response = await fetch('/api/pathfinding', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          start: start.position,
          end: end.position,
        }),
      });

      const data = await response.json();

      if (data.success && data.route) {
        setRoute(data.route);
        onRouteCalculated?.(data.route);
      }
    } catch (error) {
      console.error('Error calculating route:', error);
    } finally {
      setIsCalculating(false);
    }
  };

  const handleClearRoute = () => {
    setMarkers([]);
    setRoute(null);
  };

  return (
    <div className="relative w-full h-full flex">
      {/* Map container */}
      <div className="flex-1 relative">
        <BaseMap center={{ lat: 55.7558, lng: 37.6173 }} zoom={10}>
          <MarkerControls
            markers={markers}
            onMarkerAdd={handleMarkerAdd}
            onMarkerMove={handleMarkerMove}
          />
          <RouteLayer route={route?.path || []} />
        </BaseMap>

        {/* Controls overlay */}
        <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
          {markers.length > 0 && (
            <button
              onClick={handleClearRoute}
              className="bg-white px-4 py-2 rounded-lg shadow-lg hover:bg-gray-50 transition-colors font-medium text-sm"
            >
              Очистить маршрут
            </button>
          )}
          {isCalculating && (
            <div className="bg-white px-4 py-2 rounded-lg shadow-lg text-sm text-gray-600">
              Расчёт маршрута...
            </div>
          )}
        </div>

        {/* Instructions */}
        {markers.length === 0 && (
          <div className="absolute bottom-4 left-4 z-[1000] bg-white px-6 py-4 rounded-lg shadow-lg max-w-md">
            <h3 className="font-bold text-lg mb-2">Начните работу</h3>
            <ol className="list-decimal list-inside space-y-1 text-sm text-gray-700">
              <li>Кликните по карте, чтобы установить <span className="text-green-600 font-medium">начальную точку</span></li>
              <li>Кликните ещё раз, чтобы установить <span className="text-red-600 font-medium">конечную точку</span></li>
              <li>Маршрут будет построен автоматически с учётом рельефа</li>
              <li>Перетаскивайте маркеры для изменения маршрута</li>
            </ol>
          </div>
        )}
      </div>

      {/* Statistics sidebar */}
      {route && (
        <div className="w-96 bg-gray-50 p-4 overflow-y-auto space-y-4">
          <RouteStats route={route} />
          {route.elevation && <ElevationProfile elevation={route.elevation} />}
        </div>
      )}
    </div>
  );
}
