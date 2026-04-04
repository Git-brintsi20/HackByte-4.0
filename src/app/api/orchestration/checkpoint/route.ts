/**
 * Orchestration Checkpoint API Route
 * Handles checkpoint pass/fail actions (director only)
 */

import { NextResponse } from 'next/server'
import { passCheckpoint, failCheckpoint, loadOrchestrationEvent } from '@/lib/orchestration-db'

export async function POST(req: Request) {
  try {
    const { event_id, phase, action, director_id } = await req.json()

    if (!event_id || !phase || !action || !director_id) {
      return NextResponse.json(
        { success: false, error: 'event_id, phase, action, and director_id are required' },
        { status: 400 }
      )
    }

    if (action !== 'pass' && action !== 'fail') {
      return NextResponse.json(
        { success: false, error: 'action must be "pass" or "fail"' },
        { status: 400 }
      )
    }

    // Verify director
    const event = await loadOrchestrationEvent(event_id)
    if (!event) {
      return NextResponse.json(
        { success: false, error: 'Event not found' },
        { status: 404 }
      )
    }

    const director = event.operators.find((o) => o.operator_id === director_id)
    if (!director || director.role !== 'director') {
      return NextResponse.json(
        { success: false, error: 'Only director can manage checkpoints' },
        { status: 403 }
      )
    }

    let result: { success: boolean; error?: string }

    if (action === 'pass') {
      result = await passCheckpoint(event_id, phase, director_id)
    } else {
      result = await failCheckpoint(event_id, phase, director_id)
    }

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      )
    }

    // Reload event to get updated state
    const updatedEvent = await loadOrchestrationEvent(event_id)

    return NextResponse.json({
      success: true,
      data: {
        action,
        phase,
        event_status: updatedEvent?.status,
        checkpoints: updatedEvent?.checkpoints,
      },
    })
  } catch (error) {
    console.error('Orchestration checkpoint error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Checkpoint action failed',
      },
      { status: 500 }
    )
  }
}
