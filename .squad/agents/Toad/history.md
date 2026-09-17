## Learnings

- Phase 8d: wrote vitest specs for `MinionsListComponent` and `MinionDetailComponent`
- `pendingDelete` signal pattern (`requestDeleteAttack` / `onDeleteConfirmed` / `onDeleteCancelled`) replaces the old `window.confirm` approach; the existing `monster-detail.spec.ts` also had to be updated because `MonsterDetailComponent` had already migrated to this pattern but the spec had not
- Mock pattern: provide services with `useValue` returning synchronous `of(...)` observables; `forkJoin` in `ngOnInit` resolves synchronously in tests, so form is patched after first `fixture.detectChanges()`
- `MinionDetailComponent` param key is `minionId` (not `monsterId`); `ReferenceDataService` mock needs `getMinionTypes` + `getWeaponTags`

## 2026-09-11 — Hunter bespoke: move-level repeatable section gap (failing test for Bowser)

- `HunterServiceTests` is NOT mocked: real in-memory SQLite `Harness`, one shared `SeedPlaybook()` fixture with fixed Guids; runs without Postgres. Scope: `dotnet test <Api.Tests.csproj> --filter "FullyQualifiedName~...HunterServiceTests"`
- Adding a section to `SeedPlaybook()` can break exact-list `Outstanding` asserts: tests take `PickableMoveId`, so put new move-level sections on `OtherMoveId` (completeness skips sections of untaken moves)
- `ValidateBespoke`'s move-ownership check lives only in `ValidateSelectionScope` (per selection). An instance with `Selections: []` for a move-owned repeatable section skips it. Real form sends exactly that when a free-text instance's "Details" box is blank (`collectSelections` omits empty text); name goes in `instance.Name`
- Seed: Searcher "Network" (0..5) and Spell-Slinger "Arcane Reputation" (3..3) are both non-required, non-advanced moves; sections have `options: []` AND `freeTextLabel` set
- Added `Entries_for_a_moves_repeatable_section_are_refused_unless_the_move_is_taken` (fails today: saved) + `..._accepted_once_the_move_is_taken` (control)

## 2026-09-14 — Hunter wizard Phase 3: Mystery wizard visual pass (shared tracker/layout)

- Browser driving works with nothing installed: `node_modules/playwright` 1.61.1 in the web app + cached Chromium 1228 in `%LOCALAPPDATA%\ms-playwright`. Scripts in scratchpad use `createRequire(<web>/package.json)` to import it
- Sign-in: `test@local.dev` in `app_users` (plaintext password). Read it into an env var via `docker exec motw-postgres psql -tA`, never echo it
- Before/after reference: `git -c core.longpaths=true worktree add --detach <scratch> HEAD` (plain add fails: Filename too long), junction `node_modules` in with `mklink /J`, `ng serve --port 4201`. Same API/cookie serves both ports. Cleanup: `rmdir` the junction BEFORE `worktree remove --force`
- Theme: `emulateMedia({ colorScheme })` drives ThemeService's 'system' preference, so mid-session theme switching needs no localStorage
- Canvas pixel diff in a blank page (data-URL images) needs no image package; element screenshots of `header.tracker` diff to 0 px when unchanged
- Scroll container is the column `main section.overflow-y-auto`; also watch `main.scrollTop` and `window.scrollY`. At 1280x600 the document is 65px scrollable in both builds (sidebar nav), so viewport resizes in a harness can shift `window.scrollY`: not a user-reachable bug
- Measure bubble colours >=350ms after a step change (0.2s background transition), or you read mid-fade rgba
- Edit mode: `phaseComplete` starts all-true, then recomputes from data, so a Mystery with no locations/bystanders gives plain clickable bubbles. Locations/Bystanders phases save with zero items. Blocked-minion error band ("Finish or clear the minion...") is a no-request way to show the error band
- Pre-existing, not Phase 3: composer attack rows overflow their card (Harm `width: 80px`) at column widths <= ~343px (identical at 768 on HEAD); light error band text 3.91:1
- Test fixture left in local DB: Mystery "Toad Phase 3 check" `6093f6b2-616c-429c-a2d7-75e1c7e89983` (monster "Toad Phase 3 monster", 2 attacks, countdown day/shadows, no minions/locations/bystanders)

## 2026-09-14 — Hunter wizard Phase 4: "before" half of the Y10 GET diff (HEAD efd5309)

- Fixtures in local DB (created via POST, form-shaped payloads): Hex `288bc75a-4460-4693-9e7c-e0a4ce3a6e46`, Curse-Eater `eacfae8a-60f0-4ace-b0ac-504bd86b2fca`, Forged `869e6136-ca7a-4996-a4e1-52649ada2e58`. All `outstanding: []`
- Scripts + raw captures: session scratchpad `phase4-diff/` (`create-hunters.mjs` once; `capture.mjs --base <url> --out <dir>` re-runnable; `compare.mjs a b` strict + order-insensitive)
- HEAD unchanged edit-page re-save: create == pre == PUT response == post-save GET, strict, all three. PUT echoes instance/journal ids; no row recreated
- API login from Node: `context.request.post('/api/auth/login', { data: { email, password } })`, no antiforgery; the cookie is host-scoped, so it works via 5225 or the 4201 proxy. DataProtection keys live in the DB, so the API runs fine from a worktree
- `GetHunterDetailAsync` has no ORDER BY on child collections: GET array order is not insertion order (stable across reads so far, not guaranteed). Instances and journal entries are ordered by SortOrder
- The form's PUT groups `bespokeSelections` by section order (playbook sections, then move sections), so the PUT order differs from the GET order. Compare PUT bodies order-insensitively, or strictly against the same build's GET
- None of Hex/Curse-Eater/Forged has a numeric bespoke option or a freeTextLabel section. Only the Forged has an in-move section (Partner, required). The numeric coverage is the Curse-Eater Corruption track
- The `hunters.updated_at` column exists in the DB but isn't in the GET, so there's no volatile field in the GET body. `ApplyTimestamps` stamps only Added/Modified rows, and HEAD's unchanged save left it at its create-time value on all three. If it moves after the after-pass save, a scalar changed

## 2026-09-14 — Hunter wizard Phase 4: "after" half of the Y10 GET diff (uncommitted HunterDraft, main tree)

- After vs before: PUT body, PUT response and post-save GET all 0 diffs strict AND order-insensitive, all three; GET == create == pre; `updated_at` still create-time. No reordering showed up at all
- Hunter specs: `npx ng test --no-watch --include "src/app/features/hunters/**/*.spec.ts"` (3 files, 43 tests, ~1.4s)
- Browser checks: `phase4-diff/checks.mjs` + `refill.mjs`. Rating hint hides on pick and returns on playbook switch (create), hides on pick (edit); picker locked; untick Network with 2 entries saves; refill; edit open = 2 playbook GETs, first `net::ERR_ABORTED`
- Harness gotcha: Angular `[value]` on a `formControlName` radio is a property, not an attribute. `getAttribute('value')` is null; read `el.checked` by index and map to `playbook.statArrayOptions` order
- Scope `section` locators to `app-hunter-form form > section`: the page's outer `<section>` also contains every h3
- Refill proof that can't pass by accident: pad the name with spaces (builder trims, input shows trimmed only if repopulated), and add a repeatable entry then save twice. Save 2 must echo save 1's server instance id
- Every playbook has 5 stat arrays with its own ids, so any create-page playbook switch clears the rating
- Fixture added: "Toad Phase 4 Searcher" `3c4a77c8-d3e9-41f6-bd36-96480fe2cd2f`. Created via the UI with no rating and Network + 2 entries; the POST omitted First Encounter and the server added it. Final state: rating index 3, Network ticked, one entry "Toad contact C" (`3c23b24e-1c5b-40a3-9252-564f4c5a79f3`)

## 2026-09-14 — Hunter wizard Phase 5: shared sections + evaluate, running-app verify (uncommitted, main tree)

- Scripts + evidence: session scratchpad `phase5-verify/` (`lib5.mjs` re-exports `phase4-diff/lib.mjs`; `capture-searcher.mjs --tag`, `checks5.mjs <part>`, `evaluate.mjs`, `probe-network.mjs`, `timing-probe.mjs`). Phase 4 `capture.mjs`/`compare.mjs` ran unchanged (`--out ../phase5-verify/capture`)
- Hex/Curse-Eater/Forged vs Phase 4 `after/`: PUT body, PUT response, GET, pre all 0 strict + 0 order-insensitive. Searcher unchanged re-save: pre == PUT response == GET, and its PUT body == Phase 4 build's body for the same state
- Section components are attribute components on the page's own `<section>`/`<div>`, so `app-hunter-form form > section` + h3 scoping still works. Rating radios and History textarea have no `formcontrolname` attr (and no DOM `name` in either build: RadioControlValueAccessor sets `name` as a JS property only)
- App is zoneless (no zone.js). Every click renders at the next setTimeout(0)/rAF tick, page template and child sections alike. Playwright `click(+ Add)` then `.last().fill()` races and fills the PREVIOUS row. Phase 4's checks.mjs hit it too (POST had "contact B" in row 0 + empty row 1). Wait for the row count to change before filling/reading
- Computed colours are `oklch(...)`: regex-parsing numbers gives nonsense contrast. Convert through a 1x1 canvas `fillStyle` -> `getImageData`. Ratings label `text-muted` 12px: 4.76:1 light, 6.78:1 dark
- `POST /api/hunters/evaluate`: 401 anon; 200 `{refusal, outstanding:[{area, sectionId, gearCategoryId, message}]}`; messages == GET `outstanding` in order. A move-owned section item (area "moves") lists after Look, so areas aren't contiguous
- Searcher untick check without saving: `page.route` the PUT, capture `postData()`, `route.abort()`; then GET to prove unchanged
- Fixture added: "Toad Phase 5 create check" `aca2aaa9-bff1-4411-908d-d948247541c3` (The Searcher, rating index 2, background "Toad Phase 5 create note"). Searcher rating/history changed and restored (start vs end capture 0 diffs; instance id unchanged)

## 2026-09-15 — Hunter wizard Phase 6: pick rules, running-app verify (uncommitted, main tree)

- `motw` went from `AddHunterBespokeAnswers` to `20260915093931_AddPickRules` at API startup. The post-deploy SQL gives ok 1/1/2/4, 1/2/4/0 and 1/3/6/0 with 0 other rules, and it's the same after the admin saves. The 5 older hunters re-save with 0 diffs (Phase 4 `capture.mjs` unchanged, plus `phase6-verify/capture-one.mjs`)
- Scripts: session scratchpad `phase6-verify/` (`lib6.mjs` has the governed ids; `checks6.mjs <part>`; `probe-evaluate.mjs` saves nothing; `shots-extra.mjs`). Parts that count hunters can't run alongside parts that create them, and `admin` must run alone
- Locators: gear category root `#hunter-gear-<categoryId>`, bespoke section host `#hunter-section-<sectionId>`. Natural Attacks Base/Extra leaves have null titles, and their text is `descriptionText` ("Base: teeth …"). Write-your-own slots are indexes 4–5 (Base) and 3 (Extra)
- The hunter pages scroll in `MAIN.flex-1 min-h-0 overflow-auto`, not `main section.overflow-y-auto`. Playwright element screenshots of a tall block at 375 hide its top under the fixed top bar, so set the container's `scrollTop` instead
- Toasts: MutationObserver on root `aside[aria-live=polite]`. Keep the node refs, because `[class.bg-toast-error]` isn't applied yet at insertion
- `psql -c` inside `sh -c '…'`: `$$` expands to the PID. Pipe the SQL on stdin instead
- A playwright `click({force:true})` on a disabled checkbox never toggles it. That makes a cheap proof the lock holds
- Every over-limit build refuses through evaluate (200 + refusal, `outstanding: []`). The server suffix says "allow 2" (adjusted max) while the client hint says "allow 1–2" (range), as 12.9/L25 specify. Messages copy titles verbatim ("1 Effects", "2 Base")
- Cosmetic: the Natural Attacks section description is the same sentence as the rule label, so the create and edit pages print it twice
- Admin 409 for old-fashioned pickCount 3→2 names the rule by its two target labels (the Initiate rule has no label). One toast, the form stays open, and the GET shows 0 diffs
- Fixtures added: "Toad Phase 6 Initiate" `55aab040-5d17-4dab-916e-06b5c2629a28` (ends 3+2, Knowledgable + Modernised + Obsolete gear), "Toad Phase 6 Monstrous" `be1a4d01-2585-4a4e-a9e9-89da9b7b3b66` (ends 2+0 teeth + claws), "Toad Phase 6 Spell-Slinger" `074db0d1-c995-47ee-a8a4-188eebacdd21` (ends 2+1 Blast, Ball, Fire). Bowser's over-limit fixture `f9d5e47b-847a-4cd0-949e-2b4c1a1effcd` was inserted and left in place (its SQL header says "never against motw", but the brief allowed local `motw`)

## 2026-09-15 — Hunter wizard Phase 7 (F9): creation wizard browser pass (uncommitted, main tree)

- Scripts + evidence: session scratchpad `phase7-verify/`. `builds.mjs` derives each playbook's minimum legal build from its JSON (mirrors HunterCompleteness; 12.9 finished builds for the three governed ones); `derive-builds.mjs` proves them through evaluate first (34/34), then `legal-pass.mjs` drives them (`--dry` walks without Create); `checks7.mjs <part> [--theme --width]`; `wizard-lib.mjs` is the driver
- Picks by DOM index work: option-tree leaf checkboxes follow the served tree in depth-first order inside `#hunter-section-<id>`; gear `#hunter-gear-<cat> > label`; look rows `#hunter-look div.flex.flex-wrap.items-center` in served category order; eyebrow text gives step/dot
- The client never sends Required move ids; the server adds them. Compare the POST without them and the stored GET with them, or 14/28 "fail" for nothing
- Custom-select trigger innerText includes the caret "▾"; strip it
- During a pending popstate guard the URL already shows the destination; with 'computed', Cancel puts `/hunters/new` back. Assert after Cancel, not while the modal is open
- beforeunload: `page.evaluate(() => location.reload())` and `page.close({ runBeforeUnload: true })` both raise the `dialog` event once the page has had a click/typing gesture
- Expired session: `context.clearCookies({ name: 'motw.session' })`, then Next: evaluate 401, straight to /login, no toast, no modal
- Stale-playbook routes reach refusal paths the UI locks prevent: `page.route` the playbook GET with `pickRules: []` (NA 2+1 buildable, band offers Reload; after reload the band links to the dot), a fake gear option (Reload clears "1 gear pick"), a 404 on reload (L27 band)
- Overflow heuristics: "element right > viewport" flags the collapsed tracker label text (inside a zero-width `overflow-x: hidden` span). Trust scroll boxes (html/body/main/column/tracker scrollWidth) and confirm offenders by clipper
- Contrast probe (canvas oklch -> rgb, composite backgrounds): run it per step in dark; the wizard column sets no text colour, unlike the detail page's `section.text-primary`, so dark inherits a dark default
- Found (Phase 7): dark theme, every wizard step's un-classed text (section/option titles, h3s, rating values, counters, look chips, step 1 labels) measures 1.18:1; light 0 offenders, dark edit page 0. Cause: `wizard-layout` column has no `text-primary`; HEAD's create page had `section.text-primary`
- Found (Phase 7): step 1 name/pronouns row `grid-cols-[2fr_1fr]` resolves to `220px 220px` from md up (inputs' intrinsic width), so step 1 is ~450px minimum: Pronouns input 6px past the column at 1280, 113px at 1024, 221px at 768. 375 is fine (single column)
- Observed: the error band renders after the step content, so a refusal raised by Next on a long step (Moves) lands below the fold
- Pre-existing, cosmetic: server "Look: 1 of 2 line is unanswered." wording (since 634b3f9)
- Failed check: `checks7.mjs failed` kills the PID listening on 5225 (`netstat | findstr`, `taskkill /F`); restart the API afterwards. Card "Couldn't check what's left", no toast, Create enabled; it keeps the last clean items under the message (L6, by design). Create with the API down: band "Unable to create hunter. Please try again.", no toast
- Results: legal 28/28 (light 1280) + 15/15 (dark 1280, light 375, dark 375); refused builds 3/3 via evaluate; interaction checks all pass at light 1280 and dark 375 after 4 harness fixes
- Fixtures added: 43 hunters named "Toad Phase 7 …" (28 light-1280 one per playbook; 5 each "dark 1280", "light 375", "dark 375" covering every 12.9 finished build). Ids in `phase7-verify/db-hunters-phase7-created.txt`. Hex re-saved unchanged (0 diffs vs Phase 6)

## 2026-09-15 — Hunter wizard Phase 7: B1/B2 fix recheck (uncommitted, main tree)

- Scripts + evidence: `phase7-verify/recheck/` (`probe-lib.mjs` measure + `toggleDiff`: strip `text-primary` from `.wizard-layout` in the DOM and diff computed colours, an A/B with no worktree; `contrast-recheck.mjs --theme --width`, `mystery-recheck.mjs`, `overflow-recheck.mjs row|sweep`, `repro-hex-rotes.mjs`, `smoke-create.mjs`)
- B1 fixed: dark 1280/375 every step + card/hints/notices/bands/modals 0 enabled low (layout scope incl. tracker/aside); remaining sub-4.5 are disabled/faded only. Mystery: fix changes 0 elements' colour; tracker AND page 0px vs Phase 3 `A-*-after` (light+dark, create+edit)
- Pre-existing, light only: tracker complete "✓" `text-on-success` on `bg-success` 2.47:1 (tracker untouched); band `text-danger` 3.91:1. Probe the whole layout, not just the column, or the tracker is missed
- B2 fixed: step 1 row stacks at 1023/768/375, 2 cols at 1024/1280, column scrollWidth == clientWidth at all
- Found: 768 sweep (all 28): shared option-tree write-in `<input>` (no `w-full min-w-0`, inside flex `span.grid` without `min-w-0`) forces the 42% column sideways: Hex Rotes entry after the 3rd pick 34px, Professional Agency / Wronged Who You Lost 8px. 900+ clean, 1024 all clean, edit page 768 clean. Section templates unchanged in Phase 7: exposure is the narrow column
- Fixture added: "Toad Phase 7 recheck Initiate (Fighting arts, dark 1280)" `6bd7291b-11db-40cd-b989-632a13ea129f`

## 2026-09-15 — Hunter wizard Phase 7: N1 write-in overflow fix recheck (uncommitted, main tree)

- Scripts + evidence: `phase7-verify/recheck-n1/` (`n1-lib.mjs` `stripFix`/`restoreFix` remove exactly the fix's added classes from exactly the touched elements = before/after A/B with no worktree, plus `geometry`/`diffGeometry`/`pixelDiff`; `repro-n1.mjs hex|pro|wronged|gumshoe`, `sweep-n1.mjs`, `editpage-n1.mjs`, `followup-n1.mjs`)
- Class-only fixes: static classes, so a DOM strip is a faithful "before". Check strip counts > 0 to prove the served build has the fix, and fixed-vs-restored = 0 to prove the harness is clean
- N1 fixed: 768 Hex Rotes entry 0px sideways (stripped: 34px, the original repro); Professional Agency name / Wronged My prey 0 (stripped: 8). Write-ins shrink to 107–132px inside the card. At 375/1024/1280 the strip changes 0 elements, 0 px (wizard); Gumshoe Code textarea unaffected at 375/768
- Sweep (28 playbooks, 232 steps each width): 1024 clean incl. padding. 768 leftovers all identical to the pre-fix sweep, all on Moves: Spell-Slinger nested move sections (`ml-8` at exactly md) 1px sideways + 33px into padding, cards touch the divider; Hex Moves cards 29.4px into padding. Hex Rotes card 1px (host grid track rounds 197.1→198). Crooked Heat padding gone
- Edit page 1280 light+dark, Hex + Forged: strip A/B 0 geometry, 0 px full-page. Forged 16–18 px is look write-in render flicker (two unstripped captures differ identically). Write-ins stay 172px at desktop (`w-full` doesn't stretch them)
- Harness noise: every session logs one console error "HTTP 0 GET /api/mysteries" (dashboard request aborted by navigating away after login)
- Hunter specs 23 files / 326 tests pass. No hunters created, nothing saved
