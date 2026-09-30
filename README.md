# BookEase

BookEase is a small appointment-management product for service businesses. It includes a responsive React dashboard, an Expo React Native app, a Node.js/Express API, and PostgreSQL storage.

The scope is intentionally realistic for an early-career developer: authentication, useful CRUD operations, role checks, validation, dashboard summaries, and deployment—without claiming enterprise-scale architecture.

## Live API and demo account

- API: https://bookease.hrms.ssym.co.in
- Health check: https://bookease.hrms.ssym.co.in/health
- Owner login: `owner@bookease.demo` / `Demo@123`
- Customer login: `customer@bookease.demo` / `Demo@123`

The web and mobile clients already point to this API.

## What it demonstrates

- Owner and customer authentication with JWT
- Service catalogue and appointment booking
- Booking status updates with owner-only dashboard access
- PostgreSQL relationships and database constraints
- Responsive web UI and a separate mobile experience
- Input validation, password hashing, security headers, and parameterized SQL

## Structure

```text
bookease/
├── api/       Express + TypeScript + PostgreSQL
├── web/       React + TypeScript + Vite
└── mobile/    React Native + Expo
```

Request flow: `React / React Native → HTTPS REST API → Express → PostgreSQL`.

## Database design

- `users`: customer and owner accounts
- `services`: duration, price, description, and active state
- `bookings`: customer, service, start/end time, status, and notes

Foreign keys protect relationships, checks reject invalid durations/statuses, and indexes support booking-date and customer lookups.

## API routes

| Method | Route | Purpose |
|---|---|---|
| GET | `/health` | API and database health |
| POST | `/api/auth/login` | Sign in and receive a JWT |
| GET | `/api/services` | List active services |
| GET | `/api/bookings` | List bookings visible to the signed-in user |
| POST | `/api/bookings` | Create an appointment |
| PATCH | `/api/bookings/:id/status` | Update booking status |
| GET | `/api/dashboard` | Owner summary metrics |

Protected routes expect `Authorization: Bearer <token>`.

## Run locally

Requirements: Node.js 18+, npm, and PostgreSQL.

1. Create a `bookease` database and run `api/sql/schema.sql`.
2. In `api`, copy `.env.example` to `.env`, update the database URL, then run:

```bash
npm install
npm run build
npm run seed
npm run dev
```

3. In `web`, optionally copy `.env.example` to `.env`, then run:

```bash
npm install
npm run dev
```

4. In `mobile`, run:

```bash
npm install
npm start
```

Scan the Expo QR code with Expo Go, or press `a` for Android. The mobile API URL is near the top of `mobile/App.tsx`.

## Deploy the web app to Vercel

Push this folder to its own GitHub repository, import it into Vercel, and set:

- Root Directory: `web`
- Framework Preset: Vite
- Build Command: `npm run build`
- Output Directory: `dist`
- Environment variable (optional): `VITE_API_URL=https://bookease.hrms.ssym.co.in`

`web/vercel.json` already provides SPA routing. After receiving the final Vercel URL, it can be added to `CORS_ORIGINS` on the server for a stricter production allow-list.

## Interview talking points

**Why PostgreSQL?**  The data is relational: a booking belongs to both a user and a service. Foreign keys and check constraints keep those relationships valid, while SQL makes dashboard totals simple.

**How does authentication work?**  Login compares the submitted password with a bcrypt hash. The API signs a short payload as a JWT, and protected endpoints validate the bearer token before using the user ID and role.

**How are owner and customer permissions different?**  Authentication first identifies the user. A small role middleware then blocks non-owners from the dashboard. Booking queries also limit customers to their own records.

**What validation exists?**  Zod validates request bodies at the API boundary. PostgreSQL adds a second layer with checks such as a valid status and an end time later than the start time.

**How would you prevent double-booking next?**  I would add a transaction and a PostgreSQL exclusion constraint or a locked availability check. I kept this version simpler so I could clearly explain every part of it.

**Why separate web and mobile apps?**  They share the same REST contract but need different navigation and screen layouts. Keeping them separate makes each client easier to understand while the API remains reusable.

**What did deployment involve?**  The API runs as a system service behind Nginx with HTTPS. PostgreSQL runs on the same server, while the static React frontend is ready for Vercel.

**What would you improve for production?**  Add refresh tokens, automated API tests, email reminders, conflict-safe booking, pagination, structured logging, and a CI pipeline.

## Honest résumé bullets

- Built a responsive appointment-management application using React, React Native, Node.js, Express, and PostgreSQL, with shared REST APIs for web and mobile clients.
- Implemented JWT authentication, role-based owner views, booking status workflows, input validation, and SQL-backed dashboard metrics.
- Deployed the API and database behind HTTPS on an Ubuntu server and prepared the Vite frontend for Vercel deployment.

