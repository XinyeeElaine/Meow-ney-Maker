// Supabase reads/writes, ported from docs/js/app.js. Table names, columns and
// onConflict keys are unchanged — the existing schema and rows keep working.
import { supabase } from './supabase.js'
import { showAlert } from './dialog.js'

// supabase-js resolves with { data, error } instead of throwing, so an unchecked
// call fails silently and the user just sees nothing happen. Every call routes
// through here: log it, and surface writes so a lost shift is never invisible.
let lastShown = ''
function report(label, error, { silent = false } = {}) {
  if (!error) return false
  console.error(`${label}:`, error)
  const msg = `${label}: ${error.message || error}`
  if (!silent && msg !== lastShown) {
    lastShown = msg
    showAlert(msg, 'Sync problem')
  }
  return true
}

export async function loadPreferences(user) {
  if (!supabase || !user) return null
  const { data, error } = await supabase
    .from('user_preferences')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()
  // Reads stay quiet — a missing prefs row is normal for a brand-new account.
  report('Load preferences', error, { silent: true })
  return data
}

export async function savePreferences(user, salary, hours, days) {
  if (!supabase || !user) return
  const { error } = await supabase.from('user_preferences').upsert({
    user_id: user.id,
    salary, hours_per_day: hours, days_per_month: days,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })
  report('Save preferences', error)
}

export async function saveTheme(user, theme) {
  if (!supabase || !user) return
  const { error } = await supabase
    .from('user_preferences')
    .update({ theme, updated_at: new Date().toISOString() })
    .eq('user_id', user.id)
  report('Save theme', error)
}

export async function loadActiveSession(user) {
  if (!supabase || !user) return null
  // limit(1) rather than maybeSingle(): if user_id has no unique constraint the
  // table can hold duplicates, and maybeSingle() errors on more than one row.
  const { data, error } = await supabase
    .from('active_sessions')
    .select('*')
    .eq('user_id', user.id)
    .limit(1)
  report('Load active session', error, { silent: true })
  return data?.[0] || null
}

export async function saveActiveSession(user, startTime, ratePerSecond) {
  if (!supabase || !user) return
  const { error } = await supabase.from('active_sessions').upsert({
    user_id: user.id,
    start_time: new Date(startTime).toISOString(),
    rate_per_second: ratePerSecond,
  }, { onConflict: 'user_id' })
  report('Save active session', error)
}

export async function clearActiveSession(user) {
  if (!supabase || !user) return
  const { error } = await supabase.from('active_sessions').delete().eq('user_id', user.id)
  report('Clear active session', error)
}

export async function saveWorkSession(user, startTime, durationSeconds, ratePerSecond, earned, dateString) {
  if (!supabase || !user) return
  const { error } = await supabase.from('work_sessions').insert([{
    user_id: user.id,
    start_time: new Date(startTime).toISOString(),
    end_time: new Date().toISOString(),
    duration_seconds: Math.floor(durationSeconds),
    rate_per_second: ratePerSecond,
    amount_earned: earned,
    session_date: dateString,
  }])
  report('Save work session', error)
}

export async function loadWorkSessions(user) {
  if (!supabase || !user) return []
  const { data, error } = await supabase
    .from('work_sessions')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
  if (report('Load history', error)) return []
  // Reversed to oldest-first so the UI's shared "newest at top" render works
  // for both the Supabase and localStorage paths.
  return data
    .map((s) => ({
      date: s.session_date, duration: s.duration_seconds,
      earned: s.amount_earned, id: s.id,
    }))
    .reverse()
}

export async function deleteWorkSession(id) {
  if (!supabase) return
  const { error } = await supabase.from('work_sessions').delete().eq('id', id)
  report('Delete shift', error)
}

export async function clearAllWorkSessions(user) {
  if (!supabase || !user) return
  const { error } = await supabase.from('work_sessions').delete().eq('user_id', user.id)
  report('Clear history', error)
}
