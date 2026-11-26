/**
 * Pure functions maintaining the invariant:
 * "When a contact collection is non-empty, exactly one row is primary."
 */

export function findPrimaryIndex<T extends { isPrimary: boolean }>(items: T[]): number {
  return items.findIndex((i) => i.isPrimary)
}

export function setPrimaryIndex<T extends { isPrimary: boolean }>(
  items: T[],
  targetIndex: number
): T[] {
  if (items.length === 0) return items
  const validIndex = Math.max(0, Math.min(targetIndex, items.length - 1))
  return items.map((item, idx) => ({
    ...item,
    isPrimary: idx === validIndex,
  }))
}

export function ensurePrimaryOnAdd<T extends { isPrimary: boolean }>(items: T[]): T[] {
  if (items.length === 0) return items
  // If no primary exists or it was empty before this add, the first row becomes primary
  const hasPrimary = items.some((i) => i.isPrimary)
  if (!hasPrimary) {
    return items.map((item, idx) => ({
      ...item,
      isPrimary: idx === 0,
    }))
  }
  return items
}

export function ensurePrimaryOnRemove<T extends { isPrimary: boolean }>(
  items: T[],
  removedIndex: number
): T[] {
  if (items.length === 0) return items
  const wasPrimary = items[removedIndex]?.isPrimary
  const remaining = items.filter((_, idx) => idx !== removedIndex)
  if (remaining.length === 0) return remaining

  if (wasPrimary) {
    return remaining.map((item, idx) => ({
      ...item,
      isPrimary: idx === 0,
    }))
  }

  // Ensure there is still a primary
  const hasPrimary = remaining.some((i) => i.isPrimary)
  if (!hasPrimary) {
    return remaining.map((item, idx) => ({
      ...item,
      isPrimary: idx === 0,
    }))
  }

  return remaining
}
