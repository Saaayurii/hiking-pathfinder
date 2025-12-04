'use client';

import { ZONE_COLORS, ZONE_LABELS } from './NatureZonesLayer';

interface NatureZonesToggleProps {
  enabled: boolean;
  onToggle: () => void;
  isLoading?: boolean;
}

export default function NatureZonesToggle({ enabled, onToggle, isLoading }: NatureZonesToggleProps) {
  return (
    <div className="relative">
      <button
        onClick={onToggle}
        disabled={isLoading}
        className={`
          flex items-center gap-2 px-4 py-2 rounded-lg shadow-lg transition-all font-medium text-sm
          ${enabled
            ? 'bg-green-600 hover:bg-green-700 text-white'
            : 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
          }
          ${isLoading ? 'opacity-75 cursor-wait' : ''}
        `}
        title={enabled ? 'Скрыть природные зоны' : 'Показать природные зоны'}
      >
        {isLoading ? (
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )}
        Зоны местности
      </button>

      {/* Legend tooltip when enabled */}
      {enabled && (
        <div className="absolute top-full left-0 mt-2 p-3 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-10 min-w-[160px]">
          <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">Легенда:</div>
          <div className="space-y-1.5">
            {Object.entries(ZONE_LABELS).map(([type, label]) => (
              <div key={type} className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded"
                  style={{
                    backgroundColor: ZONE_COLORS[type as keyof typeof ZONE_COLORS],
                    opacity: 0.7,
                  }}
                />
                <span className="text-xs text-gray-700 dark:text-gray-300">{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
