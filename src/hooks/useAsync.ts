import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { getVersion, subscribeChange } from '../services'

export interface AsyncState<T> {
  data: T | null
  loading: boolean
  error: string | null
  reload: () => void
}

/** Re-renders whenever any service writes data, so lists refresh after RSVP/follow/edit. */
export function useDataVersion(): number {
  return useSyncExternalStore(subscribeChange, getVersion, getVersion)
}

/**
 * Runs an async service call and tracks loading/error state.
 * Refetches when `deps` change or when any service reports a data change.
 * Stale data stays visible while a background refetch runs (no skeleton flicker after RSVP).
 */
export function useAsync<T>(fn: () => Promise<T>, deps: readonly unknown[]): AsyncState<T> {
  const version = useDataVersion()
  const [state, setState] = useState<{ data: T | null; loading: boolean; error: string | null }>({
    data: null,
    loading: true,
    error: null,
  })
  const [nonce, setNonce] = useState(0)
  const fnRef = useRef(fn)
  fnRef.current = fn
  const depsKey = JSON.stringify(deps)
  const lastDepsKey = useRef(depsKey)

  useEffect(() => {
    let cancelled = false
    const depsChanged = lastDepsKey.current !== depsKey
    lastDepsKey.current = depsKey
    setState((s) => ({ data: depsChanged ? null : s.data, loading: depsChanged || s.data === null, error: null }))
    fnRef
      .current()
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: null })
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setState({ data: null, loading: false, error: e instanceof Error ? e.message : 'Something went wrong.' })
      })
    return () => {
      cancelled = true
    }
  }, [depsKey, version, nonce])

  const reload = useCallback(() => setNonce((n) => n + 1), [])
  return { ...state, reload }
}
