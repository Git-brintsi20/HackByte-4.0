import { motion } from 'framer-motion';
import type { Participant } from '../types';

function DefeatedBadge() {
  return (
    <span className="defeated-badge" aria-label="Eliminated">
      Out
    </span>
  );
}

function norm(s?: string) {
  return String(s ?? 'active').toLowerCase();
}

/** TeamCard — status-aware rendering + optional token/timed pills (Section 0.4) */
export function TeamCard({ data }: { data: Participant }) {
  const st = norm(data.status);
  const isDefeated = st === 'defeated';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 28 }}
      animate={{
        opacity: isDefeated ? 0.45 : 1,
        x: 0,
        filter: isDefeated ? 'grayscale(1)' : 'none',
      }}
      exit={{ opacity: 0, scale: 0.92, backgroundColor: 'rgba(239,68,68,0.25)' }}
      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
      className={`team-card team-card--${st} ${isDefeated ? 'team-card--defeated' : ''}`}
      style={{
        borderLeftColor: data.avatarColor || '#6366f1',
      }}
    >
      <div className="team-card__accent" style={{ background: data.avatarColor }} />
      <div className="team-card__body">
        <div className="team-card__top">
          <h3 className={`team-card__name ${isDefeated ? 'strike' : ''}`}>
            {data.name}
          </h3>
          {isDefeated && <DefeatedBadge />}
        </div>
        <div className="team-card__score-row">
          <span className="team-card__score-label">Score</span>
          <span className="team-card__score">{data.score}</span>
        </div>
        <div className="team-card__badges">
          {!isDefeated && st !== 'active' && (
            <span className={`team-card__pill team-card__pill--${st}`}>{st}</span>
          )}
          {data.momentumBuff ? (
            <span className="team-card__pill team-card__pill--momentum">Momentum</span>
          ) : null}
          {typeof data.shieldRoundsRemaining === 'number' && data.shieldRoundsRemaining > 0 ? (
            <span className="team-card__pill team-card__pill--shield">
              Shield {data.shieldRoundsRemaining}r
            </span>
          ) : null}
          {typeof data.cursedRoundsRemaining === 'number' && data.cursedRoundsRemaining > 0 ? (
            <span className="team-card__pill team-card__pill--curse">
              Curse {data.cursedRoundsRemaining}r
            </span>
          ) : null}
          {(data.reviveToken !== undefined || data.shieldToken !== undefined) && (
            <>
              {data.reviveToken !== false && data.reviveUsed !== true ? (
                <span className="team-card__pill team-card__pill--token">Revive</span>
              ) : null}
              {data.shieldToken !== false ? (
                <span className="team-card__pill team-card__pill--token">Shield tok</span>
              ) : null}
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}
