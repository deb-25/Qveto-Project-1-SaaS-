# TeamFlow Studio — Frontend Prototype

A redesigned React + Vite frontend for the TeamFlow project-management prototype. The UI uses a premium SaaS visual system with navy navigation, warm off-white surfaces, violet accents, responsive layouts, and frontend-only demo interactions.

## Run locally

Requirements: Node.js LTS and npm.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite (usually `http://localhost:5173`). Keep the terminal running while using the app.

To create a production build:

```bash
npm run build
npm run preview
```

## Frontend updates included

- Premium TeamFlow Studio design system and responsive sidebar/navigation.
- Dashboard with organization-scoped task KPIs, overdue/upcoming lists, focus card, and progress indicator.
- Kanban board with search, priority/status filters, drag-and-drop, and a keyboard-accessible status selector.
- Task details, comments, activity history, and improved create-task dialog.
- Reports with task status distribution, workload, overdue work, and documented KPI calculations.
- Member directory with search, role filters, and demo access actions.
- Notification center with unread filters and mark-as-read controls.
- Global task search/command palette (`Ctrl + K`), quick create shortcut (`Ctrl + N`), light/dark theme toggle, and toast feedback.

## Demo limitations

This is a frontend-only prototype using synthetic data in React state. It does not connect to a database, API, real authentication, server-enforced permissions, email delivery, real-time notifications, or persistent task storage. Role switching and member role management are demonstrations only. Do not treat UI role restrictions as production security.

The theme preference is saved in browser local storage. Task data otherwise resets when the page is refreshed.
