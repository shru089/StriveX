/**
 * db.js — Unified localStorage-first storage layer
 * All app data reads/writes go through here.
 * If user is logged in, dirty keys are queued for cloud sync.
 */
import api from './api'

const KEYS = {
  TODOS:       'sx_todos',
  GOALS:       'sx_goals',
  SCHEDULE:    'sx_schedule',
  COMMITMENTS: 'sx_commitments',
  PROFILE:     'sx_profile',
  ALARMS:      'sx_alarms',
  DIRTY:       'sx_dirty_keys',
}

// ── Read / Write ──────────────────────────────────────────────────────────────
function get(key) {
  try { return JSON.parse(localStorage.getItem(KEYS[key] ?? key) ?? 'null') } catch { return null }
}

function set(key, value) {
  const storageKey = KEYS[key] ?? key
  localStorage.setItem(storageKey, JSON.stringify(value))
  markDirty(key)
}

function markDirty(key) {
  const dirty = get('DIRTY') || []
  if (!dirty.includes(key)) {
    localStorage.setItem(KEYS.DIRTY, JSON.stringify([...dirty, key]))
  }
}

// ── Todos ─────────────────────────────────────────────────────────────────────
function getTodos() { return get('TODOS') || [] }
function saveTodos(todos) { set('TODOS', todos) }

function addTodo(todo) {
  const todos = getTodos()
  const newTodo = { id: `local_${Date.now()}`, created_at: new Date().toISOString(), completed: false, priority: 2, source: 'manual', ...todo }
  saveTodos([...todos, newTodo])
  return newTodo
}

function addTodosBulk(todoList) {
  const todos = getTodos()
  const newTodos = todoList.map(t => ({ id: `local_${Date.now()}_${Math.random().toString(36).slice(2)}`, created_at: new Date().toISOString(), completed: false, priority: 2, source: 'ai', ...t }))
  saveTodos([...todos, ...newTodos])
  return newTodos
}

function updateTodo(id, patch) {
  saveTodos(getTodos().map(t => t.id === id || t.id === String(id) ? { ...t, ...patch } : t))
}

function deleteTodo(id) {
  saveTodos(getTodos().filter(t => t.id !== id && t.id !== String(id)))
}

// ── Goals ─────────────────────────────────────────────────────────────────────
function getGoals() { return get('GOALS') || [] }
function saveGoals(goals) { set('GOALS', goals) }
function addGoal(goal) {
  const goals = getGoals()
  const newGoal = { id: `local_${Date.now()}`, created_at: new Date().toISOString(), progress: 0, ...goal }
  saveGoals([...goals, newGoal])
  return newGoal
}

// ── Schedule ──────────────────────────────────────────────────────────────────
function getSchedule() { return get('SCHEDULE') }
function saveSchedule(schedule) { set('SCHEDULE', schedule) }

// ── Alarms ────────────────────────────────────────────────────────────────────
function getAlarms() { return get('ALARMS') || [] }
function addAlarm(alarm) {
  const alarms = getAlarms()
  const newAlarm = { id: `alarm_${Date.now()}`, done: false, ...alarm }
  set('ALARMS', [...alarms, newAlarm])
  return newAlarm
}
function dismissAlarm(id) {
  set('ALARMS', getAlarms().map(a => a.id === id ? { ...a, done: true } : a))
}
function clearDoneAlarms() {
  set('ALARMS', getAlarms().filter(a => !a.done))
}

// ── Profile ───────────────────────────────────────────────────────────────────
function getProfile() { return get('PROFILE') }
function saveProfile(profile) { set('PROFILE', profile) }

// ── Cloud Sync ────────────────────────────────────────────────────────────────
async function syncToCloud() {
  const token = localStorage.getItem('access_token')
  if (!token) return { synced: 0 }
  const dirty = get('DIRTY') || []
  let synced = 0
  for (const key of dirty) {
    try {
      const data = get(key)
      if (key === 'TODOS' && Array.isArray(data)) {
        const local = data.filter(t => String(t.id).startsWith('local_'))
        if (local.length) {
          await api.post('/todos/bulk', { tasks: local })
          synced += local.length
        }
      }
    } catch { /* best effort */ }
  }
  localStorage.setItem(KEYS.DIRTY, JSON.stringify([]))
  return { synced }
}

/** Hydrate localStorage from backend (after login) */
async function hydrateFromCloud() {
  try {
    const [todosRes, goalsRes] = await Promise.allSettled([api.get('/todos'), api.get('/goals')])
    if (todosRes.status === 'fulfilled') saveTodos(todosRes.value.data)
    if (goalsRes.status === 'fulfilled') saveGoals(goalsRes.value.data)
  } catch { /* offline */ }
}

export default { get, set, getTodos, saveTodos, addTodo, addTodosBulk, updateTodo, deleteTodo, getGoals, saveGoals, addGoal, getSchedule, saveSchedule, getAlarms, addAlarm, dismissAlarm, clearDoneAlarms, getProfile, saveProfile, syncToCloud, hydrateFromCloud }
