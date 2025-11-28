'use client';

import { useState } from 'react';
import type { Route } from '@/types/route';

interface SaveRouteDialogProps {
  route: Route;
  onSave?: (savedRoute: Route & { id: string }) => void;
  onClose: () => void;
}

export default function SaveRouteDialog({ route, onSave, onClose }: SaveRouteDialogProps) {
  const [name, setName] = useState(route.name || 'Новый маршрут');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Введите название маршрута');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch('/api/routes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...route,
          name: name.trim(),
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Ошибка при сохранении');
      }

      onSave?.({ ...route, id: data.id, name: name.trim() });
      onClose();
    } catch (err) {
      console.error('Failed to save route:', err);
      setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[3000] bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6">
        <h2 className="text-xl font-bold mb-4">Сохранить маршрут</h2>

        <div className="space-y-4">
          {/* Name input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Название маршрута
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Введите название..."
              autoFocus
            />
          </div>

          {/* Route info */}
          <div className="bg-gray-50 p-3 rounded-lg text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-600">Расстояние:</span>
              <span className="font-medium">{(route.distance / 1000).toFixed(2)} км</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Время:</span>
              <span className="font-medium">
                {Math.floor(route.duration / 3600) > 0 && `${Math.floor(route.duration / 3600)} ч `}
                {Math.floor((route.duration % 3600) / 60)} мин
              </span>
            </div>
            {route.elevation && (
              <div className="flex justify-between">
                <span className="text-gray-600">Набор высоты:</span>
                <span className="font-medium">{Math.round(route.elevation.gain)} м</span>
              </div>
            )}
          </div>

          {/* Error message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              disabled={isSaving}
              className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-400 text-gray-700 rounded-lg transition-colors font-medium"
            >
              Отмена
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || !name.trim()}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg transition-colors font-medium"
            >
              {isSaving ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
