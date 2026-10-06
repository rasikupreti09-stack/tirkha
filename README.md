# Tirkha workspace

Next.js web application, Expo Router mobile application, and a shared TypeScript package. This is a starter workspace, not an implementation of booking or authentication screens.

## 1. Requirements

- Node.js 24 LTS (the repository declares this major in `.node-version`).
- pnpm 11.19.0, Git, and an editor such as VS Code.
- A physical Android/iOS device for mobile testing. Local iOS builds and the iOS Simulator require macOS/Xcode; EAS cloud builds can be used from Windows.

If pnpm is missing, install the declared version:

```powershell
npm install --global pnpm@11.19.0
node --version
pnpm --version
```

## 2. Open and install the repository

The files have already been created in this directory. Do not run create-next-app or create-expo-app over them.

```powershell
cd "C:\Users\rasik\Documents\Codex\2026-10-06\role-act-as-a-senior-lead\outputs\tirkha"
pnpm install --frozen-lockfile
```

For a fresh reconstruction from the configuration files without the included lockfile, run `pnpm install` once and commit the resulting `pnpm-lock.yaml`. Subsequent installs should use `--frozen-lockfile`.

## 3. Configure Supabase

Create a Supabase development project and obtain its project URL and public anon key from the project dashboard. This scaffold does not create a cloud project or database tables.

Copy environment templates only when the destination does not already exist:

```powershell
if (-not (Test-Path apps/web/.env.local)) {
  Copy-Item apps/web/.env.example apps/web/.env.local
}
if (-not (Test-Path apps/mobile/.env)) {
  Copy-Item apps/mobile/.env.example apps/mobile/.env
}
```

Edit `apps/web/.env.local`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

Edit `apps/mobile/.env` with the same project values:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

These are public client configuration values and are bundled into the applications. Never put a service-role key or secret key in them. Row Level Security and server-side authorization must protect the eventual database. Actual environment files are ignored by Git; only `.env.example` files are tracked.

Each app exposes a lazy `getSupabase()` helper. It validates environment values when first called, allowing the starter screens and static web build to run before credentials are supplied. Mobile has persistent session storage; login flows, app-state-driven refresh, redirects, and authorization policies are future authentication work. Next.js is configured for static export, so this is a browser client, not an SSR authentication setup.

Restart development servers after editing environment files. Set the same platform-specific variable names in hosting/EAS build environments before production builds; changing a dashboard value does not change an already published client bundle.

## 4. Run the applications

Terminal one, from the repository root:

```powershell
pnpm dev:web
```

Open http://localhost:3000.

Terminal two, from the repository root:

```powershell
pnpm dev:mobile
```

Scan the QR code with a compatible Expo Go client on the same network, or use an Expo development build. Device clients must support the selected Expo SDK. Press `a` for an installed Android emulator or `i` for an iOS Simulator on macOS. This mobile workspace targets native Android/iOS; the website is the separate Next.js app.

## 5. Verify the setup

```powershell
pnpm theme:check
pnpm typecheck
pnpm check:expo
pnpm build:web
pnpm --filter @tirkha/mobile run export:native
```

Native exports validate JavaScript bundling, not signed native binaries or on-device behavior. `apps/web/out` is the static web deployment directory. No `next start` command is provided because static output is served by a static host.

## 6. Shared theme and schemas

```text
tirkha/
  apps/
    web/                 Next.js, Tailwind 4, shadcn/ui configuration
    mobile/              Expo Router, NativeWind 4, Tailwind 3
  packages/
    shared/
      src/tokens.json    Single source of theme values
      src/theme.css      Generated browser CSS variables
      src/index.ts       Zod schemas, inferred TypeScript types, token export
  scripts/sync-theme.mjs
  package.json
  pnpm-workspace.yaml
  pnpm-lock.yaml
```

`packages/shared` is the shared design package as well as the home for domain types and schemas; a fourth workspace package is unnecessary at this stage. It has no React dependency.

Edit `packages/shared/src/tokens.json`, then run:

```powershell
pnpm theme:sync
pnpm theme:check
```

The web CSS imports the generated shared stylesheet and maps its variables through Tailwind 4's `@theme inline`. NativeWind's Tailwind 3 config reads the same JSON directly. Both support `bg-background`, `text-primary`, and `border-border`, representing `#F8FAFC`, `#1F2937`, and `#CBD5E1`. Runtime components can import `tokens` from `@tirkha/shared`. Restart Metro after changing build-time token configuration.

Do not upgrade mobile to Tailwind 4 independently: NativeWind 4 uses Tailwind 3. The Next.js application has its own Tailwind 4 dependency. The pnpm isolated linker keeps these versions separate. Expo's normal Metro configuration supports the workspace; no custom resolver or duplicated React override is used.

The mobile manifest explicitly declares `react-native-css-interop` and `@babel/plugin-transform-react-jsx`, which NativeWind's transformed code requires under isolated dependency resolution. Keep them when updating this scaffold. React DOM and its types are also aligned with React for Expo Router's internal web-related dependencies, even though this app targets native devices.

## 7. Add shadcn/ui components

The web application includes `components.json`, the `cn()` utility, semantic theme variables, and a starter Button following shadcn's owned-source pattern. shadcn/ui is source code in the app, not a monolithic runtime package.

```powershell
cd apps/web
pnpm dlx shadcn@latest add card input label
cd ../..
```

Review generated changes and commit them. Do not re-run `shadcn init` over the customized theme unless intentionally changing its configuration.

## 8. Git

The repository is initialized locally. After reviewing the scaffold and configuring your Git identity, optionally make the first commit:

```powershell
git status --short
git add .
git commit -m "Initialize Tirkha web and mobile workspace"
```

No remote is created and nothing is pushed. Keep the lockfile in version control. Do not commit real environment files.

## Configuration references

- [NativeWind stable installation](https://www.nativewind.dev/docs/getting-started/installation)
- [Expo monorepos](https://docs.expo.dev/guides/monorepos/)
- [Expo Router setup](https://docs.expo.dev/router/installation/)
- [shadcn manual installation](https://ui.shadcn.com/docs/installation/manual)
- [Next.js installation](https://nextjs.org/docs/app/getting-started/installation)

Expo/React Native versions were selected from the published Expo template; the lockfile captures installed versions. Run the Expo compatibility check after dependency changes, and use `pnpm --filter @tirkha/mobile exec expo install --fix` to align native dependencies when upgrading intentionally.

## Verification performed

- Shared, web, and mobile TypeScript checks passed.
- Shared theme generation check passed.
- Next.js production static export passed.
- Expo dependency compatibility check passed.
- Android and iOS production JavaScript/Hermes exports passed.
- Peer dependency check reported no issues.
- Git ignore rules cover both applications' real environment files.

No Supabase credentials were provided, so no live backend connection was tested. Native binaries have not been built, signed, submitted, or tested on physical devices. Git is initial