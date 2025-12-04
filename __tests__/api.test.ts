/**
 * API тесты для проверки эндпоинтов
 */

import { describe, it, expect } from '@jest/globals';

const API_BASE = process.env.API_URL || 'http://localhost:3000';

describe('API /api/pathfinding', () => {
  it('должен возвращать маршрут для валидных координат', async () => {
    const response = await fetch(`${API_BASE}/api/pathfinding`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        start: { lat: 55.751244, lng: 37.618423 },
        end: { lat: 55.755826, lng: 37.617300 }
      })
    });

    expect(response.ok).toBe(true);
    const data = await response.json();

    expect(data).toHaveProperty('success');
    expect(data.success).toBe(true);
    expect(data).toHaveProperty('route');
    expect(data.route).toHaveProperty('path');
    expect(data.route).toHaveProperty('distance');
    expect(data.route).toHaveProperty('duration');
    expect(Array.isArray(data.route.path)).toBe(true);
    expect(data.route.path.length).toBeGreaterThan(0);
  }, 60000);

  it('должен возвращать ошибку для невалидных координат', async () => {
    const response = await fetch(`${API_BASE}/api/pathfinding`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        start: { lat: 'invalid', lng: 37.618423 },
        end: { lat: 55.755826, lng: 37.617300 }
      })
    });

    expect(response.ok).toBe(false);
  });

  it('должен возвращать путь с данными высот', async () => {
    const response = await fetch(`${API_BASE}/api/pathfinding`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        start: { lat: 55.751244, lng: 37.618423 },
        end: { lat: 55.755826, lng: 37.617300 }
      })
    });

    const data = await response.json();
    expect(data.success).toBe(true);

    // Проверяем что каждая точка пути имеет высоту
    data.route.path.forEach((point: any) => {
      expect(point).toHaveProperty('lat');
      expect(point).toHaveProperty('lng');
      expect(point).toHaveProperty('elevation');
      expect(typeof point.elevation).toBe('number');
    });
  }, 60000);

  it('должен рассчитывать расстояние и время прохождения', async () => {
    const response = await fetch(`${API_BASE}/api/pathfinding`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        start: { lat: 55.751244, lng: 37.618423 },
        end: { lat: 55.755826, lng: 37.617300 }
      })
    });

    const data = await response.json();
    expect(data.success).toBe(true);

    expect(data.route.distance).toBeGreaterThan(0);
    expect(data.route.duration).toBeGreaterThan(0);

    // Расстояние должно быть в разумных пределах (примерно 500м)
    expect(data.route.distance).toBeGreaterThan(400);
    expect(data.route.distance).toBeLessThan(2000);

    // Время должно быть разумным (примерно 8-10 минут пешком)
    expect(data.route.duration).toBeGreaterThan(300); // > 5 мин
    expect(data.route.duration).toBeLessThan(3600); // < 1 час
  }, 60000);
});

describe('API /api/elevation', () => {
  it('должен возвращать данные высот для точки', async () => {
    const response = await fetch(
      `${API_BASE}/api/elevation?lat=55.751244&lng=37.618423`,
      { method: 'GET' }
    );

    expect(response.ok).toBe(true);
    const data = await response.json();

    expect(data).toHaveProperty('elevation');
    expect(typeof data.elevation).toBe('number');
  }, 30000);

  it('должен возвращать данные высот для массива точек', async () => {
    const points = [
      { lat: 55.751244, lng: 37.618423 },
      { lat: 55.755826, lng: 37.617300 }
    ];

    const response = await fetch(`${API_BASE}/api/elevation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locations: points })
    });

    expect(response.ok).toBe(true);
    const data = await response.json();

    expect(Array.isArray(data.results)).toBe(true);
    expect(data.results.length).toBe(points.length);

    data.results.forEach((result: any) => {
      expect(result).toHaveProperty('latitude');
      expect(result).toHaveProperty('longitude');
      expect(result).toHaveProperty('elevation');
      expect(typeof result.elevation).toBe('number');
    });
  }, 30000);
});

describe('API /api/osm', () => {
  it('должен возвращать OSM данные для области', async () => {
    const bbox = {
      north: 55.756,
      south: 55.751,
      east: 37.620,
      west: 37.616
    };

    const response = await fetch(
      `${API_BASE}/api/osm?north=${bbox.north}&south=${bbox.south}&east=${bbox.east}&west=${bbox.west}`,
      { method: 'GET' }
    );

    expect(response.ok).toBe(true);
    const data = await response.json();

    expect(data).toHaveProperty('elements');
    expect(Array.isArray(data.elements)).toBe(true);
  }, 30000);
});

describe('API /api/routes (CRUD)', () => {
  let testRouteId: string;

  it('должен создавать новый маршрут', async () => {
    const newRoute = {
      name: 'Test Route',
      start: { lat: 55.751244, lng: 37.618423 },
      end: { lat: 55.755826, lng: 37.617300 },
      path: [
        { lat: 55.751244, lng: 37.618423, elevation: 150 },
        { lat: 55.753535, lng: 37.617862, elevation: 155 },
        { lat: 55.755826, lng: 37.617300, elevation: 160 }
      ],
      distance: 600,
      duration: 540
    };

    const response = await fetch(`${API_BASE}/api/routes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newRoute)
    });

    expect(response.ok).toBe(true);
    const data = await response.json();

    expect(data).toHaveProperty('id');
    expect(data.name).toBe(newRoute.name);
    expect(data.distance).toBe(newRoute.distance);

    testRouteId = data.id;
  });

  it('должен получать список всех маршрутов', async () => {
    const response = await fetch(`${API_BASE}/api/routes`, {
      method: 'GET'
    });

    expect(response.ok).toBe(true);
    const data = await response.json();

    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
  });

  it('должен получать конкретный маршрут по ID', async () => {
    if (!testRouteId) {
      console.log('Skipping test: no route ID');
      return;
    }

    const response = await fetch(`${API_BASE}/api/routes/${testRouteId}`, {
      method: 'GET'
    });

    expect(response.ok).toBe(true);
    const data = await response.json();

    expect(data.id).toBe(testRouteId);
    expect(data).toHaveProperty('name');
    expect(data).toHaveProperty('path');
  });

  it('должен обновлять маршрут', async () => {
    if (!testRouteId) {
      console.log('Skipping test: no route ID');
      return;
    }

    const updatedRoute = {
      name: 'Updated Test Route',
      description: 'Updated description'
    };

    const response = await fetch(`${API_BASE}/api/routes/${testRouteId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedRoute)
    });

    expect(response.ok).toBe(true);
    const data = await response.json();

    expect(data.name).toBe(updatedRoute.name);
  });

  it('должен удалять маршрут', async () => {
    if (!testRouteId) {
      console.log('Skipping test: no route ID');
      return;
    }

    const response = await fetch(`${API_BASE}/api/routes/${testRouteId}`, {
      method: 'DELETE'
    });

    expect(response.ok).toBe(true);

    // Проверяем что маршрут действительно удален
    const getResponse = await fetch(`${API_BASE}/api/routes/${testRouteId}`, {
      method: 'GET'
    });

    expect(getResponse.ok).toBe(false);
  });
});
