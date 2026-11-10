# Brin Gym

A workout app for one iPhone. It is a web app added to the Home Screen from Safari: it has its own icon, opens full screen, and works with no signal. There is no sign-in and no account, and nothing leaves the phone.

She picks one of four days (Glutes, Legs, Shoulders and triceps, Back), then one of three variations, and the app walks her through the session one set at a time: the exercise, the set, the reps and timed rests, with a small looping line drawing of each exercise. She can leave the app at any moment, mid-set or mid-rest, and come back to the same place with the right times.

The app is plain HTML, CSS and JavaScript modules. There is no framework and no build step. The only dependency is Playwright, which is used for testing alone.

## Change a workout and republish

1. Open `app/data/workouts.json`. Every workout, rep count, set count and rest length is in this one file, and nowhere else.
2. Make the change. An exercise in a workout is `{ "exercise": "<id>", "reps": 10 }`, with `"each": "side"` or `"each": "way"` where the reps are per side or per direction. The IDs are the keys of `"exercises"` at the top of the file. Rest lengths, in seconds, are under `"rests"`, and the number of sets and rounds under `"sets"`.
3. Run `npm run check`. It says exactly what is wrong if the file no longer fits, and prints each workout's on-paper length.
4. Run `npm run serve` and open the address it prints to see the change.
5. Run `npm run publish`. It runs every test first and publishes only if they all pass. It takes about six minutes.
6. Run `npm run test:live`. It waits for GitHub Pages to serve the new version, then walks all twelve workouts on the published site and checks that it works offline.

Her phone picks the new version up the next time she opens the app with signal. A workout in progress is never interrupted: the new version waits until it is over.

## Commands

| Command | What it does |
|---|---|
| `npm install` | Installs Playwright. Then run `npx playwright install chromium webkit` once to download its browsers. |
| `npm run check` | Checks `workouts.json` and every drawing, and prints each workout's on-paper length. |
| `npm run serve` | Serves the app at `http://localhost:4173/brin-gym/`, under the same sub-path as the published site. |
| `npm test` | The logic tests, then the browser tests, on the small test content in `tests/fixtures/`. |
| `npm run test:browser:real` | The browser tests on the real workouts and drawings: all twelve workouts from Start to Finish, at two iPhone sizes, in WebKit and Chromium. |
| `npm run screens` | Screenshots of every screen and player state into `test-results/screens/`. Set `SCREENS_CONTENT=real` for the real content. |
| `npm run publish` | Tests, stamps a new version, commits, and publishes. See below. |
| `npm run test:live` | Tests the published site. |
| `npm run icons` | Renders the Home Screen icons and launch images from `app/art/app-icon.svg` in the app's colours. |

## Where things live

```text
app/                    the site: only this folder is published
  data/workouts.json    every workout, rep count and rest length
  art/                  the exercise drawings (CC BY-SA 4.0, see below) and the icon's dumbbell
  css/tokens.css        every colour, size and duration
  js/logic/             the workout's order, state and timers; no page code, tested in Node
  js/ui/                the screens; js/ui/copy.js holds every word that is not workout content
  js/platform/          sound, screen wake lock, new versions
  sw.js                 the service worker that keeps the app on the phone
  version.json          the version shown on the About screen; stamped by publishing
tools/app/              the local server, the icon renderer, the offline file list
tools/content/          the content check, and the scripts that prepared the drawings
tools/publish.mjs       npm run publish
tests/                  logic tests (node --test) and browser tests (Playwright)
docs/quality-bar.md     the rules the app is built to and audited against
docs/decisions.md       what was decided along the way, and the alternatives
CLAUDE.md               the guide for a Claude Code session working in this folder
```

## How publishing works

The `main` branch holds the whole project. GitHub Pages serves the `gh-pages` branch, which holds the `app/` folder and nothing else. `npm run publish` does this, in order:

1. Stops unless `npm run check`, `npm test` and `npm run test:browser:real` all pass.
2. Stamps `app/version.json` with the date (`2026.11.09`, then `2026.11.09.2` for a second publish that day).
3. Regenerates the offline file list (`app/offline-files.json`) and stamps its build value into `app/sw.js`, then tests the app exactly as it will be served.
4. Commits, then pushes `main` and `gh-pages` (the `app/` folder alone) together.

It refuses to commit any file outside `app/`, `tools/`, `tests/`, `docs/` and the few files at the top of the project, and it refuses to commit unless this repository's git identity is a GitHub no-reply address. To add a line to the commit message: `npm run publish -- --note "What changed"`.

On a new computer, after cloning, set the identity for this repository only:

```text
git config user.name "<GitHub login>"
git config user.email "<id>+<GitHub login>@users.noreply.github.com"
```

The published address is `https://<account>.github.io/brin-gym/`.

## Changing a drawing

The drawings in `app/art/` are made by script from two open sets, and `tools/content/art-map.json` records, for each exercise, the source drawing and which of its frames are used. To change one:

1. Clone the two source sets into one folder outside this project, as `<folder>/workout-guide` and `<folder>/everkinetic`. `app/art/LICENSE.md` gives their addresses and the commits used.
2. Edit the exercise's line in `tools/content/art-map.json`.
3. Run `node tools/content/prepare-art.mjs --sources <folder> --only <exercise-id>`.
4. Set `frames` and `still` for that exercise in `workouts.json` to match (the script says so if they differ).
5. Look at it: `node tools/content/contact-sheet.mjs --only <exercise-id>` writes an image to `test-results/contact-sheet/`.
6. Run `npm run check`, which needs neither source set.

"Plate around the world" shows a plate front raise: no free drawing of the real movement exists. Three hand-drawn frames in the same line style, saved as `app/art/plate-around-the-world/1.svg` to `3.svg` in the format `npm run check` enforces, would replace it.

## Licences and credit

**Drawings.** The artwork in `app/art/` is licensed under [Creative Commons Attribution-ShareAlike 4.0](https://creativecommons.org/licenses/by-sa/4.0/) (CC BY-SA 4.0), separately from the app's code. The exercise drawings are adapted from:

- [Workout Guide](https://github.com/bryllim/workout-guide) by Bryl Lim, CC BY-SA 4.0.
- [Everkinetic](https://github.com/everkinetic/data), created by Greg Priday and continued as the Everkinetic open data project, CC BY-SA 4.0.

They were recoloured and adapted: frames were chosen, resized and redrawn at one line weight, and some machines were removed. `app/art/LICENSE.md` has the full note, and the app's About screen carries the same credit. Anyone who shares or adapts these drawings must give the same credit and keep the same licence.

**Typefaces.** Bodoni Moda and Jost, each under the SIL Open Font License 1.1. Their licence texts are in `app/fonts/`.

**Code.** The app's own code has no open-source licence.
