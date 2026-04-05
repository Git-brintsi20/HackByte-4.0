/**
 * Orchestration Tasks API Route
 * CRUD operations for manual task management
 */

import { NextResponse } from 'next/server'
import {
  loadOrchestrationEvent,
  saveOrchestrationEvent,
} from '@/lib/orchestration-db'
import { generateUUID } from '@/lib/orchestration-agent'
import type { OrchestrationTask, OrchestrationPhaseId, OrchestrationOperatorRole } from '@/types'

export const dynamic = 'force-dynamic'

// GET - Get tasks for an event
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const eventId = searchParams.get('event_id')

    if (!eventId) {
      return NextResponse.json(
        { success: false, error: 'event_id is required' },
        { status: 400 }
      )
    }

    const event = await loadOrchestrationEvent(eventId)
    if (!event) {
      return NextResponse.json(
        { success: false, error: 'Event not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: event.tasks,
    })
  } catch (error) {
    console.error('Get tasks error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to get tasks' },
      { status: 500 }
    )
  }
}

// POST - Add a new task
export async function POST(req: Request) {
  try {
    const { event_id, operator_id, task } = await req.json()

    if (!event_id || !operator_id || !task) {
      return NextResponse.json(
        { success: false, error: 'event_id, operator_id, and task are required' },
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

    // Verify operator is director
    const operator = event.operators.find((o) => o.operator_id === operator_id)
    if (!operator || operator.role !== 'director') {
      return NextResponse.json(
        { success: false, error: 'Only director can add tasks' },
        { status: 403 }
      )
    }

    // Create new task
    const newTask: OrchestrationTask = {
      task_id: generateUUID(),
      event_id: event_id,
      title: task.title,
      description: task.description || '',
      phase: task.phase as OrchestrationPhaseId,
      status: task.depends_on?.length > 0 ? 'locked' : 'available',
      assigned_role: task.assigned_role as OrchestrationOperatorRole,
      depends_on: task.depends_on || [],
      priority: task.priority || 'medium',
      deadline: task.deadline ? new Date(task.deadline).getTime() : undefined,
      created_at: Date.now(),
    }

    // Check if dependencies exist and are valid
    if (newTask.depends_on.length > 0) {
      const validDeps = newTask.depends_on.filter((depId: string) =>
        event.tasks.some((t) => t.task_id === depId)
      )
      newTask.depends_on = validDeps

      // Check if all dependencies are complete - if so, make available
      const allDepsComplete = validDeps.every((depId: string) => {
        const dep = event.tasks.find((t) => t.task_id === depId)
        return dep?.status === 'completed'
      })
      if (allDepsComplete) {
        newTask.status = 'available'
      }
    }

    event.tasks.push(newTask)
    await saveOrchestrationEvent(event_id, event)

    return NextResponse.json({
      success: true,
      data: newTask,
    })
  } catch (error) {
    console.error('Add task error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to add task' },
      { status: 500 }
    )
  }
}

// PUT - Update a task
export async function PUT(req: Request) {
  try {
    const { event_id, operator_id, task_id, updates } = await req.json()

    if (!event_id || !operator_id || !task_id || !updates) {
      return NextResponse.json(
        { success: false, error: 'event_id, operator_id, task_id, and updates are required' },
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

    // Verify operator is director
    const operator = event.operators.find((o) => o.operator_id === operator_id)
    if (!operator || operator.role !== 'director') {
      return NextResponse.json(
        { success: false, error: 'Only director can edit tasks' },
        { status: 403 }
      )
    }

    // Find task
    const taskIndex = event.tasks.findIndex((t) => t.task_id === task_id)
    if (taskIndex === -1) {
      return NextResponse.json(
        { success: false, error: 'Task not found' },
        { status: 404 }
      )
    }

    const existingTask = event.tasks[taskIndex]

    // Update allowed fields
    const updatedTask: OrchestrationTask = {
      ...existingTask,
      title: updates.title ?? existingTask.title,
      description: updates.description ?? existingTask.description,
      phase: updates.phase ?? existingTask.phase,
      assigned_role: updates.assigned_role ?? existingTask.assigned_role,
      priority: updates.priority ?? existingTask.priority,
      deadline: updates.deadline ? new Date(updates.deadline).getTime() : existingTask.deadline,
      depends_on: updates.depends_on ?? existingTask.depends_on,
    }

    // Recalculate status based on dependencies
    if (updatedTask.status !== 'completed') {
      if (updatedTask.depends_on.length === 0) {
        updatedTask.status = 'available'
      } else {
        const allDepsComplete = updatedTask.depends_on.every((depId) => {
          const dep = event.tasks.find((t) => t.task_id === depId)
          return dep?.status === 'completed'
        })
        updatedTask.status = allDepsComplete ? 'available' : 'locked'
      }
    }

    event.tasks[taskIndex] = updatedTask
    await saveOrchestrationEvent(event_id, event)

    return NextResponse.json({
      success: true,
      data: updatedTask,
    })
  } catch (error) {
    console.error('Update task error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update task' },
      { status: 500 }
    )
  }
}

// DELETE - Remove a task
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const eventId = searchParams.get('event_id')
    const operatorId = searchParams.get('operator_id')
    const taskId = searchParams.get('task_id')

    if (!eventId || !operatorId || !taskId) {
      return NextResponse.json(
        { success: false, error: 'event_id, operator_id, and task_id are required' },
        { status: 400 }
      )
    }

    const event = await loadOrchestrationEvent(eventId)
    if (!event) {
      return NextResponse.json(
        { success: false, error: 'Event not found' },
        { status: 404 }
      )
    }

    // Verify operator is director
    const operator = event.operators.find((o) => o.operator_id === operatorId)
    if (!operator || operator.role !== 'director') {
      return NextResponse.json(
        { success: false, error: 'Only director can delete tasks' },
        { status: 403 }
      )
    }

    // Find task
    const taskIndex = event.tasks.findIndex((t) => t.task_id === taskId)
    if (taskIndex === -1) {
      return NextResponse.json(
        { success: false, error: 'Task not found' },
        { status: 404 }
      )
    }

    // Remove task
    const removedTask = event.tasks.splice(taskIndex, 1)[0]

    // Update any tasks that depended on this task
    for (let i = 0; i < event.tasks.length; i++) {
      const t = event.tasks[i]
      if (t.depends_on.includes(taskId)) {
        // Remove this task from dependencies
        const newDeps = t.depends_on.filter((d) => d !== taskId)
        event.tasks[i] = { ...t, depends_on: newDeps }

        // Recalculate status
        if (t.status === 'locked') {
          if (newDeps.length === 0) {
            event.tasks[i].status = 'available'
          } else {
            const allDepsComplete = newDeps.every((depId) => {
              const dep = event.tasks.find((dt) => dt.task_id === depId)
              return dep?.status === 'completed'
            })
            if (allDepsComplete) {
              event.tasks[i].status = 'available'
            }
          }
        }
      }
    }

    await saveOrchestrationEvent(eventId, event)

    return NextResponse.json({
      success: true,
      data: { removed: removedTask.title, updated_dependencies: true },
    })
  } catch (error) {
    console.error('Delete task error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete task' },
      { status: 500 }
    )
  }
}
