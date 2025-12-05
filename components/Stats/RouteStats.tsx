'use client';

import type { Route } from '@/types/route';

interface RouteStatsProps {
  route: Route | null;
}

export default function RouteStats({ route }: RouteStatsProps) {
  if (!route) {
    return null;
  }

  // Format distance
  const distanceKm = (route.distance / 1000).toFixed(2);

  // Format duration
  const hours = Math.floor(route.duration / 3600);
  const minutes = Math.floor((route.duration % 3600) / 60);

  // Calculate average speed
  const avgSpeed = route.duration > 0 ? (route.distance / 1000) / (route.duration / 3600) : 0;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 space-y-4">
      <h3 className="font-bold text-lg border-b dark:border-gray-700 pb-2 text-gray-900 dark:text-white">Статистика маршрута</h3>

      <div className="space-y-3">
        {/* Distance */}
        <div className="flex justify-between items-center">
          <span className="text-gray-600 dark:text-gray-400">Расстояние:</span>
          <span className="font-semibold text-blue-600 dark:text-blue-400">{distanceKm} км</span>
        </div>

        {/* Duration */}
        <div className="flex justify-between items-center">
          <span className="text-gray-600 dark:text-gray-400">Время:</span>
          <span className="font-semibold text-blue-600 dark:text-blue-400">
            {hours > 0 && `${hours} ч `}
            {minutes} мин
          </span>
        </div>

        {/* Average speed */}
        <div className="flex justify-between items-center">
          <span className="text-gray-600 dark:text-gray-400">Средняя скорость:</span>
          <span className="font-semibold text-gray-900 dark:text-white">{avgSpeed.toFixed(1)} км/ч</span>
        </div>

        {/* Elevation stats */}
        {route.elevation && (
          <>
            <div className="border-t dark:border-gray-700 pt-3 mt-3">
              <h4 className="font-semibold text-sm mb-2 text-gray-700 dark:text-gray-300">Высота</h4>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Набор высоты:</span>
                  <span className="font-semibold text-green-600 dark:text-green-400">
                    ↑ {Math.round(route.elevation.gain)} м
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Сброс высоты:</span>
                  <span className="font-semibold text-red-600 dark:text-red-400">
                    ↓ {Math.round(route.elevation.loss)} м
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Макс. высота:</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {Math.round(route.elevation.max)} м
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Мин. высота:</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {Math.round(route.elevation.min)} м
                  </span>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Trail quality */}
        {route.trailQuality && (
          <div className="border-t dark:border-gray-700 pt-3 mt-3">
            <h4 className="font-semibold text-sm mb-2 text-gray-700 dark:text-gray-300">
              Качество троп
            </h4>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Видимость:</span>
                <span className="font-semibold capitalize text-gray-900 dark:text-white">
                  {route.trailQuality.avgVisibility}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Гладкость:</span>
                <span className="font-semibold capitalize text-gray-900 dark:text-white">
                  {route.trailQuality.avgSmoothness}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Официальные тропы:</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {Math.round(route.trailQuality.officialPercent)}%
                </span>
              </div>

              {route.trailQuality.avgWidth && (
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Средняя ширина:</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {route.trailQuality.avgWidth.toFixed(1)} м
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
