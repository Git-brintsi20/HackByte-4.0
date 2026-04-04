import { GameRulesProvider, useGameRules } from './context/GameRulesContext';
import { VoiceTrackProvider, useVoiceTrack } from './context/VoiceTrackContext';
import { SessionSetup } from './components/SessionSetup';
import { EventBoard } from './components/EventBoard';
import { OperatorConsole } from './components/OperatorConsole';
import { loadSessionSnapshot } from './services/persist';

function LiveEventShell() {
  const { setFromCompiled } = useGameRules();
  const {
    sessionStarted,
    setSessionStarted,
    importLiveState,
    onRootLayoutComplete,
  } = useVoiceTrack();

  const handleStart = (opts: { restoreSnapshot: boolean }) => {
    if (opts.restoreSnapshot) {
      const snap = loadSessionSnapshot();
      if (snap.state) importLiveState(snap.state);
      setFromCompiled(snap.rules, snap.rawDescription);
    }
    setSessionStarted(true);
  };

  if (!sessionStarted) {
    return <SessionSetup onStart={handleStart} />;
  }

  return <MainStage onRootLayoutComplete={onRootLayoutComplete} />;
}

function MainStage({
  onRootLayoutComplete,
}: {
  onRootLayoutComplete: () => void;
}) {
  const { state } = useVoiceTrack();

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header__brand">
          <span className="app-logo">VoiceTrack</span>
          <span className="app-tagline">Generative UI · Groq · Voice</span>
        </div>
        <div className="app-header__meta">
          <span>Round {state.round}</span>
          <span className="dot" aria-hidden />
          <span className="capitalize">{state.scoring_mode.replace('_', ' ')}</span>
          {state.suddenDeath ? (
            <>
              <span className="dot" aria-hidden />
              <span className="late-stage-badge">Late-stage</span>
            </>
          ) : null}
        </div>
      </header>
      <div className="app-grid">
        <main className="app-main">
          <EventBoard state={state} onLayoutRootComplete={onRootLayoutComplete} />
        </main>
        <OperatorConsole />
      </div>
    </div>
  );
}

function AppProviders() {
  return (
    <GameRulesProvider>
      <VoiceTrackProvider>
        <LiveEventShell />
      </VoiceTrackProvider>
    </GameRulesProvider>
  );
}

export default AppProviders;
