import { useStore } from '../state/store.jsx';

export default function TopBar({ view, setView }) {
  const { serverOnline } = useStore();
  return (
    <div className="topbar">
      <div className="brand">
        <span className="ridge-mark">
          <svg width="26" height="26" viewBox="0 0 100 100" fill="none">
            <path d="M50 15 C25 15 15 32 15 50 C15 70 28 85 40 90" stroke="#4FD1C5" strokeWidth="4" strokeLinecap="round" />
            <path d="M50 25 C33 25 25 38 25 50 C25 65 34 76 44 82" stroke="#4FD1C5" strokeWidth="4" strokeLinecap="round" opacity="0.85" />
            <path d="M50 35 C40 35 35 43 35 50 C35 60 41 68 48 73" stroke="#4FD1C5" strokeWidth="4" strokeLinecap="round" opacity="0.7" />
            <path d="M62 20 C75 27 82 38 82 52 C82 66 74 78 62 85" stroke="#4FD1C5" strokeWidth="4" strokeLinecap="round" opacity="0.55" />
          </svg>
        </span>
        <div>
          <div className="brand-name">Smart-Vote</div>
          <div className="brand-sub">Secure vote -  the fingerprint of democracy</div>
        </div>
      </div>
      <div className="nav-tabs">
        <button className={'nav-tab' + (view === 'evm' ? ' active' : '')} onClick={() => setView('evm')}>EVM Booth</button>
        <button className={'nav-tab' + (view === 'admin' ? ' active' : '')} onClick={() => setView('admin')}>Control Room</button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="demo-flag" style={serverOnline ? { color: 'var(--teal)', borderColor: 'rgba(79,209,197,0.35)', background: 'rgba(79,209,197,0.08)' } : undefined}>
          <span className="dot"></span> {serverOnline ? 'Local server connected' : 'Prototype — Data is stored locally for demonstration purposes'}
        </span>
      </div>
    </div>
  );
}
