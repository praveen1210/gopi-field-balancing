/** Longest a single server call may take before it is given up. */
export const REQUEST_TIMEOUT_MS = 20_000;

/**
 * fetch with a time limit. When a phone sends the app to the background,
 * Android may drop the network connection without ever failing the request;
 * without a limit that request never settles and every screen waiting on it
 * stays frozen after the app is reopened. A timed-out request rejects with a
 * TypeError, like any network failure, so screens show "No internet" and can
 * retry.
 */
export function createFetchWithTimeout(
  baseFetch: typeof fetch = fetch,
  timeoutMs: number = REQUEST_TIMEOUT_MS,
): typeof fetch {
  return async (input, init) => {
    const controller = new AbortController();
    const outer = init?.signal;
    const abortFromOuter = () => controller.abort();
    if (outer) {
      if (outer.aborted) {
        controller.abort();
      } else {
        outer.addEventListener('abort', abortFromOuter);
      }
    }
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    try {
      return await baseFetch(input, { ...init, signal: controller.signal });
    } catch (cause) {
      if (timedOut) {
        throw new TypeError('Network request timed out');
      }
      throw cause;
    } finally {
      clearTimeout(timer);
      outer?.removeEventListener('abort', abortFromOuter);
    }
  };
}
