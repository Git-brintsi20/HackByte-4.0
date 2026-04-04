/**
 * Orchestration Plan API Route
 * Streams Gemini response for event planning conversation
 *
 * IMPORTANT: This route ONLY streams text. It does NOT write to any database.
 */

import { streamText } from 'ai'
import { google } from '@ai-sdk/google'
import { ORCHESTRATION_AGENT_SYSTEM_PROMPT } from '@/lib/orchestration-agent'

export const runtime = 'edge'

export async function POST(req: Request) {
  try {
    const { messages } = await req.json()

    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: 'Messages array is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const result = streamText({
      model: google('gemini-2.5-flash'),
      system: ORCHESTRATION_AGENT_SYSTEM_PROMPT,
      messages,
      temperature: 0.2, // Low temperature for consistent JSON output
    })

    return result.toDataStreamResponse()
  } catch (error) {
    console.error('Orchestration plan error:', error)
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to generate plan'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
