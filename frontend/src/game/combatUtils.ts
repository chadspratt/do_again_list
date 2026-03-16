/** Minimal shape required to pick an attack target. */
export interface AttackableEnemy {
  x: number;
  hp: number;
  dead: boolean;
}

/**
 * From all living enemies within `range` px of `heroX`, return the one with
 * the lowest current HP. Returns null if none are in range.
 */
export function pickAttackTarget<T extends AttackableEnemy>(
  enemies: T[],
  heroX: number,
  range = 80,
): T | null {
  const inRange = enemies.filter(e => !e.dead && e.x - heroX < range);
  if (inRange.length === 0) return null;
  return inRange.reduce((a, b) => (a.hp < b.hp ? a : b));
}
