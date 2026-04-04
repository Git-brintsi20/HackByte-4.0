/**
 * Orchestration Agent Logic
 * AI system prompt, parsing, and utility functions for event planning
 */

import type {
  OrchestrationEventConfigInput,
  OrchestrationEvent,
  OrchestrationTask,
  OrchestrationOperator,
  OrchestrationCheckpoint,
  OrchestrationPhaseId,
  OrchestrationOperatorRole,
} from '@/types'

// ============ System Prompt ============

export const ORCHESTRATION_AGENT_SYSTEM_PROMPT = `You are Elixa's event planning agent. Your job is to parse a plain English description of an event and produce a structured EventConfig JSON.

RULES:
1. Ask at most 2 clarifying questions if critical info is missing.
2. Never guess volunteer count - always ask if not stated.
3. Generate realistic deadlines relative to the event date.
4. Always generate a Go/No-Go phase as the final checkpoint.
5. Assign every task to a role - never leave assigned_role empty.
6. Output ONLY valid JSON. No preamble, no explanation, no markdown fences.
7. Generate 5-10 tasks per phase for realistic coverage.
8. Set critical priority for tasks that block major decisions.
9. Use depends_on_titles to reference other tasks by their exact title string.

PHASES (in order):
- permissions: Institute approvals, date confirmations, insurance, food permits
- venue: Hall booking, AV equipment, seating layout, power backup
- sponsors: Outreach, follow-ups, confirmations, payment tracking
- registrations: Platform setup, link sharing, deadline setting, team shortlisting
- volunteers: Briefings, role assignments, T-shirt distribution, schedule sharing
- gonogo: Final checklist review, contingency plans, launch readiness

ROLES:
- director: Event manager, can see and control everything
- venue_lead: Responsible for venue phase tasks
- sponsor_lead: Responsible for sponsor phase tasks
- tech_lead: Responsible for registrations/tech tasks
- volunteer_coord: Responsible for volunteer coordination
- volunteer: Generic volunteer for specific assigned tasks

OUTPUT SCHEMA:
{
  "name": string,
  "date": ISO8601 string,
  "venue": string,
  "participant_count": number,
  "phases": [
    {
      "id": "permissions" | "venue" | "sponsors" | "registrations" | "volunteers" | "gonogo",
      "label": string,
      "tasks": [
        {
          "title": string,
          "description": string,
          "assigned_role": "director" | "venue_lead" | "sponsor_lead" | "tech_lead" | "volunteer_coord" | "volunteer",
          "priority": "critical" | "high" | "medium" | "low",
          "deadline": ISO8601 string,
          "depends_on_titles": string[]
        }
      ]
    }
  ],
  "roles": [
    { "role": string, "label": string, "scope": string[] }
  ]
}

IMPORTANT:
- depends_on_titles must contain exact title strings of other tasks
- Each phase should have at least one critical task
- Deadlines should be sequenced logically (earlier phases have earlier deadlines)
- The gonogo phase should depend on key tasks from other phases being complete`

// ============ Code Generation ============

const ROLE_PREFIXES: Record<OrchestrationOperatorRole, string> = {
  director: 'DIR',
  venue_lead: 'VEN',
  sponsor_lead: 'SPO',
  tech_lead: 'TEC',
  volunteer_coord: 'VOL',
  volunteer: 'V',
}

function generateRandomCode(length: number = 4): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // Avoid ambiguous chars
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

export function generateOperatorCode(role: OrchestrationOperatorRole): string {
  const prefix = ROLE_PREFIXES[role]
  const code = generateRandomCode(4)
  if (role === 'director') {
    return `${prefix}-${code}`
  }
  return `OP-${prefix}-${code}`
}

export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

// ============ Parsing & Validation ============

export function parseEventConfig(rawJson: string): OrchestrationEventConfigInput | null {
  try {
    // Try to extract JSON from the response (in case there's any wrapping)
    const jsonMatch = rawJson.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.error('No JSON found in response')
      return null
    }

    const config = JSON.parse(jsonMatch[0]) as OrchestrationEventConfigInput

    // Validate required fields
    if (!config.name || !config.date || !config.phases || !Array.isArray(config.phases)) {
      console.error('Missing required fields in config')
      return null
    }

    // Validate phases
    const validPhases: OrchestrationPhaseId[] = [
      'permissions',
      'venue',
      'sponsors',
      'registrations',
      'volunteers',
      'gonogo',
    ]

    for (const phase of config.phases) {
      if (!validPhases.includes(phase.id as OrchestrationPhaseId)) {
        console.error(`Invalid phase id: ${phase.id}`)
        return null
      }
      if (!phase.tasks || !Array.isArray(phase.tasks)) {
        console.error(`Phase ${phase.id} has no tasks`)
        return null
      }
    }

    return config
  } catch (error) {
    console.error('Failed to parse event config:', error)
    return null
  }
}

// ============ Two-Pass Dependency Resolution ============

export function resolveTaskDependencies(
  config: OrchestrationEventConfigInput,
  eventId: string,
  directorId: string
): OrchestrationEvent {
  const now = Date.now()

  // FIRST PASS: Generate all task IDs and build title→id map
  const titleToId: Record<string, string> = {}
  const stagedTasks: Array<{
    task: OrchestrationTask
    dependsOnTitles: string[]
  }> = []

  for (const phase of config.phases) {
    for (const taskInput of phase.tasks) {
      const taskId = generateUUID()
      titleToId[taskInput.title] = taskId

      const task: OrchestrationTask = {
        task_id: taskId,
        event_id: eventId,
        title: taskInput.title,
        description: taskInput.description,
        phase: phase.id as OrchestrationPhaseId,
        status: 'locked', // Will be updated after dependency resolution
        assigned_role: taskInput.assigned_role as OrchestrationOperatorRole,
        depends_on: [], // Will be resolved in second pass
        deadline: taskInput.deadline ? new Date(taskInput.deadline).getTime() : undefined,
        priority: taskInput.priority,
        created_at: now,
      }

      stagedTasks.push({
        task,
        dependsOnTitles: taskInput.depends_on_titles || [],
      })
    }
  }

  // SECOND PASS: Resolve depends_on_titles to actual task_ids
  for (const staged of stagedTasks) {
    staged.task.depends_on = staged.dependsOnTitles
      .map((title) => titleToId[title])
      .filter(Boolean)

    // Set initial status based on dependencies
    if (staged.task.depends_on.length === 0) {
      staged.task.status = 'available'
    }
  }

  // Generate operator codes for each role
  const operators: OrchestrationOperator[] = []
  const roleLabels: Record<OrchestrationOperatorRole, string> = {
    director: 'Director',
    venue_lead: 'Venue Lead',
    sponsor_lead: 'Sponsor Lead',
    tech_lead: 'Tech Lead',
    volunteer_coord: 'Volunteer Coordinator',
    volunteer: 'Volunteer',
  }

  // Director always gets a code
  operators.push({
    operator_id: directorId,
    event_id: eventId,
    role: 'director',
    label: 'Director',
    scope: ['permissions', 'venue', 'sponsors', 'registrations', 'volunteers', 'gonogo'],
  })

  // Generate codes for other roles from config
  if (config.roles) {
    for (const roleConfig of config.roles) {
      if (roleConfig.role === 'director') continue // Already added

      const role = roleConfig.role as OrchestrationOperatorRole
      operators.push({
        operator_id: generateOperatorCode(role),
        event_id: eventId,
        role: role,
        label: roleConfig.label || roleLabels[role],
        scope: roleConfig.scope as OrchestrationPhaseId[],
      })
    }
  } else {
    // Default roles if not specified
    const defaultRoles: Array<{ role: OrchestrationOperatorRole; scope: OrchestrationPhaseId[] }> = [
      { role: 'venue_lead', scope: ['venue'] },
      { role: 'sponsor_lead', scope: ['sponsors'] },
      { role: 'tech_lead', scope: ['registrations'] },
      { role: 'volunteer_coord', scope: ['volunteers'] },
    ]

    for (const r of defaultRoles) {
      operators.push({
        operator_id: generateOperatorCode(r.role),
        event_id: eventId,
        role: r.role,
        label: roleLabels[r.role],
        scope: r.scope,
      })
    }
  }

  // Generate checkpoints for each phase
  const checkpoints: OrchestrationCheckpoint[] = config.phases.map((phase) => {
    const phaseTasks = stagedTasks.filter((st) => st.task.phase === phase.id)
    const criticalTaskIds = phaseTasks
      .filter((st) => st.task.priority === 'critical')
      .map((st) => st.task.task_id)

    return {
      checkpoint_id: generateUUID(),
      event_id: eventId,
      phase: phase.id as OrchestrationPhaseId,
      name: `${phase.label} Complete`,
      status: 'locked',
      required_task_ids: criticalTaskIds.length > 0 ? criticalTaskIds : phaseTasks.map((st) => st.task.task_id),
    }
  })

  // Build the full event
  const event: OrchestrationEvent = {
    event_id: eventId,
    name: config.name,
    description: '', // Will be set from original input
    date: new Date(config.date).getTime(),
    venue: config.venue || '',
    participant_count: config.participant_count || 0,
    status: 'active',
    created_at: now,
    updated_at: now,
    director_id: directorId,
    tasks: stagedTasks.map((st) => st.task),
    operators,
    checkpoints,
  }

  return event
}

// ============ Phase Labels ============

export const PHASE_LABELS: Record<OrchestrationPhaseId, string> = {
  permissions: 'Permissions & Approvals',
  venue: 'Venue & Logistics',
  sponsors: 'Sponsors & Funding',
  registrations: 'Registrations & Tech',
  volunteers: 'Volunteers & Teams',
  gonogo: 'Go / No-Go',
}

export const PHASE_ORDER: OrchestrationPhaseId[] = [
  'permissions',
  'venue',
  'sponsors',
  'registrations',
  'volunteers',
  'gonogo',
]
