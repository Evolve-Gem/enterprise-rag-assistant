"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/** Internal state machine for an async request. */
type AsyncState<T> =
  | { status: "loading" }
  | { status: "success"; data: T }
  | { status: "error"; error: Error };

interface AsyncControls<T> {
  /** Re-run the request. */
  reload: () => Promise<void>;
  /** Imperatively replace the value (after a mutation, say). */
  setData: (data: T) => void;
}

/**
 * The public result type.
 *
 * Declared as an explicit discriminated union rather than `{...state, ...controls}`
 * because *spreading* a union loses the correlation between `status` and
 * `data`/`error`, and TypeScript then refuses to narrow on `status`.
 *
 * There is deliberately no `idle` member: the request starts on mount, so the
 * first render is already `loading`, and a three-member union lets call sites
 * narrow exhaustively (`if (loading) … else if (error) … else data`).
 */
export type AsyncResult<T> =
  | (AsyncControls<T> & { status: "loading" })
  | (AsyncControls<T> & { status: "success"; data: T })
  | (AsyncControls<T> & { status: "error"; error: Error });

/**
 * Run an async function on mount and whenever `deps` change.
 *
 * `keepPreviousData` keeps the last successful payload visible while a refresh
 * is in flight, which avoids layout thrash when re-querying a table.
 */
export function useAsync<T>(
  factory: () => Promise<T>,
  deps: unknown[] = [],
  options: { keepPreviousData?: boolean } = {},
): AsyncResult<T> {
  const { keepPreviousData = true } = options;
  const [state, setState] = useState<AsyncState<T>>({ status: "loading" });
  const mounted = useRef(true);
  const factoryRef = useRef(factory);
  factoryRef.current = factory;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(async () => {
    setState((previous) => {
      if (keepPreviousData && previous.status === "success") return previous;
      return { status: "loading" };
    });
    try {
      const data = await factoryRef.current();
      if (mounted.current) setState({ status: "success", data });
    } catch (error) {
      if (mounted.current) setState({ status: "error", error: error as Error });
    }
  }, [keepPreviousData]);

  const setData = useCallback((data: T) => {
    setState({ status: "success", data });
  }, []);

  useEffect(() => {
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return useMemo<AsyncResult<T>>(() => {
    const controls: AsyncControls<T> = { reload: run, setData };
    if (state.status === "success") {
      return { ...controls, status: "success", data: state.data };
    }
    if (state.status === "error") {
      return { ...controls, status: "error", error: state.error };
    }
    return { ...controls, status: state.status };
  }, [state, run, setData]);
}

/** Debounce a rapidly changing value (search boxes). */
export function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/**
 * Persist a value in localStorage.
 *
 * Reads happen in an effect (not during render) so server and client markup
 * match on first paint.
 */
export function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) setValue(JSON.parse(raw) as T);
    } catch {
      /* ignore corrupt value */
    }
    setHydrated(true);
  }, [key]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage full or disabled */
    }
  }, [key, value, hydrated]);

  return [value, setValue, hydrated] as const;
}

/** Copy text to the clipboard and report success for ~1.4s. */
export function useCopyToClipboard() {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
      return true;
    } catch {
      return false;
    }
  }, []);

  return { copied, copy };
}
