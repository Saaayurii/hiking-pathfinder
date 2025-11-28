/**
 * Energy expenditure and calorie calculation for hiking routes
 * Based on metabolic equivalent of task (MET) and terrain difficulty
 */

/**
 * Calculate calories burned for a hiking route
 *
 * Formula based on:
 * - Distance traveled
 * - Elevation gain/loss
 * - Terrain difficulty (coefficient)
 * - User weight
 * - Time spent
 */

export interface CalorieCalculationOptions {
  distance: number; // meters
  elevationGain: number; // meters
  elevationLoss: number; // meters
  duration: number; // seconds
  userWeight?: number; // kg, default 70kg
  averageCoefficient?: number; // terrain difficulty, default 2.0
}

export interface EnergyExpenditureResult {
  totalCalories: number; // kcal
  caloriesPerKm: number; // kcal/km
  metabolicEquivalent: number; // MET value
  energyPerHour: number; // kcal/hour
}

/**
 * Calculate energy expenditure for hiking
 *
 * Base formula: Calories = MET * weight(kg) * time(hours)
 * MET values:
 * - Flat terrain, moderate pace: 5.3 MET
 * - Uphill, moderate grade: 7.5 MET
 * - Uphill, steep grade: 9.5 MET
 * - Downhill: 4.5 MET
 */
export function calculateCalories(options: CalorieCalculationOptions): EnergyExpenditureResult {
  const {
    distance,
    elevationGain,
    elevationLoss,
    duration,
    userWeight = 70, // default 70kg
    averageCoefficient = 2.0,
  } = options;

  // Convert duration to hours
  const durationHours = duration / 3600;

  // Calculate average grade
  const distanceKm = distance / 1000;
  const avgUpGrade = (elevationGain / distance) * 100; // percentage
  const avgDownGrade = (elevationLoss / distance) * 100; // percentage

  // Calculate MET based on terrain and grade
  let baseMET = 5.3; // Flat terrain base

  // Adjust for uphill
  if (avgUpGrade > 10) {
    baseMET = 9.5; // Steep uphill
  } else if (avgUpGrade > 5) {
    baseMET = 7.5; // Moderate uphill
  } else if (avgUpGrade > 2) {
    baseMET = 6.5; // Slight uphill
  }

  // Adjust for terrain difficulty (coefficient)
  // Coefficient ranges from 1.0 (easy) to 10.0 (very difficult)
  // Each point above 1.0 adds ~10% to MET
  const terrainMultiplier = 1 + ((averageCoefficient - 1.0) * 0.1);
  const adjustedMET = baseMET * terrainMultiplier;

  // Calculate total calories
  // Formula: Calories = MET * weight(kg) * time(hours)
  const totalCalories = adjustedMET * userWeight * durationHours;

  // Additional calories for elevation gain
  // ~0.1 kcal per kg per meter of elevation gain
  const elevationCalories = elevationGain * userWeight * 0.1;

  // Total with elevation bonus
  const totalWithElevation = totalCalories + elevationCalories;

  // Calculate derived metrics
  const caloriesPerKm = totalWithElevation / distanceKm;
  const energyPerHour = totalWithElevation / durationHours;

  return {
    totalCalories: Math.round(totalWithElevation),
    caloriesPerKm: Math.round(caloriesPerKm),
    metabolicEquivalent: Math.round(adjustedMET * 10) / 10,
    energyPerHour: Math.round(energyPerHour),
  };
}

/**
 * Calculate average terrain coefficient from route
 */
export function calculateAverageCoefficient(
  path: Array<{ lat: number; lng: number; coefficient?: number }>
): number {
  if (path.length === 0) return 2.0;

  const coefficients = path
    .map(p => p.coefficient)
    .filter((c): c is number => c !== undefined);

  if (coefficients.length === 0) return 2.0;

  const sum = coefficients.reduce((acc, c) => acc + c, 0);
  return sum / coefficients.length;
}

/**
 * Get effort level description based on MET value
 */
export function getEffortLevel(met: number): string {
  if (met < 3) return 'Очень лёгкая';
  if (met < 5) return 'Лёгкая';
  if (met < 7) return 'Умеренная';
  if (met < 9) return 'Интенсивная';
  if (met < 11) return 'Очень интенсивная';
  return 'Экстремальная';
}

/**
 * Estimate water needs in liters
 * Rule of thumb: ~0.5L per hour of moderate activity, more for intense
 */
export function estimateWaterNeeds(duration: number, met: number): number {
  const durationHours = duration / 3600;
  let waterPerHour = 0.5; // base 0.5L per hour

  if (met > 7) waterPerHour = 0.75; // intense activity
  if (met > 9) waterPerHour = 1.0; // very intense

  return Math.round(waterPerHour * durationHours * 10) / 10; // round to 0.1L
}
