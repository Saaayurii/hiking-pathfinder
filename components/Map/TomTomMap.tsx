'use client';

import { useEffect, useRef, useState } from 'react';
import type { LatLng } from '@/types/map';
import { useTheme } from '@/contexts/ThemeContext';

interface TomTomMapProps {
  center: LatLng;
  zoom: number;
  children?: React.ReactNode;
  onMapReady?: (map: any) => void;
  onChangeProvider?: () => void;
}

declare global {
  interface Window {
    tt: any;
  }
}

// TomTom поддерживает разные стили карты
const TOMTOM_STYLES = {
  light: 'basic_main',
  dark: 'basic_night'
};

export default function TomTomMap({ center, zoom, children, onMapReady, onChangeProvider }: TomTomMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<any>(null);
  const [tomtomReady, setTomtomReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { theme } = useTheme();

  // Загрузка TomTom SDK
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const apiKey = process.env.NEXT_PUBLIC_TOMTOM_API_KEY;

    if (!apiKey) {
      setError('API ключ TomTom не найден');
      return;
    }

    // Проверяем, не загружен ли уже SDK
    if (window.tt) {
      setTomtomReady(true);
      return;
    }

    // Проверяем, не загружен ли уже CSS
    const existingCss = document.querySelector('link[href*="tomtom.com"]');
    if (!existingCss) {
      const cssLink = document.createElement('link');
      cssLink.rel = 'stylesheet';
      cssLink.href = 'https://api.tomtom.com/maps-sdk-for-web/cdn/6.x/6.25.0/maps/maps.css';
      document.head.appendChild(cssLink);
    }

    // Проверяем, не загружается ли уже скрипт
    const existingScript = document.querySelector('script[src*="tomtom.com"]');
    if (existingScript) {
      const checkReady = setInterval(() => {
        if (window.tt) {
          clearInterval(checkReady);
          setTomtomReady(true);
        }
      }, 100);
      return () => clearInterval(checkReady);
    }

    // Загружаем JS
    const script = document.createElement('script');
    script.src = 'https://api.tomtom.com/maps-sdk-for-web/cdn/6.x/6.25.0/maps/maps-web.min.js';
    script.async = true;
    script.onload = () => {
      setTimeout(() => setTomtomReady(true), 100);
    };
    script.onerror = () => {
      setError('Ошибка загрузки TomTom Maps SDK');
    };
    document.body.appendChild(script);

    return () => {
      // Cleanup если необходимо
    };
  }, []);

  // Инициализация карты
  useEffect(() => {
    if (!tomtomReady || !mapRef.current || map) return;

    const apiKey = process.env.NEXT_PUBLIC_TOMTOM_API_KEY;
    if (!apiKey) {
      console.error('TomTom API key is required');
      return;
    }

    // Проверяем, что tt объект полностью загружен
    if (!window.tt || typeof window.tt.map !== 'function') {
      console.error('TomTom SDK not fully loaded');
      setError('TomTom SDK не загружен полностью');
      return;
    }

    try {
      const tomtomMap = window.tt.map({
        key: apiKey,
        container: mapRef.current,
        center: [center.lng, center.lat],
        zoom: zoom,
        style: TOMTOM_STYLES[theme],
      });

      // Добавляем контролы после загрузки карты
      tomtomMap.on('load', () => {
        try {
          tomtomMap.addControl(new window.tt.NavigationControl());
          tomtomMap.addControl(new window.tt.FullscreenControl());
        } catch (controlErr) {
          console.warn('Failed to add controls:', controlErr);
        }

        if (onMapReady) {
          onMapReady(tomtomMap);
        }
      });

      // Обработка ошибок карты
      tomtomMap.on('error', (e: any) => {
        console.error('TomTom map error:', e);
      });

      setMap(tomtomMap);

      return () => {
        if (tomtomMap) {
          try {
            tomtomMap.remove();
          } catch (removeErr) {
            console.warn('Error removing map:', removeErr);
          }
        }
      };
    } catch (error) {
      console.error('Error initializing TomTom map:', error);
      setError('Ошибка инициализации карты TomTom');
    }
  }, [tomtomReady, center.lat, center.lng, zoom]);

  // Обновление центра и зума
  useEffect(() => {
    if (map) {
      map.setCenter([center.lng, center.lat]);
      map.setZoom(zoom);
    }
  }, [map, center.lat, center.lng, zoom]);

  // Переключение темы карты
  useEffect(() => {
    if (!map || !tomtomReady) return;

    try {
      // TomTom поддерживает смену стиля на лету
      map.setStyle(TOMTOM_STYLES[theme]);
    } catch (err) {
      console.warn('Failed to change TomTom map style:', err);
    }
  }, [map, tomtomReady, theme]);

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
    <div className="relative w-full h-full">
      <div ref={mapRef} className="w-full h-full" />

      {/* Кнопка смены провайдера */}
      {onChangeProvider && (
        <button
          onClick={onChangeProvider}
          className="absolute top-4 left-4 z-10 px-4 py-2 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-lg shadow-lg hover:shadow-xl transition-all text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
          title="Сменить карту"
        >
          <svg className="w-5 h-5 inline mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          Сменить карту
        </button>
      )}

      {!tomtomReady && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-900">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-300">Загрузка TomTom Maps...</p>
          </div>
        </div>
      )}
      {children}
    </div>
  );
}
