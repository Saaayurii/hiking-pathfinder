'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import type { MapProvider } from '@/types/maps';

// Dynamic imports for SSR compatibility
const MapProviderSelector = dynamic(() => import('@/components/Map/MapProviderSelector'), {
  ssr: false,
});

const MapContainer = dynamic(() => import('@/components/Map/MapContainer'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300 mb-2">Загрузка карты...</h2>
        <p className="text-gray-500 dark:text-gray-400">Пожалуйста, подождите</p>
      </div>
    </div>
  ),
});

const YandexMapContainer = dynamic(() => import('@/components/Map/YandexMapContainer'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-gray-300">Загрузка Яндекс.Карт...</p>
      </div>
    </div>
  ),
});

const TomTomMapContainer = dynamic(() => import('@/components/Map/TomTomMapContainer'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-gray-300">Загрузка TomTom Maps...</p>
      </div>
    </div>
  ),
});

export default function Home() {
  const [selectedProvider, setSelectedProvider] = useState<MapProvider | null>(null);
  const [mounted, setMounted] = useState(false);

  // Load saved provider on mount
  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('selectedMapProvider');
    if (saved && ['leaflet', 'yandex', 'tomtom'].includes(saved)) {
      setSelectedProvider(saved as MapProvider);
    }
  }, []);

  const handleProviderSelect = (provider: MapProvider) => {
    setSelectedProvider(provider);
    localStorage.setItem('selectedMapProvider', provider);
  };

  const handleChangeProvider = () => {
    setSelectedProvider(null);
    localStorage.removeItem('selectedMapProvider');
  };

  // Show loading until mounted
  if (!mounted) {
    return (
      <main className="w-full h-screen overflow-hidden bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Загрузка...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="w-full h-screen overflow-hidden">
      {!selectedProvider && (
        <MapProviderSelector onSelect={handleProviderSelect} />
      )}

      {selectedProvider === 'leaflet' && (
        <MapContainer
          onChangeProvider={handleChangeProvider}
        />
      )}
      {selectedProvider === 'tomtom' && (
        <TomTomMapContainer
          onChangeProvider={handleChangeProvider}
        />
      )}
      {selectedProvider === 'yandex' && (
        <YandexMapContainer
          onChangeProvider={handleChangeProvider}
        />
      )}
    </main>
  );
}
