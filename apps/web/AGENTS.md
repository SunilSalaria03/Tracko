<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# TRACKO web (`apps/web`)

Next.js **16** App Router, React **19**, Tailwind **4**, shadcn **base-nova** (`components.json`), TanStack Query, Zod **4**, react-hook-form. Alias: `@/` → `src/`. Talk to the API gateway only (`NEXT_PUBLIC_API_URL`, default `http://localhost:3001`). Cookie `tracko_token` is set by the API (`credentials: "include"`).

Do not invent a new data layer, form kit, or layout. Copy the file in **Copy from** and match its shape.

## Stack files

| Concern | File |
| --- | --- |
| Env | `.env.example` |
| Root layout / fonts / metadata | `src/app/layout.tsx` |
| Global CSS / theme tokens | `src/app/globals.css` |
| Providers (theme, Query, Google) | `src/components/providers.tsx` |
| Auth cookie + route gates | `src/middleware.ts` |
| HTTP helper + `ApiError` | `src/lib/api/client.ts` |
| `cn()` | `src/lib/utils.ts` |
| Local dates `YYYY-MM-DD` | `src/lib/dates.ts` |
| User type + query key | `src/lib/auth/types.ts` |
| Current user hook | `src/lib/auth/use-current-user.ts` |
| shadcn primitives | `src/components/ui/*` |
| Logo | `src/components/brand/tracko-logo.tsx` |

## Routes

Route groups: `(auth)` = marketing/auth chrome; `(app)` = shell (header + sidebar).

| URL | Page | UI |
| --- | --- | --- |
| `/` | `src/app/page.tsx` | Redirect in middleware |
| `/sign-in` | `src/app/(auth)/sign-in/page.tsx` | `src/components/auth/sign-in-form.tsx` |
| `/sign-up` | `src/app/(auth)/sign-up/page.tsx` | `src/components/auth/sign-up-form.tsx` |
| `/forgot-password` | `src/app/(auth)/forgot-password/page.tsx` | `src/components/auth/forgot-password-form.tsx` |
| `/dashboard` | `src/app/(app)/dashboard/page.tsx` | `src/components/dashboard/dashboard-panel.tsx` |
| `/timesheet` | `src/app/(app)/timesheet/page.tsx` | `src/components/timesheet/timesheet-panel.tsx` |
| `/leave` | `src/app/(app)/leave/page.tsx` | `src/components/leave/leave-panel.tsx` |
| `/projects` | `src/app/(app)/projects/page.tsx` | `src/components/masters/masters-panel.tsx` (ADMIN) |
| `/settings` | `src/app/(app)/settings/page.tsx` | `src/components/settings/set-password-form.tsx` |

Layouts: `src/app/(auth)/layout.tsx`, `src/app/(app)/layout.tsx` → `src/components/layout/app-shell.tsx`. Nav items: `src/components/layout/app-sidebar.tsx`. Header/menu: `app-header.tsx`, `user-menu.tsx`.

Auth pages wrap client forms in `Suspense` when they use `useSearchParams`. App pages that read search params do the same (dashboard, timesheet).

## Copy from (when adding work)

### New authenticated page

1. Thin page under `src/app/(app)/<name>/page.tsx` — copy `src/app/(app)/leave/page.tsx` (no search params) or `src/app/(app)/timesheet/page.tsx` (needs `Suspense`).
2. Feature UI as a `"use client"` panel under `src/components/<feature>/`.
3. Add the path to `src/middleware.ts` (`matcher` + cookie check).
4. Add a sidebar link in `src/components/layout/app-sidebar.tsx`. Use `adminOnly: true` like Projects if `user.role === "ADMIN"`.

### New public / auth page

1. Page under `src/app/(auth)/<name>/page.tsx` — copy `src/app/(auth)/sign-in/page.tsx`.
2. Form in `src/components/auth/` — copy `src/components/auth/sign-up-form.tsx`.
3. Shared pieces: `form-field.tsx`, `password-input.tsx`, `auth-styles.ts`, `auth-notice.tsx`, `google-auth-button.tsx`, `auth-legal-links.tsx`.
4. Schemas in `src/lib/validations/auth.ts` (reuse `emailSchema` / password rules).
5. API in `src/lib/api/auth.api.ts`. Add the path to `middleware.ts` if it should stay public or gated.

### New API module

Copy `src/lib/api/timesheet.api.ts` or `src/lib/api/masters.api.ts`:

- Types next to the functions.
- Exported Query keys (`fooQueryKey`, functions for parameterized keys).
- `apiFetch` + `parseJson<T>` from `src/lib/api/client.ts`.
- JSON body only when `init.body` is set (client sets `Content-Type`).
- Paths are gateway paths: `/api/...` (not service ports).

Existing modules: `auth.api.ts`, `timesheet.api.ts`, `leave.api.ts`, `masters.api.ts`.

### Query + mutation in a panel

Copy `src/components/masters/masters-panel.tsx` (CRUD) or `src/components/leave/leave-panel.tsx` (role-split queries):

- `useQuery` / `useMutation` / `useQueryClient`.
- Invalidate the same keys exported from the API module.
- Catch `ApiError` for user-facing `Alert` text.
- Default QueryClient: `src/components/providers.tsx` (`staleTime` 60s, no retry, no refetch on focus).

Current user: `useCurrentUser()` → `getCurrentUser` in `auth.api.ts`. After login/logout/set-password, invalidate `currentUserQueryKey` from `src/lib/auth/types.ts` (see `sign-in-form.tsx`, `user-menu.tsx`, `set-password-form.tsx`).

### Auth form (RHF + Zod)

Copy `src/components/auth/sign-up-form.tsx` or `src/components/settings/set-password-form.tsx`:

- `"use client"`, `useForm` + `zodResolver`.
- Field errors via `FormField`; server errors via `Alert`.
- Auth look: `authInputClassName` / `authPrimaryButtonClassName` from `auth-styles.ts`.
- In-app forms: shadcn `Button`, `Input`, `Label`, `Select`, `Textarea`, `Dialog` like timesheet/leave/masters.

### Dates

Use `src/lib/dates.ts` (`toIsoDate`, week/month ranges). Do not use UTC `toISOString().slice(0, 10)` for calendar days.

### UI primitives

Add via shadcn into `src/components/ui/`. Compose; do not restyle by forking unless matching auth screens. Class merge: `cn()` from `src/lib/utils.ts`. Select extras: `src/lib/form-styles.ts`. Theme: `theme-provider.tsx`, `theme-toggle.tsx`.

Long free-text must wrap (`min-w-0`, `break-words`); no `field-sizing-content` on textareas. See workspace rule on overflow.

## Auth product rules (do not change casually)

One email = one account. Google and password are methods on the same user (`hasPassword`, `hasGoogle` on `PublicUser`). Signup 409 → point to sign-in without saying how the email is registered. Dummy Google exists for local (`signInWithDummyGoogle` in `auth.api.ts`).
