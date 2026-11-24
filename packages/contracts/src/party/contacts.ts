/**
 * Pure contact helpers shared by server rules, Zod refinements, and web forms.
 */

/** Normalized lowercase and trimmed comparison key for emails. */
export function emailKey(email: string): string {
  return email.trim().toLowerCase()
}

/** Returns the 0-based index of every entry whose email key appeared earlier in the collection. */
export function findDuplicateEmailIndexes(
  entries: readonly { email: string }[]
): number[] {
  const seen = new Set<string>()
  const duplicates: number[] = []

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]
    if (!entry) continue
    const key = emailKey(entry.email)
    if (seen.has(key)) {
      duplicates.push(i)
    } else {
      seen.add(key)
    }
  }

  return duplicates
}

/** Counts how many entries have `isPrimary === true`. */
export function countPrimaries(
  entries: readonly { isPrimary?: boolean }[]
): number {
  return entries.reduce((acc, cur) => (cur.isPrimary ? acc + 1 : acc), 0)
}

/** Returns true if the collection is empty OR has exactly one primary entry. */
export function hasExactlyOnePrimary(
  entries: readonly { isPrimary?: boolean }[]
): boolean {
  if (entries.length === 0) return true
  return countPrimaries(entries) === 1
}

/** Finds repeated non-undefined IDs inside an update collection. */
export function findDuplicateIds(
  entries: readonly { id?: string | null }[]
): string[] {
  const seen = new Set<string>()
  const duplicates = new Set<string>()

  for (const entry of entries) {
    if (!entry?.id) continue
    if (seen.has(entry.id)) {
      duplicates.add(entry.id)
    } else {
      seen.add(entry.id)
    }
  }

  return Array.from(duplicates)
}
