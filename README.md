# Wellness Pro

A full-stack digital wellness tracker. Log water, track screen time across your computer and other devices, get posture and hydration reminders as desktop notifications, and see weekly analytics, a daily wellness score and habit streaks.

[![CI](https://github.com/snaryavardhan-wq/wellness-pro/actions/workflows/ci.yml/badge.svg)](https://github.com/snaryavardhan-wq/wellness-pro/actions)

   **Live demo:** coming soon

![Dashboard](docs/screenshot.png)

## Features

- **Accounts and security:** register and log in with JWT authentication. Passwords are hashed with bcrypt, requests are validated with Zod, auth routes are rate limited.
- **Hydration tracking:** one-tap logging (150, 250 or 500 ml), daily goal progress, history with pagination, and delete for your own entries only.
- **Screen time from three sources:** the in-app timer (counts only while the tab is visible), a **Chrome extension** that measures active browsing time on any site, and manual entry for phones and other devices.
- **Reminders:** posture and water reminders arrive as desktop notifications from the extension, with action buttons ("Fixed it", "Snooze", "Drank 250 ml"). Your answers are saved and feed the analytics.
- **Analytics dashboard:** 7-day water and screen-time charts with goal lines, posture stats, a 0 to 100 **wellness score** with a weekly trend, and water and screen-limit **streaks**.
- **Personal goals:** daily water target, screen-time limit and reminder intervals.
- **Timezone-aware:** a "day" is the user's local day, not UTC.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React, Vite, React Router, Axios, Recharts |
| Backend | Node.js, Express, Mongoose, Zod, JWT, bcryptjs, Helmet, CORS, express-rate-limit |
| Database | MongoDB (Atlas in production, any MongoDB locally) |
| Extension | Chrome Manifest V3 (service worker, alarms, idle, notifications, content script) |
| Testing | Node's built-in test runner, Supertest, mongodb-memory-server |
| DevOps | Docker and Docker Compose, GitHub Actions CI |

## Architecture

```mermaid
flowchart LR
  subgraph Browser
    UI[React dashboard]
    EXT[Chrome extension]
  end
  UI -- "Axios + JWT" --> API[Express API]
  EXT -- "fetch + JWT" --> API
  API -- Mongoose --> DB[(MongoDB)]
  UI -. "token shared by content script" .-> EXT
```

How a request flows (for example, tapping "+250 ml"): the button calls Axios, an interceptor adds the JWT, the `auth` middleware verifies it and sets `req.userId`, the `validate` middleware checks the body with Zod, the route handler writes to MongoDB, and the dashboard re-fetches the analytics so the numbers and charts update.

## Project structure

```
wellness-pro/
├── client/                 React app (Vite)
│   └── src/
│       ├── api/            Axios instance and helpers
│       ├── context/        AuthContext (login state)
│       ├── components/     ProtectedRoute
│       ├── hooks/          useScreenTime, useReminders
│       ├── pages/          Login, Register, Dashboard
│       └── styles.css
├── server/                 Express API
│   ├── src/
│   │   ├── config/         database connection
│   │   ├── middleware/     auth, validate, errorHandler
│   │   ├── models/         User, Hydration, ScreenTime, PostureLog
│   │   ├── routes/         auth, users, hydration, screentime, posture, analytics
│   │   └── utils/          insights (streak and score logic)
│   ├── tests/              unit and API integration tests
│   ├── Dockerfile
│   └── server.js
├── extension/              Chrome extension (Manifest V3)
├── docker-compose.yml
└── .github/workflows/ci.yml
```

## Getting started

Requirements: Node.js 18 or newer, and either a MongoDB Atlas cluster or Docker.

### Option A: with MongoDB Atlas

```bash
# 1. API
cd server
cp .env.example .env        # then fill in MONGO_URI and JWT_SECRET
npm install
npm run dev                 # http://localhost:5000/api/health

# 2. Web app (new terminal)
cd client
npm install
npm run dev                 # http://localhost:5173
```

In Atlas, add an entry to **Network Access** that allows your IP address (or `0.0.0.0/0` for development) and create a database user with read and write access to the `wellness` database.

### Option B: with Docker (no Atlas needed)

```bash
docker compose up --build   # API on :5000 and MongoDB on :27017
cd client && npm install && npm run dev
```

Stop it with `docker compose down`. The database lives in the `mongo-data` volume.

### Chrome extension

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and choose the `extension/` folder.
3. Log in to the web app. The extension picks up your login automatically (a content script shares the token), then starts counting active browsing time and scheduling reminders.
4. Allow notifications for Chrome in your operating system settings.

The extension reads only the **domain** of your active tab, never page content. Per-site minutes stay in your browser, and the server receives only the daily total.

## Environment variables

**`server/.env`**

| Variable | Example | Purpose |
|---|---|---|
| `PORT` | `5000` | API port |
| `MONGO_URI` | `mongodb+srv://user:pass@cluster.mongodb.net/wellness` | Database connection string |
| `JWT_SECRET` | long random string | Signs login tokens |
| `JWT_EXPIRES_IN` | `7d` | Token lifetime |
| `CLIENT_URL` | `http://localhost:5173` | The only origin allowed by CORS |

**`client/.env`** (production only; in development the Vite proxy forwards `/api`)

| Variable | Example |
|---|---|
| `VITE_API_URL` | `https://your-api.onrender.com/api` |

## API reference

All routes except register, login and health require the header `Authorization: Bearer <token>`.

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | Health check |
| POST | `/api/auth/register` | Create an account, returns a JWT |
| POST | `/api/auth/login` | Log in, returns a JWT |
| GET | `/api/auth/me` | Current user and goals |
| PUT | `/api/users/goals` | Update goals |
| POST | `/api/hydration` | Log a drink (`amountMl`) |
| GET | `/api/hydration` | List drinks (`from`, `to`, `page`, `limit`) |
| DELETE | `/api/hydration/:id` | Delete one of your drinks |
| GET | `/api/screentime/:date` | The in-app minutes for a day (`YYYY-MM-DD`) |
| PUT | `/api/screentime/:date` | Save in-app minutes (never decreases) |
| PUT | `/api/screentime/:date/source` | Save `browser` or `manual` minutes |
| POST | `/api/posture` | Record a reminder response |
| GET | `/api/posture` | Latest 50 responses |
| GET | `/api/analytics/weekly?tz=` | 7-day totals, averages and posture stats |
| GET | `/api/analytics/insights?tz=` | Wellness score, trend and streaks |

## Testing

```bash
cd server
npm test
```

The unit tests cover the streak and score logic. The integration tests run the real Express app against an in-memory MongoDB and check registration and login, validation, ownership rules (one user cannot delete another user's data), the screen-time update rules and the analytics responses. The first run downloads a MongoDB binary once.

GitHub Actions runs the server tests and a client production build on every push.

## Deployment

| Part | Where | Notes |
|---|---|---|
| Database | MongoDB Atlas | Allow connections from your host (`0.0.0.0/0`) and use a strong database password |
| API | Render (Web Service) | Root directory `server`, build `npm install`, start `npm start`, set the five server env vars |
| Web app | Vercel | Root directory `client`, set `VITE_API_URL`, keep `client/vercel.json` for client-side routing |

After deploying, set `CLIENT_URL` on the API to your Vercel URL, and update the API and dashboard URLs in `extension/background.js`, `extension/popup.js` and `extension/manifest.json`. The API sets `trust proxy` so rate limiting sees real user IP addresses behind Render.

## Design decisions

- **Screen time uses `max(app, browser) + manual`.** The in-app timer is a subset of browser time, so those two are not added together. Manual entry stands for other devices, so it is added.
- **Writes are safe to repeat.** App and browser minutes are saved with `$max`, so a retry or a second open tab can never lower a stored value. Manual entry uses `$set` so users can correct mistakes.
- **Days are local days.** The client sends its timezone and MongoDB groups with it, and the API fills empty days with zeros so charts have no gaps.
- **Reminders run in the extension,** not in the page, so they keep firing when the dashboard tab is closed or in the background.
- **Streaks ignore the unfinished day,** so a streak is not lost until the day actually ends.
- **Wellness score re-balances.** Water is 40%, screen time 35% and posture 25%. A part with no data is left out instead of counting as a zero.

## Known limitations

- Screen time covers active time in Chrome plus whatever you enter manually. A browser extension cannot see other desktop apps or other devices.
- Reminders need Chrome to be running. Web Push through a PWA would remove this.
- The login token is stored in `localStorage`, which is simple but readable by injected scripts. An httpOnly cookie with CSRF protection is the safer alternative.
- Free hosting sleeps when idle, so the first request after a break can take about 30 seconds.

## Roadmap

- Refresh tokens with httpOnly cookies
- PWA with Web Push notifications
- Password reset by email
- Site categories (productive and distracting) in the extension
- Data export and account deletion

## License

MIT
