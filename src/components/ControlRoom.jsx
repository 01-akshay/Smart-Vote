import { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import { useStore, FINGER_NAMES, computeWinner, FINALIZED_STATUSES } from '../state/store.jsx';

/* ---------------------------------------------------------------------
   [DEMO ONLY] This login is a client-side visibility gate, not real
   security — anyone who reads this bundle's source can see the
   credentials below. Don't ship a real account password here; swap in
   a throwaway one if you plan to share or deploy this build.
--------------------------------------------------------------------- */
const ADMIN_EMAIL = 'akshaythakur1323@gmail.com';
const ADMIN_PASSWORD = 'Jogindernagar@29';
const SESSION_MS = 24 * 60 * 60 * 1000; // 24 hours

const CR_TABS = [
  { id: 'election', label: 'Election' },
  { id: 'results', label: 'Results' },
  { id: 'voters', label: 'Voters' },
  { id: 'parties', label: 'Parties' },
  { id: 'fraud', label: 'AI Fraud' },
  { id: 'logs', label: 'Audit & Security Logs' },
  { id: 'history', label: 'Election History' }
];

export default function ControlRoom() {
  const [auth, setAuth] = useState({ loggedIn: false, loginTime: null });
  const [activeTab, setActiveTab] = useState('election');
  const { voters, elections, currentElection, fraudEvents, security, audit } = useStore();

  const stillValid = auth.loggedIn && (Date.now() - auth.loginTime < SESSION_MS);

  if (!stillValid) {
    return <LoginGate onSuccess={() => {
      setAuth({ loggedIn: true, loginTime: Date.now() });
      security('Admin login');
      audit('Admin signed in to Control Room');
    }} />;
  }

  const el = currentElection;
  const registered = voters.length;
  const votesCast = el ? el.voteLog.length : 0;
  const remaining = registered - votesCast;
  const turnout = registered ? Math.round((votesCast / registered) * 1000) / 10 : 0;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
        <button className="btn btn-sm" onClick={() => {
          security('Admin logout');
          setAuth({ loggedIn: false, loginTime: null });
        }}>Sign Out</button>
      </div>

      <div className="stat-grid">
        <StatCard label="Registered Voters" value={registered} />
        <StatCard label="Votes Cast" value={votesCast} accent="teal" />
        <StatCard label="Remaining" value={remaining} />
        <StatCard label="Turnout" value={turnout + '%'} accent="teal" />
        <StatCard label="Active Sessions" value={el && el.status === 'LIVE' ? 1 : 0} />
        <StatCard label="Fraud Alerts" value={fraudEvents.length} accent="red" />
      </div>

      <div className="crtabs">
        {CR_TABS.map(t => (
          <button key={t.id} className={'crtab' + (activeTab === t.id ? ' active' : '')} onClick={() => setActiveTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'election' && <ElectionTab />}
      {activeTab === 'results' && <ResultsTab />}
      {activeTab === 'voters' && <VotersTab />}
      {activeTab === 'parties' && <PartiesTab />}
      {activeTab === 'fraud' && <FraudTab />}
      {activeTab === 'logs' && <LogsTab />}
      {activeTab === 'history' && <HistoryTab />}
    </div>
  );
}

function StatCard({ label, value, accent }) {
  return (
    <div className={'card stat-card' + (accent ? ` stat-accent-${accent}` : '')}>
      <div className="stat-num">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

function LoginGate({ onSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  const submit = () => {
    if (email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase() && password === ADMIN_PASSWORD) {
      setError(false);
      setPassword('');
      onSuccess();
    } else {
      setError(true);
    }
  };

  return (
    <div className="login-stage">
      <div className="card login-card">
        <div className="ridge-mark" style={{ marginBottom: 14 }}>
          <svg width="34" height="34" viewBox="0 0 100 100" fill="none">
            <path d="M50 15 C25 15 15 32 15 50 C15 70 28 85 40 90" stroke="#4FD1C5" strokeWidth="4" strokeLinecap="round" />
            <path d="M50 25 C33 25 25 38 25 50 C25 65 34 76 44 82" stroke="#4FD1C5" strokeWidth="4" strokeLinecap="round" opacity="0.85" />
          </svg>
        </div>
        <div className="section-title" style={{ marginBottom: 4 }}>Control Room Sign In</div>
        <div className="small-muted" style={{ marginBottom: 18 }}>Restricted to authorized election officers.</div>
        <div className="field"><label>Email</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" /></div>
        <div className="field"><label>Password</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" /></div>
        {error && <div className="login-error">Incorrect email or password.</div>}
        <button className="btn btn-primary" style={{ width: '100%', marginTop: 6 }} onClick={submit}>Sign In</button>
      </div>
    </div>
  );
}

/* ---------------- Election tab ---------------- */
function ElectionTab() {
  const { currentElection: el, createElection, startElection, pauseElection, resumeElection, stopElection, lockElection, fullReset, exportElection } = useStore();
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [constituency, setConstituency] = useState('');

  const handleCreate = () => {
    if (!name.trim()) { alert('Election name is required.'); return; }
    createElection(name.trim(), desc.trim(), constituency.trim() || 'Demo Constituency');
    setName(''); setDesc(''); setConstituency('');
  };

  const handleStart = () => {
    if (!el) return;
    const enteredName = window.prompt('Name this election before starting (e.g. "Panchayat Booth Number 2"):', el.name);
    if (enteredName === null) return; // cancelled
    const r = startElection(enteredName);
    if (!r.ok) alert(r.reason);
  };

  const handleReset = () => {
    const r = fullReset(); // fullReset() shows its own confirm() dialog internally
    if (!r.ok && !r.cancelled) alert(r.reason);
  };

  return (
    <div className="panel-grid">
      <div className="card pad">
        <div className="section-title">Current Election</div>
        {el ? (
          <>
            <div style={{ fontFamily: 'var(--disp)', fontSize: 17, fontWeight: 600, marginBottom: 4 }}>{el.name}</div>
            <div className="small-muted" style={{ marginBottom: 10 }}>{el.description} · {el.constituency}</div>
            <span className={'status-pill ' + (el.status === 'LIVE' ? 'status-live' : el.status === 'PAUSED' ? 'status-paused' : 'status-off')}>{el.status}</span>
            <hr className="hair" />
            <div className="lifecycle-row">
              <button className="btn btn-sm btn-primary" disabled={el.status !== 'DRAFT' && el.status !== 'READY'} onClick={handleStart}>Start Voting</button>
              <button className="btn btn-sm" disabled={el.status !== 'LIVE'} onClick={pauseElection}>Pause</button>
              <button className="btn btn-sm" disabled={el.status !== 'PAUSED'} onClick={resumeElection}>Resume</button>
              <button className="btn btn-sm btn-danger" disabled={!(el.status === 'LIVE' || el.status === 'PAUSED')} onClick={stopElection}>Stop / End</button>
              <button className="btn btn-sm" disabled={el.status !== 'COMPLETED'} onClick={lockElection}>Lock</button>
              <button className="btn btn-sm" onClick={() => exportElection('json')}>Export JSON</button>
              <button className="btn btn-sm" onClick={() => exportElection('csv')}>Export CSV</button>
              <button className="btn btn-sm btn-danger" disabled={['LOCKED','ARCHIVED'].includes(el.status)} onClick={handleReset}>Reset Everything (0 Voters / Parties / Votes)</button>
            </div>
          </>
        ) : <div className="empty">No election yet — create one on the right.</div>}
      </div>

      <div className="card pad">
        <div className="section-title">Create New Election</div>
        <div className="field"><label>Election Name</label><input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. General Election 2026 - Demo" /></div>
        <div className="field"><label>Description</label><input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Optional" /></div>
        <div className="field"><label>Demo Constituency</label><input value={constituency} onChange={e => setConstituency(e.target.value)} placeholder="e.g. Demo Constituency 2" /></div>
        <button className="btn btn-primary" onClick={handleCreate}>Create Election</button>
        <div className="small-muted" style={{ marginTop: 8 }}>Creating a new election never deletes the previous one — it's archived and stays viewable under Election History.</div>
      </div>
    </div>
  );
}

/* ---------------- Results tab ---------------- */
function ResultsTab() {
  const { currentElection: el, voters } = useStore();
  if (!el) return <div className="empty">No election selected.</div>;

  const finalized = FINALIZED_STATUSES.includes(el.status);
  const w = finalized ? computeWinner(el) : null;
  const results = el.parties
    .map(p => ({ ...p, votes: el.voteLog.filter(v => v.partyId === p.id).length }))
    .sort((a, b) => b.votes - a.votes);
  const total = el.voteLog.length;
  const registered = voters.length;
  const turnoutData = [
    { name: 'Voted', value: total },
    { name: 'Remaining', value: Math.max(registered - total, 0) }
  ];

  return (
    <>
      {finalized && (
        <div className="card pad winner-banner">
          {w ? (
            <>
              <div className="winner-badge">🏆 Winner{w.tie ? ' (tie)' : ''}</div>
              <div className="winner-name" style={{ color: w.party.color }}>{w.party.symbol} &nbsp; {w.party.name}</div>
              <div className="small-muted">{w.party.votes} vote{w.party.votes === 1 ? '' : 's'} out of {total} cast{w.tie ? ' · tied with another party — result inconclusive' : ''}</div>
            </>
          ) : (
            <>
              <div className="winner-badge">Election Ended</div>
              <div className="small-muted">No votes were cast, so no winner can be announced.</div>
            </>
          )}
        </div>
      )}

      <div className="panel-grid">
        <div className="card pad">
          <div className="section-title">Live Results — {el.name}</div>
          <table>
            <thead><tr><th>#</th><th>Party</th><th>Votes</th><th>%</th></tr></thead>
            <tbody>
              {results.length ? results.map((r, i) => (
                <tr key={r.id}>
                  <td>{i + 1}</td>
                  <td>{r.symbol} &nbsp; {r.name}</td>
                  <td className="mono">{r.votes}</td>
                  <td>{total ? Math.round((r.votes / total) * 1000) / 10 : 0}%</td>
                </tr>
              )) : <tr><td colSpan={4} className="empty">No votes yet</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="card pad">
          <div className="section-title">Turnout</div>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={turnoutData} dataKey="value" nameKey="name" innerRadius="60%" outerRadius="85%">
                  <Cell fill="#4FD1C5" />
                  <Cell fill="#232B3B" />
                </Pie>
                <Legend wrapperStyle={{ color: '#8A93A8', fontSize: 12 }} />
                <Tooltip contentStyle={{ background: '#1D2433', border: '1px solid #2A3244', color: '#EDEFF4' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="card pad" style={{ gridColumn: '1 / -1', marginTop: 18 }}>
        <div className="section-title">Vote Share</div>
        <div className="chart-wrap">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={results}>
              <CartesianGrid stroke="#232B3B" vertical={false} />
              <XAxis dataKey="symbol" tick={{ fill: '#8A93A8', fontSize: 12 }} axisLine={{ stroke: '#232B3B' }} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fill: '#8A93A8', fontSize: 12 }} axisLine={{ stroke: '#232B3B' }} tickLine={false} />
              <Tooltip contentStyle={{ background: '#1D2433', border: '1px solid #2A3244', color: '#EDEFF4' }} />
              <Bar dataKey="votes" radius={[6, 6, 0, 0]}>
                {results.map(r => <Cell key={r.id} fill={r.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </>
  );
}

/* ---------------- Voters tab ---------------- */
function VotersTab() {
  const { voters, currentElection: el, registerVoter } = useStore();
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [hiddenId, setHiddenId] = useState('');
  const [enrolled, setEnrolled] = useState({});

  const toggleFinger = (i) => setEnrolled(prev => ({ ...prev, [i]: true }));
  const enrolledCount = Object.keys(enrolled).length;

  const handleRegister = () => {
    const result = registerVoter(name.trim(), parseInt(age, 10), hiddenId.trim(), enrolledCount);
    if (!result.ok) { alert(result.reason); return; }
    setName(''); setAge(''); setHiddenId(''); setEnrolled({});
  };

  return (
    <div className="panel-grid">
      <div className="card pad">
        <div className="section-title">Registered Voters ({voters.length})</div>
        {voters.map(v => {
          const voted = el ? !!el.hasVoted[v.id] : false;
          return (
            <div key={v.id} className="voter-row">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className="avatar">{v.name.split(' ').map(n => n[0]).join('').slice(0, 2)}</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{v.name}</div>
                  <div className="small-muted mono">{v.hiddenId} · age {v.age} · {v.enrolledCount}/10 fingerprints</div>
                </div>
              </div>
              <span className={'badge ' + (voted ? 'badge-teal' : 'badge-muted')}>{voted ? 'Voted' : 'Not Voted'}</span>
            </div>
          );
        })}
      </div>

      <div className="card pad">
        <div className="section-title">Register New Voter</div>
        <div className="field-row">
          <div className="field"><label>Full Name</label><input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Neha Joshi" /></div>
          <div className="field"><label>Age</label><input type="number" value={age} onChange={e => setAge(e.target.value)} placeholder="e.g. 22" /></div>
        </div>
        <div className="field"><label>Demo Voter ID (internal use only — never entered at the booth)</label><input value={hiddenId} onChange={e => setHiddenId(e.target.value)} placeholder="Auto-generated if left blank" /></div>

        <div className="finger-grid">
          {FINGER_NAMES.map((f, i) => (
            <button key={i} type="button" className={'finger-cell' + (enrolled[i] ? ' done' : '')} onClick={() => toggleFinger(i)}>
              <span className="fmark">{enrolled[i] ? '✓' : '○'}</span>{f}
            </button>
          ))}
        </div>
        <div className="small-muted">{enrolledCount}/10 fingerprints enrolled</div>

        <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={handleRegister}>Register Voter + Enroll Fingerprints</button>
        <div className="small-muted" style={{ marginTop: 8 }}>In this demo, click a finger to simulate a real scan from the USB reader + biometric SDK. Real deployments require informed volunteer consent before enrollment.</div>
      </div>
    </div>
  );
}

/* ---------------- Parties tab ---------------- */
function PartiesTab() {
  const { currentElection: el, addParty, removeParty } = useStore();
  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [color, setColor] = useState('#4FD1C5');

  const canEdit = el && (el.status === 'DRAFT' || el.status === 'READY');

  const handleAdd = () => {
    const r = addParty(name.trim(), symbol.trim(), color);
    if (!r.ok) { alert(r.reason); return; }
    setName(''); setSymbol('');
  };

  return (
    <div className="panel-grid">
      <div className="card pad">
        <div className="section-title">Parties{el ? ` — ${el.name}` : ''}</div>
        {el ? (
          <table>
            <thead><tr><th>Symbol</th><th>Name</th><th></th></tr></thead>
            <tbody>
              {el.parties.map(p => (
                <tr key={p.id}>
                  <td><span className="party-symbol" style={{ width: 28, height: 28, fontSize: 12, background: p.color + '22', color: p.color, border: `1px solid ${p.color}55` }}>{p.symbol}</span></td>
                  <td>{p.name}</td>
                  <td>{p.name !== 'NOTA' && <button className="btn btn-sm btn-danger" onClick={() => removeParty(p.id)}>Remove</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <div className="empty">No election selected.</div>}
      </div>

      <div className="card pad">
        <div className="section-title">Add Party</div>
        <div className="field"><label>Party Name</label><input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Progress Alliance" /></div>
        <div className="field-row">
          <div className="field"><label>Symbol (short)</label><input value={symbol} maxLength={3} onChange={e => setSymbol(e.target.value)} placeholder="e.g. PA" /></div>
          <div className="field"><label>Color</label><input type="color" value={color} onChange={e => setColor(e.target.value)} style={{ height: 38, padding: 2 }} /></div>
        </div>
        <button className="btn btn-primary" disabled={!canEdit} onClick={handleAdd}>Add Party</button>
        {!canEdit && el && <div className="small-muted" style={{ marginTop: 8 }}>Parties can only be edited before voting starts.</div>}
      </div>
    </div>
  );
}

/* ---------------- AI Fraud tab ---------------- */
function FraudTab() {
  const { fraudEvents } = useStore();
  return (
    <div className="card pad">
      <div className="section-title">AI Fraud Detection — Alert Layer</div>
      <div className="small-muted" style={{ marginBottom: 14, lineHeight: 1.6 }}>
        <b style={{ color: 'var(--muted)' }}>Rule Engine</b> flags duplicate-vote and unknown-voter-ID patterns in real time.{' '}
        <b style={{ color: 'var(--muted)' }}>Risk Scoring</b> weights repeat attempts higher. This layer only raises alerts — it can never modify, create, or delete votes, or decide results.
      </div>
      <table>
        <thead><tr><th>Risk</th><th>Reason</th><th>Detail</th><th>Time</th></tr></thead>
        <tbody>
          {fraudEvents.length ? fraudEvents.map((f, i) => (
            <tr key={i}>
              <td><span className={'badge ' + (f.riskScore === 'HIGH' ? 'badge-red' : f.riskScore === 'MEDIUM' ? 'badge-amber' : 'badge-muted')}>{f.riskScore}</span></td>
              <td>{f.reason}</td>
              <td className="mono small-muted">{f.hiddenVoterId || f.evmId || ''}{f.attempt ? ` · attempt #${f.attempt}` : ''}</td>
              <td className="small-muted">{f.ts}</td>
            </tr>
          )) : <tr><td colSpan={4} className="empty">No fraud signals yet</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------- Logs tab ---------------- */
function LogsTab() {
  const { auditLog, securityLog } = useStore();
  return (
    <div className="panel-grid">
      <div className="card pad">
        <div className="section-title">Audit Log (admin actions)</div>
        <table>
          <thead><tr><th>Action</th><th>Admin</th><th>Time</th></tr></thead>
          <tbody>
            {auditLog.length ? auditLog.map((a, i) => (
              <tr key={i}><td>{a.action}</td><td className="small-muted">{a.admin}</td><td className="small-muted">{a.ts}</td></tr>
            )) : <tr><td colSpan={3} className="empty">No actions yet</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="card pad">
        <div className="section-title">Security Log (system events)</div>
        <table>
          <thead><tr><th>Event</th><th>Detail</th><th>Time</th></tr></thead>
          <tbody>
            {securityLog.length ? securityLog.map((s, i) => (
              <tr key={i}><td>{s.event}</td><td className="mono small-muted">{s.hiddenVoterId || s.token || s.txRef || ''}</td><td className="small-muted">{s.ts}</td></tr>
            )) : <tr><td colSpan={3} className="empty">No events yet</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------------- History tab ---------------- */
function HistoryTab() {
  const { elections, voters, currentElection, selectElection } = useStore();
  const finishedCount = useMemo(() => elections.filter(e => FINALIZED_STATUSES.includes(e.status)).length, [elections]);

  return (
    <>
      <div className="card pad" style={{ marginBottom: 18 }}>
        <div className="section-title">Summary</div>
        <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
          <div><div className="stat-num" style={{ fontSize: 22 }}>{elections.length}</div><div className="stat-label">Total Elections</div></div>
          <div><div className="stat-num" style={{ fontSize: 22 }}>{finishedCount}</div><div className="stat-label">Completed / Ended</div></div>
        </div>
      </div>

      <div className="card pad">
        <div className="section-title">Election History</div>
        <table>
          <thead><tr><th>Election</th><th>Date</th><th>Status</th><th>Registered</th><th>Votes</th><th>Turnout</th><th>Winner</th><th></th></tr></thead>
          <tbody>
            {elections.length ? elections.map(e => {
              const finished = FINALIZED_STATUSES.includes(e.status);
              const registered = finished ? (e.finalRegisteredCount ?? 0) : voters.length;
              const votes = e.voteLog.length;
              const turnout = registered ? Math.round((votes / registered) * 1000) / 10 : 0;
              const w = finished ? computeWinner(e) : null;
              return (
                <tr key={e.id}>
                  <td>{e.name}</td>
                  <td className="small-muted">{e.endTime || e.startTime || '—'}</td>
                  <td><span className="badge badge-muted">{e.status}</span></td>
                  <td>{registered}</td>
                  <td>{votes}</td>
                  <td>{turnout}%</td>
                  <td>
                    {!finished ? <span className="small-muted">—</span>
                      : w ? <><span style={{ color: w.party.color, fontWeight: 600 }}>{w.party.symbol} {w.party.name}</span>{w.tie && <span className="badge badge-amber" style={{ marginLeft: 6 }}>TIE</span>}</>
                        : <span className="small-muted">No votes cast</span>}
                  </td>
                  <td><button className="btn btn-sm" onClick={() => selectElection(e.id)}>{e.id === currentElection?.id ? 'Current' : 'View'}</button></td>
                </tr>
              );
            }) : <tr><td colSpan={8} className="empty">No elections yet</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
