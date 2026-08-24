@AGENTS.md

# TRACKO web — Claude

This folder is the Next.js 16 frontend. Full conventions and the Next.js 16 warning live in `AGENTS.md`. Use that file as the source of truth. Below is a short recipe list so you can open the right existing file instead of inventing a pattern.

## Before writing code

1. Read `AGENTS.md` in this directory.
2. Open the **Copy from** file for the kind of change.
3. Keep talking to `NEXT_PUBLIC_API_URL` via `src/lib/api/client.ts` (`apiFetch` / `parseJson` / `ApiError`). Never call auth/timesheet/leave services by port.

## Recipes

| I need to… | Open these |
| --- | --- |
| Add a logged-in screen | `src/app/(app)/leave/page.tsx` + a panel under `src/components/<feature>/`; then `middleware.ts` and `app-sidebar.tsx` |
| Add a screen that reads `?query` | `src/app/(app)/timesheet/page.tsx` (`Suspense`) |
| Add sign-in style page | `src/app/(auth)/sign-in/page.tsx` + `src/components/auth/sign-up-form.tsx` |
| Auth fields / password / Google | `form-field.tsx`, `password-input.tsx`, `auth-styles.ts`, `google-auth-button.tsx` |
| Zod schemas for auth | `src/lib/validations/auth.ts` |
| Auth HTTP | `src/lib/api/auth.api.ts` |
| CRUD HTTP + query keys | `src/lib/api/masters.api.ts` or `timesheet.api.ts` |
| Leave HTTP + domain helpers | `src/lib/api/leave.api.ts` |
| List/create/edit UI with React Query | `src/components/masters/masters-panel.tsx` |
| Admin vs employee UI | `src/components/leave/leave-panel.tsx` |
| Calendar / date filters | `src/lib/dates.ts` + `timesheet-panel.tsx` |
| Current user / roles | `src/lib/auth/use-current-user.ts`, `src/lib/auth/types.ts` |
| Login / logout cache | `sign-in-form.tsx`, `user-menu.tsx` (`currentUserQueryKey`) |
| Shell / nav | `app-shell.tsx`, `app-header.tsx`, `app-sidebar.tsx` |
| shadcn control | `src/components/ui/` + `components.json` |
| Cookie gate | `src/middleware.ts` (`AUTH_COOKIE_NAME` in `types.ts`) |

Pages stay thin. Put `"use client"` panels, queries, and dialogs in `src/components/`, not in `page.tsx`, except small pages like `settings/page.tsx`.
