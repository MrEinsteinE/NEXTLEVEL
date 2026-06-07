import { lazy } from 'react'

const RELOAD_KEY = 'nl_chunk_reload_attempted'

// Retries a failed dynamic import a few times (flaky network), and if it still
// fails — typically because a new deploy invalidated the old chunk hashes — it
// forces a single full reload to pull the fresh asset manifest. This prevents
// the white-screen / "Failed to fetch dynamically imported module" crash.
async function attempt(factory, retries, interval) {
  try {
    const mod = await factory()
    try { sessionStorage.removeItem(RELOAD_KEY) } catch (_) {}
    return mod
  } catch (err) {
    if (retries > 0) {
      await new Promise(res => setTimeout(res, interval))
      return attempt(factory, retries - 1, interval)
    }
    throw err
  }
}

export default function lazyWithRetry(factory, { retries = 2, interval = 600 } = {}) {
  return lazy(async () => {
    try {
      return await attempt(factory, retries, interval)
    } catch (err) {
      let reloaded = null
      try { reloaded = sessionStorage.getItem(RELOAD_KEY) } catch (_) {}
      if (!reloaded) {
        try { sessionStorage.setItem(RELOAD_KEY, '1') } catch (_) {}
        window.location.reload()
        return new Promise(() => {}) // hang until reload swaps the page
      }
      throw err // already reloaded once; let the ErrorBoundary show the fallback
    }
  })
}
