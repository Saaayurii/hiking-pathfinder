'use client';

import { useState } from 'react';
import type { MapProvider, MapProviderConfig } from '@/types/maps';

interface MapProviderSelectorProps {
  onSelect: (provider: MapProvider) => void;
}

export default function MapProviderSelector({ onSelect }: MapProviderSelectorProps) {
  const [selectedProvider, setSelectedProvider] = useState<MapProvider | null>(null);

  const providers: MapProviderConfig[] = [
    {
      id: 'leaflet',
      name: 'OpenStreetMap (Leaflet)',
      description: 'Бесплатная карта с открытыми данными. Лучше всего подходит для туристических маршрутов.',
      available: true,
    },
    {
      id: 'tomtom',
      name: 'TomTom Maps',
      description: 'Профессиональные карты с навигацией, трафиком и детальными POI.',
      apiKey: process.env.NEXT_PUBLIC_TOMTOM_API_KEY,
      available: !!process.env.NEXT_PUBLIC_TOMTOM_API_KEY,
    },
    {
      id: 'yandex',
      name: 'Яндекс.Карты',
      description: 'Подробные карты России и СНГ. Отличная детализация городов.',
      apiKey: process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY,
      available: !!process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY,
    },
  ];

  const handleSelect = (provider: MapProvider) => {
    setSelectedProvider(provider);
    onSelect(provider);
  };

  if (selectedProvider) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-2xl w-full mx-4 p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Hiking Pathfinder
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Выберите картографический сервис для работы
          </p>
        </div>

        <div className="space-y-4">
          {providers.map((provider) => (
            <button
              key={provider.id}
              onClick={() => handleSelect(provider.id)}
              disabled={!provider.available}
              className={`
                w-full text-left p-6 rounded-xl border-2 transition-all
                ${provider.available
                  ? 'border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-400 hover:shadow-lg cursor-pointer bg-white dark:bg-gray-800'
                  : 'border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 cursor-not-allowed opacity-50'
                }
              `}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    {provider.name}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {provider.description}
                  </p>
                  {!provider.available && provider.apiKey !== undefined && (
                    <p className="text-xs text-red-600 mt-2">
                      API ключ не настроен
                    </p>
                  )}
                </div>
                <div className={`
                  ml-4 w-12 h-12 rounded-full flex items-center justify-center
                  ${provider.available ? 'bg-blue-50 dark:bg-blue-900' : 'bg-gray-100 dark:bg-gray-800'}
                `}>
                  {provider.id === 'leaflet' && (
                    <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                    </svg>
                  )}
                  {provider.id === 'yandex' && (
                    <svg className="w-6 h-6 text-red-600" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
                    </svg>
                  )}
                  {provider.id === 'tomtom' && (
                    <svg className="w-6 h-6 text-orange-600" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
                    </svg>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
          <p className="text-sm text-blue-800 dark:text-blue-300">
            <strong>Совет:</strong> Для туристических маршрутов рекомендуем OpenStreetMap -
            там больше всего данных о тропах, препятствиях и рельефе местности.
          </p>
        </div>
      </div>
    </div>
  );
}
