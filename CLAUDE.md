# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

A 3D "jeu de l'oie" (snakes-and-ladders style) for a child learning to read by whole-word recognition. Each tile carries a word; landing on it shows a large word card (print + cursive, syllables coloured, silent letters underlined) that flips to a picture and can be read aloud. Hosted for a whole school class as a single Docker image (Unraid NAS): each child has a profile and per-word progress. All UI text, comments and docs are in French — keep it that way.

## Commands

```sh
npm run dev          # Fastify on :8080 (tsx watch) + Vite on :5173 (proxies /api and /media)
npm test             # vitest run (shared, server and client/src **/*.test.ts)
npx vitest run shared/syllabify.test.ts        # one file
npx vitest run -t "hiver"                      # one test by name
npm run typecheck    # tsc --noEmit (there is no linter)
npm run build        # vite build → dist/client ; esbuild bundle → dist/server/index.js ; copies server/seed
npm start            # node dist/server/index.js (serves dist/client too)
docker build -t jeu-lecture:latest .           # runs npm test inside the build; podman build --format docker also works
```

Env vars: `PORT` (8080), `DATA_DIR` (`./data`, `/data` in the image), `ADMIN_PASSWORD` (admin login; if unset a random one is logged at each start; legacy `ADMIN_PIN` accepted), `CLASS_CODE` (initial class code, first start only), `PIPER_BIN` / `PIPER_MODEL` (TTS; absent in dev, so the client falls back to browser speech).

## Architecture

One npm package, three source roots:

- `shared/` — pure TypeScript imported by both server and client. This is the pedagogically critical code.
- `server/` — Fastify API + static hosting. File-based storage, no database.
- `client/` — Vite + React 19 + three.js via `@react-three/fiber` / `drei`, state in `zustand`. Vite `root` is `client/`.

Runtime dependencies are only `fastify`, its two plugins and `onnxruntime-node` (lazy-loaded, pruned to linux-x64 in the Dockerfile); everything the client uses is a devDependency because Vite bundles it (the final image runs `npm ci --omit=dev`).

### Word model and colouring (do not get this wrong)

`shared/types.ts` `Word`: `determiner?`, `syllables: string[]` (concatenated = the word), `silent: boolean[]` (one flag **per code point** of the joined syllables — always iterate with `[...str]`, never `.length`).

`shared/coloring.ts` `colorRuns()` is the single source of truth for colours, used by the HTML `WordText` component, the tile canvas textures and the editor. Rules: determiner → `determiner` colour; silent letter → `silent` colour + underline; otherwise syllables alternate `a` / `b`, and a syllable with no pronounced letter does not advance the alternation. Adjacent same-kind runs are merged on purpose: fewer spans keeps cursive letter joins intact.

`shared/syllabify.ts` `propose()` is only a *suggestion* (determiner detection, written-syllable split, likely silent letters). The parent corrects and validates it in `WordEditor`; nothing is stored without that validation. Final `e` is deliberately not marked silent (matches the school's cards). When changing heuristics, add cases to the table in `shared/syllabify.test.ts`.

### Server (`server/`)

- `index.ts` holds all routes. `isAdminRoute()` + one `preHandler` hook gate everything admin (all `/api/admin/*` except login/session, `/api/pictos`, and every non-GET on words/settings/images/audio) behind the `admin` session cookie. Add new admin routes under `/api/admin/` so they are covered.
- `auth.ts`: admin password check, in-memory sessions (lost on restart), child token / class code generation and normalisation, per-IP failure limiter (`trustProxy` is on).
- `storage.ts`: `DATA_DIR/words.json`, `settings.json`, `children.json`, `admin.json` (private: class code), `images/`, `audio/`. Handlers do read-modify-write synchronously (no `await` in between) — keep it that way, it is the only concurrency protection. First start copies `server/seed/`. `collectGarbage()` deletes unreferenced media older than one hour (the delay protects uploads belonging to an unsaved editor draft).
- Images and audio are uploaded as **raw request bodies** (content-type parser for `image|audio|video/*`), not multipart; they return `{file}` and the word JSON then references that filename.
- `syllableTts.ts` + `phonemes.ts` produce the optional "syllable by syllable" audio (`audio.syllables`, 🐢 button). Reading written syllables one by one through TTS is wrong (« é » → "e accent aigu", « cham » loses its nasal), so: phonemize the **whole** text with `piper_phonemize`, split the phonemes into syllables, align them to the written syllables (re-inserting schwa for mute-e syllables, moving liaison consonants to the word), then synthesize each unit straight from phoneme ids with `onnxruntime-node` (the Piper CLI cannot take phonemes; `[[…]]` is not supported). If counts don't align, `audio.syllables` is `null` — no audio rather than wrong audio. Test cases in `server/phonemes.test.ts` are real phonemizer outputs.
- `tts.ts` shells out to the Piper binary, one job at a time. On word save, audio is regenerated unless the parent supplied a recording (`audio.source === 'recorded'`) or the text is unchanged. At startup, words lacking audio get synthesized.
- ARASAAC pictogram search is proxied (`/api/pictos`); a chosen pictogram is downloaded into `images/` so the game works offline.
- Media is served under `/media/images|audio/`; `words.json` is not reachable through `/media`.

### Children, privacy and progress

- A `Child` is a name + secret `token` + `progress[wordId] = {success, fail}`. The browser holds its children's tokens in the HttpOnly cookie `enfants` (dot-separated, 400 days). **Family routes must only ever return children whose token is in the request cookie** (`mine(req)`); only `/api/admin/children` lists everyone. Registration requires the class code.
- `settings.json` is public (`GET /api/settings`): never put secrets there — that is why the class code lives in `admin.json`.
- `shared/progress.ts`: a word is acquired when `success >= settings.acquiredAfter`; thumbs-down only increments `fail`. `wordWeights()` gives each word a draw weight (1, or `ACQUIRED_WEIGHT` when acquired, averaged over the registered children playing; guests ignored), consumed by `generateBoard()` as the probability of entering each bag cycle.
- `addAttempt()` also appends `{t, ok}` to `progress[wordId].history` (last 30 kept; absent on older data — always treat it as optional). `ui/ChildProgress.tsx` renders the child sheet for both parents (`#/enfants/<id>`, own children only) and admin.
- Players without `childId` are guests: the word card shows « Continuer » instead of 👍/👎 and nothing is recorded.

### Client (`client/src/`)

- Hash routing by hand in `App.tsx` (`#/jouer`, `#/partie`, `#/enfants`, `#/admin`); `go()` changes route. With no child in the browser, the root route shows `Profiles` in welcome mode.
- `data.ts`: zustand store of server data (words, settings, info, this browser's children). `game/store.ts`: the game state machine, persisted to `localStorage` (`jeu-partie-v4` — bump the key if the persisted shape changes).
- Game phases: `roll → moving → word → (jump) → roll`, or `won`. Logical positions update immediately in the store; `anim` describes the visual movement. `three/Pawn.tsx` plays it in `useFrame` and calls `animDone(id)`, which advances the phase. `onRehydrateStorage` resolves a reload that happened mid-animation.
- Keyboard play: `game/useShortcuts.ts` + one handler in `pages/Game.tsx` keyed on the phase. Digits are read from `e.code` (AZERTY top row needs Shift otherwise). **Enter must never validate a registered child's word** (kids mash Enter; thumbs are the adult's ↑/↓). Key hints (`<Key>`) show on fine-pointer devices or once any key was pressed (`.has-keyboard`).
- `Focus` (store): concentration switches chosen in Setup, all on by default — `movableBoard` (OrbitControls), `animations` (pawn/die durations, `.no-anim` CSS, confetti), `scenery`, `links` (board generated without snakes/ladders), `tileWords`. New visual effects must respect `focus.animations`.
- The board snapshot (`game/board.ts`) stores full `Word` objects, so editing words does not alter a game in progress. `cols` is chosen at game start from screen orientation; `tilePosition` / `rowOf` / `colOf` take a `Layout {size, cols}`. Ladders and snakes never touch start/finish, share no tile (no chaining), and are kept near-vertical so they don't hide tile labels.
- Tile labels are `CanvasTexture`s (`three/tileTexture.ts`) drawn in Andika after `document.fonts` has loaded; the big card is HTML/CSS over the canvas (`ui/WordCard.tsx`).
- The virtual die is its own small `<Canvas>` in the HUD (`three/Dice.tsx`); `SHOW_ROT` / `FACE_ROT` must stay inverse of each other.
- `CameraRig` in `three/Scene.tsx` frames the board and reserves the bottom of the screen for the die.

### Fonts

Self-hosted via fontsource: Andika (print), Playwrite FR Trad (French school cursive), Fredoka Variable (UI). CSS family names: `Andika`, `'Playwrite FR Trad'`, `'Fredoka Variable'`.

## Constraints worth knowing

- Microphone recording only works in a secure context (HTTPS or localhost); the editor hides the button otherwise and offers audio file import.
- The Piper binary in the Dockerfile is x86-64 only.
- ARASAAC pictograms are CC BY-NC-SA: keep the attribution in the "À propos" tab and README.
- Visual checks: headless Chrome needs `--use-angle=swiftshader --enable-unsafe-swiftshader` for WebGL. With rootless Podman, reach the container via `127.0.0.1`, not `localhost`.
