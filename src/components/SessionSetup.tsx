import { useState } from 'react';
import { useGameRules } from '../context/GameRulesContext';
import { loadSessionSnapshot } from '../services/persist';
import { EXAMPLE_COMPLEX_RULESET } from '../data/exampleRulesTemplates';

type Props = {
  onStart: (opts: { restoreSnapshot: boolean }) => void;
};

export function SessionSetup({ onStart }: Props) {
  const { compileFromText, setFromCompiled } = useGameRules();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const snap = loadSessionSnapshot();

  const handleCompileAndStart = async () => {
    setErr(null);
    setBusy(true);
    try {
      if (text.trim()) await compileFromText(text.trim());
      else setFromCompiled(null, '');
      onStart({ restoreSnapshot: false });
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleSkipLinear = () => {
    setFromCompiled(null, '');
    setErr(null);
    onStart({ restoreSnapshot: false });
  };

  const handleRestore = () => {
    onStart({ restoreSnapshot: true });
  };

  return (
    <div className="setup">
      <div className="setup__card">
        <p className="setup__eyebrow">VoiceTrack</p>
        <h1 className="setup__title">Session setup</h1>
        <p className="setup__lede">
          Describe your game rules once (Mode A). We compile a Rule Manifest via Groq
          and inject it into every voice command. Skip to use linear / quiz scoring only
          (Section 0.5).
        </p>

        <label className="setup__label" htmlFor="rules">
          Natural language rules
        </label>
        <textarea
          id="rules"
          className="setup__textarea"
          rows={6}
          placeholder='e.g. "1v1 fighting tournament: when someone defeats another, winner +10, loser status defeated. Say revive player X once per match."'
          value={text}
          onChange={(e) => setText(e.target.value)}
        />

        {err && <p className="setup__error">{err}</p>}

        <div className="setup__template-row">
          <button
            type="button"
            className="btn btn--secondary"
            disabled={busy}
            onClick={() => {
              setText(EXAMPLE_COMPLEX_RULESET);
              setErr(null);
            }}
          >
            Load example complex ruleset
          </button>
        </div>

        <div className="setup__actions">
          <button
            type="button"
            className="btn btn--primary"
            disabled={busy}
            onClick={handleCompileAndStart}
          >
            {busy ? 'Compiling…' : 'Compile rules & start'}
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            disabled={busy}
            onClick={handleSkipLinear}
          >
            Skip — linear scoring
          </button>
        </div>

        {snap.state?.participants?.length ? (
          <div className="setup__restore">
            <p className="setup__restore-note">
              Found saved board ({snap.state.participants.length} participants).
            </p>
            <button type="button" className="btn btn--secondary" onClick={handleRestore}>
              Restore snapshot & go live
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
