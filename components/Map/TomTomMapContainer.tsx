'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import type { LatLng, MapMarker } from '@/types/map';
import type { Route } from '@/types/route';
import type { TerrainCoefficients } from '@/types/terrain';
import { DEFAULT_COEFFICIENTS } from '@/lib/terrain/coefficients';
import { useTheme } from '@/contexts/ThemeContext';
import RouteStats from '../Stats/RouteStats';
import ElevationProfile from '../Stats/ElevationProfile';
import TerrainSettings from '../Controls/TerrainSettings';
import ExportButtons from '../Export/ExportButtons';
import SaveRouteDialog from '../Export/SaveRouteDialog';
import RouteHistory from '../Export/RouteHistory';
import ThemeToggle from '../UI/ThemeToggle';
import NatureZonesToggle from './NatureZonesToggle';
import { ZONE_COLORS, ZONE_LABELS } from './NatureZonesLayer';

const RouteProgress = dynamic(() => import('./RouteProgress'), { ssr: false });

interface NatureZone {
  id: number;
  type: 'water' | 'forest' | 'wetland' | 'grassland';
  name?: string;
  geometry: Array<{ lat: number; lng: number }>;
}

interface TomTomMapContainerProps {
  onRouteCalculated?: (route: Route) => void;
  onChangeProvider?: () => void;
}

declare global {
  interface Window {
    tt: any;
  }
}

const TOMTOM_STYLES = {
  light: 'basic_main',
  dark: 'basic_night'
};

export default function TomTomMapContainer({ onRouteCalculated, onChangeProvider }: TomTomMapContainerProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<any>(null);
  const [tomtomReady, setTomtomReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { theme } = useTheme();

  // Routing state
  const [markers, setMarkers] = useState<MapMarker[]>([]);
  const [route, setRoute] = useState<Route | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [calculationStage, setCalculationStage] = useState<'idle' | 'osm' | 'elevation' | 'graph' | 'pathfinding' | 'complete'>('idle');
  const [coefficients, setCoefficients] = useState<TerrainCoefficients>(DEFAULT_COEFFICIENTS);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showNatureZones, setShowNatureZones] = useState(false);
  const [isLoadingZones, setIsLoadingZones] = useState(false);
  const elevationCanvasRef = useRef<HTMLCanvasElement>(null);

  // Map objects refs
  const startMarkerRef = useRef<any>(null);
  const endMarkerRef = useRef<any>(null);
  const routeLayerRef = useRef<string | null>(null);
  const terrainLayersRef = useRef<string[]>([]);
  const natureZoneLayersRef = useRef<string[]>([]);

  // Use refs for values needed in click handlers to avoid stale closures
  const markersRef = useRef<MapMarker[]>([]);
  const isCalculatingRef = useRef(false);
  const mapReadyRef = useRef(false);

  // Keep refs in sync with state
  useEffect(() => {
    markersRef.current = markers;
  }, [markers]);

  useEffect(() => {
    isCalculatingRef.current = isCalculating;
  }, [isCalculating]);

  useEffect(() => {
    mapReadyRef.current = tomtomReady && map !== null;
  }, [tomtomReady, map]);

  // Load TomTom SDK
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const apiKey = process.env.NEXT_PUBLIC_TOMTOM_API_KEY;
    if (!apiKey) {
      setError('API ключ TomTom не найден');
      return;
    }

    if (window.tt) {
      setTomtomReady(true);
      return;
    }

    // Load CSS
    const cssLink = document.createElement('link');
    cssLink.rel = 'stylesheet';
    cssLink.href = 'https://api.tomtom.com/maps-sdk-for-web/cdn/6.x/6.25.0/maps/maps.css';
    document.head.appendChild(cssLink);

    // Load JS
    const script = document.createElement('script');
    script.src = 'https://api.tomtom.com/maps-sdk-for-web/cdn/6.x/6.25.0/maps/maps-web.min.js';
    script.async = true;
    script.onload = () => setTomtomReady(true);
    script.onerror = () => setError('Ошибка загрузки TomTom Maps');
    document.body.appendChild(script);
  }, []);

  // Initialize map
  useEffect(() => {
    if (!tomtomReady || !mapRef.current || map) return;

    const apiKey = process.env.NEXT_PUBLIC_TOMTOM_API_KEY;
    if (!apiKey) return;

    try {
      const tomtomMap = window.tt.map({
        key: apiKey,
        container: mapRef.current,
        center: [37.8028, 48.0159], // [lng, lat] for TomTom
        zoom: 12,
        style: TOMTOM_STYLES[theme],
      });

      tomtomMap.addControl(new window.tt.NavigationControl());
      tomtomMap.addControl(new window.tt.FullscreenControl());

      // Click handler for adding markers
      tomtomMap.on('click', (e: any) => {
        handleMapClick({ lat: e.lngLat.lat, lng: e.lngLat.lng });
      });

      setMap(tomtomMap);

      return () => {
        if (tomtomMap) {
          tomtomMap.remove();
        }
      };
    } catch (err) {
      setError('Ошибка инициализации карты');
      console.error(err);
    }
  }, [tomtomReady]);

  // Theme effect
  useEffect(() => {
    if (!map || !tomtomReady) return;
    try {
      map.setStyle(TOMTOM_STYLES[theme]);
    } catch (err) {
      console.warn('Failed to change TomTom map style:', err);
    }
  }, [map, tomtomReady, theme]);

  // Handle map click - add markers (uses refs to avoid stale closures)
  const handleMapClick = useCallback((position: LatLng) => {
    if (!mapReadyRef.current) return;

    const currentMarkers = markersRef.current;
    const hasStart = currentMarkers.some(m => m.type === 'start');
    const hasEnd = currentMarkers.some(m => m.type === 'end');

    if (!hasStart) {
      addMarker(position, 'start');
    } else if (!hasEnd) {
      addMarker(position, 'end');
    }
  }, []);

  // Add marker (uses refs to avoid stale closures)
  const addMarker = useCallback((position: LatLng, type: 'start' | 'end') => {
    if (!map || !tomtomReady) return;

    const newMarker: MapMarker = {
      id: `${type}-${Date.now()}`,
      type,
      position,
    };

    // Create marker element
    const el = document.createElement('div');
    el.className = 'tt-marker';
    el.style.width = '30px';
    el.style.height = '40px';
    el.style.backgroundSize = 'cover';
    el.style.cursor = 'grab';

    // SVG marker
    const color = type === 'start' ? '#22c55e' : '#ef4444';
    el.innerHTML = `
      <svg viewBox="0 0 24 36" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 0C5.373 0 0 5.373 0 12c0 9 12 24 12 24s12-15 12-24c0-6.627-5.373-12-12-12z" fill="${color}"/>
        <circle cx="12" cy="12" r="5" fill="white"/>
      </svg>
    `;

    const marker = new window.tt.Marker({
      element: el,
      draggable: true,
      anchor: 'bottom',
    })
      .setLngLat([position.lng, position.lat])
      .addTo(map);

    // Drag handler
    marker.on('dragend', () => {
      const lngLat = marker.getLngLat();
      moveMarker(newMarker.id, { lat: lngLat.lat, lng: lngLat.lng });
    });

    if (type === 'start') {
      if (startMarkerRef.current) {
        startMarkerRef.current.remove();
      }
      startMarkerRef.current = marker;
    } else {
      if (endMarkerRef.current) {
        endMarkerRef.current.remove();
      }
      endMarkerRef.current = marker;
    }

    setMarkers(prev => {
      const filtered = prev.filter(m => m.type !== type);
      const updated = [...filtered, newMarker];

      // Auto-calculate route using the new markers array
      const hasStart = updated.some(m => m.type === 'start');
      const hasEnd = updated.some(m => m.type === 'end');

      if (hasStart && hasEnd && !isCalculatingRef.current) {
        setTimeout(() => calculateRoute(updated), 100);
      }

      return updated;
    });
  }, [map, tomtomReady]);

  // Move marker (uses refs to avoid stale closures)
  const moveMarker = useCallback((id: string, position: LatLng) => {
    setMarkers(prev => {
      const updated = prev.map(marker =>
        marker.id === id ? { ...marker, position } : marker
      );

      if (!isCalculatingRef.current) {
        setTimeout(() => calculateRoute(updated), 100);
      }

      return updated;
    });
  }, []);

  // Calculate route
  const calculateRoute = async (currentMarkers: MapMarker[]) => {
    const start = currentMarkers.find(m => m.type === 'start');
    const end = currentMarkers.find(m => m.type === 'end');

    if (!start || !end) return;

    setIsCalculating(true);
    setCalculationStage('osm');

    const progressTimer = setTimeout(() => setCalculationStage('elevation'), 1000);
    const progressTimer2 = setTimeout(() => setCalculationStage('graph'), 3000);
    const progressTimer3 = setTimeout(() => setCalculationStage('pathfinding'), 5000);

    try {
      const response = await fetch('/api/pathfinding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start: start.position,
          end: end.position,
          options: { coefficients },
        }),
      });

      const data = await response.json();

      if (data.success && data.route) {
        setCalculationStage('complete');
        setTimeout(() => {
          setRoute(data.route);
          drawRoute(data.route);
          onRouteCalculated?.(data.route);
          setIsCalculating(false);
        }, 500);
      } else {
        console.error('Route calculation failed:', data.error);
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

  // Draw route on map
  const drawRoute = useCallback((routeData: Route) => {
    if (!map || !tomtomReady || !routeData.path) return;

    // Remove old route
    if (routeLayerRef.current && map.getLayer(routeLayerRef.current)) {
      map.removeLayer(routeLayerRef.current);
      map.removeSource(routeLayerRef.current);
    }

    // Remove old terrain layers
    terrainLayersRef.current.forEach(layerId => {
      if (map.getLayer(layerId)) {
        map.removeLayer(layerId);
        map.removeSource(layerId);
      }
    });
    terrainLayersRef.current = [];

    // Create route GeoJSON
    const routeId = `route-${Date.now()}`;
    const routeCoords = routeData.path.map(p => [p.lng, p.lat]);

    map.addSource(routeId, {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: routeCoords,
        },
      },
    });

    map.addLayer({
      id: routeId,
      type: 'line',
      source: routeId,
      layout: {
        'line-join': 'round',
        'line-cap': 'round',
      },
      paint: {
        'line-color': '#ef4444',
        'line-width': 6,
        'line-opacity': 0.9,
      },
    });

    routeLayerRef.current = routeId;

    // Draw terrain features if available
    if (routeData.terrainFeatures) {
      const terrainColors: Record<string, string> = {
        building: '#8B4513',
        barrier: '#696969',
        water: '#1E90FF',
        railway: '#2F4F4F',
        forest: '#228B22',
        grassland: '#90EE90',
        scrub: '#6B8E23',
        rock: '#A9A9A9',
        wetland: '#4682B4',
      };

      const terrainOpacity: Record<string, number> = {
        building: 0.7,
        barrier: 0.6,
        water: 0.5,
        railway: 0.6,
        forest: 0.3,
        grassland: 0.2,
        scrub: 0.3,
        rock: 0.4,
        wetland: 0.4,
      };

      routeData.terrainFeatures.forEach((feature, index) => {
        if (feature.geometry.length < 3) return;

        const layerId = `terrain-${feature.type}-${index}-${Date.now()}`;
        const coords = feature.geometry.map(p => [p.lng, p.lat]);
        // Close the polygon
        if (coords.length > 0) {
          coords.push(coords[0]);
        }

        const color = terrainColors[feature.type] || '#808080';
        const opacity = terrainOpacity[feature.type] || 0.3;

        map.addSource(layerId, {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: { type: feature.type },
            geometry: {
              type: 'Polygon',
              coordinates: [coords],
            },
          },
        });

        map.addLayer({
          id: layerId,
          type: 'fill',
          source: layerId,
          paint: {
            'fill-color': color,
            'fill-opacity': opacity,
          },
        });

        terrainLayersRef.current.push(layerId);
      });
    }

    // Fit bounds to show entire route
    const bounds = routeCoords.reduce((bounds, coord) => {
      return bounds.extend(coord as [number, number]);
    }, new window.tt.LngLatBounds(routeCoords[0] as [number, number], routeCoords[0] as [number, number]));

    map.fitBounds(bounds, { padding: 50 });
  }, [map, tomtomReady]);

  // Clear route
  const handleClearRoute = () => {
    if (startMarkerRef.current) {
      startMarkerRef.current.remove();
      startMarkerRef.current = null;
    }
    if (endMarkerRef.current) {
      endMarkerRef.current.remove();
      endMarkerRef.current = null;
    }
    if (routeLayerRef.current && map) {
      if (map.getLayer(routeLayerRef.current)) {
        map.removeLayer(routeLayerRef.current);
        map.removeSource(routeLayerRef.current);
      }
      routeLayerRef.current = null;
    }
    terrainLayersRef.current.forEach(layerId => {
      if (map && map.getLayer(layerId)) {
        map.removeLayer(layerId);
        map.removeSource(layerId);
      }
    });
    terrainLayersRef.current = [];

    setMarkers([]);
    setRoute(null);
  };

  // Load route from history
  const handleLoadRoute = (loadedRoute: Route) => {
    handleClearRoute();
    setRoute(loadedRoute);

    if (loadedRoute.start && loadedRoute.end) {
      addMarker(loadedRoute.start, 'start');
      setTimeout(() => {
        addMarker(loadedRoute.end, 'end');
        setTimeout(() => drawRoute(loadedRoute), 100);
      }, 100);
    }
  };

  // Coefficients change handler
  const handleCoefficientsChange = useCallback((newCoefficients: TerrainCoefficients) => {
    setCoefficients(newCoefficients);
    if (markers.length === 2 && !isCalculating) {
      setTimeout(() => calculateRoute(markers), 100);
    }
  }, [markers, isCalculating]);

  // Fetch nature zones
  const fetchNatureZones = useCallback(async () => {
    if (!map || !tomtomReady) return;

    setIsLoadingZones(true);

    try {
      const bounds = map.getBounds();
      const response = await fetch('/api/nature-zones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bounds: {
            north: bounds.getNorth(),
            south: bounds.getSouth(),
            east: bounds.getEast(),
            west: bounds.getWest(),
          },
        }),
      });

      const data = await response.json();

      if (data.success && data.data?.zones) {
        drawNatureZones(data.data.zones);
        console.log(`🌲 Loaded ${data.data.zones.length} nature zones`);
      }
    } catch (error) {
      console.error('Failed to fetch nature zones:', error);
    } finally {
      setIsLoadingZones(false);
    }
  }, [map, tomtomReady]);

  // Draw nature zones on map
  const drawNatureZones = useCallback((zones: NatureZone[]) => {
    if (!map || !tomtomReady) return;

    // Remove old nature zone layers
    natureZoneLayersRef.current.forEach(layerId => {
      if (map.getLayer(layerId)) {
        map.removeLayer(layerId);
        map.removeSource(layerId);
      }
    });
    natureZoneLayersRef.current = [];

    const zoneOpacity: Record<string, number> = {
      water: 0.4,
      forest: 0.35,
      wetland: 0.35,
      grassland: 0.25,
    };

    zones.forEach((zone, index) => {
      if (zone.geometry.length < 3) return;

      const layerId = `nature-zone-${zone.type}-${index}-${Date.now()}`;
      const coords = zone.geometry.map(p => [p.lng, p.lat]);
      // Close the polygon
      if (coords.length > 0) {
        coords.push(coords[0]);
      }

      const color = ZONE_COLORS[zone.type] || '#808080';
      const opacity = zoneOpacity[zone.type] || 0.3;

      try {
        map.addSource(layerId, {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: { type: zone.type, name: zone.name },
            geometry: {
              type: 'Polygon',
              coordinates: [coords],
            },
          },
        });

        map.addLayer({
          id: layerId,
          type: 'fill',
          source: layerId,
          paint: {
            'fill-color': color,
            'fill-opacity': opacity,
          },
        });

        natureZoneLayersRef.current.push(layerId);
      } catch (err) {
        console.warn('Failed to add nature zone layer:', err);
      }
    });
  }, [map, tomtomReady]);

  // Clear nature zones
  const clearNatureZones = useCallback(() => {
    if (!map) return;

    natureZoneLayersRef.current.forEach(layerId => {
      if (map.getLayer(layerId)) {
        map.removeLayer(layerId);
        map.removeSource(layerId);
      }
    });
    natureZoneLayersRef.current = [];
  }, [map]);

  // Toggle nature zones
  const handleToggleNatureZones = useCallback(() => {
    if (showNatureZones) {
      clearNatureZones();
      setShowNatureZones(false);
    } else {
      setShowNatureZones(true);
      fetchNatureZones();
    }
  }, [showNatureZones, clearNatureZones, fetchNatureZones]);

  if (error) {
    return (
      <div className="relative w-full h-full bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center p-8">
          <div className="text-red-500 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Ошибка загрузки карты</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">{error}</p>
          {onChangeProvider && (
            <button
              onClick={onChangeProvider}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              Выбрать другую карту
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full flex flex-col lg:flex-row">
      <ThemeToggle />

      {/* Map container */}
      <div className="flex-1 relative order-2 lg:order-1">
        <div ref={mapRef} className="w-full h-full" />

        {/* Loading */}
        {!tomtomReady && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-900">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600 dark:text-gray-300">Загрузка TomTom Maps...</p>
            </div>
          </div>
        )}

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
            onToggle={handleToggleNatureZones}
            isLoading={isLoadingZones}
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
            onToggle={handleToggleNatureZones}
            isLoading={isLoadingZones}
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
        </div>

        {/* Instructions */}
        {markers.length === 0 && tomtomReady && (
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
          onSave={(savedRoute) => setRoute(savedRoute)}
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
