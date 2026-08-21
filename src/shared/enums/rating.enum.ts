/**
 * Five-level rating scale (both directions: passenger→driver and
 * driver→passenger). Numeric values 5..1 feed the running averages
 * stored on Driver.rating / User.rating.
 *
 * Display labels (owned by the apps):
 *   excellent  — Excellent  / ممتاز
 *   very_good  — Very good  / جيد جداً
 *   good       — Good       / جيد
 *   not_bad    — Not bad    / لا بأس
 *   bad        — Bad        / سيئ   ← a written message is REQUIRED
 */
export enum RatingLevel {
  EXCELLENT = 'excellent',
  VERY_GOOD = 'very_good',
  GOOD = 'good',
  NOT_BAD = 'not_bad',
  BAD = 'bad',
}

export const RATING_VALUE: Record<RatingLevel, number> = {
  [RatingLevel.EXCELLENT]: 5,
  [RatingLevel.VERY_GOOD]: 4,
  [RatingLevel.GOOD]: 3,
  [RatingLevel.NOT_BAD]: 2,
  [RatingLevel.BAD]: 1,
};

export enum RaterType {
  PASSENGER = 'passenger',
  DRIVER = 'driver',
}
