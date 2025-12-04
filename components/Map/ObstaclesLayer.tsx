'use client';

import { useEffect, useState } from 'react';
import { Polygon, Polyline, Popup, useMap } from 'react-leaflet';
import type { Obstacle } from '@/lib/osm/obstacles';

interface ObstaclesLayerProps {
  obstacles: Obstacle[];
  visible?: boolean;
}

export default function ObstaclesLayer({ obstacles, visible = true }: ObstaclesLayerProps) {
  const map = useMap();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !visible) {
    return null;
  }

  return (
    <>
      {obstacles.map((obstacle) => {
        const positions = obstacle.geometry.map(p => [p.lat, p.lng] as [number, number]);
        const isPolygon = positions.length > 2 &&
          positions[0][0] === positions[positions.length - 1][0] &&
          positions[0][1] === positions[positions.length - 1][1];

        const color = getObstacleColor(obstacle.type);
        const fillOpacity = obstacle.properties.passable ? 0.1 : 0.3;

        return isPolygon ? (
          <Polygon
            key={`obstacle-${obstacle.id}`}
            positions={positions}
            pathOptions={{
              color,
              fillColor: color,
              fillOpacity,
              weight: 2,
            }}
          >
            <Popup>
              <div className="text-sm">
                <strong>{getObstacleTitle(obstacle.type)}</strong>
                <div className="mt-1 space-y-1">
                  <div>Проходимо: {obstacle.properties.passable ? 'Да' : 'Нет'}</div>
                  {obstacle.properties.height && (
                    <div>Высота: {obstacle.properties.height} м</div>
                  )}
                  {obstacle.properties.width && (
                    <div>Ширина: {obstacle.properties.width} м</div>
                  )}
                  {obstacle.properties.material && (
                    <div>Материал: {obstacle.properties.material}</div>
                  )}
                  <div className="text-xs text-gray-500 mt-2">
                    ID: {obstacle.id}
                  </div>
                </div>
              </div>
            </Popup>
          </Polygon>
        ) : (
          <Polyline
            key={`obstacle-${obstacle.id}`}
            positions={positions}
            pathOptions={{
              color,
              weight: 3,
              opacity: 0.8,
            }}
          >
            <Popup>
              <div className="text-sm">
                <strong>{getObstacleTitle(obstacle.type)}</strong>
                <div className="mt-1 space-y-1">
                  <div>Проходимо: {obstacle.properties.passable ? 'Да' : 'Нет'}</div>
                  {obstacle.properties.height && (
                    <div>Высота: {obstacle.properties.height} м</div>
                  )}
                  {obstacle.properties.width && (
                    <div>Ширина: {obstacle.properties.width} м</div>
                  )}
                  {obstacle.properties.material && (
                    <div>Материал: {obstacle.properties.material}</div>
                  )}
                  <div className="text-xs text-gray-500 mt-2">
                    ID: {obstacle.id}
                  </div>
                </div>
              </div>
            </Popup>
          </Polyline>
        );
      })}
    </>
  );
}

function getObstacleColor(type: Obstacle['type']): string {
  switch (type) {
    case 'building':
      return '#8B4513'; // Коричневый
    case 'wall':
      return '#696969'; // Серый
    case 'fence':
      return '#A9A9A9'; // Светло-серый
    case 'hedge':
      return '#228B22'; // Зеленый
    case 'water':
      return '#1E90FF'; // Синий
    case 'waterway':
      return '#00BFFF'; // Голубой
    case 'cliff':
      return '#B22222'; // Красный
    case 'railway':
      return '#000000'; // Черный
    case 'construction':
      return '#FFD700'; // Золотой
    default:
      return '#808080'; // Серый
  }
}

function getObstacleTitle(type: Obstacle['type']): string {
  switch (type) {
    case 'building':
      return 'Здание';
    case 'wall':
      return 'Стена';
    case 'fence':
      return 'Забор';
    case 'hedge':
      return 'Живая изгородь';
    case 'water':
      return 'Водоем';
    case 'waterway':
      return 'Водоток';
    case 'cliff':
      return 'Обрыв';
    case 'railway':
      return 'Железная дорога';
    case 'construction':
      return 'Стройка';
    default:
      return 'Препятствие';
  }
}
