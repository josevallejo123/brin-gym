# Brin Gym quality bar

Every rule here can be checked from a screenshot at iPhone size, from the code, or by a test. A rule that can only be seen on a real iPhone is marked **(phone)**. The app is built to this list and audited against it before each release.

How to read a rule: the letter and number are its ID; the text in brackets says how to check it. "Shot" means a screenshot at 390×844 and at 375×667. "Code" means reading or searching the files in `app/`. "Test" names the automated test that covers it.

## 1. Design

**Restraint**

- **D1.** No gradients, glow, blur, glass effects or shadows, anywhere. The one layer that sits over a screen, the End workout sheet, dims what is behind it with a flat scrim. [Test: `tokens.test.mjs` searches the CSS for `gradient`, `blur`, `shadow` and `filter`.]
- **D2.** No emoji anywhere, as icons or in copy. Icons are line drawings in one stroke weight, drawn as SVG. [Shot; code.]
- **D3.** Content is not wrapped in rounded, bordered cards. Space separates things; a hairline is used only where it carries information (a progress line, a group boundary). The one exception, asked for by the owner: each choice on Home and Day is a box, one hairline outline around one flat fill, because each is a separate thing to tap and must read as one. Nothing else is boxed. [Shot.]
- **D4.** One accent colour, rose gold. It marks the single primary action of a screen, the progress lines, the Finish flourish, and the rim of a choice while it is pressed and for the moment after, and nothing else. [Shot; code: only `--color-accent` and `--color-accent-pressed` are accent hues.]
- **D5.** One clear action per screen. A screen has at most one filled accent button. [Shot.]
- **D6.** Layouts are left-aligned with a visible order of importance: one largest thing, then supporting text. Nothing is centred by default. [Shot.]
- **D7.** Lots of empty space. Between the title and the things she taps, Day and Finish leave at least a third of the screen empty and Home at least a quarter. The small iPhone is the exception: Home's four boxes leave it a fifth. [Shot.]

**Type**

- **D8.** Exactly two typefaces, both chosen for this app and bundled: Bodoni Moda (headings and every number that counts time or reps) and Jost (everything else). No system font, Inter or Roboto shows as the brand face. [Code: `@font-face` rules; shot.]
- **D9.** Type sizes come from one scale and spacing from one scale. No size, gap, radius or duration is written as a raw number outside `css/tokens.css`. [Test: `tokens.test.mjs`.]
- **D10.** Timer digits never shift width as they change. [Test: the browser test measures the timer at different values.]
- **D11.** No tracked-out all-caps labels, no label that only restates the thing under it, no single word of a heading picked out in another colour or style, no arrow glued to a button's text. The middle dot appears only where the brief writes it: "1 · Hip thrust", "Superset A · round 2 of 3" (the finisher's label takes the same form) and "Done · 29:41". [Shot.]
- **D12.** On the player and the rest screen, the reps and the countdown are at least 96 px tall in type size, the exercise name (on a rest, the name of the exercise that comes next) at least 30 px and the set label at least 24 px, so they read with the phone propped a couple of metres away. [Code: tokens; shot.]
- **D13.** No text is cut off, ellipsised or overflowing at 375×667, including the longest exercise name and "Shoulders and triceps". [Test: the walk checks for horizontal overflow; shot.]

**Colour and contrast**

- **D14.** Always dark, whatever the phone's setting. [Code: no `prefers-color-scheme` rule; `color-scheme: dark` on the root.]
- **D15.** Text on the plum background has a contrast ratio of at least 7:1 for main text and 4.5:1 for muted text; text on the accent at least 4.5:1. Rose on plum is never used below these. While a workout is paused the stage dims, and muted text seen through the dimming still reaches 4.5:1. [Test: `tokens.test.mjs` computes the ratios.]
- **D16.** Colour is never the only signal: paused, muted and "warm-up" are also said in words or by the icon's shape. [Shot.]

**Controls**

- **D17.** No default-looking controls: every button, link and the dialog is styled, with no browser default outline, underline or grey button face. [Shot.]
- **D18.** Every tap target is at least 44×44 px; Done, Start and Resume are at least 56 px tall and sit in the bottom third, in thumb reach. The one exception is a link inside a sentence, which only the credits on About have. [Test: `layout.spec.mjs` measures every target on every screen.]
- **D19.** Every control has a pressed state, and focus is visible for keyboard use. A pressed control gets lighter, never dimmer, so pressed and focused states have more contrast than the resting state. [Code: `:active` and `:focus-visible` rules.]
- **D20.** Nothing looks tappable that is not, and everything tappable looks it. [Shot.]
- **D21.** Icon-only buttons have an accessible name. [Test: the walk finds every button by its name.]

**Motion**

- **D22.** Motion is short and calm: nothing bounces, nothing overshoots, and every change she triggers is over within 300 ms of her tap. Only `transform` and `opacity` are animated (and the stroke of the Finish flourish as it draws), never layout, and never `transition: all`. The flourish is the one longer, unprompted movement in the app. [Test: `tokens.test.mjs`; code.]
- **D23.** A change of screen is one movement with one lead. When she picks a day or a variation, or goes back from one, the name she chose travels between its box and the screen's title; the old screen fades out behind it, the box she chose opening a little towards her; and the parts of the new screen step in after the name, from the top down, a beat apart. Every other change of screen is a single fade. Nothing else moves on its own. [Test: `handover.spec.mjs`; code.]
- **D24.** With reduced motion on, drawings show a still frame, screens change at once and no name travels. [Test: the browser tests run with reduced motion; code.]
- **D25.** Nothing jumps as content loads: drawings and timers have their space reserved, and fonts are bundled and preloaded. [Shot; code.]

**Copy**

- **D26.** Copy is plain and in sentence case. No exclamation marks, no motivational or cheerful lines, no placeholder or filler text. [Code: search the app for `!` in strings; shot.]
- **D27.** A button says what it does, and an action keeps one name everywhere. [Shot.]
- **D28.** When something fails, the screen says what happened and what to do. [Code: the load-error screen.]

## 2. Feels like an app, not a web page

- **A1.** No white flash on launch or between screens: the background colour is set inline on the root element before any stylesheet loads, and `theme-color` and the manifest colours match it. [Code: `index.html`; **(phone)** for the cold start.]
- **A2.** No text selection, no long-press callout and no grey tap highlight on controls. [Code: `user-select`, `-webkit-touch-callout`, `-webkit-tap-highlight-color`.]
- **A3.** No double-tap zoom: controls use `touch-action: manipulation`. Pinch zoom is left alone, because it is an accessibility feature. [Code.]
- **A4.** Fixed screens do not rubber-band: every screen is laid out to fit both phone sizes, so nothing scrolls but the variation list and About, and their scrolling does not drag the page. A screen scrolls only as a fallback when it cannot fit (the phone on its side). [Code: `overscroll-behavior`; test: the walk finds no overflow; **(phone)**.]
- **A5.** Nothing sits under the notch, the status bar or the home indicator: edges are padded with `env(safe-area-inset-*)`, and the layout still holds when those insets are zero. [Code; shot at 375×667, which has no insets.]
- **A6.** Reopening the app returns to where she was. A workout in progress opens straight into the player with no loading screen in between. [Test: reload mid-set and mid-rest.]
- **A7.** No browser chrome leaks in: no page scrollbars, no underlined blue links, no focus ring on tap, no "Loading" text on a normal launch. [Shot.]
- **A8.** Inner screens have a back control at the top left, and the system back gesture never leaves the app in a broken state. [Test: the walk uses back; code.]

## 3. Code

- **C1.** No giant file. Each module does one job; logic modules (`js/logic/`) contain no DOM code and run in Node. [Test: the logic tests import them in Node.]
- **C2.** No framework, no build step, no runtime dependency. The only dependency is the browser test runner, used for testing alone. [Code: `package.json`.]
- **C3.** No dead code, no unused dependency, no commented-out code, no `TODO` left in shipped files, no `console.log`. [Code.]
- **C4.** No near-duplicate blocks: a thing done twice is one function called twice. [Code review.]
- **C5.** No magic numbers. Every duration, threshold and size is a named constant (`js/config.js`) or a token (`css/tokens.css`). [Code.]
- **C6.** No timer counts ticks. Every time shown is computed from timestamps; the repaint interval only decides when to look at the clock. [Test: `workout.test.mjs`, clock jumps.]
- **C7.** No state held only in memory: the workout is saved on every change and restored on launch. [Test: `session.test.mjs`, closed and reopened mid-set and mid-rest.]
- **C8.** No swallowed errors. Every `catch` either handles the failure in a way the comment beside it explains, or rethrows. [Code: read every `catch`.]
- **C9.** No console errors or warnings in either browser engine during a full walk. [Test: the walk fails on any console error or warning.]
- **C10.** The timer and state logic is tested: the clock jumping forward in the background, closing and reopening mid-set and mid-rest, a rest that ended while away, the three-hour drop, pause, step back, add time and skip. [Test: `tests/logic/`.]
- **C11.** No workout content in code: no exercise name, rep count or rest length appears outside `data/workouts.json`. [Code: search `app/js` for digits used as reps or rests, and for exercise names.]
- **C12.** One source of truth for each thing: the palette (icons are rendered from the CSS tokens), the version value, and the offline file list (generated by scanning `app/`, never kept by hand). [Code.]
- **C13.** No test-only switch in the app. Tests swap data and art at the server, not in app code. [Code.]
- **C14.** Every URL in `app/` is relative, and nothing loads from another site: no CDN, analytics, remote font or image. [Test: `shell.test.mjs` scans for absolute URLs.]
- **C15.** Data never reaches the page as HTML: the DOM is built with `textContent`, not `innerHTML`. [Code.]
- **C16.** Every platform API that is not universal is feature-detected before use, and named in section 4 with its source. [Code.]
- **C17.** Claims are checked before they are written down. "Works offline", "restores after reload" and "no console errors" each have a test; the README states nothing that was not run. [Test; README.]
- **C18.** Comments say why, not what. No banner comments, no narration of the next line. [Code.]

## 4. iOS Home Screen web app

**Installing and launching**

- **H1.** The manifest sets `name` and `short_name` "Brin Gym", `display: standalone`, and relative `start_url`, `scope` and `id`, so it works under `/brin-gym/`. `background_color` and `theme_color` equal the page background. [Test: `shell.test.mjs`.]
- **H2.** Icons: an opaque 180×180 PNG as `apple-touch-icon` (on iOS this link wins over the manifest's icons, and transparency would turn black), plus 192 and 512 PNGs and a separate maskable 512 in the manifest. Never one icon marked "any maskable". [Test: `shell.test.mjs` reads the PNG headers.]
- **H3.** The head carries `apple-mobile-web-app-title`, `mobile-web-app-capable` with `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style: black-translucent` and `viewport-fit=cover`. `black-translucent` is still the only way to draw under the status bar; the capable tag is no longer needed to open as an app on iOS 26 but startup images still depend on it. [Code.]
- **H4.** A startup image in the page background colour exists for each current iPhone screen size, so the launch screen is plum, not white. iOS takes its launch screen only from `apple-touch-startup-image` at the exact device size; it ignores the manifest's `background_color`. [Test: `shell.test.mjs` matches the links to the files; **(phone)**.]
- **H5.** A known WebKit bug (311569, open) can still show one white frame on a cold start in dark mode. Nothing in the page fixes it; it is on the phone checklist rather than claimed. **(phone)**

**Safe areas**

- **H6.** Layout uses `env(safe-area-inset-*)` on all four edges and never assumes the top inset is larger than zero: some iOS 26 builds report zero and draw their own status bar strip (WebKit bug 301994, reopened). [Code; shot at both sizes.]

**Storage**

- **H7.** A Home Screen web app has its own storage, separate from Safari's. The app keeps only two small values in `localStorage` (mute, and a workout in progress) and asks for persistent storage with `navigator.storage.persist()` where it exists; WebKit grants it by heuristics that include being a Home Screen web app. [Code.]

**New versions**

- **H8.** A service worker precaches every file in the generated offline list under a cache named for the build, and serves cache first. After one load the whole app works with the network off. [Test: the offline test.]
- **H9.** The app checks for a new service worker at launch, and each time it returns to the foreground with no workout in progress. A new version installs in the background and takes over only when no workout is in progress; a page is reloaded onto the new version only then. [Test: `updates.test.mjs`; code.]
- **H10.** Every build changes the bytes of `sw.js` itself (a stamped build value), because that is the one change every browser checks for. [Test: `offline-list.test.mjs`.]

**Time in the background**

- **H11.** iOS freezes or closes a web app in the background. Nothing relies on running there: times come from `Date.now()`, and the app re-reads the clock on `visibilitychange` and `pageshow`. [Test: `session.test.mjs`.]

**Sound**

- **H12.** Sounds are made with Web Audio only. There is no `<audio>` or `<video>` element and no media file, because a media element moves the page's audio session to "playback", which pauses other apps' music. [Code: search for `audio`, `video`, `.mp3`, `.wav`.]
- **H13.** Where `navigator.audioSession` exists, its `type` is set to `"ambient"` before the audio context is created. Ambient is the one type defined as mixing with other audio. [Code; **(phone)** for Spotify and Apple Music.]
- **H14.** The audio context is created and resumed only inside a tap, on `click`, the one event every browser counts as a tap (a touch `pointerdown` does not count). It is resumed again when the app returns to the screen. [Code; test: no autoplay warning in the walk.]
- **H15.** Sounds play only while the app is visible, and are never replayed late for a rest that ended in the background. [Test: the countdown cue in `copy.test.mjs` and the sounds tests in `player.spec.mjs`, which count every note the app starts.]
- **H16.** Accepted side effect, stated in the install notes: an ambient session is silent when the iPhone's ring switch is set to silent. **(phone)**

**Screen wake lock**

- **H17.** The Screen Wake Lock API is feature-detected, requested when a workout starts and again each time the app becomes visible, and released when the workout ends. It works in Safari from 16.4 and in a Home Screen web app from iOS 18.4. Where the request fails the app does nothing: no video, audio or other trick holds the screen awake. [Code; **(phone)**.]

## 5. Sources

Read on 2026-11-09. Each rule above that goes beyond the brief's starting list comes from one of these.

| Source | Dated | Used for |
|---|---|---|
| W3C, *Audio Session* working draft, `w3.org/TR/audio-session/` | 13 Nov 2024 | H12, H13: `ambient` is "mixable with other types of audio"; an `AudioContext` defaults to ambient and a media element to playback. |
| MDN, *Audio Session API* | modified 19 Aug 2026 | H13: types and the `auto` fallback order. Only Safari implements it. |
| WebKit bug 237322, "webaudio api is muted when the iOS ringer is muted" | comment of 25 Sep 2024 | H16: "By default the type is `ambient` and so audio will be muted if the phone is muted." |
| WebKit blog, *WebKit Features in Safari 16.4* | 27 Mar 2023 | H13, H17: Screen Wake Lock and a subset of the Audio Session API arrive in 16.4. |
| Apple, *Safari 18.4 Release Notes* | 31 Mar 2025 | H17: "Fixed Wake Lock API for Home Screen Web Apps." |
| WebKit bugs 254545 and 255363 (wake lock in Home Screen web apps; re-request after `visibilitychange`) | fixed 2025 and Apr 2023 | H17: request again on becoming visible. |
| WebKit blog, *News from WWDC25: WebKit in Safari 26 beta* | 9 Jun 2025 | H1, H3: every site added to the Home Screen opens as a web app; the manifest still supplies name, icons and display. |
| WebKit blog, *Updates to Storage Policy* | 10 Aug 2023 | H7: eviction, and `persist()` granted by heuristics such as being a Home Screen web app. |
| firt.dev, *iOS PWA compatibility notes* | updated 13 Oct 2026 | H2, H3, H4: `apple-touch-icon` overrides manifest icons; maskable icons ignored; startup image is the only splash and needs the capable tag; manifest `background_color` unsupported; `black-translucent` is the only full-screen status bar; separate storage. |
| WebKit bug 311569, white full-screen flash after cold start | filed 6 Apr 2026, open | H5. |
| WebKit bug 301994, status bar strip and zero top inset in Home Screen web apps | reopened 4 Aug 2026 | H6. |
| WebKit bug 199110, installed web app serves stale assets | fixed in iOS 16.0 | H9: update checks are reliable from iOS 16. |
| Vercel, *Web Interface Guidelines*, `github.com/vercel-labs/web-interface-guidelines` | undated, read 9 Nov 2026 | D10, D18, D19, D21, D22, D24, D28, A3, A5, H1: 44 px targets on mobile, `touch-action: manipulation`, never disable zoom, animate only `transform` and `opacity`, never `transition: all`, reduced-motion variant, tabular numerals, `theme-color` matching the background, `color-scheme` on the root, safe areas, named icon buttons, a recovery path on every screen. |
| Anthropic, `frontend-design` skill, `github.com/anthropics/skills` | commit 2c5958e | D8, D11, D23: the looks generated interfaces cluster around, and the template chrome to avoid. |
| 925 Studios, *AI slop fonts and gradients* | 6 Nov 2026 | D4, D8: unchosen default typefaces, default gradients, interchangeable icons and weightless copy as the tells. |
| K. Ganglani, *Vibe coding tech debt audit* | 28 Apr 2026, updated 1 Sep 2026 | C3, C4, C8, C16: dead code, duplicated logic, empty `catch` blocks, calls to APIs that do not exist, and tests with weak assertions as the tells in code. |
