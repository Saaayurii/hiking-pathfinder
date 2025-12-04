'use client';

import { useState, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import type { LatLng, MapMarker } from '@/types/map';
import type { Route } from '@/types/route';
import type { TerrainCoefficients } from '@/types/terrain';
import { DEFAULT_COEFFICIENTS } from '@/lib/terrain/coefficients';
import RouteStats from '../Stats/RouteStats';
import ElevationProfile from '../Stats/ElevationProfile';
import TerrainSettings from '../Controls/TerrainSettings';
import ExportButtons from '../Export/ExportButtons';
import SaveRouteDialog from '../Export/SaveRouteDialog';
import RouteHistory from '../Export/RouteHistory';
import RouteProgress from './RouteProgress';
import ThemeToggle from '../UI/ThemeToggle';
import NatureZonesToggle from './NatureZonesToggle';

// Dynamic import for SSR compatibility
const BaseMap = dynamic(() => import('./BaseMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-900">
      <div className="text-gray-600 dark:text-gray-300">Загрузка карты...</div>
    </div>
  ),
});

const MarkerControls = dynamic(() => import('./MarkerControls'), {
  ssr: false,
});

const RouteLayer = dynamic(() => import('./RouteLayer'), {
  ssr: false,
});

const TerrainLayer = dynamic(() => import('./TerrainLayer'), {
  ssr: false,
});

const TerrainLegend = dynamic(() => import('./TerrainLegend'), {
  ssr: false,
});

const NatureZonesLayer = dynamic(() => import('./NatureZonesLayer'), {
  ssr: false,
});

interface MapContainerProps {
  onRouteCalculated?: (route: Route) => void;
  onChangeProvider?: () => void;
}

export default function MapContainer({ onRouteCalculated, onChangeProvider }: MapContainerProps) {
  const [markers, setMarkers] = useState<MapMarker[]>([]);
  const [route, setRoute] = useState<Route | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [calculationStage, setCalculationStage] = useState<'idle' | 'osm' | 'elevation' | 'graph' | 'pathfinding' | 'complete'>('idle');
  const [coefficients, setCoefficients] = useState<TerrainCoefficients>(DEFAULT_COEFFICIENTS);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showNatureZones, setShowNatureZones] = useState(false);
  const elevationCanvasRef = useRef<HTMLCanvasElement>(null);

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
    setCalculationStage('osm');

    // Simulate progress stages
    const progressTimer = setTimeout(() => setCalculationStage('elevation'), 1000);
    const progressTimer2 = setTimeout(() => setCalculationStage('graph'), 3000);
    const progressTimer3 = setTimeout(() => setCalculationStage('pathfinding'), 5000);

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
        console.log('✅ Route received:', {
          pathLength: data.route.path?.length,
          distance: data.route.distance,
          hasPath: !!data.route.path
        });
        setCalculationStage('complete');
        setTimeout(() => {
          setRoute(data.route);
          onRouteCalculated?.(data.route);
          setIsCalculating(false);
        }, 500);
      } else {
        console.error('❌ Route calculation failed:', data.error);
        setIsCalculating(false);
      }
    } catch (error) {
      console.error('Error calculating route:', error);
      setIsCalculating(false);
    } finally {
      clearTimeout(progressTimer);
      clearTimeout(progressTimer2);
      clearTimeout(progressTimer3);
    }
  };

  const handleClearRoute = () => {
    setMarkers([]);
    setRoute(null);
  };

  const handleLoadRoute = (loadedRoute: Route) => {
    setRoute(loadedRoute);
    
    // Set markers from loaded route
    const newMarkers: MapMarker[] = [
      {
        id: `start-${Date.now()}`,
        type: 'start',
        position: loadedRoute.start,
      },
      {
        id: `end-${Date.now()}`,
        type: 'end',
        position: loadedRoute.end,
      },
    ];
    
    setMarkers(newMarkers);
  };

  return (
    <div className="relative w-full h-full flex flex-col lg:flex-row">
      {/* Theme Toggle */}
      <ThemeToggle />

      {/* Map container */}
      <div className="flex-1 relative order-2 lg:order-1">
        <BaseMap center={{ lat: 48.0159, lng: 37.8028 }} zoom={10}>
          <NatureZonesLayer enabled={showNatureZones} />
          <MarkerControls
            markers={markers}
            onMarkerAdd={handleMarkerAdd}
            onMarkerMove={handleMarkerMove}
          />
          {route?.terrainFeatures && <TerrainLayer features={route.terrainFeatures} />}
          <RouteLayer route={route?.path || []} />
        </BaseMap>

        {/* Terrain Legend */}
        {route?.terrainFeatures && route.terrainFeatures.length > 0 && <TerrainLegend />}

        {/* Controls overlay - desktop */}
        <div className="hidden lg:flex absolute top-4 right-4 z-[1000] flex-col gap-2">
          {onChangeProvider && (
            <button
              onClick={onChangeProvider}
              className="bg-white dark:bg-gray-800 px-4 py-2 rounded-lg shadow-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium text-sm flex items-center gap-2 text-gray-700 dark:text-gray-300"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              Сменить карту
            </button>
          )}
          <NatureZonesToggle
            enabled={showNatureZones}
            onToggle={() => setShowNatureZones(!showNatureZones)}
          />
          <button
            onClick={() => setShowHistory(true)}
            className="bg-white dark:bg-gray-800 px-4 py-2 rounded-lg shadow-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium text-sm flex items-center gap-2 text-gray-700 dark:text-gray-300"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            История
          </button>

          {markers.length > 0 && (
            <button
              onClick={handleClearRoute}
              className="bg-white dark:bg-gray-800 px-4 py-2 rounded-lg shadow-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium text-sm text-gray-700 dark:text-gray-300"
            >
              Очистить маршрут
            </button>
          )}
          {isCalculating && (
            <div className="bg-white dark:bg-gray-800 px-4 py-2 rounded-lg shadow-lg text-sm text-gray-700 dark:text-gray-300">
              Расчёт маршрута...
            </div>
          )}
        </div>

        {/* Mobile controls */}
        <div className="lg:hidden absolute top-4 left-4 right-4 z-[1000] flex items-center gap-2 flex-wrap">
          <NatureZonesToggle
            enabled={showNatureZones}
            onToggle={() => setShowNatureZones(!showNatureZones)}
          />
          {route && (
            <button
              onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
              className="bg-white dark:bg-gray-800 px-4 py-2 rounded-lg shadow-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium text-sm flex items-center gap-2 text-gray-700 dark:text-gray-300"
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
              className="bg-white dark:bg-gray-800 px-3 py-2 rounded-lg shadow-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          {isCalculating && (
            <div className="bg-white dark:bg-gray-800 px-3 py-2 rounded-lg shadow-lg text-sm text-gray-700 dark:text-gray-300 flex-1 text-center">
              Расчёт...
            </div>
          )}
        </div>

        {/* Instructions */}
        {markers.length === 0 && (
          <div className="absolute bottom-4 left-4 right-4 lg:right-auto z-[1000] bg-white dark:bg-gray-800 px-4 lg:px-6 py-4 rounded-lg shadow-lg lg:max-w-md">
            <h3 className="font-bold text-base lg:text-lg mb-2 text-gray-900 dark:text-white">Начните работу</h3>
            <ol className="list-decimal list-inside space-y-1 text-xs lg:text-sm text-gray-700 dark:text-gray-300">
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
        <div className="hidden lg:block w-96 bg-gray-50 dark:bg-gray-900 p-4 overflow-y-auto space-y-4 order-2">
          {/* Save and Export buttons */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 space-y-3">
            <h3 className="font-bold text-sm text-gray-700 dark:text-gray-300">Действия</h3>
            <button
              onClick={() => setShowSaveDialog(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
              Сохранить маршрут
            </button>
            <ExportButtons route={route} elevationCanvasRef={elevationCanvasRef} />
          </div>

          <TerrainSettings onCoefficientsChange={handleCoefficientsChange} />
          <RouteStats route={route} />
          {route.elevation && <ElevationProfile elevation={route.elevation} canvasRef={elevationCanvasRef} />}
        </div>
      )}

      {/* Mobile statistics panel */}
      {route && isMobileSidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-[2000] bg-black bg-opacity-50" onClick={() => setIsMobileSidebarOpen(false)}>
          <div
            className="absolute bottom-0 left-0 right-0 bg-white dark:bg-gray-800 rounded-t-2xl max-h-[80vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b dark:border-gray-700 px-4 py-3 flex items-center justify-between">
              <h2 className="font-bold text-lg text-gray-900 dark:text-white">Информация о маршруте</h2>
              <button
                onClick={() => setIsMobileSidebarOpen(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <svg className="w-6 h-6 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 space-y-4">
              {/* Save and Export buttons */}
              <div className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-4 space-y-3">
                <button
                  onClick={() => setShowSaveDialog(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium text-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                  </svg>
                  Сохранить маршрут
                </button>
                <ExportButtons route={route} elevationCanvasRef={elevationCanvasRef} />
              </div>

              <TerrainSettings onCoefficientsChange={handleCoefficientsChange} />
              <RouteStats route={route} />
              {route.elevation && <ElevationProfile elevation={route.elevation} canvasRef={elevationCanvasRef} />}
            </div>
          </div>
        </div>
      )}

      {/* Dialogs */}
      {showSaveDialog && route && (
        <SaveRouteDialog
          route={route}
          onSave={(savedRoute) => {
            setRoute(savedRoute);
          }}
          onClose={() => setShowSaveDialog(false)}
        />
      )}

      {showHistory && (
        <RouteHistory
          onLoadRoute={handleLoadRoute}
          onClose={() => setShowHistory(false)}
        />
      )}

      {/* Route calculation progress */}
      {isCalculating && <RouteProgress stage={calculationStage} />}
    </div>
  );
}
