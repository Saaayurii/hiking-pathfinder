'use client';

import { useState, useEffect } from 'react';
import type { Route } from '@/types/route';

interface RouteHistoryProps {
  onLoadRoute?: (route: Route) => void;
  onClose: () => void;
}

interface SavedRoute {
  id: string;
  name: string;
  distance: number;
  duration: number;
  createdAt: Date;
  start: { lat: number; lng: number };
  end: { lat: number; lng: number };
}

export default function RouteHistory({ onLoadRoute, onClose }: RouteHistoryProps) {
  const [routes, setRoutes] = useState<SavedRoute[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchRoutes();
  }, []);

  const fetchRoutes = async () => {
    try {
      const response = await fetch('/api/routes');
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Ошибка загрузки маршрутов');
      }

      setRoutes(data.routes || []);
    } catch (err) {
      console.error('Failed to fetch routes:', err);
      setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoad = async (id: string) => {
    try {
      const response = await fetch(`/api/routes?id=${id}`);
      const data = await response.json();

      if (!data.success || !data.route) {
        throw new Error(data.error || 'Ошибка загрузки маршрута');
      }

      onLoadRoute?.(data.route);
      onClose();
    } catch (err) {
      console.error('Failed to load route:', err);
      alert(err instanceof Error ? err.message : 'Ошибка загрузки маршрута');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить этот маршрут?')) {
      return;
    }

    setDeletingId(id);

    try {
      const response = await fetch(`/api/routes?id=${id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Ошибка удаления');
      }

      setRoutes(routes.filter((r) => r.id !== id));
    } catch (err) {
      console.error('Failed to delete route:', err);
      alert(err instanceof Error ? err.message : 'Ошибка удаления маршрута');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[3000] bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-bold">История маршрутов</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-6 h-6 text-black-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading && (
            <div className="text-center py-12 text-gray-500">
              Загрузка маршрутов...
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {!isLoading && !error && routes.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="font-medium mb-1">Нет сохранённых маршрутов</p>
              <p className="text-sm">Сохраните маршрут, чтобы он появился здесь</p>
            </div>
          )}

          {!isLoading && !error && routes.length > 0 && (
            <div className="space-y-3">
              {routes.map((route) => (
                <div
                  key={route.id}
                  className="bg-white border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-lg mb-2 truncate">{route.name}</h3>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-black-600">
                        <div>
                          <span className="text-gray-500">Расстояние:</span>{' '}
                          <span className="font-medium">{(route.distance / 1000).toFixed(2)} км</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Время:</span>{' '}
                          <span className="font-medium">
                            {Math.floor(route.duration / 3600) > 0 && `${Math.floor(route.duration / 3600)} ч `}
                            {Math.floor((route.duration % 3600) / 60)} мин
                          </span>
                        </div>
                        <div className="col-span-2 text-xs text-gray-400 mt-1">
                          {new Date(route.createdAt).toLocaleString('ru-RU', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleLoad(route.id)}
                        className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium"
                      >
                        Загрузить
                      </button>
                      <button
                        onClick={() => handleDelete(route.id)}
                        disabled={deletingId === route.id}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                        title="Удалить"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
