// Supabase reads/writes, ported from the original vanilla app. Table names, columns and
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
      start: s.start_time, end: s.end_time,
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

// Diary: one row per user per day. Returned keyed by entry_date so the calendar can
// look a day up in O(1) instead of scanning the list per cell.
export async function loadDiaryEntries(user) {
  if (!supabase || !user) return {}
  const { data, error } = await supabase
    .from('diary_entries')
    .select('entry_date, emote, note, tags, spends')
    .eq('user_id', user.id)
  if (report('Load diary', error)) return {}
  return Object.fromEntries(
    data.map((e) => [
      e.entry_date,
      { emote: e.emote, note: e.note, tags: e.tags || [], spends: e.spends || [] },
    ])
  )
}

// Upsert on (user_id, entry_date) so re-saving the same day overwrites, never dupes.
export async function saveDiaryEntry(user, date, emote, note, tags, spends) {
  if (!supabase || !user) return
  const { error } = await supabase.from('diary_entries').upsert({
    user_id: user.id,
    entry_date: date,
    emote, note, tags, spends,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,entry_date' })
  report('Save diary', error)
}

// To-Do: categories and their tasks. Two tables rather than a category string
// on each task, so a freshly made empty list survives a reload.
export async function loadTodoData(user) {
  // ok distinguishes "really empty" from "failed to load" — a caller that can't
  // tell the two apart ends up wiping good state on a network hiccup.
  if (!supabase || !user) return { ok: false, categories: [], todos: [] }
  const [cats, todos] = await Promise.all([
    supabase.from('todo_categories').select('*').eq('user_id', user.id)
      .order('position').order('created_at'),
    supabase.from('todos').select('*').eq('user_id', user.id),
  ])
  if (report('Load lists', cats.error) || report('Load tasks', todos.error)) {
    return { ok: false, categories: [], todos: [] }
  }
  // Task order is computed client-side by sortTasks, so no .order() here.
  return { ok: true, categories: cats.data, todos: todos.data }
}

// Returns the inserted row: the caller needs the generated id to attach tasks
// to the new category without a refetch.
export async function addCategory(user, name, position) {
  if (!supabase || !user) return null
  const { data, error } = await supabase.from('todo_categories')
    .insert({ user_id: user.id, name, position })
    .select()
    .single()
  if (report('Add list', error)) return null
  return data
}

// Rename, recolour: same patch shape as updateTodo.
export async function updateCategory(id, patch) {
  if (!supabase) return false
  const { error } = await supabase.from('todo_categories').update(patch).eq('id', id)
  return !report('Update list', error)
}

// The tasks go with it — that's the on-delete-cascade on todos.category_id.
export async function deleteCategory(id) {
  if (!supabase) return false
  const { error } = await supabase.from('todo_categories').delete().eq('id', id)
  return !report('Delete list', error)
}

export async function addTodo(user, categoryId, text, color = 'lilac') {
  if (!supabase || !user) return null
  const { data, error } = await supabase.from('todos')
    .insert({ user_id: user.id, category_id: categoryId, text, color })
    .select()
    .single()
  if (report('Add task', error)) return null
  return data
}

// One patch function instead of four setters: every edit is the same update.
export async function updateTodo(id, patch) {
  if (!supabase) return false
  const { error } = await supabase.from('todos').update(patch).eq('id', id)
  return !report('Update task', error)
}

export async function deleteTodo(id) {
  if (!supabase) return false
  const { error } = await supabase.from('todos').delete().eq('id', id)
  return !report('Delete task', error)
}
