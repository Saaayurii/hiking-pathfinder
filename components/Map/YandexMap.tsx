'use client';

import { useEffect, useRef, useState } from 'react';
import type { LatLng } from '@/types/map';
import { useTheme } from '@/contexts/ThemeContext';

interface YandexMapProps {
  center: LatLng;
  zoom: number;
  children?: React.ReactNode;
  onMapReady?: (map: any) => void;
  onChangeProvider?: () => void;
}

declare global {
  interface Window {
    ymaps: any;
  }
}

export default function YandexMap({ center, zoom, children, onMapReady, onChangeProvider }: YandexMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<any>(null);
  const [ymapsReady, setYmapsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { theme } = useTheme();

  // Загрузка API Яндекс.Карт
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const apiKey = process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY;

    if (!apiKey) {
      setError('API ключ Яндекс.Карт не найден');
      return;
    }

    // Проверяем, не загружен ли уже API
    if (window.ymaps) {
      setYmapsReady(true);
      return;
    }

    const script = document.createElement('script');
    script.src = `https://api-maps.yandex.ru/2.1/?apikey=${apiKey}&lang=ru_RU`;
    script.async = true;
    script.onload = () => {
      window.ymaps.ready(() => {
        setYmapsReady(true);
      });
    };
    script.onerror = () => {
      setError('Ошибка загрузки Яндекс.Карт');
    };
    document.body.appendChild(script);

    return () => {
      // Cleanup если необходимо
    };
  }, []);

  // Инициализация карты
  useEffect(() => {
    if (!ymapsReady || !mapRef.current || map) return;

    try {
      const yandexMap = new window.ymaps.Map(mapRef.current, {
        center: [center.lat, center.lng],
        zoom: zoom,
        controls: []
      });

      // Добавляем минимальный набор контролов
      yandexMap.controls.add('zoomControl', { float: 'right' });
      yandexMap.controls.add('fullscreenControl', { float: 'right' });

      setMap(yandexMap);

      if (onMapReady) {
        onMapReady(yandexMap);
      }

      return () => {
        if (yandexMap) {
          yandexMap.destroy();
        }
      };
    } catch (err) {
      setError('Ошибка инициализации карты');
      console.error(err);
    }
  }, [ymapsReady, center.lat, center.lng, zoom]);

  // Обновление центра и зума
  useEffect(() => {
    if (map) {
      map.setCenter([center.lat, center.lng], zoom);
    }
  }, [map, center.lat, center.lng, zoom]);

  // Переключение темы карты
  useEffect(() => {
    if (!map || !ymapsReady) return;

    // Yandex Maps поддерживает разные типы карт
    // Для темной темы используем инверсию цветов через CSS
    const container = mapRef.current;
    if (container) {
      if (theme === 'dark') {
        container.style.filter = 'invert(1) hue-rotate(180deg) brightness(0.95) contrast(0.9)';
      } else {
        container.style.filter = 'none';
      }
    }
  }, [map, ymapsReady, theme]);

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

      {!ymapsReady && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-900">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-300">Загрузка Яндекс.Карт...</p>
          </div>
        </div>
      )}
      {children}
    </div>
  );
}
