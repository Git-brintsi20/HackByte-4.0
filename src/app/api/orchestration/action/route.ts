/**
 * Orchestration Action API Route
 * Handles task actions: complete, flag_blocker, add_note
 */

import { NextResponse } from 'next/server'
import {
  completeTask,
  flagTaskBlocked,
  addTaskNote,
  loadOrchestrationEvent,
} from '@/lib/orchestration-db'

type ActionType = 'complete_task' | 'flag_blocker' | 'add_note'

interface ActionPayload {
  event_id: string
  task_id: string
  operator_id: string
  notes?: string
  reason?: string
}

export async function POST(req: Request) {
  try {
    const { action_type, payload } = (await req.json()) as {
      action_type: ActionType
      payload: ActionPayload
    }

    if (!action_type || !payload) {
      return NextResponse.json(
        { success: false, error: 'action_type and payload are required' },
        { status: 400 }
      )
    }

    const { event_id, task_id, operator_id } = payload

    if (!event_id || !task_id || !operator_id) {
      return NextResponse.json(
        { success: false, error: 'event_id, task_id, and operator_id are required' },
        { status: 400 }
      )
    }

    // Verify operator exists
    const event = await loadOrchestrationEvent(event_id)
    if (!event) {
      return NextResponse.json(
        { success: false, error: 'Event not found' },
        { status: 404 }
      )
    }

    const operator = event.operators.find((o) => o.operator_id === operator_id)
    if (!operator) {
      return NextResponse.json(
        { success: false, error: 'Invalid operator' },
        { status: 401 }
      )
    }

    let result: { success: boolean; error?: string; unlockedTasks?: string[] }

    switch (action_type) {
      case 'complete_task':
        result = await completeTask(event_id, task_id, operator_id, payload.notes)
        break

      case 'flag_blocker':
        if (!payload.reason) {
          return NextResponse.json(
            { success: false, error: 'reason is required for flag_blocker' },
            { status: 400 }
          )
        }
        result = await flagTaskBlocked(event_id, task_id, operator_id, payload.reason)
        break

      case 'add_note':
        if (!payload.notes) {
          return NextResponse.json(
            { success: false, error: 'notes is required for add_note' },
            { status: 400 }
          )
        }
        result = await addTaskNote(event_id, task_id, operator_id, payload.notes)
        break

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action type: ${action_type}` },
          { status: 400 }
        )
    }

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        action: action_type,
        task_id,
        unlocked_tasks: result.unlockedTasks || [],
      },
    })
  } catch (error) {
    console.error('Orchestration action error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Action failed',
      },
      { status: 500 }
    )
  }
}

// GET endpoint to fetch current event state
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const event_id = searchParams.get('event_id')
    const operator_id = searchParams.get('operator_id')

    if (!event_id) {
      return NextResponse.json(
        { success: false, error: 'event_id is required' },
        { status: 400 }
      )
    }

    const event = await loadOrchestrationEvent(event_id)
    if (!event) {
      return NextResponse.json(
        { success: false, error: 'Event not found' },
        { status: 404 }
      )
    }

    // If operator_id provided, filter tasks to their scope
    if (operator_id) {
      const operator = event.operators.find((o) => o.operator_id === operator_id)
      if (!operator) {
        return NextResponse.json(
          { success: false, error: 'Invalid operator' },
          { status: 401 }
        )
      }

      // Director sees everything
      if (operator.role !== 'director') {
        event.tasks = event.tasks.filter((t) => operator.scope.includes(t.phase))
      }
    }

    return NextResponse.json({
      success: true,
      data: event,
    })
  } catch (error) {
    console.error('Orchestration fetch error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch event',
      },
      { status: 500 }
    )
  }
}
