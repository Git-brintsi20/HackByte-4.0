/**
 * Orchestration Database Functions
 * File-based storage for persistent data across server restarts
 * Uses JSON files stored in .data directory
 */

import fs from 'fs'
import path from 'path'
import type {
  OrchestrationEvent,
  OrchestrationTask,
  OrchestrationOperator,
  OrchestrationTaskHistoryEntry,
} from '@/types'

// Data directory for persistent storage
const DATA_DIR = path.join(process.cwd(), '.data', 'orchestration')
const EVENTS_FILE = path.join(DATA_DIR, 'events.json')
const HISTORY_FILE = path.join(DATA_DIR, 'history.json')

// Ensure data directory exists
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
    console.log(`[DB] Created data directory: ${DATA_DIR}`)
  }
}

// Load events from file
function loadEventsFromFile(): Map<string, OrchestrationEvent> {
  ensureDataDir()
  try {
    if (fs.existsSync(EVENTS_FILE)) {
      const data = fs.readFileSync(EVENTS_FILE, 'utf-8')
      const parsed = JSON.parse(data)
      const map = new Map<string, OrchestrationEvent>()
      for (const [key, value] of Object.entries(parsed)) {
        map.set(key, value as OrchestrationEvent)
      }
      console.log(`[DB] Loaded ${map.size} events from file`)
      return map
    }
  } catch (error) {
    console.error('[DB] Error loading events from file:', error)
  }
  return new Map<string, OrchestrationEvent>()
}

// Load history from file
function loadHistoryFromFile(): Map<string, OrchestrationTaskHistoryEntry[]> {
  ensureDataDir()
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      const data = fs.readFileSync(HISTORY_FILE, 'utf-8')
      const parsed = JSON.parse(data)
      const map = new Map<string, OrchestrationTaskHistoryEntry[]>()
      for (const [key, value] of Object.entries(parsed)) {
        map.set(key, value as OrchestrationTaskHistoryEntry[])
      }
      return map
    }
  } catch (error) {
    console.error('[DB] Error loading history from file:', error)
  }
  return new Map<string, OrchestrationTaskHistoryEntry[]>()
}

// Save events to file
function saveEventsToFile(events: Map<string, OrchestrationEvent>) {
  ensureDataDir()
  try {
    const obj: Record<string, OrchestrationEvent> = {}
    events.forEach((value, key) => {
      obj[key] = value
    })
    fs.writeFileSync(EVENTS_FILE, JSON.stringify(obj, null, 2))
    console.log(`[DB] Saved ${events.size} events to file`)
  } catch (error) {
    console.error('[DB] Error saving events to file:', error)
  }
}

// Save history to file
function saveHistoryToFile(history: Map<string, OrchestrationTaskHistoryEntry[]>) {
  ensureDataDir()
  try {
    const obj: Record<string, OrchestrationTaskHistoryEntry[]> = {}
    history.forEach((value, key) => {
      obj[key] = value
    })
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(obj, null, 2))
  } catch (error) {
    console.error('[DB] Error saving history to file:', error)
  }
}

// Extend globalThis type for our caches
declare global {
  // eslint-disable-next-line no-var
  var orchestrationEventCache: Map<string, OrchestrationEvent> | undefined
  // eslint-disable-next-line no-var
  var orchestrationHistoryCache: Map<string, OrchestrationTaskHistoryEntry[]> | undefined
  // eslint-disable-next-line no-var
  var orchestrationDbInitialized: boolean | undefined
}

// Initialize caches - load from file on first access
function getEventCache(): Map<string, OrchestrationEvent> {
  if (!globalThis.orchestrationEventCache) {
    globalThis.orchestrationEventCache = loadEventsFromFile()
  }
  return globalThis.orchestrationEventCache
}

function getHistoryCache(): Map<string, OrchestrationTaskHistoryEntry[]> {
  if (!globalThis.orchestrationHistoryCache) {
    globalThis.orchestrationHistoryCache = loadHistoryFromFile()
  }
  return globalThis.orchestrationHistoryCache
}

// ============ Event Operations ============

export async function saveOrchestrationEvent(
  eventId: string,
  data: Partial<OrchestrationEvent>
): Promise<{ acknowledged: boolean }> {
  const eventCache = getEventCache()
  const existing = eventCache.get(eventId)
  const updated = {
    ...existing,
    ...data,
    event_id: eventId,
    updated_at: Date.now(),
  } as OrchestrationEvent

  eventCache.set(eventId, updated)
  saveEventsToFile(eventCache) // Persist to file

  console.log(`[DB] Saved event: ${eventId} with ${updated.tasks?.length || 0} tasks, ${updated.operators?.length || 0} operators`)
  console.log(`[DB] Total events in cache: ${eventCache.size}`)

  return { acknowledged: true }
}

export async function loadOrchestrationEvent(
  eventId: string
): Promise<OrchestrationEvent | null> {
  const eventCache = getEventCache()
  console.log(`[DB] Loading event: ${eventId}, cache size: ${eventCache.size}`)

  const event = eventCache.get(eventId)
  console.log(`[DB] Load event: ${eventId} - ${event ? 'found' : 'NOT FOUND'}`)
  return event || null
}

export async function listOrchestrationEventsByDirector(
  directorId: string
): Promise<OrchestrationEvent[]> {
  const eventCache = getEventCache()
  const events: OrchestrationEvent[] = []
  eventCache.forEach((event) => {
    if (event.director_id === directorId) {
      events.push(event)
    }
  })
  return events.sort((a, b) => b.created_at - a.created_at)
}

// ============ Task Operations ============

export async function updateTask(
  eventId: string,
  taskId: string,
  updates: Partial<OrchestrationTask>
): Promise<boolean> {
  const eventCache = getEventCache()
  const event = eventCache.get(eventId)
  if (!event) return false

  const taskIndex = event.tasks.findIndex((t) => t.task_id === taskId)
  if (taskIndex === -1) return false

  event.tasks[taskIndex] = { ...event.tasks[taskIndex], ...updates }
  event.updated_at = Date.now()
  eventCache.set(eventId, event)
  saveEventsToFile(eventCache) // Persist to file

  return true
}

export async function completeTask(
  eventId: string,
  taskId: string,
  operatorId: string,
  notes?: string
): Promise<{ success: boolean; unlockedTasks?: string[]; error?: string }> {
  const eventCache = getEventCache()
  const event = eventCache.get(eventId)
  if (!event) return { success: false, error: 'Event not found' }

  // Find the task
  const taskIndex = event.tasks.findIndex((t) => t.task_id === taskId)
  if (taskIndex === -1) return { success: false, error: 'Task not found' }

  const task = event.tasks[taskIndex]

  // Validate operator scope
  const operator = event.operators.find((o) => o.operator_id === operatorId)
  if (!operator) return { success: false, error: 'Operator not found' }

  if (!operator.scope.includes(task.phase)) {
    return { success: false, error: 'Operator not authorized for this task' }
  }

  // Check task is available
  if (task.status !== 'available' && task.status !== 'in_progress') {
    return { success: false, error: `Task is ${task.status}, cannot complete` }
  }

  // Update the task
  const oldStatus = task.status
  event.tasks[taskIndex] = {
    ...task,
    status: 'completed',
    completed_at: Date.now(),
    completed_by: operatorId,
    notes: notes || task.notes,
  }

  // Check and unlock dependent tasks
  const unlockedTasks: string[] = []
  for (let i = 0; i < event.tasks.length; i++) {
    const t = event.tasks[i]
    if (t.status === 'locked' && t.depends_on.includes(taskId)) {
      // Check if all dependencies are now complete
      const allDepsComplete = t.depends_on.every((depId) => {
        const dep = event.tasks.find((dt) => dt.task_id === depId)
        return dep?.status === 'completed'
      })
      if (allDepsComplete) {
        event.tasks[i] = { ...t, status: 'available' }
        unlockedTasks.push(t.task_id)
      }
    }
  }

  // Check if checkpoint should become available
  const checkpoint = event.checkpoints.find((cp) => cp.phase === task.phase)
  if (checkpoint && checkpoint.status === 'locked') {
    const phaseTasks = event.tasks.filter((t) => t.phase === task.phase)
    const criticalTasks = phaseTasks.filter((t) => t.priority === 'critical')
    const allCriticalComplete = criticalTasks.every((t) => t.status === 'completed')
    if (allCriticalComplete) {
      const cpIndex = event.checkpoints.findIndex((cp) => cp.phase === task.phase)
      event.checkpoints[cpIndex] = { ...checkpoint, status: 'available' }
    }
  }

  event.updated_at = Date.now()
  eventCache.set(eventId, event)
  saveEventsToFile(eventCache) // Persist to file

  // Log task history
  await saveTaskHistory(eventId, {
    task_id: taskId,
    event_id: eventId,
    from_status: oldStatus,
    to_status: 'completed',
    changed_by: operatorId,
    timestamp: Date.now(),
    notes,
  })

  console.log(`[DB] Task completed: ${task.title} - unlocked ${unlockedTasks.length} tasks`)
  return { success: true, unlockedTasks }
}

export async function flagTaskBlocked(
  eventId: string,
  taskId: string,
  operatorId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  const eventCache = getEventCache()
  const event = eventCache.get(eventId)
  if (!event) return { success: false, error: 'Event not found' }

  const taskIndex = event.tasks.findIndex((t) => t.task_id === taskId)
  if (taskIndex === -1) return { success: false, error: 'Task not found' }

  const task = event.tasks[taskIndex]
  const oldStatus = task.status

  event.tasks[taskIndex] = {
    ...task,
    status: 'blocked',
    notes: reason,
  }
  event.updated_at = Date.now()
  eventCache.set(eventId, event)
  saveEventsToFile(eventCache) // Persist to file

  await saveTaskHistory(eventId, {
    task_id: taskId,
    event_id: eventId,
    from_status: oldStatus,
    to_status: 'blocked',
    changed_by: operatorId,
    timestamp: Date.now(),
    notes: reason,
  })

  return { success: true }
}

export async function addTaskNote(
  eventId: string,
  taskId: string,
  _operatorId: string,
  note: string
): Promise<{ success: boolean; error?: string }> {
  const eventCache = getEventCache()
  const event = eventCache.get(eventId)
  if (!event) return { success: false, error: 'Event not found' }

  const taskIndex = event.tasks.findIndex((t) => t.task_id === taskId)
  if (taskIndex === -1) return { success: false, error: 'Task not found' }

  event.tasks[taskIndex] = {
    ...event.tasks[taskIndex],
    notes: note,
  }
  event.updated_at = Date.now()
  eventCache.set(eventId, event)
  saveEventsToFile(eventCache) // Persist to file

  return { success: true }
}

// ============ Operator Operations ============

export async function getOperatorByCode(
  eventId: string,
  code: string
): Promise<OrchestrationOperator | null> {
  const eventCache = getEventCache()
  const event = eventCache.get(eventId)
  if (!event) return null

  return event.operators.find((o) => o.operator_id === code) || null
}

export async function updateOperatorLastActive(
  eventId: string,
  operatorId: string
): Promise<void> {
  const eventCache = getEventCache()
  const event = eventCache.get(eventId)
  if (!event) return

  const opIndex = event.operators.findIndex((o) => o.operator_id === operatorId)
  if (opIndex === -1) return

  event.operators[opIndex] = {
    ...event.operators[opIndex],
    last_active: Date.now(),
  }
  eventCache.set(eventId, event)
  saveEventsToFile(eventCache) // Persist to file
}

// ============ Checkpoint Operations ============

export async function passCheckpoint(
  eventId: string,
  phase: string,
  directorId: string
): Promise<{ success: boolean; error?: string }> {
  const eventCache = getEventCache()
  const event = eventCache.get(eventId)
  if (!event) return { success: false, error: 'Event not found' }

  // Verify director
  const director = event.operators.find((o) => o.operator_id === directorId)
  if (!director || director.role !== 'director') {
    return { success: false, error: 'Only director can pass checkpoints' }
  }

  const cpIndex = event.checkpoints.findIndex((cp) => cp.phase === phase)
  if (cpIndex === -1) return { success: false, error: 'Checkpoint not found' }

  const checkpoint = event.checkpoints[cpIndex]
  if (checkpoint.status !== 'available') {
    return { success: false, error: `Checkpoint is ${checkpoint.status}, cannot pass` }
  }

  event.checkpoints[cpIndex] = {
    ...checkpoint,
    status: 'passed',
    passed_at: Date.now(),
    passed_by: directorId,
  }

  // Check if all checkpoints passed - event complete
  const allPassed = event.checkpoints.every((cp) => cp.status === 'passed')
  if (allPassed) {
    event.status = 'completed'
  }

  event.updated_at = Date.now()
  eventCache.set(eventId, event)
  saveEventsToFile(eventCache) // Persist to file

  console.log(`[DB] Checkpoint passed: ${phase}`)
  return { success: true }
}

export async function failCheckpoint(
  eventId: string,
  phase: string,
  directorId: string
): Promise<{ success: boolean; error?: string }> {
  const eventCache = getEventCache()
  const event = eventCache.get(eventId)
  if (!event) return { success: false, error: 'Event not found' }

  // Verify director
  const director = event.operators.find((o) => o.operator_id === directorId)
  if (!director || director.role !== 'director') {
    return { success: false, error: 'Only director can fail checkpoints' }
  }

  const cpIndex = event.checkpoints.findIndex((cp) => cp.phase === phase)
  if (cpIndex === -1) return { success: false, error: 'Checkpoint not found' }

  event.checkpoints[cpIndex] = {
    ...event.checkpoints[cpIndex],
    status: 'failed',
    passed_at: Date.now(),
    passed_by: directorId,
  }
  event.updated_at = Date.now()
  eventCache.set(eventId, event)
  saveEventsToFile(eventCache) // Persist to file

  return { success: true }
}

// ============ History Operations ============

export async function saveTaskHistory(
  eventId: string,
  entry: OrchestrationTaskHistoryEntry
): Promise<void> {
  const historyCache = getHistoryCache()
  const history = historyCache.get(eventId) || []
  history.push({ ...entry, timestamp: Date.now() })
  historyCache.set(eventId, history)
  saveHistoryToFile(historyCache) // Persist to file
}

export async function getTaskHistory(
  eventId: string,
  limit = 50
): Promise<OrchestrationTaskHistoryEntry[]> {
  const historyCache = getHistoryCache()
  const history = historyCache.get(eventId) || []
  return history.slice(-limit).reverse()
}

// ============ Query Helpers ============

export async function getTasksByOperatorScope(
  eventId: string,
  operatorId: string
): Promise<OrchestrationTask[]> {
  const eventCache = getEventCache()
  const event = eventCache.get(eventId)
  if (!event) return []

  const operator = event.operators.find((o) => o.operator_id === operatorId)
  if (!operator) return []

  // Director sees all tasks
  if (operator.role === 'director') {
    return event.tasks
  }

  // Others see only their scoped phases
  return event.tasks.filter((t) => operator.scope.includes(t.phase))
}

export async function getEventProgress(eventId: string): Promise<{
  total: number
  completed: number
  percentage: number
  byPhase: Record<string, { total: number; completed: number }>
}> {
  const eventCache = getEventCache()
  const event = eventCache.get(eventId)
  if (!event) {
    return { total: 0, completed: 0, percentage: 0, byPhase: {} }
  }

  const total = event.tasks.length
  const completed = event.tasks.filter((t) => t.status === 'completed').length
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0

  const byPhase: Record<string, { total: number; completed: number }> = {}
  for (const task of event.tasks) {
    if (!byPhase[task.phase]) {
      byPhase[task.phase] = { total: 0, completed: 0 }
    }
    byPhase[task.phase].total++
    if (task.status === 'completed') {
      byPhase[task.phase].completed++
    }
  }

  return { total, completed, percentage, byPhase }
}

// ============ Debug Helpers ============

export function getAllEvents(): OrchestrationEvent[] {
  const eventCache = getEventCache()
  return Array.from(eventCache.values())
}

export function clearAllEvents(): void {
  const eventCache = getEventCache()
  const historyCache = getHistoryCache()
  eventCache.clear()
  historyCache.clear()
  saveEventsToFile(eventCache)
  saveHistoryToFile(historyCache)
}
