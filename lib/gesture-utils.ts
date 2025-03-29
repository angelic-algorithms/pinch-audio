export function calculateDistance(point1: number[], point2: number[]): number {
  const dx = point1[0] - point2[0]
  const dy = point1[1] - point2[1]
  const dz = (point1[2] || 0) - (point2[2] || 0)

  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

/**
 * Normalize a value between a min and max range
 */
export function normalizeValue(value: number, min: number, max: number, newMin = 0, newMax = 1): number {
  // Clamp the value between min and max
  const clampedValue = Math.min(Math.max(value, min), max)

  // Normalize to 0-1 range
  const normalized = (clampedValue - min) / (max - min)

  // Scale to new range
  return normalized * (newMax - newMin) + newMin
}

/**
 * Detect if a pinch gesture is occurring between thumb and index finger
 */
export function detectPinchGesture(thumbTip: number[], indexTip: number[], threshold = 40): boolean {
  const distance = calculateDistance(thumbTip, indexTip)
  return distance < threshold
}

/**
 * Apply smoothing to a value to reduce jitter
 */
export function smoothValue(currentValue: number, newValue: number, smoothingFactor = 0.3): number {
  return currentValue * (1 - smoothingFactor) + newValue * smoothingFactor
}

// Add a new function to help with smoother gesture detection

/**
 * Detect hand position in frame (left or right)
 */
export function determineHandSide(handX: number, frameWidth: number, threshold = 0.5): "left" | "right" {
  const normalizedX = handX / frameWidth
  return normalizedX < threshold ? "left" : "right"
}

/**
 * Apply exponential smoothing to reduce jitter in gesture controls
 */
export function exponentialSmoothing(currentValue: number, newValue: number, alpha = 0.3): number {
  // Alpha is the smoothing factor (0-1)
  // Lower alpha = more smoothing but slower response
  return alpha * newValue + (1 - alpha) * currentValue
}

