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
    <div className="bg-white rounded-lg shadow-lg p-4 space-y-4">
      <h3 className="font-bold text-lg border-b pb-2">Статистика маршрута</h3>

      <div className="space-y-3">
        {/* Distance */}
        <div className="flex justify-between items-center">
          <span className="text-black-600">Расстояние:</span>
          <span className="font-semibold text-blue-600">{distanceKm} км</span>
        </div>

        {/* Duration */}
        <div className="flex justify-between items-center">
          <span className="text-black-600">Время:</span>
          <span className="font-semibold text-blue-600">
            {hours > 0 && `${hours} ч `}
            {minutes} мин
          </span>
        </div>

        {/* Average speed */}
        <div className="flex justify-between items-center">
          <span className="text-black-600">Средняя скорость:</span>
          <span className="font-semibold">{avgSpeed.toFixed(1)} км/ч</span>
        </div>

        {/* Elevation stats */}
        {route.elevation && (
          <>
            <div className="border-t pt-3 mt-3">
              <h4 className="font-semibold text-sm mb-2 text-black-700">Высота</h4>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-black-600">Набор высоты:</span>
                  <span className="font-semibold text-green-600">
                    ↑ {Math.round(route.elevation.gain)} м
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-black-600">Сброс высоты:</span>
                  <span className="font-semibold text-red-600">
                    ↓ {Math.round(route.elevation.loss)} м
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-black-600">Макс. высота:</span>
                  <span className="font-semibold">
                    {Math.round(route.elevation.max)} м
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-black-600">Мин. высота:</span>
                  <span className="font-semibold">
                    {Math.round(route.elevation.min)} м
                  </span>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Trail quality */}
        {route.trailQuality && (
          <div className="border-t pt-3 mt-3">
            <h4 className="font-semibold text-sm mb-2 text-black-700">
              Качество троп
            </h4>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-black-600">Видимость:</span>
                <span className="font-semibold capitalize">
                  {route.trailQuality.avgVisibility}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-black-600">Гладкость:</span>
                <span className="font-semibold capitalize">
                  {route.trailQuality.avgSmoothness}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-black-600">Официальные тропы:</span>
                <span className="font-semibold">
                  {Math.round(route.trailQuality.officialPercent)}%
                </span>
              </div>

              {route.trailQuality.avgWidth && (
                <div className="flex justify-between">
                  <span className="text-black-600">Средняя ширина:</span>
                  <span className="font-semibold">
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
