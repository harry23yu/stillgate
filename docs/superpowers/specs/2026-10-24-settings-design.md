# Settings (app preferences) — design

**Date:** 2026-10-24
**Status:** Approved design, ready for implementation plan
**Owner:** Tyler (mobile front end)

## 1. Goal

Add a real **Settings** screen for app-level preferences, distinct from the
sensory **Profile**. This also fixes a current redundancy: the Home gear icon and
the Profile tab both open the same sensory-profile screen. After this change, the
gear opens Settings; the Profile tab keeps opening the sensory profile.

Settings holds three preferences chosen for this audience and timeline:

1. **Text size** — an in-app size multiplier on top of the OS setting.
2. **Reduced motion** — shorten/stop animations beyond what the OS already asks.
3. **Dim / dark mode** — a low-light theme. On-theme for an audience that
   includes light-sensitive travelers (the sensory profile literally asks about
   bright/flickering lights).

## 2. Decisions

- **Two build phases, one spec.**
  - **Phase 1:** `settings.ts` store + `SettingsProvider` + `/settings` screen +
    gear → Settings + **text size** + **reduced motion**. All low-risk: they go
    through existing chokepoints (`ThemedText` for text; a context flag for
    motion). Produces a working Settings screen.
  - **Phase 2:** **dim/dark mode** — a dark palette plus the theme refactor that
    makes every screen's static styles react to a live theme switch, and the
    theme control in the Settings screen.
- **Phase 1 ships independently.** If time runs short, Phase 2 can be dropped
  without leaving the app half-broken; the Settings screen simply won't show a
  theme control yet.
- **Language (i18n) is out of scope** (large effort, low value for an English
  2-minute demo).

## 3. Why the split exists (the key technical fact)

Text already funnels through `ThemedText`, and colors through `useTheme()` —
clean single chokepoints. But nearly every screen also imports `Colors` directly
into a module-level `StyleSheet.create(...)`, which is evaluated **once at import**
and cannot react to a runtime theme change. So:

- Text size and reduced motion can be delivered by touching the chokepoints only
  (Phase 1).
- Real dark mode requires converting those static style blocks to build at render
  time from the active palette (Phase 2) — a mechanical but app-wide change.

## 4. Data model

New store `src/data/settings.ts` (AsyncStorage, mirroring `profile.ts` /
`trip-details.ts`). Key: `stillgate.settings`.

```ts
type ThemePreference = 'system' | 'light' | 'dark';

interface AppSettings {
  theme: ThemePreference;   // Phase 2 acts on this; Phase 1 persists 'system'
  textScale: number;        // multiplier: 1.0 (default) | 1.15 | 1.3
  reducedMotion: boolean;
}

const defaultAppSettings: AppSettings = {
  theme: 'system',
  textScale: 1.0,
  reducedMotion: false,
};
```

`getSettings()` returns defaults merged over stored values (tolerant of missing
keys, like `getTripDetails`). `saveSettings(settings)` persists the whole object.

## 5. Provider and hook

`src/contexts/settings.tsx` exposes:

```ts
interface SettingsContextValue {
  settings: AppSettings;
  updateSettings: (patch: Partial<AppSettings>) => void; // merges, persists, re-renders
  loaded: boolean; // false until the first async read resolves
}

function SettingsProvider({ children }): JSX.Element;
function useSettings(): SettingsContextValue;
```

- `SettingsProvider` loads persisted settings on mount (defaults until `loaded`),
  holds them in state, and persists on every `updateSettings`.
- Wrap the app once in `src/app/_layout.tsx` so changes apply live everywhere.
- Consumers call `useSettings()`; outside the provider it returns defaults (so a
  component can't crash if mounted early).

## 6. Phase 1 — text size, reduced motion, the screen

### 6.1 Text size (chokepoint: `ThemedText`)

`ThemedText` multiplies its resolved `fontSize` by `useSettings().settings.textScale`.
It keeps `allowFontScaling` at its current default so the OS setting still
applies; our multiplier stacks on top. Components that render raw `<Text>` (if
any) are out of scope — `ThemedText` is the standard and covers the UI.

Control in Settings: a 3-option segmented control — **Default (1.0)**,
**Large (1.15)**, **Larger (1.3)** — labeled "A", "A+", "A++" with text labels
(not size alone) for screen readers.

### 6.2 Reduced motion (chokepoint: a context flag)

Effective reduced motion = `settings.reducedMotion || <OS reduced-motion>` (RN's
`useReducedMotion()` from react-native-reanimated). Animation sites read this and
skip or shorten. Implementation audits the current animation surface (e.g.
`launch-screen.tsx` and any reanimated usage) and gates each; the volume is small.

Control in Settings: a `Switch` (reuse the pattern already in `gate-change.tsx`).

### 6.3 The Settings screen

New route `src/app/settings.tsx` (a top-level route like `flight-lookup.tsx` /
`gate-change.tsx`; expo-router registers it by file). Layout mirrors the profile
screen's structure (SafeAreaView, scroll, section headings, Save/close pattern):

- Header: "Settings" + a "Done"/close control (consistent with the other routes).
- Section **Text size**: the segmented control + a short live preview line that
  renders at the chosen scale.
- Section **Motion**: the reduced-motion switch with a one-line description.
- (Phase 2 inserts a **Theme** section above these.)

Changes apply immediately via `updateSettings` (no explicit Save needed; closing
returns to the previous screen). Persisted automatically.

### 6.4 Gear → Settings

In `src/app/(tabs)/index.tsx`, the header gear (`gearshape.fill`) routes to
`/settings` instead of `/profile`, with accessibility label "Open settings". The
Profile tab continues to open the sensory profile. This resolves the duplicate
doorway.

## 7. Phase 2 — dim / dark mode

### 7.1 Palettes

`src/constants/theme.ts` gains a dark palette alongside the existing light one,
same keys. Candidate dark values (must be verified at ≥ 4.5:1 text contrast
before shipping; tune as needed):

```
background #14191B · surface #1E2528 · text #F2EFE8 · textSecondary #C3CCCE
primary #6FB8A8 · primaryLight #24413B · border #8A8475
neutralFill #2A3134 · neutralFillAlt #232A2D
estimateFill #4A2E14 · estimateText #F2C79A · estimateBorder #E08A3C
youMarker #7FA8E8
```

`Colors` (light) stays the default export so any not-yet-migrated reference still
compiles during the Phase 2 migration.

### 7.2 Scheme-aware `useTheme()`

`useTheme()` resolves the active palette from `useSettings().settings.theme`:
`'light'`/`'dark'` pick directly; `'system'` reads RN `useColorScheme()`. Because
`ThemedText` and `ThemedView` already consume `useTheme()`, they repaint on
switch with no further change.

### 7.3 Static-style refactor (the bulk of Phase 2)

Introduce one helper:

```ts
// src/hooks/use-themed-styles.ts
function useThemedStyles<T>(factory: (c: typeof Colors) => T): T;
// memoizes StyleSheet.create(factory(activePalette)) per active palette
```

Then convert each screen/component that does
`const styles = StyleSheet.create({ ...Colors.x... })` at module scope to
`const styles = useThemedStyles((c) => ({ ...c.x... }))` inside the component.
Files to migrate are every screen/component referencing `Colors` in a style block
(Home, map, calm-guide, profile, flight-lookup, gate-change, and the shared
components: button, card, chip, pill, text-field, terminal-map, terminal-schematic,
launch-screen, flight-leg-card, connection-card, etc.). Mechanical and done file
by file; each file is independently verifiable.

### 7.4 Status bar and root background

Update the status-bar style and root background to follow the active scheme
(via `expo-status-bar` and/or `expo-system-ui`, both already dependencies) so
system chrome matches.

### 7.5 Theme control

Add a **Theme** segmented control to `settings.tsx`: **System / Light / Dark**,
calling `updateSettings({ theme })`. Text labels, not color alone.

## 8. Accessibility

- Every control (segmented options, switches, close) has a screen-reader label and
  a ≥ 44 px target; selected state conveyed by text/`accessibilityState`, not color
  alone.
- Dark palette verified at ≥ 4.5:1 for body text (Phase 2), matching the light
  bar.
- The text-size preview gives immediate feedback; reduced motion takes effect live.

## 9. Testing

- **Store** (`settings.ts`): defaults when nothing stored; merge of partial stored
  values; round-trip of `saveSettings`/`getSettings`. (Jest data-layer setup from
  the layover plan is reused if present; otherwise verified by typecheck + device.)
- **Manual on device (Phase 1):** gear opens Settings; Profile tab still opens the
  sensory profile; changing text size instantly rescales text app-wide and
  survives restart; reduced-motion switch stops/shortens animations and survives
  restart.
- **Manual on device (Phase 2):** switching System/Light/Dark repaints the whole
  app live with no stuck light-palette areas; 'system' follows the OS; contrast
  holds; restart preserves the choice.

## 10. Out of scope

Language/i18n; per-screen theme overrides; custom accent colors; high-contrast
mode beyond the two palettes; animating the theme transition itself.
