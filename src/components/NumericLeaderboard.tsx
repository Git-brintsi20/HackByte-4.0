import { LayoutGroup, AnimatePresence, motion } from 'framer-motion';
import { TeamCard } from './TeamCard';
import type { Participant } from '../types';

type Props = {
  participants: Participant[];
  onLayoutRootComplete?: () => void;
};

/** Sorted leaderboard with FLIP layout + popLayout exits (Section 4.2) */
export function NumericLeaderboard({ participants, onLayoutRootComplete }: Props) {
  const sorted = [...participants].sort((a, b) => b.score - a.score);

  return (
    <LayoutGroup id="leaderboard">
      <motion.div
        layout
        className="leaderboard-shell"
        onLayoutAnimationComplete={onLayoutRootComplete}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
      >
        <ul className="leaderboard-list">
          <AnimatePresence mode="popLayout" initial={false}>
            {sorted.map((p) => (
              <motion.li
                key={p.id}
                layout
                className="leaderboard-item"
                transition={{ type: 'spring', stiffness: 320, damping: 30 }}
              >
                <TeamCard data={p} />
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      </motion.div>
    </LayoutGroup>
  );
}
