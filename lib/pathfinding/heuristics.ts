/**
 * Heuristic functions for A* pathfinding
 */

import type { GraphNode } from './types';

/**
 * Haversine distance heuristic (in meters)
 * Admissible and consistent for geographic pathfinding
 */
export function haversineHeuristic(
  current: { lat: number; lng: number },
  goal: { lat: number; lng: number }
): number {
  const R = 6371000; // Earth's radius in meters
  const φ1 = (current.lat * Math.PI) / 180;
  const φ2 = (goal.lat * Math.PI) / 180;
  const Δφ = ((goal.lat - current.lat) * Math.PI) / 180;
  const Δλ = ((goal.lng - current.lng) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Euclidean distance heuristic
 * Faster but less accurate for geographic coordinates
 */
export function euclideanHeuristic(
  current: { lat: number; lng: number },
  goal: { lat: number; lng: number }
): number {
  const latDiff = goal.lat - current.lat;
  const lngDiff = goal.lng - current.lng;

  // Approximate conversion to meters
  const metersPerDegreeLat = 111000;
  const metersPerDegreeLng = 111000 * Math.cos((current.lat * Math.PI) / 180);

  const dx = lngDiff * metersPerDegreeLng;
  const dy = latDiff * metersPerDegreeLat;

  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Manhattan distance heuristic
 * Good for grid-based pathfinding with 4-directional movement
 */
export function manhattanHeuristic(
  current: { lat: number; lng: number },
  goal: { lat: number; lng: number }
): number {
  const latDiff = Math.abs(goal.lat - current.lat);
  const lngDiff = Math.abs(goal.lng - current.lng);

  const metersPerDegreeLat = 111000;
  const metersPerDegreeLng = 111000 * Math.cos((current.lat * Math.PI) / 180);

  return latDiff * metersPerDegreeLat + lngDiff * metersPerDegreeLng;
}

/**
 * Diagonal distance heuristic (Chebyshev)
 * Good for 8-directional movement on a grid
 */
export function diagonalHeuristic(
  current: { lat: number; lng: number },
  goal: { lat: number; lng: number }
): number {
  const latDiff = Math.abs(goal.lat - current.lat);
  const lngDiff = Math.abs(goal.lng - current.lng);

  const metersPerDegreeLat = 111000;
  const metersPerDegreeLng = 111000 * Math.cos((current.lat * Math.PI) / 180);

  const dx = lngDiff * metersPerDegreeLng;
  const dy = latDiff * metersPerDegreeLat;

  // D is the cost of a straight move, D2 is the cost of a diagonal move
  const D = 1.0;
  const D2 = Math.sqrt(2);

  return D * Math.max(dx, dy) + (D2 - D) * Math.min(dx, dy);
}

/**
 * Weighted heuristic that accounts for terrain difficulty
 * Optimistic estimate considering best-case terrain coefficient
 */
export function terrainAwareHeuristic(
  current: { lat: number; lng: number; coefficient?: number },
  goal: { lat: number; lng: number },
  bestTerrainCoefficient: number = 1.0
): number {
  const straightLineDistance = haversineHeuristic(current, goal);

  // Multiply by best possible coefficient (optimistic heuristic)
  // This ensures admissibility (never overestimate)
  return straightLineDistance * bestTerrainCoefficient;
}

/**
 * Default heuristic for hiking pathfinding
 * Uses Haversine for accuracy on Earth's surface
 */
export const defaultHeuristic = haversineHeuristic;
