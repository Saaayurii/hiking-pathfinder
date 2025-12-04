/**
 * Интеграционные тесты для проверки всей системы поиска маршрутов
 */

import { describe, it, expect } from '@jest/globals';
import { calculateTerrainCoefficient, DEFAULT_COEFFICIENTS, getCoefficientColor } from '../lib/terrain/coefficients';
import { calculateSlope, getSlopeFactor, isWalkable, classifySlope } from '../lib/terrain/slope';
import { haversineHeuristic } from '../lib/pathfinding/heuristics';
import { createNodeId, parseNodeId } from '../lib/pathfinding/graph';

describe('Система зонирования и коэффициентов проходимости', () => {
  it('должна правильно рассчитывать базовые коэффициенты для разных поверхностей', () => {
    // Отличные условия
    expect(calculateTerrainCoefficient({ surface: 'paved' })).toBe(1.0);
    expect(calculateTerrainCoefficient({ surface: 'asphalt' })).toBe(1.2);

    // Хорошие условия
    expect(calculateTerrainCoefficient({ surface: 'gravel' })).toBe(2.0);
    expect(calculateTerrainCoefficient({ surface: 'path' })).toBe(2.0);

    // Средние условия
    expect(calculateTerrainCoefficient({ surface: 'ground' })).toBe(2.5);
    expect(calculateTerrainCoefficient({ surface: 'grass' })).toBe(3.0);

    // Сложные условия
    expect(calculateTerrainCoefficient({ surface: 'rock' })).toBe(4.5);
    expect(calculateTerrainCoefficient({ surface: 'sand' })).toBe(5.0);

    // Очень сложные условия
    expect(calculateTerrainCoefficient({ surface: 'mud' })).toBe(6.0);

    // Непроходимые
    expect(calculateTerrainCoefficient({ surface: 'water' })).toBe(10.0);
  });

  it('должна применять модификаторы видимости', () => {
    const base = calculateTerrainCoefficient({ surface: 'path' }); // 2.0

    // Отличная видимость - бонус
    const excellent = calculateTerrainCoefficient({
      surface: 'path',
      visibility: 'excellent'
    });
    expect(excellent).toBeLessThan(base);

    // Плохая видимость - штраф
    const bad = calculateTerrainCoefficient({
      surface: 'path',
      visibility: 'bad'
    });
    expect(bad).toBeGreaterThan(base);
  });

  it('должна применять модификаторы гладкости', () => {
    const base = calculateTerrainCoefficient({ surface: 'path' }); // 2.0

    // Отличная гладкость - бонус
    const excellent = calculateTerrainCoefficient({
      surface: 'path',
      smoothness: 'excellent'
    });
    expect(excellent).toBeLessThan(base);

    // Ужасная гладкость - штраф
    const horrible = calculateTerrainCoefficient({
      surface: 'path',
      smoothness: 'horrible'
    });
    expect(horrible).toBeGreaterThan(base);
  });

  it('должна применять штраф для неофициальных троп', () => {
    const official = calculateTerrainCoefficient({
      surface: 'path',
      informal: false
    });

    const unofficial = calculateTerrainCoefficient({
      surface: 'path',
      informal: true
    });

    expect(unofficial).toBeGreaterThan(official);
    expect(unofficial / official).toBeCloseTo(1.3, 1);
  });

  it('должна давать бонус для широких троп', () => {
    const narrow = calculateTerrainCoefficient({
      surface: 'path',
      width: 0.5
    });

    const wide = calculateTerrainCoefficient({
      surface: 'path',
      width: 3.5
    });

    expect(wide).toBeLessThan(narrow);
  });

  it('должна давать бонус для плоской местности', () => {
    const flat = calculateTerrainCoefficient({
      surface: 'path',
      slope: 3
    });

    const steep = calculateTerrainCoefficient({
      surface: 'path',
      slope: 15
    });

    expect(flat).toBeLessThan(steep);
  });

  it('должна ограничивать коэффициент в диапазоне 1.0-10.0', () => {
    // Очень хорошие условия
    const best = calculateTerrainCoefficient({
      surface: 'paved',
      visibility: 'excellent',
      smoothness: 'excellent',
      width: 5.0,
      slope: 2
    });
    expect(best).toBeGreaterThanOrEqual(1.0);

    // Очень плохие условия
    const worst = calculateTerrainCoefficient({
      surface: 'mud',
      visibility: 'no',
      smoothness: 'very_horrible',
      informal: true,
      width: 0.3
    });
    expect(worst).toBeLessThanOrEqual(10.0);
  });

  it('должна правильно определять цвета для коэффициентов', () => {
    expect(getCoefficientColor(1.5)).toBe('#22c55e'); // Green - excellent
    expect(getCoefficientColor(2.5)).toBe('#84cc16'); // Light green - good
    expect(getCoefficientColor(3.5)).toBe('#eab308'); // Yellow - moderate
    expect(getCoefficientColor(4.5)).toBe('#f97316'); // Orange - difficult
    expect(getCoefficientColor(6.0)).toBe('#ef4444'); // Red - very difficult
    expect(getCoefficientColor(8.0)).toBe('#991b1b'); // Dark red - extreme
  });
});

describe('Расчет уклонов и факторов скорости', () => {
  it('должна правильно рассчитывать уклон между точками', () => {
    const flat = calculateSlope(
      { lat: 55.0, lng: 37.0, elevation: 100 },
      { lat: 55.001, lng: 37.0, elevation: 100 }
    );
    expect(flat).toBeCloseTo(0, 1);

    const slope10deg = calculateSlope(
      { lat: 55.0, lng: 37.0, elevation: 0 },
      { lat: 55.001, lng: 37.0, elevation: 19.6 } // ~10 degrees
    );
    expect(slope10deg).toBeGreaterThan(9);
    expect(slope10deg).toBeLessThan(11);
  });

  it('должна правильно классифицировать уклоны', () => {
    expect(classifySlope(3).difficulty).toBe('easy');
    expect(classifySlope(7).difficulty).toBe('easy');
    expect(classifySlope(12).difficulty).toBe('moderate');
    expect(classifySlope(20).difficulty).toBe('difficult');
    expect(classifySlope(30).difficulty).toBe('very_difficult');
    expect(classifySlope(40).difficulty).toBe('extreme');
  });

  it('должна применять фактор Тоблера для подъемов', () => {
    // Пологий подъем
    expect(getSlopeFactor(3, true)).toBe(1.0);

    // Умеренный подъем
    expect(getSlopeFactor(12, true)).toBe(1.8);

    // Крутой подъем (20-25 градусов)
    expect(getSlopeFactor(22, true)).toBe(3.5);

    // Очень крутой подъем
    expect(getSlopeFactor(28, true)).toBe(5.0);
  });

  it('должна применять фактор для спусков', () => {
    // Легкий спуск - самый быстрый
    expect(getSlopeFactor(3, false)).toBe(0.9);

    // Умеренный спуск
    expect(getSlopeFactor(12, false)).toBe(1.2);

    // Крутой спуск (20-25 градусов) - медленнее из-за опасности
    expect(getSlopeFactor(22, false)).toBe(2.0);

    // Очень крутой спуск
    expect(getSlopeFactor(28, false)).toBe(3.0);
  });

  it('должна определять проходимость по уклону', () => {
    expect(isWalkable(10, 35)).toBe(true);
    expect(isWalkable(25, 35)).toBe(true);
    expect(isWalkable(35, 35)).toBe(true);
    expect(isWalkable(40, 35)).toBe(false);
    expect(isWalkable(50, 35)).toBe(false);
  });

  it('должна поддерживать настраиваемый максимальный уклон', () => {
    expect(isWalkable(25, 30)).toBe(true);
    expect(isWalkable(35, 30)).toBe(false);

    expect(isWalkable(25, 20)).toBe(false);
    expect(isWalkable(15, 20)).toBe(true);
  });
});

describe('Алгоритм A* и построение графа', () => {
  it('должна правильно создавать и парсить ID узлов', () => {
    const id = createNodeId(55.751244, 37.618423);
    expect(id).toBe('55.751244,37.618423');

    const parsed = parseNodeId(id);
    expect(parsed.lat).toBeCloseTo(55.751244, 6);
    expect(parsed.lng).toBeCloseTo(37.618423, 6);
  });

  it('должна правильно рассчитывать эвристику Haversine', () => {
    const start = { lat: 55.751244, lng: 37.618423 };
    const end = { lat: 55.755826, lng: 37.617300 };

    const distance = haversineHeuristic(start, end);

    // Расстояние должно быть примерно 510 метров
    expect(distance).toBeGreaterThan(500);
    expect(distance).toBeLessThan(520);
  });

  it('должна возвращать 0 для одинаковых точек', () => {
    const point = { lat: 55.751244, lng: 37.618423 };
    const distance = haversineHeuristic(point, point);
    expect(distance).toBe(0);
  });

  it('должна быть симметричной', () => {
    const p1 = { lat: 55.751244, lng: 37.618423 };
    const p2 = { lat: 55.755826, lng: 37.617300 };

    const d1 = haversineHeuristic(p1, p2);
    const d2 = haversineHeuristic(p2, p1);

    expect(d1).toBeCloseTo(d2, 5);
  });
});

describe('Интеграционный тест: расчет веса ребра', () => {
  it('должна правильно комбинировать все факторы для расчета веса ребра', () => {
    // Сценарий 1: Идеальные условия на плоскости
    const idealCoeff = calculateTerrainCoefficient({
      surface: 'paved',
      visibility: 'excellent',
      smoothness: 'excellent'
    });
    const idealSlope = getSlopeFactor(2, false); // легкий спуск
    const distance = 100; // метров

    const idealWeight = distance * idealCoeff * idealSlope;
    expect(idealWeight).toBeLessThan(100); // Меньше расстояния

    // Сценарий 2: Сложные условия с крутым подъемом
    const hardCoeff = calculateTerrainCoefficient({
      surface: 'rock',
      visibility: 'bad',
      smoothness: 'very_bad',
      informal: true
    });
    const hardSlope = getSlopeFactor(25, true); // крутой подъем

    const hardWeight = distance * hardCoeff * hardSlope;
    expect(hardWeight).toBeGreaterThan(distance * 10); // Намного больше расстояния

    // Вес сложного пути должен быть значительно больше
    expect(hardWeight).toBeGreaterThan(idealWeight * 20);
  });

  it('должна предпочитать обход горы плоским путем', () => {
    const distance = 1000; // метров

    // Вариант 1: Через гору (короче, но крутой подъем)
    const throughMountain = distance * 0.7 * // на 30% короче
      calculateTerrainCoefficient({ surface: 'rock' }) *
      getSlopeFactor(30, true); // очень крутой подъем

    // Вариант 2: Обход горы (длиннее, но плоско и по хорошей тропе)
    const aroundMountain = distance * 1.5 * // на 50% длиннее
      calculateTerrainCoefficient({ surface: 'path' }) *
      getSlopeFactor(3, false); // плоский или легкий спуск

    // Обход должен быть быстрее
    expect(aroundMountain).toBeLessThan(throughMountain);

    console.log('Через гору:', throughMountain.toFixed(0), 'единиц');
    console.log('Обход горы:', aroundMountain.toFixed(0), 'единиц');
  });

  it('должна избегать непроходимых препятствий', () => {
    // Вода - непроходима
    const waterCoeff = calculateTerrainCoefficient({ surface: 'water' });
    expect(waterCoeff).toBe(10.0);

    // Вес ребра через воду должен быть запретительно высоким
    const throughWater = 100 * waterCoeff;
    expect(throughWater).toBe(1000);

    // Обход должен быть предпочтительнее
    const aroundWater = 300 * calculateTerrainCoefficient({ surface: 'path' });
    expect(aroundWater).toBeLessThan(throughWater);
  });
});

describe('Тестирование коэффициентов по умолчанию', () => {
  it('должна содержать все основные типы поверхностей', () => {
    expect(DEFAULT_COEFFICIENTS['paved']).toBeDefined();
    expect(DEFAULT_COEFFICIENTS['gravel']).toBeDefined();
    expect(DEFAULT_COEFFICIENTS['grass']).toBeDefined();
    expect(DEFAULT_COEFFICIENTS['rock']).toBeDefined();
    expect(DEFAULT_COEFFICIENTS['water']).toBeDefined();
    expect(DEFAULT_COEFFICIENTS['unknown']).toBeDefined();
  });

  it('должна иметь правильную иерархию сложности', () => {
    expect(DEFAULT_COEFFICIENTS['paved']).toBeLessThan(DEFAULT_COEFFICIENTS['gravel']);
    expect(DEFAULT_COEFFICIENTS['gravel']).toBeLessThan(DEFAULT_COEFFICIENTS['grass']);
    expect(DEFAULT_COEFFICIENTS['grass']).toBeLessThan(DEFAULT_COEFFICIENTS['rock']);
    expect(DEFAULT_COEFFICIENTS['rock']).toBeLessThan(DEFAULT_COEFFICIENTS['mud']);
    expect(DEFAULT_COEFFICIENTS['mud']).toBeLessThan(DEFAULT_COEFFICIENTS['water']);
  });
});
