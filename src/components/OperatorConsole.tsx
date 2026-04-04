import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { useVoiceTrack } from '../context/VoiceTrackContext';
import { useGameRules } from '../context/GameRulesContext';

export function OperatorConsole() {
  const {
    runTranscript,
    processing,
    lastTranscript,
    lastAgentTrace,
    undo,
    redo,
    canUndo,
    canRedo,
    state,
  } = useVoiceTrack();
  const { ruleManifest, rawDescription } = useGameRules();

  const { status, lastError, start, stop } = useSpeechRecognition((t) => {
    void runTranscript(t);
  });

  return (
    <aside className="console">
      <div className="console__header">
        <h2>Operator</h2>
        <div className="console__chips">
          <span className="chip">{ruleManifest ? 'Non-linear rules' : 'Linear mode'}</span>
          <span className="chip chip--muted">{state.scoring_mode}</span>
          {state.suddenDeath ? (
            <span className="chip chip--danger">Late-stage mode</span>
          ) : null}
          {ruleManifest?.rulesetLabel ? (
            <span className="chip chip--ruleset" title="Ruleset label from compile">
              {ruleManifest.rulesetLabel}
            </span>
          ) : null}
        </div>
      </div>

      <p className="console__hint">
        Continuous listening: interim results off; recognition restarts on end/error.
      </p>

      <div className="console__mic">
        {status !== 'listening' ? (
          <button type="button" className="btn btn--primary btn--lg" onClick={start}>
            Start listening
          </button>
        ) : (
          <button type="button" className="btn btn--danger btn--lg" onClick={stop}>
            Stop listening
          </button>
        )}
        {lastError && <p className="console__error">{lastError}</p>}
      </div>

      <div className="console__row">
        <button
          type="button"
          className="btn btn--ghost"
          disabled={!canUndo}
          onClick={() => undo()}
        >
          Undo
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          disabled={!canRedo}
          onClick={() => redo()}
        >
          Redo
        </button>
      </div>

      {processing && <p className="console__processing">Groq agent running…</p>}

      <section className="console__section">
        <h3>Last transcript</h3>
        <pre className="console__pre">{lastTranscript || '—'}</pre>
      </section>

      <section className="console__section">
        <h3>ReAct trace</h3>
        <pre className="console__pre console__pre--sm">{lastAgentTrace || '—'}</pre>
      </section>

      {ruleManifest && (
        <section className="console__section">
          <h3>Rule manifest (summary)</h3>
          <pre className="console__pre console__pre--sm">
            {JSON.stringify(
              {
                scoringType: ruleManifest.scoringType,
                triggers: ruleManifest.triggers?.length ?? 0,
                statusValues: ruleManifest.statusValues,
              },
              null,
              2,
            )}
          </pre>
        </section>
      )}

      {rawDescription.length > 0 && (
        <section className="console__section">
          <h3>Raw rules text</h3>
          <p className="console__muted">
            {rawDescription.length > 400
              ? `${rawDescription.slice(0, 400)}…`
              : rawDescription}
          </p>
        </section>
      )}
    </aside>
  );
}
