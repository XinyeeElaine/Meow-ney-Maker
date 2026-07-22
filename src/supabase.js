import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

// Null when env vars are missing (fresh clone with no .env) — callers fall back
// to localStorage rather than crashing the whole app on import.
// PKCE returns the session as a `?code=` query param. The implicit flow returns it
// in the URL hash, which HashRouter also owns — the two would fight over `#`.
export const supabase = url && key
  ? createClient(url, key, { auth: { flowType: 'pkce' } })
  : null

// Dev-only handle so failing queries can be reproduced straight from the console.
if (import.meta.env.DEV) window.__sb = supabase
