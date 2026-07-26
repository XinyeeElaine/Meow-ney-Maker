# To-Do / Task List — Design

Date: 2026-07-26
Status: approved, ready for implementation plan

## Purpose

A plain personal task list for general daily tasks. Independent of shifts,
earnings, and the diary — it shares the app's look and its Supabase account,
nothing else.

Replaces the `<Soon title="To-Do" />` placeholder at `App.jsx:93`. The nav tab
`['/todo', 'To-Do']` already exists in `Nav.jsx`.

## Scope

In:

- User-created categories (lists)
- Tasks with text, done state, optional due date, high/normal priority
- Done tasks hidden behind a per-category toggle
- Login required, Supabase-only storage

Out (deliberately):

- Drag-to-reorder, recurring tasks, subtasks, sharing, reminders
- Any link to `work_sessions` or `diary_entries`
- Guest/localStorage mode

## Data

Two tables. Categories live independently so a freshly created empty list
survives a reload, and renaming one touches a single row.

```sql
create table todo_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  position int not null default 0,
  created_at timestamptz default now()
);

create table todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  category_id uuid references todo_categories on delete cascade,
  text text not null,
  done boolean not null default false,
  due_date date,
  priority boolean not null default false,   -- true = high
  created_at timestamptz default now()
);
```

`priority` is a boolean because there are exactly two states (high, normal).
An enum would be a third state waiting to be invented.

RLS on both tables mirrors `diary_entries`: `user_id = auth.uid()` for select,
insert, update, delete. Deleting a category cascades to its tasks.

`position` is written on category creation but nothing reads it yet beyond
ordering categories. It exists so manual reordering can land later without a
migration.

### Rejected storage shapes

- **One table, `category` as text** — categories derived from distinct values,
  the trick `allTags` uses in the diary. Lazier by a table, but an empty
  category vanishes on reload and a rename means updating every row. Breaks the
  user-created-lists requirement.
- **One jsonb blob per user** — like the diary's new `spends` column. Fewest
  queries, but two open tabs clobber each other and nothing is queryable later.

## Page layout

New file `src/Todo.jsx`. Header mirrors Diary's: sentence title left, one action
button right.

```
Small wins, one box at a time.                    [+ New list]

+- Study --------- 3 -+  +- Home ---------- 1 -+  +- Errands -- 0 -+
| [ ] * Finish report |  | [ ] Wash dishes     |  | Nothing here   |
|       Jul 28        |  | [ ] * Fix lamp      |  |                |
| [ ] Read chapter 4  |  |       Jul 12 (!)    |  | + Add task...  |
| [ ] Email tutor     |  |                     |  +----------------+
|                     |  | + Add task...       |
| + Add task...       |  | Show done (2)       |
| Show done (1)       |  +---------------------+
+---------------------+
```

- **Grid** — `repeat(auto-fit, minmax(260px, 1fr))`, the same auto-fit pattern
  `.kpi-row` uses, so lists reflow to one column on a narrow screen.
- **Category card** — name, open-task count, `x` to delete. Pixel border and
  offset shadow like the other cards.
- **Task row** — checkbox, `*` priority toggle, text, due date, `x`. The star
  fills accent when high. The date turns red when past and the task is open.
  Clicking the text starts an inline rename.
- **Adding a task** — permanent input at the card's bottom, Enter commits, focus
  stays for the next one.
- **Adding a list** — `showPrompt('Name this list')` from `dialog.js`.
- **Deleting a list** — `showConfirm` first, since it cascades the tasks.
- **Empty states** — no lists: "No lists yet — make one to start." Empty list:
  "Nothing here."
- **Logged out** — "Log in to see your tasks.", matching Diary and Dashboard.

## Sorting

Within a category, open tasks first, ordered by:

1. priority (high before normal)
2. due date ascending, undated last
3. created_at ascending (oldest first)

Done tasks are hidden entirely behind a `Show done (n)` toggle, one per
category. Unchecking a task returns it to the open list.

## Data flow

On mount, `Promise.all` of the two queries, same shape as Diary's
`loadWorkSessions` + `loadDiaryEntries`. Two arrays in state; tasks are grouped
by `category_id` at render time, not stored pre-grouped.

Writes are optimistic — local state updates first so the checkbox feels
instant, then the Supabase call fires. Unlike the diary, there is no explicit
Save button and no unsaved-changes guard: every change persists immediately.

### New `db.js` functions

```js
loadTodoData(user)              // { categories, todos }
addCategory(user, name)         // returns the new row (caller needs its id)
deleteCategory(id)              // cascades its tasks
addTodo(user, categoryId, text)
updateTodo(id, patch)           // done / text / due_date / priority
deleteTodo(id)
```

One `updateTodo` taking a patch object rather than four single-field setters —
every edit is the same `.update().eq('id', ...)` call.

## Error handling

`db.js`'s existing `report()` surfaces failures through `showAlert`. On a failed
write the page refetches, so the screen never keeps a change the server
rejected.

## Testing

The only logic worth a check is the sort comparator. It goes in `calc.js` as
`sortTasks(tasks)` and gets assertions appended to the existing
`src/calc.test.mjs` (`node src/calc.test.mjs`, no framework):

- priority beats due date
- undated sinks below dated
- done never outranks open

The rest is CRUD and reads better as manual clicks than as tests.

## Manual setup required

The two tables and their RLS policies must be created in the Supabase SQL
editor before the page can save anything.
