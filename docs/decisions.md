# Brin Gym: decisions

What was decided while the app was built, and what else was considered. The app was built on 2026-11-09 from an approved brief by three sessions: one prepared the content and the drawings ("content"), one built the app ("app"), and one joined, checked and published them ("publish"). Where the brief was silent, the simplest option that fitted was taken and written down here.

## 1. Decisions set before building

Each had a recommended option that was in force unless the owner wrote something else in its "Your call" cell.

**The owner's "Your call" entries:** none. Every cell was left empty, so the recommended option below is the one in force for all fourteen.

| # | Question | In force | Considered and not chosen |
|---|---|---|---|
| R1-1 | Where the app lives and how it is published | The app lives in `app/`. The `main` branch holds the whole project; publishing pushes `app/` alone to a `gh-pages` branch, which GitHub Pages serves. One command, `npm run publish`, runs the check and the tests first. The live site then holds exactly the app and nothing else. | A GitHub Actions deploy (it needs a permission the signed-in command line did not have) · Pages from the `docs/` folder of `main` (`docs/` holds the quality bar) · app files at the repository root (the site would also serve the tests, tools and notes) |
| R1-2 | Which files are public | Public: `app/`, `tools/`, `tests/`, `docs/`, `package.json`, `package-lock.json`, `README.md`, `CLAUDE.md`, `.gitignore`. Everything else in the project folder is local and git-ignored. The tests, the quality bar and `CLAUDE.md` are needed to maintain the app from a fresh copy and carry nothing personal. | Keep `CLAUDE.md` local too (a new computer or a fresh clone would lose the maintenance guide) · Publish the install notes (the brief allows only the source, the README and licence notes) |
| R1-3 | Who uses git | Only the publish session. The other two wrote files and never ran git. The repository was created after `.gitignore` was confirmed, and the full list of tracked files was read before the first commit and the first push, because a public history is permanent. | Each session commits its own paths as it goes (two sessions in one working tree collide, and one wrong `git add` cannot be taken back) |
| R1-4 | GitHub account and commit identity | The account the GitHub command line is signed in to when publishing. Commits use that account's GitHub no-reply address, set for this repository only. | A personal email as the author (public and permanent) · Another account (not chosen) |
| R1-5 | Format of the data file | One JSON file, `app/data/workouts.json`, read by the app with `fetch` and by the check script with Node. JSON holds content only and every tool reads it. | A JavaScript module (content could grow code) · YAML (needs a parser library) |
| R1-6 | How the drawings get their colour | The files are colour-neutral (`fill="currentColor"` on a transparent background) and the app colours them with CSS. A palette change never touches the drawing files. | Bake the theme colour into each file · CSS filters over the white originals (cannot hit an exact colour) |
| R1-7 | How the rests are read | No set-up rest before the first block: the clock starts at Start, on the warm-up set. Between blocks the 90-second set-up rest replaces the 60-second rest. The warm-up set uses the main lift's reps. Nothing follows the last finisher set. This is the only reading that gives the brief's on-paper lengths. | A 90-second rest before the main lift too (adds 1:30 to every workout and opens each one with a wait) · 60 plus 90 seconds between blocks (adds 3 minutes) |
| R1-8 | Language of the tests and tools | Node only: `node --test` for the logic and Playwright for Node in the browser, run in WebKit (the closest thing to iPhone Safari on a PC) and in Chromium. | Python Playwright (a second language in the repository) · Chromium only (iPhones run WebKit) |
| R1-9 | A chime that never touches her music | Sounds are made with Web Audio, with `navigator.audioSession.type = "ambient"` where that API exists, and no audio or video elements. Confirmed against the W3C Audio Session draft, MDN and WebKit bug 237322 before building. Known side effect: the chime is silent when the iPhone's ring switch is on silent. | `transient` (it may lower other audio) · `playback` (it takes over the audio session and pauses music) |
| R1-10 | What Pause and Step back do | Switching apps or locking the phone pauses nothing: every clock keeps running. The Pause button freezes the total time and any rest countdown until she resumes. Step back returns to the previous set as not yet done and cancels the rest in progress; the total time is not rewound. | Pause freezes only the rest countdown (a deliberate break would still count against 30:00) |
| R1-11 | Licence for the app's own code | None stated. The README says the artwork is CC BY-SA 4.0, the fonts are under their own open licences, and the code has no open-source licence. | MIT (it needs a copyright holder's name in a public file, and nobody asked for the code to be open source) |
| R1-12 | Effort level of the sessions | High for all three. The spec was settled, so the work was execution and checking. | Higher (slower and costlier for the same spec) |
| R1-13 | Source of the "Dumbbell walking lunge" drawing | Everkinetic `0121`, the walking dumbbell lunge, credited beside Workout Guide. Workout Guide's `walking-lunge` frame 1 is a trace of that same drawing, and its other two frames are different views at a different size, so they make no loop. Same licence. This is the one place the drawings depart from the brief's table. | Workout Guide's frames 1 and 3, as the table says (reads as two unrelated drawings swapping twice a second) |
| R1-14 | The "Plate around the world" drawing | Ship the fallback the brief names, the plate front raise: right equipment, wrong movement. It is the only one of the 46 that shows a different movement. | Adapt a figure by script (two ways were studied and neither reached the standard of the other 45) · three frames drawn by hand (not rejected: it needs a person with a drawing tool) · show no drawing for this one exercise (the brief names the fallback) |

## 2. The log, in order

| When | Who | What changed |
|---|---|---|
| 2026-11-09 | planning | Two skills were installed for the sessions to use, `frontend-design` and `webapp-testing`, both from `github.com/anthropics/skills` (Apache 2.0), each read in full first. Four others were looked at and skipped: one whose examples use absolute paths, a CDN import and a combined "any maskable" icon; one that fetches its rules at run time; and two that install packages at run time. |
| 2026-11-09 | planning | `.gitignore` was written before any session started, so local-only files could not be staged by mistake. |
| 2026-11-09 22:05 | content | The source frames come thin, heavy or as double lines, so dropping one frame per exercise was not enough. Every kept frame is fitted to the canvas and redrawn by script at one line weight (`tools/content/prepare-art.mjs`, driven by `art-map.json`). Alternative: frame selection only, which left about 8 exercises with no matching pair. |
| 2026-11-09 22:05 | content | 15 exercises keep 3 frames and 31 keep 2; `frames` and `still` in `workouts.json` say which. Weight-stack machines are erased from the pull-through, face pull, overhead rope extension and lat pulldown (stack only) drawings, where they would not redraw cleanly. |
| 2026-11-09 22:05 | content | Departure from the brief's table: Dumbbell walking lunge is drawn from Everkinetic `0121`, the drawing Workout Guide's `walking-lunge` frame 1 was traced from, because Workout Guide's other two frames make no loop with it. Dumbbell upright row uses Everkinetic `0016`, as the brief allows. Both sources are in `credits.json`. |
| 2026-11-09 22:05 | content | Plate around the world falls back to `plate-front-raise`, the fallback the brief names: adapting the figure needs new arms drawn from the shoulders, which could not be done to the standard of the other drawings. |
| 2026-11-09 22:05 | content | `check-workouts.mjs` prints the on-paper lengths but does not pin them, so a later rep change does not fail the check. Alternative: fail when they differ from the approved table. |
| 2026-11-09 22:15 | app | R1-9 confirmed against the W3C Audio Session draft (13 Nov 2024), MDN (19 Aug 2026) and WebKit bug 237322: ambient mixes with other apps, Web Audio defaults to it, and it is silent with the ring switch on silent. Screen Wake Lock works in a Home Screen app from iOS 18.4 (Safari 18.4 release notes). |
| 2026-11-09 22:15 | app | Typefaces Bodoni Moda and Jost (SIL OFL); palette refined from the brief's starting values; timer digits in fixed-width cells; one version value in `app/version.json`, with the service worker's build value a separate content hash; offline list as `app/offline-files.json` plus a stamped `BUILD` line in `sw.js`; twelve flat launch images for the iPhone screen sizes; the wake lock is held through a pause; the away note fades after 8 seconds; About also credits the two typefaces; tests run on `tests/fixtures` by default and on the real content with `npm run test:browser:real`. Playwright pinned to 1.64.0. |
| 2026-11-09 22:40 | planning | R1-13 and R1-14 added from the content session's notes. Publishing now also requires the real-content browser tests to pass, and its order was fixed: stamp the version, then the offline file list, then commit and push. |
| 2026-11-09 23:00 | publish | `app/.nojekyll` added and kept out of the offline list. GitHub Pages runs Jekyll on a branch-published site and turns `art/LICENSE.md` into a web page; the missing file would stop the service worker installing, so the live app would have had no offline copy. Alternative: rename the licence note to `.txt`. |
| 2026-11-09 23:00 | publish | `.gitattributes` pins line endings to LF, because the worker's build value is a hash of the app's bytes. It is one more public file than R1-2 lists. Alternative: rely on each computer's git settings. |
| 2026-11-09 23:00 | publish | Publish tool: the version is the date; `package.json` carries no version of its own; publishing refuses a file outside R1-2's public list and refuses to commit without a GitHub no-reply identity; the `gh-pages` commit is made from `app/` as committed on `main`; nothing is done when the site already serves that folder; `--note` adds a line to the commit. Two new runs: `test:browser:published` and `test:live`. |
| 2026-11-09 23:00 | publish | Code review over `app/`, `tools/` and `tests/`: 10 findings, 9 fixed (Jekyll, line endings, the wake lock asked for twice, IDs safe in an address, the published worker pair untested, on-paper length computed twice, contact sheet defaults, a malformed saved note, a shared control in a screen module). Not fixed: a fast double tap on Done can land on the rest's Skip. |
| 2026-11-09 23:00 | publish | Drawings looked at in the app's colours at the player's, the rest screen's and the list's sizes, all 46. No correction made. R1-13 and R1-14 confirmed. Weakest: wide-grip lat pulldown, frame 2. The GitHub account's name is kept out of public files. |
| 2026-11-09 23:20 | publish | Screenshot audits, one by the publish session and one by a reviewer that saw only the screenshots, the quality bar and the brief's sections on what the app does and how it looks: 2 misses and 15 smaller points, 9 fixed. The rest screen's "next" block, the paused stage's contrast, the set label's size and colour, and the End sheet's main button changed. The fixed screens were re-shot and looked at by the publish session, not re-audited independently. |
| 2026-11-09 23:20 | publish | Simplify pass: the site's address moved to `tools/app/site.mjs`; `main` and `gh-pages` go up in one push; stray files and the identity are checked before the tests, not after; an ID is a slug of the name; the new-version test has its own file; the published run is the offline test alone. |
| 2026-11-09 23:20 | publish | Published as version 2026.11.09. Before the push: 124 logic tests, 162 browser tests on the test content, 162 on the real content, and the offline test on the app as stamped. On the live site: all twelve workouts at two sizes in two engines, and the offline test in Chromium. Not verified: everything that needs an iPhone. |

## 3. Decided by the app session

Each with the alternative that was not taken.

1. **Typefaces: Bodoni Moda and Jost**, from the Fontsource 5.3.0 packages (Latin subset, variable). Alternatives looked at on the plum background: Cormorant Garamond (too light at a distance), Fraunces (no fixed-width figures in its Latin subset).
2. **Palette refined from the brief's starting values**: background `#1d141a`, surface `#2b1f27`, hairline `#46323d`, text `#f4e8e3`, muted `#b99da4`, accent `#dba898`, on accent `#2a1a1f`. Alternative: the starting values unchanged.
3. **Timer digits sit in fixed-width cells** as well as asking the font for tabular figures, because one test engine does not apply tabular figures to a single character.
4. **Test content is small**: the real four days and twelve variation names, built from twelve exercises with generated stand-in figures. Alternative: a second full copy of the workouts in `tests/`, which invites editing the wrong one.
5. **One version value**, shown on About. The service worker's build value is a hash of the app's files, never typed by anyone.
6. **The offline list is a JSON file plus a stamped line in `sw.js`**, not an imported script: a browser always re-checks the bytes of `sw.js`, and not always the scripts it imports.
7. **Launch images**: twelve flat plum PNGs, one per iPhone screen size. iOS takes its launch screen only from these.
8. **Navigation**: addresses in the URL hash; the back control steps back through history when the previous screen is part of the app, so it agrees with the iOS back swipe. A workout in progress owns the screen whatever the address.
9. **While paused** the stage dims, the buttons become "Paused" and Resume, and the pause control is hidden, so there is one way on. Alternative: a second Resume at the top.
10. **Step back is hidden on the first set**, where there is nothing to undo.
11. **The wake lock is held for the whole workout, paused or not.** Alternative: release it on pause.
12. **The away note fades after 8 seconds** and is cleared by her next action. Alternative: keep it until Done, when "4 minutes ago" would be stale.
13. **Labels**: "Warm-up set", "Set 2 of 3", "Superset A · round 2 of 3", "Finisher · set 2 of 3"; rests are "Rest", "Switch" (the 10 seconds) and "Set up" (the 90 seconds).
14. **About also names the two typefaces.**
15. **Sounds**: a falling two-part tock for Done, a short tick at 3, 2 and 1, and a two-note chime when a rest ends, all sine tones defined as a table at the top of `sounds.js`.
16. **A rest counts as "ended while away" when the app first notices it 3 seconds or more late.** Under that, it chimes as normal.
17. **The three hours run from her last tap**, and a rest ending on its own does not count as a tap.
18. **The Finish screen is not remembered.** Reloading on it shows Home.
19. **Pressed states get lighter, never dimmer.**
20. **Persistent storage is requested at launch**, so iOS is less likely to clear the app's storage.
21. **Sound is switched on by the first tap anywhere in the app**, not only by Start, because after iOS reopens the app mid-workout there is no Start to tap.
22. **About shows at once** and fills in its credits and version when their two small files have loaded.
23. **No check for a new version is made during a workout.**

## 4. Decided by the content session

1. **Every frame is redrawn at one line weight (4 units on the 512 canvas) and each exercise is fitted to the canvas.** Alternative: only choose frames.
2. **Weight-stack machines are erased** where they redraw as speckled blocks and differ between frames. The cable stays and ends in mid-air.
3. **Cable hip abduction keeps its machine**, because the hand holds it.
4. **Leg extension has no machine base in any frame**, since one source frame has none.
5. **Clean frames over full range of movement**: for single-leg glute bridge, landmine squat, overhead rope triceps extension and wide-grip lat pulldown, the loop uses two clean frames that cover part of the movement instead of a rough frame that covers all of it.
6. **The icon is drawn from simple shapes**, as outlines at one line weight, turned 35 degrees. Alternative: lift a dumbbell from a frame, where each is partly hidden by a hand.
7. **The check is strict about a drawing file**: only `<svg>` and `<path>`, only `fill="currentColor"`, ink inside the canvas, and less than 40% of the canvas filled.

## 5. Decided by the publish session

1. **`app/.nojekyll`.** GitHub Pages runs Jekyll on a branch-published site, and Jekyll turns `art/LICENSE.md` into a web page. A file in the offline list that is not there stops the service worker from installing, so the app would have worked only with signal. The marker tells Pages to serve the folder as it is. Alternative: rename the licence note to `.txt`.
2. **`.gitattributes` pins line endings to LF.** The service worker's build value is a hash of the app's files, so a checkout that changes line endings would look like a new version. Alternative: rely on each computer's git settings.
3. **The version is the date**: `2026.11.09`, then `2026.11.09.2` for a second publish that day. `package.json` no longer carries a version of its own. Alternative: a hand-kept number such as 0.1.1, which says nothing about when.
4. **`npm run publish` has two locks of its own**: it refuses to commit a file outside the public list (R1-2), and it refuses to commit unless the repository's git identity is a GitHub no-reply address. Alternative: trust `.gitignore` and the git settings alone.
5. **The `gh-pages` commit is made directly from the `app/` folder as committed on `main`**, so the site is byte for byte what was tested, and both branches go up in one push: both or neither. If the site already serves exactly that folder and nothing is waiting to be committed, publishing does nothing. Alternative: a second working folder or a subtree split.
6. **Two more test runs**: `npm run test:browser:published` runs the offline test against `app/` exactly as it is on disk, with the stamped worker and offline list (every other run works those out in memory), and `npm run test:live` runs the twelve-workout walk and the offline check against the published site, after waiting for it to serve the new version.
7. **The content check prints lengths from the app's own step sequence** (`app/js/logic/sequence.js`), not from a second copy of the rules. An ID is the name with everything but letters and digits turned into hyphens, so an ID is always safe as a folder name and in an address, and a name may hold anything. Alternative: refuse names with other characters.
8. **No guard against a double tap.** Done and the rest's Skip share the bottom of the screen, so a fast double tap on Done can skip the rest that follows; Back one set undoes it in one tap. Alternative: ignore taps for a quarter of a second after the buttons change, which slows every automated walk and adds a timer to the player. To be revisited if it happens in use.
9. **The contact sheet defaults to the app's own colours and list size**, read from `app/css/tokens.css`, and writes to `test-results/`.
10. **The GitHub account's name is kept out of the public files.** Tools work the published address out from the repository's own address.
11. **R1-13 and R1-14 confirmed on the contact sheet in the app's colours and sizes**: the Everkinetic walking lunge reads as a step forward, and the plate front raise ships as the stand-in for "Plate around the world".
12. **No drawing was changed.** All 46 were looked at in the app's colours at the player's size, the rest screen's and the list's. The second frame of the wide-grip lat pulldown is visibly rougher than the first at phone resolution. Eight other clean-up settings were tried through `prepare-art.mjs` and none was better, so it stays as it was. A cleaner frame needs a hand with a drawing tool.

### From the screenshot audits

Every screen and player state was shot at both sizes and audited twice: once by the publish session, and once by a reviewer that was given only the screenshots, the quality bar and the brief's sections on what the app does and how it looks.

13. **On a rest, what comes next is laid out like the set it is about to become**: the drawing, the name at the size it has on the set, the set label and the reps, stacked on the left margin. Before, it was a small row at list scale, with the name under the 30 px floor and the middle of the screen empty. Alternative: only enlarge the name.
14. **A paused stage dims to 75%, not 35%**, and the word "Paused" is set in the main text colour. At 35% the exercise name measured 2.9:1 and the labels 2.0:1. A test now works out the contrast of muted text through the dimming. Alternative: dim only the drawing and the numerals.
15. **The set label ("Warm-up set", "Set 2 of 3") and the kind of rest are 24 px in the main text colour**, and "each side" is 30 px, so they carry across a room. Before, they were 21 to 24 px in the muted colour.
16. **On the End workout sheet, carrying on is the filled button** and sits on the right, where Done and Resume sit; "End workout" is the quiet one. A slip onto the close control followed by a habitual tap then ends nothing. The button reads "Continue": "Keep going" was literal, but it is also a stock phrase of encouragement. Alternative: "Cancel", which could be read as cancelling the workout.
17. **The bottom row of the player keeps one height**, so the step-back arrow keeps one centre line and nothing above it moves when the buttons change. **Home's title sits where the inner screens' titles sit.** The quality bar now names the Finish flourish as the third use of the accent.
18. **Audit points left as they are**, each with its reason:
    - *No guaranteed cue that the variation list scrolls.* With an iPhone's safe-area insets the fold cuts through a row, which is the cue; with none, on the larger size, it can fall cleanly between rows. A fade would need a gradient, which the quality bar rules out.
    - *List drawings do not share a left edge.* Each figure is centred on its own canvas, so a narrow figure sits in from the margin, in the list and on the player alike.
    - *The pause control leaves a gap while paused.* It is hidden in place so that the two controls beside it do not move.
    - *The step-back arrow has no word beside it.* The rest screen's row is full at the smaller size.
    - *A time that starts with "1" looks indented.* That is the cost of fixed-width digits. Setting the first digit on the margin was tried and left a wide gap before the colon, which looked worse.
    - *About credits the two typefaces.* One line of plain credit beside the drawings' credits.
    - *A long name can wrap on the larger phone and not on the smaller*, because the larger phone sets it larger.
    - *Done is full width on the first set*, where there is nothing to step back to.
