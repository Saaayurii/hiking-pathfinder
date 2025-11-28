'use client';

import { useState } from 'react';

interface TerrainType {
  type: string;
  label: string;
  color: string;
  description: string;
  passable: boolean;
}

const TERRAIN_TYPES: TerrainType[] = [
  {
    type: 'building',
    label: 'Здания',
    color: '#8B4513',
    description: 'Непроходимые объекты',
    passable: false,
  },
  {
    type: 'water',
    label: 'Водоёмы',
    color: '#1E90FF',
    description: 'Реки, озёра, каналы',
    passable: false,
  },
  {
    type: 'barrier',
    label: 'Барьеры',
    color: '#696969',
    description: 'Заборы, стены',
    passable: false,
  },
  {
    type: 'railway',
    label: 'Ж/Д пути',
    color: '#2F4F4F',
    description: 'Железная дорога',
    passable: false,
  },
  {
    type: 'path',
    label: 'Тропы',
    color: '#FFD700',
    description: 'Лёгкая проходимость',
    passable: true,
  },
  {
    type: 'road',
    label: 'Дороги',
    color: '#D3D3D3',
    description: 'Обычная проходимость',
    passable: true,
  },
  {
    type: 'grassland',
    label: 'Луга',
    color: '#90EE90',
    description: 'Лёгкая проходимость',
    passable: true,
  },
  {
    type: 'forest',
    label: 'Леса',
    color: '#228B22',
    description: 'Средняя сложность',
    passable: true,
  },
  {
    type: 'scrub',
    label: 'Кустарники',
    color: '#6B8E23',
    description: 'Сложная проходимость',
    passable: true,
  },
  {
    type: 'rock',
    label: 'Скалы',
    color: '#A9A9A9',
    description: 'Очень сложная',
    passable: true,
  },
];

export default function TerrainLegend() {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="absolute bottom-4 left-4 z-[1000] bg-white rounded-lg shadow-lg max-w-xs">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 rounded-lg transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg
            className="w-5 h-5 text-gray-700"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
            />
          </svg>
          <span className="font-semibold text-sm text-gray-900">Типы местности</span>
        </div>
        <svg
          className={`w-4 h-4 text-gray-500 transition-transform ${
            isExpanded ? 'rotate-180' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Legend items */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-2 max-h-96 overflow-y-auto">
          {/* Непроходимые */}
          <div className="pt-2 border-t">
            <h4 className="text-xs font-semibold text-red-600 mb-2">Непроходимые</h4>
            {TERRAIN_TYPES.filter(t => !t.passable).map(terrain => (
              <div key={terrain.type} className="flex items-center gap-2 py-1">
                <div
                  className="w-4 h-4 rounded flex-shrink-0 border border-gray-300"
                  style={{ backgroundColor: terrain.color }}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-gray-900">{terrain.label}</div>
                  <div className="text-xs text-gray-500">{terrain.description}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Проходимые */}
          <div className="pt-2 border-t">
            <h4 className="text-xs font-semibold text-green-600 mb-2">Проходимые</h4>
            {TERRAIN_TYPES.filter(t => t.passable).map(terrain => (
              <div key={terrain.type} className="flex items-center gap-2 py-1">
                <div
                  className="w-4 h-4 rounded flex-shrink-0 border border-gray-300"
                  style={{ backgroundColor: terrain.color }}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-gray-900">{terrain.label}</div>
                  <div className="text-xs text-gray-500">{terrain.description}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
