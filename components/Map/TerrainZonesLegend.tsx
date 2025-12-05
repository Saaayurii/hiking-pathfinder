'use client';

import { useState } from 'react';
import { getCoefficientColor } from '@/lib/terrain/coefficients';

interface LegendItem {
  label: string;
  coefficient: number;
  color: string;
  description: string;
}

const LEGEND_ITEMS: LegendItem[] = [
  {
    label: 'Асфальт/Тротуар',
    coefficient: 1.0,
    color: getCoefficientColor(1.0),
    description: 'Отличная проходимость, максимальная скорость',
  },
  {
    label: 'Тропа/Дорожка',
    coefficient: 2.0,
    color: getCoefficientColor(2.0),
    description: 'Хорошие условия для пешего хода',
  },
  {
    label: 'Грунт/Трава',
    coefficient: 3.0,
    color: getCoefficientColor(3.0),
    description: 'Средняя проходимость',
  },
  {
    label: 'Лес/Кустарник',
    coefficient: 4.0,
    color: getCoefficientColor(4.0),
    description: 'Затруднённое передвижение',
  },
  {
    label: 'Песок/Камни',
    coefficient: 5.0,
    color: getCoefficientColor(5.0),
    description: 'Сложная местность',
  },
  {
    label: 'Грязь/Снег',
    coefficient: 6.5,
    color: getCoefficientColor(6.5),
    description: 'Очень сложные условия',
  },
  {
    label: 'Болото',
    coefficient: 7.5,
    color: getCoefficientColor(7.5),
    description: 'Крайне труднопроходимо',
  },
  {
    label: 'Вода/Здания',
    coefficient: 10.0,
    color: getCoefficientColor(10.0),
    description: 'Непроходимо',
  },
];

interface TerrainZonesLegendProps {
  className?: string;
  collapsed?: boolean;
}

export default function TerrainZonesLegend({ className = '', collapsed = false }: TerrainZonesLegendProps) {
  const [isExpanded, setIsExpanded] = useState(!collapsed);

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-lg ${className}`}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-3 py-2 flex items-center justify-between text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
      >
        <span className="flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          Зоны проходимости
        </span>
        <svg
          className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <div className="px-3 pb-3 space-y-1">
          {LEGEND_ITEMS.map((item) => (
            <div
              key={item.label}
              className="flex items-center gap-2 text-xs group cursor-help"
              title={item.description}
            >
              <div
                className="w-4 h-4 rounded flex-shrink-0 border border-gray-300 dark:border-gray-600"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-gray-700 dark:text-gray-300 flex-1 truncate">
                {item.label}
              </span>
              <span className="text-gray-500 dark:text-gray-400 font-mono text-[10px]">
                {item.coefficient.toFixed(1)}
              </span>
            </div>
          ))}

          {/* Speed info */}
          <div className="pt-2 mt-2 border-t border-gray-200 dark:border-gray-700">
            <div className="text-[10px] text-gray-500 dark:text-gray-400">
              Коэффициент влияет на скорость:
            </div>
            <div className="text-[10px] text-gray-500 dark:text-gray-400">
              1.0 = 4 км/ч, 2.0 = 2 км/ч, и т.д.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
