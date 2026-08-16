import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export const FINGER_NAMES = [
  'L. Thumb', 'L. Index', 'L. Middle', 'L. Ring', 'L. Little',
  'R. Thumb', 'R. Index', 'R. Middle', 'R. Ring', 'R. Little'
];

export const FINALIZED_STATUSES = ['COMPLETED', 'LOCKED', 'ARCHIVED'];

export function uid(prefix) {
  return prefix + '-' + Math.random().toString(36).slice(2, 8).toUpperCase();
}
export function nowStr() {
  return new Date().toLocaleString();
}
export function txRef() {
  return 'TX' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
}

function freshElection(name, description, constituency) {
  return {
    id: uid('EL'),
    name,
    description: description || '',
    constituency: constituency || 'Demo Constituency',
    status: 'DRAFT',
    startTime: null,
    endTime: null,
    finalRegisteredCount: 0,
    parties: [{ id: uid('P'), name: 'NOTA', symbol: '—', color: '#5C6579' }],
    hasVoted: {},
    voteLog: [] // {partyId, ts, txRef} — never stores voter identity
  };
}

function seedElection() {
  return freshElection('General Election 2026 — Demo Constituency', 'College demonstration election', 'Demo Constituency 1');
}

/* ---------------- persistence ----------------
   Two layers:
   1. localStorage — instant, always available in a normal browser, but tied to one
      browser profile and can be cleared by the user.
   2. Local JSON-file server (server/server.js, `npm run server`) — a real file on
      disk (server/db.json), so history survives closing the browser, clearing site
      data, or coming back days later. Optional: if that server isn't running, the
      app silently falls back to localStorage only — nothing breaks. */
const PERSIST_KEY = 'biovote-ai-state-v1';
const API_BASE = 'http://localhost:4787/api';

function loadPersisted() {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(PERSIST_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export function computeWinner(el) {
  if (!el || el.voteLog.length === 0) return null;
  const candidates = el.parties.filter(p => p.name !== 'NOTA');
  if (candidates.length === 0) return null;
  const tallied = candidates
    .map(p => ({ ...p, votes: el.voteLog.filter(v => v.partyId === p.id).length }))
    .sort((a, b) => b.votes - a.votes);
  if (tallied[0].votes === 0) return null;
  const tie = tallied.filter(t => t.votes === tallied[0].votes).length > 1;
  return { party: tallied[0], tie };
}

const StoreContext = createContext(null);

export function StoreProvider({ children }) {
  const [voters, setVoters] = useState(() => loadPersisted()?.voters ?? []); // {id, hiddenId, name, age, eligibility, enrolledCount, registeredAt}
  const [elections, setElections] = useState(() => {
    const p = loadPersisted();
    return (p?.elections && p.elections.length) ? p.elections : [seedElection()];
  });
  const [currentElectionId, setCurrentElectionId] = useState(() => loadPersisted()?.currentElectionId ?? elections[0]?.id ?? null);
  const [fraudEvents, setFraudEvents] = useState(() => loadPersisted()?.fraudEvents ?? []);
  const [auditLog, setAuditLog] = useState(() => loadPersisted()?.auditLog ?? []);
  const [securityLog, setSecurityLog] = useState(() => loadPersisted()?.securityLog ?? []);
  const [serverLoaded, setServerLoaded] = useState(false);
  const [serverOnline, setServerOnline] = useState(false);

  // NOTE on currentElectionId init: safe because `elections` (initialized above via
  // loadPersisted()/seedElection()) is a plain variable already assigned by the time
  // this line runs, in the same render pass.

  // On first mount, check whether the local JSON server has a saved state and, if so,
  // prefer it over localStorage (the file on disk is the more durable copy).
  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/state`)
      .then(res => {
        if (!cancelled) setServerOnline(true); // any response (even 404 "no data yet") means the server is up
        return res.ok ? res.json() : null;
      })
      .then(data => {
        if (cancelled || !data || !data.elections || !data.elections.length) return;
        setVoters(data.voters || []);
        setElections(data.elections);
        setCurrentElectionId(data.currentElectionId || data.elections[0].id);
        setFraudEvents(data.fraudEvents || []);
        setAuditLog(data.auditLog || []);
        setSecurityLog(data.securityLog || []);
      })
      .catch(() => { /* local server not running — localStorage/seed data already loaded */ })
      .finally(() => { if (!cancelled) setServerLoaded(true); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const snapshot = { voters, elections, currentElectionId, fraudEvents, auditLog, securityLog };

    if (typeof window !== 'undefined' && window.localStorage) {
      try { window.localStorage.setItem(PERSIST_KEY, JSON.stringify(snapshot)); }
      catch (e) { /* storage unavailable or full — persistence is best-effort */ }
    }

    // Don't push to the server until the initial server-load check above has finished —
    // otherwise a save could race the load and clobber db.json with pre-load defaults.
    if (!serverLoaded) return;
    fetch(`${API_BASE}/state`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(snapshot)
    })
      .then(() => setServerOnline(true))
      .catch(() => setServerOnline(false)); // local server not running — localStorage still has this
  }, [voters, elections, currentElectionId, fraudEvents, auditLog, securityLog, serverLoaded]);

  const audit = useCallback((action, extra) => {
    setAuditLog(prev => [{ ts: nowStr(), action, admin: 'admin-01 (Super Admin)', ...extra }, ...prev]);
  }, []);
  const security = useCallback((event, extra) => {
    setSecurityLog(prev => [{ ts: nowStr(), event, ...extra }, ...prev]);
  }, []);
  const fraud = useCallback((reason, riskScore, extra) => {
    setFraudEvents(prev => [{ ts: nowStr(), reason, riskScore, ...extra }, ...prev]);
  }, []);

  const currentElection = useMemo(
    () => elections.find(e => e.id === currentElectionId) || null,
    [elections, currentElectionId]
  );

  const updateElection = useCallback((id, updater) => {
    setElections(prev => prev.map(e => (e.id === id ? updater(e) : e)));
  }, []);

  // ---------------- election lifecycle ----------------
  const createElection = useCallback((name, description, constituency) => {
    const el = freshElection(name, description, constituency);
    setElections(prev => [...prev, el]);
    setCurrentElectionId(el.id);
    audit('Created election "' + name + '"');
    return el;
  }, [audit]);

  const startElection = useCallback((newName) => {
    if (!currentElection) return { ok: false, reason: 'No election selected.' };
    if (currentElection.parties.filter(p => p.name !== 'NOTA').length === 0) {
      return { ok: false, reason: 'Add at least one party before starting voting.' };
    }
    updateElection(currentElection.id, e => ({
      ...e,
      name: (newName && newName.trim()) ? newName.trim() : e.name,
      status: 'LIVE',
      startTime: nowStr()
    }));
    audit('Started election', { electionId: currentElection.id });
    security('Election start', { electionId: currentElection.id });
    return { ok: true };
  }, [currentElection, updateElection, audit, security]);

  const pauseElection = useCallback(() => {
    if (!currentElection) return;
    updateElection(currentElection.id, e => ({ ...e, status: 'PAUSED' }));
    audit('Paused election', { electionId: currentElection.id });
    security('Election pause', { electionId: currentElection.id });
  }, [currentElection, updateElection, audit, security]);

  const resumeElection = useCallback(() => {
    if (!currentElection) return;
    updateElection(currentElection.id, e => ({ ...e, status: 'LIVE' }));
    audit('Resumed election', { electionId: currentElection.id });
    security('Election resume', { electionId: currentElection.id });
  }, [currentElection, updateElection, audit, security]);

  const stopElection = useCallback(() => {
    if (!currentElection) return;
    updateElection(currentElection.id, e => ({
      ...e,
      status: 'COMPLETED',
      endTime: nowStr(),
      finalRegisteredCount: voters.length // snapshot so history stays accurate after a later reset
    }));
    audit('Stopped election', { electionId: currentElection.id });
    security('Election stop', { electionId: currentElection.id });
  }, [currentElection, updateElection, audit, security, voters.length]);

  const lockElection = useCallback(() => {
    if (!currentElection) return;
    updateElection(currentElection.id, e => ({ ...e, status: 'LOCKED' }));
    audit('Locked election (immutable)', { electionId: currentElection.id });
  }, [currentElection, updateElection, audit]);

  const selectElection = useCallback((id) => setCurrentElectionId(id), []);

  // Wipes voters/fingerprints/parties for the CURRENT election, but never destroys a
  // result that already happened: if this election has votes, was started, or has
  // already been stopped (COMPLETED), it's (re-)archived as COMPLETED — untouched if
  // already finished — and a brand-new election is created to continue with. Only
  // truly immutable elections (LOCKED/ARCHIVED) are refused.
  const fullReset = useCallback(() => {
    if (!currentElection) return { ok: false, reason: 'No election selected.' };
    if (['LOCKED', 'ARCHIVED'].includes(currentElection.status)) {
      return { ok: false, reason: 'This election is locked/archived — its result is permanent. Use "Create New Election" to start a fresh round.' };
    }

    const alreadyFinished = currentElection.status === 'COMPLETED';
    const hasProgress = alreadyFinished || currentElection.voteLog.length > 0 || !!currentElection.startTime;
    const ok = window.confirm(hasProgress
      ? `This will keep "${currentElection.name}" saved as completed in Election History (with its results, voters, and logs untouched), then start a brand-new election with 0 registered voters, 0 parties (except NOTA), and 0 votes. Continue?`
      : `Full reset: this will remove ALL registered voters, ALL fingerprints, and ALL parties (except NOTA) for "${currentElection.name}". This cannot be undone. Continue?`
    );
    if (!ok) return { ok: false, cancelled: true };

    const registeredSnapshot = voters.length;
    const finishedId = currentElection.id;

    if (hasProgress) {
      const freshEl = freshElection(currentElection.name, currentElection.description, currentElection.constituency);
      setElections(prev => [
        ...prev.map(e => (e.id === finishedId && !alreadyFinished)
          ? { ...e, status: 'COMPLETED', endTime: nowStr(), finalRegisteredCount: registeredSnapshot }
          : e),
        freshEl
      ]);
      setCurrentElectionId(freshEl.id);
      if (!alreadyFinished) {
        audit('Election auto-archived by reset (kept as history)', { electionId: finishedId });
        security('Election auto-archived by reset', { electionId: finishedId });
      }
      audit('Created new election "' + freshEl.name + '" (continuing after reset)', { electionId: freshEl.id });
    } else {
      setElections(prev => prev.map(e => e.id === finishedId ? {
        ...e,
        parties: [{ id: uid('P'), name: 'NOTA', symbol: '—', color: '#5C6579' }],
        voteLog: [],
        hasVoted: {},
        status: 'DRAFT',
        startTime: null,
        endTime: null
      } : e));
    }

    setVoters([]);
    audit('Reset voters/parties (finished elections kept as history)', { electionId: finishedId });
    security('System reset performed', { electionId: finishedId });
    return { ok: true };
  }, [currentElection, voters.length, audit, security]);

  // ---------------- voters ----------------
  const registerVoter = useCallback((name, age, hiddenIdInput, enrolledCount) => {
    if (!name) return { ok: false, reason: 'Name is required.' };
    if (!age || age < 18) return { ok: false, reason: 'Voter must be 18+ for this demo eligibility rule.' };
    if (!enrolledCount || enrolledCount < 1) return { ok: false, reason: 'Enroll at least one fingerprint before registering.' };

    const voterId = uid('V');
    const hiddenId = (hiddenIdInput && hiddenIdInput.trim()) || ('VOTER-' + (1001 + voters.length));

    // A Voter ID must map to exactly one person — reject duplicates instead of
    // silently creating a second voter under the same ID.
    const isDuplicate = voters.some(v => v.hiddenId.toLowerCase() === hiddenId.toLowerCase());
    if (isDuplicate) {
      return { ok: false, reason: `Voter ID "${hiddenId}" is already registered to someone else. Use a different ID.` };
    }

    const fingerprints = Array.from({ length: enrolledCount }, () => uid('FP'));

    setVoters(prev => [...prev, {
      id: voterId, hiddenId, name, age, eligibility: 'ELIGIBLE',
      fingerprints, enrolledCount, registeredAt: nowStr()
    }]);
    setElections(prev => prev.map(e => (voterId in e.hasVoted ? e : { ...e, hasVoted: { ...e.hasVoted, [voterId]: false } })));
    audit('Registered voter ' + hiddenId, { name });
    return { ok: true, hiddenId };
  }, [voters, audit]);

  // ---------------- parties ----------------
  const addParty = useCallback((name, symbol, color) => {
    if (!currentElection) return { ok: false, reason: 'No election selected.' };
    if (!name) return { ok: false, reason: 'Party name required.' };
    const party = { id: uid('P'), name, symbol: symbol || name.slice(0, 2).toUpperCase(), color };
    updateElection(currentElection.id, e => ({ ...e, parties: [party, ...e.parties] }));
    audit('Added party ' + name, { electionId: currentElection.id });
    return { ok: true };
  }, [currentElection, updateElection, audit]);

  const removeParty = useCallback((partyId) => {
    if (!currentElection) return;
    updateElection(currentElection.id, e => ({ ...e, parties: e.parties.filter(p => p.id !== partyId) }));
    audit('Removed party', { electionId: currentElection.id });
  }, [currentElection, updateElection, audit]);

  // ---------------- EVM booth verification + voting ----------------
  // Looks up a voter by their Voter ID (stands in for the fingerprint-reader → SDK →
  // 1:N template match step in a real deployment).
  const lookupVoterById = useCallback((hiddenId) => {
    return voters.find(v => v.hiddenId.toLowerCase() === (hiddenId || '').trim().toLowerCase()) || null;
  }, [voters]);

  const logUnknownVoterAttempt = useCallback((evmId, enteredId) => {
    security('Unknown voter ID attempt', { evmId, enteredId });
    fraud('Unregistered/unrecognized Voter ID presented at EVM', 'LOW', { evmId });
  }, [security, fraud]);

  const logFingerprintVerified = useCallback((evmId, voter, fingerName) => {
    security('Fingerprint verification success', { evmId, hiddenVoterId: voter.hiddenId, finger: fingerName });
  }, [security]);

  // Returns {blocked:boolean, attemptNum} — also logs the duplicate-attempt security/fraud events.
  const checkAndLogDuplicate = useCallback((evmId, voter, dupAttemptsRef) => {
    const el = currentElection;
    if (!el || !el.hasVoted[voter.id]) return { blocked: false };
    const key = voter.id + '::' + el.id;
    dupAttemptsRef.current[key] = (dupAttemptsRef.current[key] || 0) + 1;
    const attemptNum = dupAttemptsRef.current[key];
    security('Duplicate vote attempt blocked', { evmId, hiddenVoterId: voter.hiddenId, attempt: attemptNum });
    fraud('Duplicate vote attempt (voter already voted this election)',
      attemptNum >= 3 ? 'HIGH' : attemptNum === 2 ? 'MEDIUM' : 'LOW',
      { hiddenVoterId: voter.hiddenId, attempt: attemptNum, electionId: el.id });
    return { blocked: true, attemptNum };
  }, [currentElection, security, fraud]);

  // Atomic-equivalent vote submission with a server-side-style re-check of hasVoted.
  const submitVote = useCallback((voterId, partyId) => {
    const el = currentElection;
    if (!el) return { ok: false, reason: 'No election selected.' };
    if (el.status !== 'LIVE') return { ok: false, reason: 'Election is not live.' };
    if (el.hasVoted[voterId]) return { ok: false, reason: 'ALREADY_VOTED' }; // race-condition guard
    const voter = voters.find(v => v.id === voterId);
    const ref = txRef();
    updateElection(el.id, e => ({
      ...e,
      hasVoted: { ...e.hasVoted, [voterId]: true },
      voteLog: [...e.voteLog, { partyId, ts: nowStr(), txRef: ref }]
    }));
    audit('Vote cast', { electionId: el.id, txRef: ref });
    security('Vote submitted', { evmId: 'EVM-01', hiddenVoterId: voter?.hiddenId, txRef: ref });
    return { ok: true, txRef: ref };
  }, [currentElection, voters, updateElection, audit, security]);

  // ---------------- export ----------------
  const exportElection = useCallback((format) => {
    const el = currentElection;
    if (!el) return;
    const registered = voters.length;
    const votesCast = el.voteLog.length;
    const results = el.parties.map(p => ({ party: p.name, symbol: p.symbol, vote_count: el.voteLog.filter(v => v.partyId === p.id).length }));
    const dupAttempts = fraudEvents.filter(f => f.reason && f.reason.startsWith('Duplicate') && f.electionId === el.id).length;
    const unknownAttempts = securityLog.filter(s => s.event === 'Unknown voter ID attempt').length;
    const payload = {
      election: { id: el.id, name: el.name, status: el.status, start_time: el.startTime, constituency: el.constituency },
      statistics: { registered_voters: registered, votes_cast: votesCast, remaining: registered - votesCast, turnout_percent: registered ? Math.round((votesCast / registered) * 1000) / 10 : 0 },
      results,
      security: { duplicate_attempts: dupAttempts, unknown_id_attempts: unknownAttempts },
      audit_summary: auditLog.filter(a => a.electionId === el.id).slice(0, 50)
      // fingerprint templates are intentionally never included in exports
    };
    let blob, filename;
    if (format === 'json') {
      blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      filename = el.name.replace(/\s+/g, '_') + '.json';
    } else {
      let csv = 'party,symbol,vote_count\n' + results.map(r => `${r.party},${r.symbol},${r.vote_count}`).join('\n');
      csv += `\n\nregistered_voters,${registered}\nvotes_cast,${votesCast}\nturnout_percent,${payload.statistics.turnout_percent}`;
      blob = new Blob([csv], { type: 'text/csv' });
      filename = el.name.replace(/\s+/g, '_') + '.csv';
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    audit('Export generated', { electionId: el.id, format });
  }, [currentElection, voters.length, fraudEvents, securityLog, auditLog]);

  const value = {
    voters, elections, currentElection, currentElectionId,
    fraudEvents, auditLog, securityLog, serverOnline,
    audit, security, fraud,
    createElection, startElection, pauseElection, resumeElection, stopElection, lockElection, selectElection, fullReset,
    registerVoter, addParty, removeParty,
    lookupVoterById, logUnknownVoterAttempt, logFingerprintVerified, checkAndLogDuplicate, submitVote,
    exportElection
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within a StoreProvider');
  return ctx;
}
