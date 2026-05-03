# Sarfees Admin Portal

Operations console for the Sarfees platform. Pairs with the NestJS backend in the parent repo.

## Phase 1 features

- Email + password admin auth (super_admin / ops_manager / support / finance roles)
- Forced password rotation on first login
- Drivers CRUD: list (search + filter + paginate), create, view detail (profile + vehicle + reputation + recent trips + decline log), edit, suspend/reinstate

## Stack

- Next.js 15 (App Router) + React 19
- TypeScript, Tailwind CSS v4
- Server Actions for mutations, httpOnly cookies for the access token (token never reaches the browser)

## Local dev

Prerequisites: backend running on `http://localhost:3000` (see parent README) and the super-admin seed applied:

```bash
cat ../src/admins/seed/0001-seed-super-admin.sql | docker exec -i sarfeesweb-db-1 psql -U sarfees_user -d sarfees_db
```

Then in this folder:

```bash
cp .env.local.example .env.local   # adjust SARFEES_API_URL if needed
npm install
npm run dev                         # http://localhost:3001
```

Default credentials (rotate on first login):

```
admin@sarfees.com  /  ChangeMe!2026
```

## Project layout

```
admin-portal/
├── src/
│   ├── app/
│   │   ├── (auth)/                 ← login + change-password
│   │   ├── (dashboard)/            ← shell + dashboard + drivers screens
│   │   ├── globals.css             ← Tailwind v4 + Sarfees brand tokens
│   │   └── layout.tsx
│   ├── lib/
│   │   ├── api.ts                  ← typed server-side fetch wrapper
│   │   ├── auth.ts                 ← login/logout/change-password Server Actions
│   │   └── types.ts
│   └── middleware.ts               ← cookie-based auth gate
├── package.json
├── next.config.ts
├── tsconfig.json
└── postcss.config.mjs
```

## Phases beyond Phase 1 (deferred)

- Trip browser with map + manual assignment
- Earnings dashboard, settlement tooling, CSV export
- Announcements composer, push notifications
- Audit log, 2FA on admin accounts
- Customer support tooling
