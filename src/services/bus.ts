/**
 * Tiny change bus. Services call notifyChange() after any write so hooks can refetch.
 * With a real backend this would be replaced by query invalidation (React Query, Supabase realtime, etc.).
 */
let version = 0
const listeners = new Set<() => void>()

export function notifyChange(): void {
  version += 1
  listeners.forEach((l) => l())
}

export function subscribeChange(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getVersion(): number {
  return version
}

/** Simulated network latency so loading states are visible in the demo. */
export const delay = (ms = 350) => new Promise<void>((resolve) => setTimeout(resolve, ms))
