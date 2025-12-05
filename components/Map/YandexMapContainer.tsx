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
import TerrainZonesLegend from './TerrainZonesLegend';
import { ZONE_COLORS, ZONE_LABELS } from './NatureZonesLayer';

const RouteProgress = dynamic(() => import('./RouteProgress'), { ssr: false });

interface NatureZone {
  id: number;
  type: 'water' | 'forest' | 'wetland' | 'grassland';
  name?: string;
  geometry: Array<{ lat: number; lng: number }>;
}

interface YandexMapContainerProps {
  onRouteCalculated?: (route: Route) => void;
  onChangeProvider?: () => void;
}

declare global {
  interface Window {
    ymaps: any;
  }
}

export default function YandexMapContainer({ onRouteCalculated, onChangeProvider }: YandexMapContainerProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<any>(null);
  const [ymapsReady, setYmapsReady] = useState(false);
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
  const [showTerrainZones, setShowTerrainZones] = useState(true);
  const [natureZones, setNatureZones] = useState<NatureZone[]>([]);
  const [isLoadingZones, setIsLoadingZones] = useState(false);
  const elevationCanvasRef = useRef<HTMLCanvasElement>(null);

  // Map objects refs
  const startPlacemarkRef = useRef<any>(null);
  const endPlacemarkRef = useRef<any>(null);
  const routePolylineRef = useRef<any>(null);
  const terrainPolygonsRef = useRef<any[]>([]);
  const natureZonePolygonsRef = useRef<any[]>([]);

  // Use refs for values needed in click handlers to avoid stale closures
  const markersRef = useRef<MapMarker[]>([]);
  const isCalculatingRef = useRef(false);
  const mapRef2 = useRef<any>(null); // Additional ref to access map in click handler
  const calculateRouteRef = useRef<((markers: MapMarker[]) => void) | null>(null);

  // Keep refs in sync with state
  useEffect(() => {
    markersRef.current = markers;
  }, [markers]);

  useEffect(() => {
    isCalculatingRef.current = isCalculating;
  }, [isCalculating]);

  useEffect(() => {
    mapRef2.current = map;
  }, [map]);

  // Load Yandex Maps API
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const apiKey = process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY;
    if (!apiKey) {
      setError('API ключ Яндекс.Карт не найден');
      return;
    }

    if (window.ymaps) {
      window.ymaps.ready(() => setYmapsReady(true));
      return;
    }

    const script = document.createElement('script');
    script.src = `https://api-maps.yandex.ru/2.1/?apikey=${apiKey}&lang=ru_RU`;
    script.async = true;
    script.onload = () => {
      window.ymaps.ready(() => setYmapsReady(true));
    };
    script.onerror = () => setError('Ошибка загрузки Яндекс.Карт');
    document.body.appendChild(script);
  }, []);

  // Initialize map
  useEffect(() => {
    if (!ymapsReady || !mapRef.current || map) return;

    try {
      const yandexMap = new window.ymaps.Map(mapRef.current, {
        center: [48.0159, 37.8028],
        zoom: 12,
        controls: []
      });

      yandexMap.controls.add('zoomControl', { float: 'right' });
      yandexMap.controls.add('fullscreenControl', { float: 'right' });
      yandexMap.controls.add('typeSelector', { float: 'right' });

      // Click handler for adding markers - use inline function that references yandexMap directly
      yandexMap.events.add('click', (e: any) => {
        const coords = e.get('coords');
        const position = { lat: coords[0], lng: coords[1] };

        // Use refs to get current state without stale closures
        const currentMarkers = markersRef.current;
        const hasStart = currentMarkers.some(m => m.type === 'start');
        const hasEnd = currentMarkers.some(m => m.type === 'end');

        if (!hasStart) {
          addMarkerToMap(yandexMap, position, 'start');
        } else if (!hasEnd) {
          addMarkerToMap(yandexMap, position, 'end');
        }
      });

      // Store map reference immediately
      mapRef2.current = yandexMap;
      setMap(yandexMap);

      return () => {
        if (yandexMap) {
          yandexMap.destroy();
        }
      };
    } catch (err) {
      setError('Ошибка инициализации карты');
      console.error(err);
    }
  }, [ymapsReady]);

  // Theme effect
  useEffect(() => {
    if (!mapRef.current) return;
    if (theme === 'dark') {
      mapRef.current.style.filter = 'invert(1) hue-rotate(180deg) brightness(0.95) contrast(0.9)';
    } else {
      mapRef.current.style.filter = 'none';
    }
  }, [theme]);

  // Add marker to map - accepts map instance directly to avoid stale closures
  const addMarkerToMap = useCallback((mapInstance: any, position: LatLng, type: 'start' | 'end') => {
    if (!mapInstance || !window.ymaps) return;

    const newMarker: MapMarker = {
      id: `${type}-${Date.now()}`,
      type,
      position,
    };

    // Create placemark
    const placemark = new window.ymaps.Placemark(
      [position.lat, position.lng],
      {
        balloonContent: type === 'start' ? 'Начальная точка' : 'Конечная точка',
        iconCaption: type === 'start' ? 'Старт' : 'Финиш',
      },
      {
        preset: type === 'start' ? 'islands#greenDotIcon' : 'islands#redDotIcon',
        draggable: true,
      }
    );

    // Drag handler - use mapRef2 to get current map
    placemark.events.add('dragend', () => {
      const coords = placemark.geometry.getCoordinates();
      moveMarker(newMarker.id, { lat: coords[0], lng: coords[1] });
    });

    mapInstance.geoObjects.add(placemark);

    if (type === 'start') {
      if (startPlacemarkRef.current) {
        mapInstance.geoObjects.remove(startPlacemarkRef.current);
      }
      startPlacemarkRef.current = placemark;
    } else {
      if (endPlacemarkRef.current) {
        mapInstance.geoObjects.remove(endPlacemarkRef.current);
      }
      endPlacemarkRef.current = placemark;
    }

    setMarkers(prev => {
      const filtered = prev.filter(m => m.type !== type);
      const updated = [...filtered, newMarker];

      // Auto-calculate route using the new markers array
      const hasStart = updated.some(m => m.type === 'start');
      const hasEnd = updated.some(m => m.type === 'end');

      if (hasStart && hasEnd && !isCalculatingRef.current) {
        setTimeout(() => {
          if (calculateRouteRef.current) {
            calculateRouteRef.current(updated);
          }
        }, 100);
      }

      return updated;
    });
  }, []);

  // Move marker (uses refs to avoid stale closures)
  const moveMarker = useCallback((id: string, position: LatLng) => {
    setMarkers(prev => {
      const updated = prev.map(marker =>
        marker.id === id ? { ...marker, position } : marker
      );

      if (!isCalculatingRef.current) {
        setTimeout(() => {
          if (calculateRouteRef.current) {
            calculateRouteRef.current(updated);
          }
        }, 100);
      }

      return updated;
    });
  }, []);

  // Draw route on map - defined first so calculateRoute can use it
  const drawRoute = useCallback((routeData: Route) => {
    console.log('🎨 drawRoute called', { map: !!map, ymapsReady, pathLength: routeData.path?.length });

    if (!map || !ymapsReady || !routeData.path) {
      console.warn('⚠️ Cannot draw route: map not ready or no path');
      return;
    }

    // Remove old route
    if (routePolylineRef.current) {
      map.geoObjects.remove(routePolylineRef.current);
    }

    // Remove old terrain polygons
    terrainPolygonsRef.current.forEach(polygon => {
      map.geoObjects.remove(polygon);
    });
    terrainPolygonsRef.current = [];

    // Draw new route
    const routeCoords = routeData.path.map(p => [p.lat, p.lng]);
    console.log('📍 Route coords:', routeCoords.length, 'points');

    try {
      const polyline = new window.ymaps.Polyline(
        routeCoords,
        { balloonContent: `Маршрут: ${(routeData.distance / 1000).toFixed(2)} км` },
        {
          strokeColor: '#ef4444',
          strokeWidth: 6,
          strokeOpacity: 0.9,
        }
      );

      map.geoObjects.add(polyline);
      routePolylineRef.current = polyline;
      console.log('✅ Route polyline added to map');

      // Draw terrain features if available
      if (routeData.terrainFeatures && showTerrainZones) {
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
          path: '#FFD700',
          footway: '#FFD700',
          track: '#DAA520',
          cliff: '#8B0000',
          wall: '#696969',
          fence: '#A0522D',
        };

        const terrainOpacity: Record<string, number> = {
          building: 0.6,
          barrier: 0.5,
          water: 0.5,
          railway: 0.5,
          forest: 0.35,
          grassland: 0.25,
          scrub: 0.3,
          rock: 0.4,
          wetland: 0.45,
          path: 0.4,
          footway: 0.4,
          track: 0.35,
          cliff: 0.6,
          wall: 0.5,
          fence: 0.4,
        };

        const TERRAIN_NAMES: Record<string, string> = {
          building: 'Здание',
          wall: 'Стена',
          fence: 'Забор',
          water: 'Водоём',
          waterway: 'Река/Ручей',
          wetland: 'Болото',
          forest: 'Лес',
          grassland: 'Луг',
          scrub: 'Кустарник',
          rock: 'Скалы',
          path: 'Тропа',
          footway: 'Пешеходная дорожка',
          track: 'Грунтовая дорога',
          steps: 'Ступени',
          residential: 'Жилая улица',
          cliff: 'Обрыв',
          railway: 'Железная дорога',
          construction: 'Строительство',
          barrier: 'Препятствие',
          unknown: 'Неизвестно',
        };

        const getCoefficientLabel = (coef: number): string => {
          if (coef <= 1.5) return 'Отличная проходимость';
          if (coef <= 2.5) return 'Хорошая проходимость';
          if (coef <= 4.0) return 'Средняя проходимость';
          if (coef <= 6.0) return 'Затруднённая проходимость';
          if (coef <= 8.0) return 'Очень сложно';
          return 'Непроходимо';
        };

        console.log(`🗺️ Drawing ${routeData.terrainFeatures.length} terrain features`);

        routeData.terrainFeatures.forEach((feature, index) => {
          if (feature.geometry.length < 2) return;

          const coords = feature.geometry.map(p => [p.lat, p.lng]);
          const color = terrainColors[feature.type] || '#808080';
          const opacity = terrainOpacity[feature.type] || 0.3;
          const terrainName = TERRAIN_NAMES[feature.type] || feature.type;
          const passabilityText = feature.passable ? 'Проходимо' : 'Непроходимо';
          const coefficientLabel = getCoefficientLabel(feature.coefficient);

          // Create balloon content with detailed info
          const balloonContent = `
            <div style="padding: 8px; min-width: 180px;">
              <div style="font-weight: bold; font-size: 14px; margin-bottom: 8px; color: #1f2937;">${terrainName}</div>
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                <span style="width: 12px; height: 12px; border-radius: 50%; background-color: ${color}; display: inline-block;"></span>
                <span style="color: ${feature.passable ? '#059669' : '#dc2626'}; font-weight: 500;">${passabilityText}</span>
              </div>
              <div style="color: #6b7280; font-size: 13px; margin-bottom: 2px;">
                Коэффициент: <strong>${feature.coefficient.toFixed(1)}</strong>
              </div>
              <div style="color: #6b7280; font-size: 12px;">
                ${coefficientLabel}
              </div>
              ${feature.tags?.name ? `<div style="color: #9ca3af; font-size: 12px; font-style: italic; margin-top: 4px;">${feature.tags.name}</div>` : ''}
            </div>
          `;

          // Check if polygon (closed) or polyline
          const isPolygon = feature.geometry.length >= 3 &&
            Math.abs(feature.geometry[0].lat - feature.geometry[feature.geometry.length - 1].lat) < 0.0001 &&
            Math.abs(feature.geometry[0].lng - feature.geometry[feature.geometry.length - 1].lng) < 0.0001;

          if (isPolygon) {
            const polygon = new window.ymaps.Polygon(
              [coords],
              {
                balloonContent,
                hintContent: `${terrainName} - ${passabilityText}`,
              },
              {
                fillColor: color,
                fillOpacity: opacity,
                strokeColor: color,
                strokeWidth: feature.passable ? 1 : 2,
                strokeOpacity: 0.8,
                strokeStyle: feature.passable ? 'solid' : 'dash',
              }
            );

            map.geoObjects.add(polygon);
            terrainPolygonsRef.current.push(polygon);
          } else {
            // Draw as polyline for paths, rivers, etc.
            const polyline = new window.ymaps.Polyline(
              coords,
              {
                balloonContent,
                hintContent: `${terrainName} - ${passabilityText}`,
              },
              {
                strokeColor: color,
                strokeWidth: 3,
                strokeOpacity: 0.8,
              }
            );

            map.geoObjects.add(polyline);
            terrainPolygonsRef.current.push(polyline);
          }
        });

        console.log(`✅ Added ${terrainPolygonsRef.current.length} terrain objects to map`);
      }

      // Fit bounds to show entire route
      const bounds = polyline.geometry.getBounds();
      if (bounds) {
        map.setBounds(bounds, { checkZoomRange: true, zoomMargin: 50 });
      }
    } catch (error) {
      console.error('❌ Error drawing route:', error);
    }
  }, [map, ymapsReady, showTerrainZones]);

  // Calculate route
  const calculateRoute = useCallback(async (currentMarkers: MapMarker[]) => {
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
      console.log('📡 Route response:', { success: data.success, hasRoute: !!data.route, pathLength: data.route?.path?.length });

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
  }, [coefficients, drawRoute, onRouteCalculated]);

  // Keep calculateRouteRef in sync
  useEffect(() => {
    calculateRouteRef.current = calculateRoute;
  }, [calculateRoute]);

  // Clear route
  const handleClearRoute = () => {
    if (startPlacemarkRef.current && map) {
      map.geoObjects.remove(startPlacemarkRef.current);
      startPlacemarkRef.current = null;
    }
    if (endPlacemarkRef.current && map) {
      map.geoObjects.remove(endPlacemarkRef.current);
      endPlacemarkRef.current = null;
    }
    if (routePolylineRef.current && map) {
      map.geoObjects.remove(routePolylineRef.current);
      routePolylineRef.current = null;
    }
    terrainPolygonsRef.current.forEach(polygon => {
      if (map) map.geoObjects.remove(polygon);
    });
    terrainPolygonsRef.current = [];

    setMarkers([]);
    setRoute(null);
  };

  // Load route from history
  const handleLoadRoute = (loadedRoute: Route) => {
    handleClearRoute();
    setRoute(loadedRoute);

    if (loadedRoute.start && loadedRoute.end && mapRef2.current) {
      addMarkerToMap(mapRef2.current, loadedRoute.start, 'start');
      setTimeout(() => {
        if (mapRef2.current) {
          addMarkerToMap(mapRef2.current, loadedRoute.end, 'end');
        }
        setTimeout(() => drawRoute(loadedRoute), 100);
      }, 100);
    }
  };

  // Coefficients change handler
  const handleCoefficientsChange = useCallback((newCoefficients: TerrainCoefficients) => {
    setCoefficients(newCoefficients);
    if (markers.length === 2 && !isCalculating) {
      setTimeout(() => {
        if (calculateRouteRef.current) {
          calculateRouteRef.current(markers);
        }
      }, 100);
    }
  }, [markers, isCalculating]);

  // Fetch nature zones
  const fetchNatureZones = useCallback(async () => {
    if (!map || !ymapsReady) return;

    setIsLoadingZones(true);

    try {
      const bounds = map.getBounds();
      const response = await fetch('/api/nature-zones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bounds: {
            north: bounds[1][0],
            south: bounds[0][0],
            east: bounds[1][1],
            west: bounds[0][1],
          },
        }),
      });

      const data = await response.json();

      if (data.success && data.data?.zones) {
        setNatureZones(data.data.zones);
        drawNatureZones(data.data.zones);
        console.log(`🌲 Loaded ${data.data.zones.length} nature zones`);
      }
    } catch (error) {
      console.error('Failed to fetch nature zones:', error);
    } finally {
      setIsLoadingZones(false);
    }
  }, [map, ymapsReady]);

  // Draw nature zones on map
  const drawNatureZones = useCallback((zones: NatureZone[]) => {
    if (!map || !ymapsReady) return;

    // Remove old nature zone polygons
    natureZonePolygonsRef.current.forEach(polygon => {
      map.geoObjects.remove(polygon);
    });
    natureZonePolygonsRef.current = [];

    const zoneOpacity: Record<string, number> = {
      water: 0.4,
      forest: 0.35,
      wetland: 0.35,
      grassland: 0.25,
    };

    zones.forEach((zone) => {
      if (zone.geometry.length < 3) return;

      const coords = zone.geometry.map(p => [p.lat, p.lng]);
      const color = ZONE_COLORS[zone.type] || '#808080';
      const opacity = zoneOpacity[zone.type] || 0.3;

      const polygon = new window.ymaps.Polygon(
        [coords],
        { balloonContent: ZONE_LABELS[zone.type] || zone.type },
        {
          fillColor: color,
          fillOpacity: opacity,
          strokeColor: color,
          strokeWidth: 1,
          strokeOpacity: 0.6,
        }
      );

      map.geoObjects.add(polygon);
      natureZonePolygonsRef.current.push(polygon);
    });
  }, [map, ymapsReady]);

  // Clear nature zones
  const clearNatureZones = useCallback(() => {
    if (!map) return;

    natureZonePolygonsRef.current.forEach(polygon => {
      map.geoObjects.remove(polygon);
    });
    natureZonePolygonsRef.current = [];
    setNatureZones([]);
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
        {!ymapsReady && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-900">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600 dark:text-gray-300">Загрузка Яндекс.Карт...</p>
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
          {route?.terrainFeatures && route.terrainFeatures.length > 0 && (
            <button
              onClick={() => setShowTerrainZones(!showTerrainZones)}
              className={`px-4 py-2 rounded-lg shadow-lg transition-colors font-medium text-sm flex items-center gap-2 ${
                showTerrainZones
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              Зоны
            </button>
          )}
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
        {markers.length === 0 && ymapsReady && (
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

        {/* Terrain Zones Legend */}
        {route?.terrainFeatures && route.terrainFeatures.length > 0 && showTerrainZones && (
          <div className="absolute bottom-4 left-4 z-[1000]">
            <TerrainZonesLegend collapsed={false} />
          </div>
        )}
      </div>

      {/* Sidebar - desktop - always visible */}
      <div className="hidden lg:block w-96 bg-gray-50 dark:bg-gray-900 p-4 overflow-y-auto space-y-4 order-2">
        {/* Actions - only when route exists */}
        {route && (
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
        )}

        {/* Terrain settings - always visible */}
        <TerrainSettings onCoefficientsChange={handleCoefficientsChange} />

        {/* Route stats - only when route exists */}
        {route && (
          <>
            <RouteStats route={route} />
            {route.elevation && <ElevationProfile elevation={route.elevation} canvasRef={elevationCanvasRef} />}
          </>
        )}

        {/* Instructions when no route */}
        {!route && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4">
            <h3 className="font-bold text-sm text-gray-700 dark:text-gray-300 mb-3">Как построить маршрут</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <li>Кликните по карте для <span className="text-green-600 font-medium">начала</span></li>
              <li>Кликните ещё раз для <span className="text-red-600 font-medium">конца</span></li>
              <li>Маршрут построится автоматически</li>
            </ol>
          </div>
        )}
      </div>

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
