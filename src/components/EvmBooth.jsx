import { useEffect, useRef, useState } from 'react';
import { useStore, uid, FINGER_NAMES, computeWinner, FINALIZED_STATUSES } from '../state/store.jsx';

function newSessionState() {
  return {
    evmId: 'EVM-01',
    qrToken: uid('QR'),
    step: 'WAITING_QR',
    pendingVoterId: null,
    verifiedVoterId: null,
    selectedPartyId: null,
    lastTxRef: null
  };
}

function QrGrid() {
  // purely decorative pattern, regenerated per render of the waiting screen
  const cells = Array.from({ length: 81 }, () => Math.random() > 0.55);
  return (
    <div className="qr-box">
      <div className="qr-grid">
        {cells.map((on, i) => <div key={i} className={on ? 'on' : ''} />)}
      </div>
    </div>
  );
}

export default function EvmBooth() {
  const {
    currentElection, voters,
    lookupVoterById, logUnknownVoterAttempt, logFingerprintVerified, checkAndLogDuplicate, submitVote
  } = useStore();

  const [session, setSession] = useState(newSessionState);
  const dupAttemptsRef = useRef({});
  const [idInput, setIdInput] = useState('');

  const resetEvm = () => {
    setSession(newSessionState());
    setIdInput('');
  };

  // Reset the booth whenever the selected election changes (e.g. admin switches election).
  useEffect(() => { resetEvm(); }, [currentElection?.id]);

  if (!currentElection) {
    return (
      <div className="evm-stage">
        <Kiosk statusPill={{ cls: 'status-off', label: 'NO ELECTION' }} electionName="No election selected">
          <div className="evm-title">Waiting for election</div>
          <div className="evm-sub">Create and start an election from the Control Room.</div>
        </Kiosk>
      </div>
    );
  }

  const el = currentElection;
  const statusPill = el.status === 'LIVE'
    ? { cls: 'status-live', label: 'LIVE' }
    : el.status === 'PAUSED'
      ? { cls: 'status-paused', label: 'PAUSED' }
      : { cls: 'status-off', label: el.status };

  if (el.status !== 'LIVE') {
    const ended = FINALIZED_STATUSES.includes(el.status);
    const w = ended ? computeWinner(el) : null;
    return (
      <div className="evm-stage">
        <Kiosk statusPill={statusPill} electionName={el.name} sessionTag="—">
          <div className="ridge-mark">
            <svg width="46" height="46" viewBox="0 0 100 100" fill="none">
              <path d="M50 15 C25 15 15 32 15 50 C15 70 28 85 40 90" stroke="#5C6579" strokeWidth="4" strokeLinecap="round" />
              <path d="M50 25 C33 25 25 38 25 50 C25 65 34 76 44 82" stroke="#5C6579" strokeWidth="4" strokeLinecap="round" />
            </svg>
          </div>
          <div className="evm-title">{el.status === 'PAUSED' ? 'Voting Paused' : ended ? 'Election Ended' : 'Voting Not Yet Started'}</div>
          <div className="evm-sub">
            {el.status === 'PAUSED'
              ? 'The election officer has paused voting. Please wait.'
              : ended ? 'Voting has closed for this election.' : 'This booth will activate once the election officer starts voting.'}
          </div>
          {ended && w && (
            <>
              <div className="winner-badge">🏆 Winner</div>
              <div className="winner-name" style={{ color: w.party.color }}>{w.party.symbol} &nbsp; {w.party.name}</div>
            </>
          )}
          {ended && !w && <div className="small-muted">No votes were cast.</div>}
        </Kiosk>
      </div>
    );
  }

  const s = session;

  const simulatePair = () => setSession(prev => ({ ...prev, step: 'PAIRED' }));

  const proceedToFingerSelect = () => {
    const voter = lookupVoterById(idInput);
    if (!voter) {
      logUnknownVoterAttempt(s.evmId, idInput);
      setSession(prev => ({ ...prev, step: 'UNKNOWN' }));
      return;
    }
    setSession(prev => ({ ...prev, pendingVoterId: voter.id, step: 'SELECT_FINGER' }));
  };

  const selectFinger = (fingerIdx) => {
    const voter = voters.find(v => v.id === s.pendingVoterId);
    setSession(prev => ({ ...prev, step: 'VERIFYING' }));
    setTimeout(() => {
      logFingerprintVerified(s.evmId, voter, FINGER_NAMES[fingerIdx]);
      const dup = checkAndLogDuplicate(s.evmId, voter, dupAttemptsRef);
      if (dup.blocked) {
        setSession(prev => ({ ...prev, step: 'ALREADY_VOTED' }));
        return;
      }
      setSession(prev => ({ ...prev, verifiedVoterId: voter.id, step: 'VOTE' }));
    }, 900);
  };

  const confirmVoteScreen = () => setSession(prev => ({ ...prev, step: 'CONFIRM' }));
  const backToVote = () => setSession(prev => ({ ...prev, step: 'VOTE' }));
  const backToId = () => setSession(prev => ({ ...prev, step: 'PAIRED' }));

  const doSubmitVote = () => {
    const result = submitVote(s.verifiedVoterId, s.selectedPartyId);
    if (!result.ok) {
      if (result.reason === 'ALREADY_VOTED') { setSession(prev => ({ ...prev, step: 'ALREADY_VOTED' })); return; }
      alert(result.reason);
      resetEvm();
      return;
    }
    setSession(prev => ({ ...prev, lastTxRef: result.txRef, step: 'SUBMITTED' }));
    setTimeout(() => resetEvm(), 2200);
  };

  return (
    <div className="evm-stage">
      <Kiosk statusPill={statusPill} electionName={el.name} sessionTag={s.qrToken}>

        {s.step === 'WAITING_QR' && (
          <>
            <div className="evm-title">Waiting for Voter</div>
            <div className="evm-sub">Scan this pairing code with the Smart-Vote mobile app to begin fingerprint verification.</div>
            <QrGrid />
            <div className="evm-voter-tag">{s.qrToken} · expires in 90s · single use</div>
            <button className="btn btn-primary" onClick={simulatePair}>Simulate: Phone Scans QR</button>
          </>
        )}

        {s.step === 'PAIRED' && (
          <>
            <div className="evm-title">Verify Voter</div>
            <div className="evm-sub">Enter the Voter ID to continue.</div>
            <div className="field" style={{ width: 220 }}>
              <label>Voter ID</label>
              <input value={idInput} onChange={e => setIdInput(e.target.value)} placeholder="e.g. VOTER-1001" />
            </div>
            <button className="btn btn-primary" onClick={proceedToFingerSelect}>Continue</button>
          </>
        )}

        {s.step === 'SELECT_FINGER' && (() => {
          const voter = voters.find(v => v.id === s.pendingVoterId);
          const count = voter ? voter.enrolledCount : 0;
          return (
            <>
              <div className="evm-title">Place Your Finger</div>
              <div className="evm-sub">Select which of your registered fingers you're presenting to the reader.</div>
              <div className="finger-grid" style={{ width: '100%', maxWidth: 340 }}>
                {Array.from({ length: count }, (_, i) => (
                  <button key={i} className="finger-cell" type="button" onClick={() => selectFinger(i)}>
                    <span className="fmark">○</span>{FINGER_NAMES[i]}
                  </button>
                ))}
              </div>
              <button className="btn" onClick={backToId}>Back</button>
            </>
          );
        })()}

        {s.step === 'VERIFYING' && (
          <>
            <div className="ridge-mark ridge-scan">
              <svg width="70" height="70" viewBox="0 0 100 100" fill="none">
                <path d="M50 15 C25 15 15 32 15 50 C15 70 28 85 40 90" stroke="#4FD1C5" strokeWidth="4.5" strokeLinecap="round" />
                <path d="M50 25 C33 25 25 38 25 50 C25 65 34 76 44 82" stroke="#4FD1C5" strokeWidth="4.5" strokeLinecap="round" />
                <path d="M50 35 C40 35 35 43 35 50 C35 60 41 68 48 73" stroke="#4FD1C5" strokeWidth="4.5" strokeLinecap="round" />
                <path d="M62 20 C75 27 82 38 82 52 C82 66 74 78 62 85" stroke="#4FD1C5" strokeWidth="4.5" strokeLinecap="round" />
              </svg>
            </div>
            <div className="evm-title">Searching…</div>
            <div className="evm-sub">Matching against registered templates (1:N identification)</div>
          </>
        )}

        {s.step === 'UNKNOWN' && (
          <>
            <div className="evm-title" style={{ color: 'var(--red)' }}>Voter Not Registered</div>
            <div className="evm-sub">This Voter ID does not match any enrolled voter. Please contact the election officer.</div>
            <button className="btn" onClick={resetEvm}>Back</button>
          </>
        )}

        {s.step === 'ALREADY_VOTED' && (
          <>
            <div className="evm-title" style={{ color: 'var(--amber)' }}>Already Voted</div>
            <div className="evm-sub">Our records show this voter has already cast a vote in this election.</div>
            <button className="btn" onClick={resetEvm}>Back</button>
          </>
        )}

        {s.step === 'VOTE' && (
          <>
            <div className="badge badge-teal" style={{ marginBottom: 2 }}>Verified</div>
            <div className="evm-title">Cast Your Vote</div>
            <div className="evm-sub">Select a party, then confirm.</div>
            <div className="party-grid">
              {el.parties.map(p => (
                <button
                  key={p.id}
                  className={'party-btn' + (s.selectedPartyId === p.id ? ' selected' : '')}
                  onClick={() => setSession(prev => ({ ...prev, selectedPartyId: p.id }))}
                >
                  <div className="party-symbol" style={{ background: p.color + '22', color: p.color, border: `1px solid ${p.color}55` }}>{p.symbol}</div>
                  <div className="party-name">{p.name}</div>
                </button>
              ))}
            </div>
            <button className="btn btn-primary" style={{ marginTop: 6 }} disabled={!s.selectedPartyId} onClick={confirmVoteScreen}>Continue</button>
          </>
        )}

        {s.step === 'CONFIRM' && (() => {
          const p = el.parties.find(pt => pt.id === s.selectedPartyId);
          return (
            <>
              <div className="evm-title">Confirm Your Vote</div>
              <div className="party-symbol" style={{ background: p.color + '22', color: p.color, border: `1px solid ${p.color}55`, width: 56, height: 56, fontSize: 20 }}>{p.symbol}</div>
              <div className="evm-sub">You are voting for <b style={{ color: 'var(--text)' }}>{p.name}</b>. This cannot be changed after submission.</div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn" onClick={backToVote}>Back</button>
                <button className="btn btn-primary" onClick={doSubmitVote}>Submit Vote</button>
              </div>
            </>
          );
        })()}

        {s.step === 'SUBMITTED' && (
          <>
            <div className="ridge-mark">
              <svg width="46" height="46" viewBox="0 0 100 100" fill="none">
                <circle cx="50" cy="50" r="34" stroke="#4FD1C5" strokeWidth="4" />
                <path d="M36 51 L46 61 L66 39" stroke="#4FD1C5" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="evm-title" style={{ color: 'var(--teal)' }}>Vote Submitted Successfully</div>
            <div className="evm-sub mono">{s.lastTxRef}</div>
            <div className="small-muted">Resetting booth…</div>
          </>
        )}

      </Kiosk>
    </div>
  );
}

function Kiosk({ statusPill, electionName, sessionTag, children }) {
  return (
    <div className="evm-kiosk">
      <div className="evm-header">
        <div>
          <div style={{ fontFamily: 'var(--disp)', fontWeight: 700, fontSize: 14 }}>Smart-Vote</div>
          <div className="evm-election-name">{electionName}</div>
        </div>
        <div className={'status-pill ' + statusPill.cls}>{statusPill.label}</div>
      </div>
      <div className="evm-body">{children}</div>
      <div className="evm-footer"><span className="tx-tag">session: {sessionTag || '—'}</span></div>
    </div>
  );
}
