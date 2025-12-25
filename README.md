# ScoreJudge - Live Scorekeeper

A modern, mobile-first web application for the Judgement card game, featuring real-time updates and Google Sheets integration.

## Features

-   **Google Login**: Secure authentication.
-   **No Database**: Uses your Google Drive & Sheets as the database.
-   **Real-time**: WebSockets ensure all players see scores instantly.
-   **Live Scoreboard**: Auto-calculates scores based on bids and tricks.

## Setup

1.  **Environment Variables**:
    Ensure `.env` contains your Google Client ID/Secret.
    ```env
    GOOGLE_CLIENT_ID=...
    GOOGLE_CLIENT_SECRET=...
    NEXTAUTH_URL=http://localhost:3000
    NEXTAUTH_SECRET=...
    ```

2.  **Install**:
    ```bash
    npm install
    ```

3.  **Run**:
    ```bash
    npm run dev
    ```
    This starts the custom Node server (Next.js + WebSockets) on port 3000.

## Usage

1.  **Create Game**: Sign in, click "New Game", give it a name. Use the joined Google account to create the sheet in your Drive.
2.  **Join Game**: Other players sign in, see the game (if shared) or you share the link. They click "Join".
3.  **Play**:
    -   Owner/Operator enters bids and tricks.
    -   Scores update automatically.

## Tech Stack
-   Next.js 14 (App Router)
-   TypeScript
-   Tailwind CSS (Zinc/Glassmorphism theme)
-   NextAuth.js (JWT Strategy)
-   Google Drive/Sheets API
-   `ws` (WebSockets)
