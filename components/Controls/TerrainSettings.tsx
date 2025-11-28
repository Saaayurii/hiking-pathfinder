'use client';

import { useState } from 'react';
import { DEFAULT_COEFFICIENTS, getCoefficientColor, getCoefficientLabel } from '@/lib/terrain/coefficients';
import type { TerrainCoefficients } from '@/types/terrain';

interface TerrainSettingsProps {
  onCoefficientsChange?: (coefficients: TerrainCoefficients) => void;
  onClose?: () => void;
}

export default function TerrainSettings({ onCoefficientsChange, onClose }: TerrainSettingsProps) {
  const [coefficients, setCoefficients] = useState<TerrainCoefficients>(DEFAULT_COEFFICIENTS);
  const [isOpen, setIsOpen] = useState(false);

  const handleCoefficientChange = (surface: string, value: number) => {
    const newCoefficients = { ...coefficients, [surface]: value };
    setCoefficients(newCoefficients);
    onCoefficientsChange?.(newCoefficients);
  };

  const handleReset = () => {
    setCoefficients(DEFAULT_COEFFICIENTS);
    onCoefficientsChange?.(DEFAULT_COEFFICIENTS);
  };

  const handleToggle = () => {
    setIsOpen(!isOpen);
  };

  const surfaceGroups = {
    'Отличные покрытия': ['paved', 'asphalt'],
    'Хорошие покрытия': ['gravel', 'compacted', 'path'],
    'Средние покрытия': ['ground', 'dirt', 'grass', 'earth'],
    'Сложные покрытия': ['rock', 'pebblestone', 'sand'],
    'Очень сложные': ['mud', 'snow'],
    'Препятствия': ['wetland', 'water', 'forest'],
  };

  const surfaceLabels: Record<string, string> = {
    paved: 'Асфальт',
    asphalt: 'Асфальт (гладкий)',
    gravel: 'Гравий',
    compacted: 'Уплотнённый грунт',
    path: 'Тропа',
    ground: 'Грунт',
    dirt: 'Грязь',
    grass: 'Трава',
    earth: 'Земля',
    rock: 'Скалы',
    pebblestone: 'Галька',
    sand: 'Песок',
    mud: 'Болото',
    snow: 'Снег',
    wetland: 'Заболоченность',
    water: 'Вода',
    forest: 'Лес',
    unknown: 'Неизвестно',
  };

  return (
    <div className="bg-white rounded-lg shadow-lg">
      {/* Toggle button */}
      <button
        onClick={handleToggle}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors rounded-lg"
      >
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
          </svg>
          <span className="font-semibold text-gray-800">Настройки проходимости</span>
        </div>
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Settings panel */}
      {isOpen && (
        <div className="border-t p-4 max-h-96 overflow-y-auto">
          <div className="space-y-4">
            {/* Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
              <p className="text-blue-800">
                Коэффициенты определяют сложность прохождения различных типов поверхностей.
                <br />
                <strong>1.0</strong> - легко, <strong>10.0</strong> - непроходимо.
              </p>
            </div>

            {/* Surface groups */}
            {Object.entries(surfaceGroups).map(([groupName, surfaces]) => (
              <div key={groupName} className="space-y-2">
                <h4 className="font-semibold text-sm text-gray-700">{groupName}</h4>
                <div className="space-y-3">
                  {surfaces.map((surface) => {
                    const value = coefficients[surface] || 3.5;
                    return (
                      <div key={surface} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="text-sm text-gray-600">
                            {surfaceLabels[surface] || surface}
                          </label>
                          <div className="flex items-center gap-2">
                            <span
                              className="px-2 py-1 rounded text-xs font-semibold text-white"
                              style={{ backgroundColor: getCoefficientColor(value) }}
                            >
                              {value.toFixed(1)}
                            </span>
                          </div>
                        </div>
                        <input
                          type="range"
                          min="1.0"
                          max="10.0"
                          step="0.1"
                          value={value}
                          onChange={(e) => handleCoefficientChange(surface, parseFloat(e.target.value))}
                          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                          style={{
                            background: `linear-gradient(to right, ${getCoefficientColor(1.0)} 0%, ${getCoefficientColor(5.5)} 50%, ${getCoefficientColor(10.0)} 100%)`,
                          }}
                        />
                        <div className="text-xs text-gray-500">
                          {getCoefficientLabel(value)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Actions */}
            <div className="flex gap-2 pt-4 border-t">
              <button
                onClick={handleReset}
                className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors font-medium text-sm"
              >
                Сбросить
              </button>
              <button
                onClick={() => {
                  setIsOpen(false);
                  onClose?.();
                }}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium text-sm"
              >
                Применить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
