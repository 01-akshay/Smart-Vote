import { useState } from 'react';
import { StoreProvider } from './state/store.jsx';
import TopBar from './components/TopBar.jsx';
import EvmBooth from './components/EvmBooth.jsx';
import ControlRoom from './components/ControlRoom.jsx';

export default function App() {
  const [view, setView] = useState('evm');

  return (
    <StoreProvider>
      <TopBar view={view} setView={setView} />
      <div className="wrap">
        <div className="notice">
          <b>College project prototype.</b> This prototype operates entirely within a secure 
          browser environment using locally stored demonstration data. It is not connected
           to any government, Aadhaar01 card, or Election Commission database. Biometric verification
            is simulated through Voter ID validation and virtual fingerprint selection to
             represent a real-world fingerprint authentication system.
        </div>

        {view === 'evm' ? <EvmBooth /> : <ControlRoom />}

        <div className="footer-note">
          Smart-Vote — A secure and transparent digital voting 
          system designed to ensure fair, accurate, and efficient elections.
        </div>
        <div className="footer-note">
          Smart-Vote — An innovative biometric voting solution proudly developed by @ Team NEO.
        </div>
      </div>
    </StoreProvider>
  );
}
