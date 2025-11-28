'use client';

import { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import type { LatLng, MapMarker } from '@/types/map';
import type { Route } from '@/types/route';
import type { TerrainCoefficients } from '@/types/terrain';
import { DEFAULT_COEFFICIENTS } from '@/lib/terrain/coefficients';
import RouteStats from '../Stats/RouteStats';
import ElevationProfile from '../Stats/ElevationProfile';
import TerrainSettings from '../Controls/TerrainSettings';

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
  const [coefficients, setCoefficients] = useState<TerrainCoefficients>(DEFAULT_COEFFICIENTS);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

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

  const handleCoefficientsChange = useCallback((newCoefficients: TerrainCoefficients) => {
    setCoefficients(newCoefficients);
    // Recalculate route with new coefficients if markers are set
    if (markers.length === 2 && !isCalculating) {
      setTimeout(() => calculateRoute(markers), 100);
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
          options: {
            coefficients,
          },
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
    <div className="relative w-full h-full flex flex-col lg:flex-row">
      {/* Map container */}
      <div className="flex-1 relative order-2 lg:order-1">
        <BaseMap center={{ lat: 55.7558, lng: 37.6173 }} zoom={10}>
          <MarkerControls
            markers={markers}
            onMarkerAdd={handleMarkerAdd}
            onMarkerMove={handleMarkerMove}
          />
          <RouteLayer route={route?.path || []} />
        </BaseMap>

        {/* Controls overlay - desktop */}
        <div className="hidden lg:flex absolute top-4 right-4 z-[1000] flex-col gap-2">
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

        {/* Mobile controls */}
        <div className="lg:hidden absolute top-4 left-4 right-4 z-[1000] flex items-center gap-2">
          {route && (
            <button
              onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
              className="bg-white px-4 py-2 rounded-lg shadow-lg hover:bg-gray-50 transition-colors font-medium text-sm flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Статистика
            </button>
          )}
          {markers.length > 0 && (
            <button
              onClick={handleClearRoute}
              className="bg-white px-3 py-2 rounded-lg shadow-lg hover:bg-gray-50 transition-colors"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          {isCalculating && (
            <div className="bg-white px-3 py-2 rounded-lg shadow-lg text-sm text-gray-600 flex-1 text-center">
              Расчёт...
            </div>
          )}
        </div>

        {/* Instructions */}
        {markers.length === 0 && (
          <div className="absolute bottom-4 left-4 right-4 lg:right-auto z-[1000] bg-white px-4 lg:px-6 py-4 rounded-lg shadow-lg lg:max-w-md">
            <h3 className="font-bold text-base lg:text-lg mb-2">Начните работу</h3>
            <ol className="list-decimal list-inside space-y-1 text-xs lg:text-sm text-gray-700">
              <li>Кликните по карте, чтобы установить <span className="text-green-600 font-medium">начальную точку</span></li>
              <li>Кликните ещё раз, чтобы установить <span className="text-red-600 font-medium">конечную точку</span></li>
              <li>Маршрут будет построен автоматически с учётом рельефа</li>
              <li>Перетаскивайте маркеры для изменения маршрута</li>
            </ol>
          </div>
        )}
      </div>

      {/* Statistics sidebar - desktop */}
      {route && (
        <div className="hidden lg:block w-96 bg-gray-50 p-4 overflow-y-auto space-y-4 order-2">
          <TerrainSettings onCoefficientsChange={handleCoefficientsChange} />
          <RouteStats route={route} />
          {route.elevation && <ElevationProfile elevation={route.elevation} />}
        </div>
      )}

      {/* Mobile statistics panel */}
      {route && isMobileSidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-[2000] bg-black bg-opacity-50" onClick={() => setIsMobileSidebarOpen(false)}>
          <div 
            className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl max-h-[80vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b px-4 py-3 flex items-center justify-between">
              <h2 className="font-bold text-lg">Информация о маршруте</h2>
              <button
                onClick={() => setIsMobileSidebarOpen(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 space-y-4">
              <TerrainSettings onCoefficientsChange={handleCoefficientsChange} />
              <RouteStats route={route} />
              {route.elevation && <ElevationProfile elevation={route.elevation} />}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
