import type { TerrainType, TrailVisibility, Smoothness, TerrainCoefficients } from '@/types/terrain';

/**
 * Calculate walkability coefficient based on terrain attributes
 * Coefficient range: 1.0 (best) to 10.0 (impassable)
 */

export const DEFAULT_COEFFICIENTS: TerrainCoefficients = {
  // Excellent surfaces (1.0-2.0)
  'paved': 1.0,
  'asphalt': 1.2,

  // Good surfaces (2.0-3.0)
  'gravel': 2.0,
  'compacted': 2.2,
  'path': 2.0,

  // Moderate surfaces (2.5-4.0)
  'ground': 2.5,
  'dirt': 2.8,
  'grass': 3.0,
  'earth': 2.7,

  // Difficult surfaces (4.0-6.0)
  'rock': 4.5,
  'pebblestone': 4.0,
  'sand': 5.0,

  // Very difficult (6.0-8.0)
  'mud': 6.0,
  'snow': 6.5,

  // Obstacles (7.5-10.0)
  'wetland': 7.5,
  'water': 10.0,
  'forest': 4.0,

  // Unknown
  'unknown': 3.5,
};

/**
 * Get coefficient modifier based on trail visibility
 */
export function getVisibilityModifier(visibility: string): number {
  switch (visibility) {
    case 'excellent':
      return 0.9; // 10% bonus for excellent visibility
    case 'good':
      return 1.0; // No modifier
    case 'intermediate':
      return 1.2; // 20% penalty
    case 'bad':
      return 1.5; // 50% penalty
    case 'horrible':
      return 2.0; // 100% penalty
    case 'no':
      return 2.5; // 150% penalty - very hard to follow
    default:
      return 1.0;
  }
}

/**
 * Get coefficient modifier based on smoothness
 */
export function getSmoothnessModifier(smoothness: string): number {
  switch (smoothness) {
    case 'excellent':
      return 0.9; // 10% bonus
    case 'good':
      return 1.0; // No modifier
    case 'intermediate':
      return 1.15; // 15% penalty
    case 'bad':
      return 1.4; // 40% penalty
    case 'very_bad':
      return 1.8; // 80% penalty
    case 'horrible':
      return 2.3; // 130% penalty
    case 'very_horrible':
      return 3.0; // 200% penalty
    default:
      return 1.0;
  }
}

/**
 * Get coefficient modifier for informal/unofficial trails
 */
export function getInformalModifier(informal: boolean): number {
  return informal ? 1.3 : 1.0; // 30% penalty for informal trails
}

/**
 * Get coefficient modifier based on trail width
 */
export function getWidthModifier(width?: number): number {
  if (!width) return 1.0;

  // Wider trails are easier
  if (width >= 3.0) return 0.95; // Wide trail (3m+)
  if (width >= 2.0) return 1.0; // Normal trail (2-3m)
  if (width >= 1.0) return 1.1; // Narrow trail (1-2m)
  return 1.3; // Very narrow (<1m)
}

/**
 * Calculate comprehensive terrain coefficient
 */
export function calculateTerrainCoefficient(attributes: {
  surface?: string;
  visibility?: string;
  smoothness?: string;
  informal?: boolean;
  width?: number;
  slope?: number;
  customCoefficients?: TerrainCoefficients;
}): number {
  const coefficients = attributes.customCoefficients || DEFAULT_COEFFICIENTS;

  // Base coefficient from surface type
  const baseCoefficient = coefficients[attributes.surface || 'unknown'] || 3.5;

  // Apply modifiers
  const visibilityMod = getVisibilityModifier(attributes.visibility || 'good');
  const smoothnessMod = getSmoothnessModifier(attributes.smoothness || 'good');
  const informalMod = getInformalModifier(attributes.informal || false);
  const widthMod = getWidthModifier(attributes.width);

  // Calculate final coefficient
  let coefficient = baseCoefficient * visibilityMod * smoothnessMod * informalMod * widthMod;

  // Slope factor is handled separately in pathfinding
  // but we can add a small bonus for flat terrain
  if (attributes.slope !== undefined && attributes.slope < 5) {
    coefficient *= 0.95; // 5% bonus for flat terrain
  }

  // Clamp to valid range
  return Math.max(1.0, Math.min(10.0, coefficient));
}

/**
 * Get color for coefficient visualization
 */
export function getCoefficientColor(coefficient: number): string {
  // Green (easy) to Red (difficult)
  if (coefficient <= 2.0) return '#22c55e'; // Green - excellent
  if (coefficient <= 3.0) return '#84cc16'; // Light green - good
  if (coefficient <= 4.0) return '#eab308'; // Yellow - moderate
  if (coefficient <= 5.0) return '#f97316'; // Orange - difficult
  if (coefficient <= 7.0) return '#ef4444'; // Red - very difficult
  return '#991b1b'; // Dark red - extreme/impassable
}

/**
 * Get descriptive label for coefficient
 */
export function getCoefficientLabel(coefficient: number): string {
  if (coefficient <= 2.0) return 'Отличные условия';
  if (coefficient <= 3.0) return 'Хорошие условия';
  if (coefficient <= 4.0) return 'Средние условия';
  if (coefficient <= 5.0) return 'Сложные условия';
  if (coefficient <= 7.0) return 'Очень сложные условия';
  return 'Непроходимо';
}

/**
 * Batch calculate coefficients for multiple trail segments
 */
export function calculateSegmentCoefficients(
  segments: Array<{
    surface?: string;
    visibility?: string;
    smoothness?: string;
    informal?: boolean;
    width?: number;
  }>,
  customCoefficients?: TerrainCoefficients
): number[] {
  return segments.map((seg) =>
    calculateTerrainCoefficient({
      ...seg,
      customCoefficients,
    })
  );
}
