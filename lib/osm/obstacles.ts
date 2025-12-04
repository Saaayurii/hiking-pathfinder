/**
 * Улучшенная система обработки препятствий из OpenStreetMap
 * Обрабатывает здания, стены, заборы и другие непроходимые объекты
 */

import type { OverpassElement } from './overpass';

export interface Obstacle {
  id: number;
  type: ObstacleType;
  geometry: Array<{ lat: number; lng: number }>;
  tags: Record<string, string>;
  properties: ObstacleProperties;
}

export type ObstacleType =
  | 'building'
  | 'wall'
  | 'fence'
  | 'hedge'
  | 'water'
  | 'waterway'
  | 'cliff'
  | 'railway'
  | 'construction'
  | 'other';

export interface ObstacleProperties {
  passable: boolean;           // Можно ли пройти
  height?: number;             // Высота препятствия (м)
  width?: number;              // Ширина (м)
  material?: string;           // Материал
  avoidanceDistance: number;   // Расстояние избегания (м)
  penaltyCoefficient: number;  // Штраф за близость
}

/**
 * Извлечь препятствия из OSM данных
 */
export function extractObstacles(
  elements: OverpassElement[],
  nodeMap: Map<number, { lat: number; lng: number }>
): Obstacle[] {
  const obstacles: Obstacle[] = [];

  for (const element of elements) {
    if (element.type === 'way' && element.nodes) {
      const obstacle = classifyObstacle(element, nodeMap);
      if (obstacle) {
        obstacles.push(obstacle);
      }
    }
    // Обработка relations для сложных зданий
    else if (element.type === 'relation' && element.members) {
      const obstacleFromRelation = processRelation(element, nodeMap, elements);
      if (obstacleFromRelation) {
        obstacles.push(obstacleFromRelation);
      }
    }
  }

  return obstacles;
}

/**
 * Классифицировать препятствие по тегам
 */
function classifyObstacle(
  element: OverpassElement,
  nodeMap: Map<number, { lat: number; lng: number }>
): Obstacle | null {
  const tags = element.tags || {};
  const geometry = getGeometry(element, nodeMap);

  if (geometry.length < 2) return null;

  // Здания
  if (tags.building) {
    return {
      id: element.id,
      type: 'building',
      geometry,
      tags,
      properties: {
        passable: false,
        height: parseHeight(tags.height || tags['building:levels']),
        avoidanceDistance: 2, // 2 метра от стен
        penaltyCoefficient: 100.0, // Очень высокий штраф
      },
    };
  }

  // Стены
  if (tags.barrier === 'wall' || tags.barrier === 'city_wall' || tags.barrier === 'retaining_wall') {
    return {
      id: element.id,
      type: 'wall',
      geometry,
      tags,
      properties: {
        passable: false,
        height: parseHeight(tags.height),
        material: tags.material,
        avoidanceDistance: 1,
        penaltyCoefficient: 100.0,
      },
    };
  }

  // Заборы
  if (tags.barrier === 'fence') {
    return {
      id: element.id,
      type: 'fence',
      geometry,
      tags,
      properties: {
        passable: false,
        height: parseHeight(tags.height, 2.0), // По умолчанию 2м
        material: tags.material,
        avoidanceDistance: 0.5,
        penaltyCoefficient: 50.0,
      },
    };
  }

  // Живые изгороди
  if (tags.barrier === 'hedge') {
    return {
      id: element.id,
      type: 'hedge',
      geometry,
      tags,
      properties: {
        passable: false,
        height: parseHeight(tags.height, 1.5),
        avoidanceDistance: 0.5,
        penaltyCoefficient: 30.0,
      },
    };
  }

  // Вода и водоемы
  if (tags.natural === 'water' || tags.landuse === 'reservoir' || tags.landuse === 'basin') {
    return {
      id: element.id,
      type: 'water',
      geometry,
      tags,
      properties: {
        passable: false,
        avoidanceDistance: 5,
        penaltyCoefficient: 100.0,
      },
    };
  }

  // Реки и ручьи
  if (tags.waterway) {
    const width = parseWidth(tags.width);
    return {
      id: element.id,
      type: 'waterway',
      geometry,
      tags,
      properties: {
        passable: width < 2, // Узкие ручьи можно перепрыгнуть
        width,
        avoidanceDistance: width / 2,
        penaltyCoefficient: width < 2 ? 5.0 : 100.0,
      },
    };
  }

  // Обрывы и скалы
  if (tags.natural === 'cliff') {
    return {
      id: element.id,
      type: 'cliff',
      geometry,
      tags,
      properties: {
        passable: false,
        height: parseHeight(tags.height, 10.0),
        avoidanceDistance: 10,
        penaltyCoefficient: 100.0,
      },
    };
  }

  // Железные дороги
  if (tags.railway && !['abandoned', 'disused', 'razed'].includes(tags.railway)) {
    return {
      id: element.id,
      type: 'railway',
      geometry,
      tags,
      properties: {
        passable: false, // Опасно переходить
        avoidanceDistance: 10,
        penaltyCoefficient: 80.0,
      },
    };
  }

  // Строительство
  if (tags.landuse === 'construction' || tags.construction) {
    return {
      id: element.id,
      type: 'construction',
      geometry,
      tags,
      properties: {
        passable: false,
        avoidanceDistance: 5,
        penaltyCoefficient: 50.0,
      },
    };
  }

  return null;
}

/**
 * Обработать relation (сложные здания, мультиполигоны)
 */
function processRelation(
  relation: OverpassElement,
  nodeMap: Map<number, { lat: number; lng: number }>,
  allElements: OverpassElement[]
): Obstacle | null {
  const tags = relation.tags || {};

  // Здания из relations
  if (tags.building || tags.type === 'building') {
    // Собираем геометрию из всех outer ways
    const geometry: Array<{ lat: number; lng: number }> = [];

    if (relation.members) {
      for (const member of relation.members) {
        if (member.role === 'outer' && member.type === 'way') {
          const way = allElements.find(e => e.id === member.ref && e.type === 'way');
          if (way) {
            const wayGeom = getGeometry(way, nodeMap);
            geometry.push(...wayGeom);
          }
        }
      }
    }

    if (geometry.length < 3) return null;

    return {
      id: relation.id,
      type: 'building',
      geometry,
      tags,
      properties: {
        passable: false,
        height: parseHeight(tags.height || tags['building:levels']),
        avoidanceDistance: 2,
        penaltyCoefficient: 100.0,
      },
    };
  }

  return null;
}

/**
 * Получить геометрию элемента
 */
function getGeometry(
  element: OverpassElement,
  nodeMap: Map<number, { lat: number; lng: number }>
): Array<{ lat: number; lng: number }> {
  const geometry: Array<{ lat: number; lng: number }> = [];

  if (element.type === 'way' && element.nodes) {
    for (const nodeId of element.nodes) {
      const node = nodeMap.get(nodeId);
      if (node) {
        geometry.push(node);
      }
    }
  }

  return geometry;
}

/**
 * Парсить высоту из строки
 */
function parseHeight(value: string | undefined, defaultValue: number = 3.0): number {
  if (!value) return defaultValue;

  // "5 m" или "5m"
  const match = value.match(/(\d+(?:\.\d+)?)\s*m/);
  if (match) {
    return parseFloat(match[1]);
  }

  // Количество этажей: "building:levels"="3"
  const levels = parseInt(value, 10);
  if (!isNaN(levels)) {
    return levels * 3.0; // Средняя высота этажа 3м
  }

  return defaultValue;
}

/**
 * Парсить ширину
 */
function parseWidth(value: string | undefined): number {
  if (!value) return 0;

  const match = value.match(/(\d+(?:\.\d+)?)\s*m/);
  if (match) {
    return parseFloat(match[1]);
  }

  const width = parseFloat(value);
  return isNaN(width) ? 0 : width;
}

/**
 * Проверить пересечение пути с препятствием
 */
export function doesPathIntersectObstacle(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  obstacle: Obstacle
): boolean {
  // Для полигонов (здания, водоемы) проверяем пересечение линии с полигоном
  if (obstacle.geometry.length > 2 &&
      obstacle.geometry[0].lat === obstacle.geometry[obstacle.geometry.length - 1].lat &&
      obstacle.geometry[0].lng === obstacle.geometry[obstacle.geometry.length - 1].lng) {
    return lineIntersectsPolygon(from, to, obstacle.geometry);
  }

  // Для линий (стены, заборы) проверяем пересечение двух линий
  for (let i = 0; i < obstacle.geometry.length - 1; i++) {
    if (linesIntersect(from, to, obstacle.geometry[i], obstacle.geometry[i + 1])) {
      return true;
    }
  }

  return false;
}

/**
 * Проверка пересечения двух отрезков
 */
function linesIntersect(
  a1: { lat: number; lng: number },
  a2: { lat: number; lng: number },
  b1: { lat: number; lng: number },
  b2: { lat: number; lng: number }
): boolean {
  const det = (a2.lng - a1.lng) * (b2.lat - b1.lat) - (a2.lat - a1.lat) * (b2.lng - b1.lng);

  if (det === 0) return false; // Параллельные линии

  const lambda = ((b2.lat - b1.lat) * (b2.lng - a1.lng) + (b1.lng - b2.lng) * (b2.lat - a1.lat)) / det;
  const gamma = ((a1.lat - a2.lat) * (b2.lng - a1.lng) + (a2.lng - a1.lng) * (b2.lat - a1.lat)) / det;

  return (lambda >= 0 && lambda <= 1) && (gamma >= 0 && gamma <= 1);
}

/**
 * Проверка пересечения линии с полигоном
 */
function lineIntersectsPolygon(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  polygon: Array<{ lat: number; lng: number }>
): boolean {
  // Проверяем пересечение с каждым ребром полигона
  for (let i = 0; i < polygon.length - 1; i++) {
    if (linesIntersect(from, to, polygon[i], polygon[i + 1])) {
      return true;
    }
  }

  return false;
}

/**
 * Получить расстояние от точки до препятствия
 */
export function distanceToObstacle(
  point: { lat: number; lng: number },
  obstacle: Obstacle
): number {
  let minDistance = Infinity;

  for (let i = 0; i < obstacle.geometry.length - 1; i++) {
    const dist = distanceToLineSegment(point, obstacle.geometry[i], obstacle.geometry[i + 1]);
    minDistance = Math.min(minDistance, dist);
  }

  return minDistance;
}

/**
 * Расстояние от точки до отрезка (в метрах)
 */
function distanceToLineSegment(
  point: { lat: number; lng: number },
  lineStart: { lat: number; lng: number },
  lineEnd: { lat: number; lng: number }
): number {
  const A = point.lng - lineStart.lng;
  const B = point.lat - lineStart.lat;
  const C = lineEnd.lng - lineStart.lng;
  const D = lineEnd.lat - lineStart.lat;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = -1;

  if (lenSq !== 0) {
    param = dot / lenSq;
  }

  let xx, yy;

  if (param < 0) {
    xx = lineStart.lng;
    yy = lineStart.lat;
  } else if (param > 1) {
    xx = lineEnd.lng;
    yy = lineEnd.lat;
  } else {
    xx = lineStart.lng + param * C;
    yy = lineStart.lat + param * D;
  }

  const dx = point.lng - xx;
  const dy = point.lat - yy;

  // Конвертация в метры
  const metersPerDegreeLat = 111000;
  const metersPerDegreeLng = 111000 * Math.cos((point.lat * Math.PI) / 180);

  const dxMeters = dx * metersPerDegreeLng;
  const dyMeters = dy * metersPerDegreeLat;

  return Math.sqrt(dxMeters * dxMeters + dyMeters * dyMeters);
}
