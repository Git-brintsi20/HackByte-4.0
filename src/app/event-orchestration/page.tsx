'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { CalendarClock, ClipboardCheck, RadioTower, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const pillars = [
  {
    title: 'Timeline Control',
    text: 'Sequence sessions, transition cues, and deadline checkpoints from one board.',
    icon: CalendarClock,
  },
  {
    title: 'Task Broadcasting',
    text: 'Assign producer, host, and ops duties with instant visibility across teams.',
    icon: RadioTower,
  },
  {
    title: 'Execution Assurance',
    text: 'Track completion and surface blockers before they affect attendee experience.',
    icon: ClipboardCheck,
  },
  {
    title: 'Crew Coordination',
    text: 'Keep marshals, judges, and volunteers synchronized throughout the event.',
    icon: Users,
  },
]

export default function EventOrchestrationPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100 sm:px-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-cyan-200">Orchestration Space</p>
            <h1 className="text-4xl font-semibold">Event Operations Board</h1>
            <p className="mt-2 max-w-3xl text-slate-300">
              This module is now ready for your orchestration workflows. Use this screen as your command center for event-wide coordination.
            </p>
          </div>
          <Link href="/">
            <Button className="bg-cyan-300 text-slate-950 hover:bg-cyan-200">Back To Landing</Button>
          </Link>
        </div>

        <section className="grid gap-4 sm:grid-cols-2">
          {pillars.map((pillar, index) => {
            const Icon = pillar.icon
            return (
              <motion.div
                animate={{ opacity: 1, y: 0 }}
                initial={{ opacity: 0, y: 18 }}
                key={pillar.title}
                transition={{ duration: 0.35, delay: index * 0.07 }}
              >
                <Card className="h-full border-white/15 bg-slate-900/50 text-slate-100">
                  <CardHeader>
                    <CardTitle className="inline-flex items-center gap-2 text-xl">
                      <Icon className="h-5 w-5 text-cyan-200" />
                      {pillar.title}
                    </CardTitle>
                    <CardDescription className="text-slate-300">{pillar.text}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-slate-400">Add your orchestration widgets, schedule ingest, and crew communication channels here.</p>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </section>
      </div>
    </main>
  )
}
