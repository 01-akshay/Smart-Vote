<<<<<<< HEAD
# BioVote AI — React Prototype

A college-demo election control room + EVM booth built with **React + Vite**.
Everything runs client-side, in memory — there is no backend, no database, and
no real fingerprint hardware. Voter identity is verified by entering a Voter ID
and then selecting the finger presented, which stands in for a real USB
fingerprint reader + biometric SDK.

No government, Aadhaar, or Election Commission systems are involved anywhere
in this project.

## Getting started

You need [Node.js](https://nodejs.org) 18+ installed.

```bash
npm install
```

Then, in **two separate terminals**:

```bash
# Terminal 1 — the local JSON-file server (keep this running)
npm run server

# Terminal 2 — the React app
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`). The top bar shows
"Local server connected" when `npm run server` is reachable — if you skip
that terminal, the app still works fine, it just falls back to
browser-only storage (see **Data persistence** below).

`npm install` needs an internet connection — this project was generated
without one, so **`node_modules/` is not included** in the download. Running
`npm install` will create it locally from the `dependencies` listed in
`package.json` (React, ReactDOM, Recharts, Vite, Express, cors).

To build a static production bundle:

```bash
npm run build
npm run preview   # serve the built files locally to check them
```

## Project structure

```
biovote-ai-react/
  index.html            Vite entry HTML
  package.json
  vite.config.js
  server/
    server.js             Local JSON-file backend (`npm run server`) — GET/PUT
                           /api/state, persists to server/db.json on disk
    db.json                The actual saved data lives here. Back this file up
                           (or commit it) if you want to keep election history
                           long-term; deleting it resets everything.
  src/
    main.jsx             React root
    App.jsx               Top-level layout (nav + notice banner)
    styles.css             All styling (dark control-room theme)
    state/
      store.jsx            All data + business logic (elections, voters,
                            parties, votes, fraud/audit/security logs) via
                            React Context — this is the "backend" simulation,
                            persisted to both localStorage and server/db.json
    components/
      TopBar.jsx            EVM Booth / Control Room nav switcher + local
                             server connection status
      EvmBooth.jsx           Voter-facing kiosk flow (QR pairing → Voter ID →
                              finger select → vote → confirm → submit → reset)
      ControlRoom.jsx        Login gate + all admin dashboard tabs (Election,
                              Results, Voters, Parties, AI Fraud, Logs, History)
```

## Control Room login

The Control Room is gated by a simple email/password check (valid for 24
hours, tracked in `localStorage` so it survives a page refresh — clearing
site data or waiting past 24 hours will ask again).

```
Email:    akshaythakur1323@gmail.com
Password: Jogindernagar@29
```

**This is a client-side visibility gate only, not real security.** Anyone who
opens devtools or reads the built JS bundle can see these credentials in
plain text. If you plan to share, deploy, or commit this project anywhere
public, **replace `ADMIN_EMAIL` / `ADMIN_PASSWORD` in
`src/components/ControlRoom.jsx` with a throwaway password**, not a real
account password.

## Data persistence

There are two layers, and both run automatically — you don't need to do
anything except (optionally) keep `npm run server` running:

1. **`localStorage`** — instant, always on in any normal browser. Survives a
   page refresh or closing the tab, but is tied to one browser profile and
   is wiped if you clear that browser's site data.
2. **Local JSON-file server** (`server/server.js`, started with
   `npm run server`) — writes the exact same data to a real file on disk,
   `server/db.json`. This is what makes history durable across days,
   browser restarts, or clearing site data: as long as `db.json` isn't
   deleted, opening the app again (even after `npm run server` wasn't
   running for a while) loads it right back. The TopBar shows **"Local
   server connected"** when this is active, or **"Local server offline —
   using browser storage"** if you didn't start `npm run server` — either
   way the app keeps working.

Everything gets persisted this way: elections (including full history),
voters, parties, votes, and both the audit log and security log. Starting
"Start Voting" also prompts for an election name (e.g.
`Panchayat Booth Number 2`) so each round gets a distinct, identifiable name
in the history table.

If you want to keep a long-term record, back up (or commit to git)
`server/db.json` — it's a plain JSON file. Deleting it just means the app
starts fresh next time (falling back to whatever's still in localStorage,
if anything).

## What's simulated vs. what a real deployment would need

This build fulfills the *software* side of the original spec (election
lifecycle, one-person-one-vote logic scoped per election, party management,
live results, fraud alerting, audit/security logs, exports). It intentionally
does **not** include the parts that require physical hardware and a real
backend, because those can't be built or tested inside this environment:

| In this demo | In a real deployment |
|---|---|
| Voter ID typed in, finger picked from a list | Flutter mobile app + native Android `MethodChannel` bridge to a real USB‑OTG fingerprint reader SDK |
| React state persisted to `localStorage` in-browser | Node/Postgres (or similar) backend with real transactions |
| Single browser tab acting as both EVM and Control Room | Separate EVM devices talking to a backend over the network, with QR-based session pairing |
| Browser storage on one machine | A real database with encryption at rest for biometric templates |

If you want to build out the hardware/backend pieces, that work needs a real
dev environment (Android Studio, a physical fingerprint reader, a running
database) rather than a browser sandbox — **Claude Code** is a good fit for
that next phase.

## Data & privacy notes carried over from the spec

- Fingerprint templates are never stored as raw images, and votes never store
  voter identity — `voteLog` entries only contain `{partyId, ts, txRef}`.
- Exports (`Export JSON` / `Export CSV`) never include fingerprint data.
- Resetting voters/parties/votes only affects an election that hasn't
  finished yet — `COMPLETED` / `LOCKED` / `ARCHIVED` elections are permanent
  history and are never touched by the reset button.
=======
# Smart-Vote
>>>>>>> c3b2e45d74147e9522983d04322857c23b756e4f
