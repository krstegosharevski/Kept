# Kept: build plan for Claude Code

## 0. How to use this file

You are building **Kept**, a personal routine tracker for one person (the owner). It runs only on the owner's own iPhone and will **not** go to the App Store. It is a Progressive Web App (PWA): static files on a free HTTPS host, installed to the iPhone Home Screen from Safari.

- `kept-demo.html` (next to this file) is the demo the owner has already approved. Reuse its markup patterns and logic as your starting point. Its look has since been replaced by an Apple style (section 6). It was written for a sandbox that added its own `<html>/<head>/<body>` skeleton and safe-area padding, so the real app must add those itself.
- Work through the milestones in section 9, in order. After each milestone, give a short summary and ask the owner to check it with `preview.cmd`.
- Ask the owner before you add anything that is not in this plan.

## 1. Context and constraints

- **Owner's computer:** Windows PC (no Mac), with VS Code and Azure. Node.js LTS is required: check `node -v`, and if it is missing ask the owner to install it from nodejs.org.
- **Target device:** an iPhone running Safari, with the app installed as a Home Screen web app. After the first open it must work fully offline.
- **No backend:** single user, single device. No accounts, no server, no analytics, and no third-party requests at runtime (the app uses the iPhone's system font, so there are no font files).
- **Data storage:** data lives on the phone in localStorage. Backups are files that the owner saves to Files or iCloud Drive.
- **Tech:** plain HTML, CSS and JavaScript (ES modules). No framework, no bundler, no build step. npm tools are used only through `npx`, and only in the helper scripts.
- **Language:** English UI.

## 2. Project structure

```
kept/
├─ KEPT_PLAN.md
├─ kept-demo.html              reference only, never deployed
├─ README.md                   owner instructions: preview, publish, install, update, backup
├─ preview.cmd                 runs a local server for app/ and opens the browser
├─ deploy.cmd                  publishes app/ to Azure Static Web Apps
├─ tests/
│  └─ logic.test.mjs           run with: node --test
└─ app/                        the only folder that gets deployed
   ├─ index.html
   ├─ styles.css
   ├─ js/
   │  ├─ logic.js              pure functions: dates, schedules, stats, streaks, normalize (no DOM)
   │  ├─ store.js              load/save localStorage, backup export/import
   │  ├─ ui.js                 rendering and events
   │  └─ scene.js              scenery from the owner's website: the lake and the dandelion
   ├─ sw.js
   ├─ manifest.webmanifest
   ├─ staticwebapp.config.json
   ├─ icons/                   icon.svg, apple-touch-icon.png (180), icon-192.png, icon-512.png, icon-maskable-512.png
   ├─ ranks/                   rank artwork: banner-<id>.svg (Ranks tab) and badge-<id>.svg (Stats → Month)
   └─ fonts/                   Bricolage Grotesque 800 and Figtree, used only by the rank artwork (SIL OFL)
```

Initialize a git repository and commit after each milestone.

## 3. Core rules (the owner asked for these explicitly)

1. **Only today can be checked off.**
   - Past days can be viewed but never changed: no completing and no un-completing.
   - Future days cannot be opened.
2. **Saturday and Sunday are always rest days.**
   - Nothing is due on them, and nothing can be checked.
   - They are left out of every percentage and never break a streak.
   - They are shown in **black** everywhere: the Today screen, the week chart, the month calendar, the routine dots and the schedule day picker.
3. **The past stays as it was.**
   - Changing a routine's schedule affects only today and later days.
   - Stopping a routine keeps its history (see 4.2).

## 4. Data

### 4.1 Model

localStorage key `kept-data-v1`:

```json
{
  "schema": 1,
  "routines": [
    {
      "id": "r_lx3k9a",
      "name": "Eat healthy",
      "emoji": "🥗",
      "color": "#34C759",
      "created": "2026-10-28",
      "stopped": null,
      "schedules": [
        { "from": "2026-10-28", "type": "daily" }
      ]
    }
  ],
  "checks": { "2026-10-28": ["r_lx3k9a"] }
}
```

- **Schedule types:**
  - `{type:"daily"}`: Monday to Friday.
  - `{type:"days", days:[0,2,4]}`: chosen weekdays, with Monday = 0 through Friday = 4. Values 5 and 6 are never allowed.
  - `{type:"weekly", target:1..5}`: a number of times per week, on any weekdays.
- **`schedules`** is a history sorted by `from`.
  - The schedule for a given date is the last entry with `from <= date`.
  - Editing a schedule appends `{from: today, ...}`. If the last entry's `from` is already today, replace that entry instead.
- **`stopped`:** a date string or null. A stopped routine is not due on or after that date, and its history is kept.
  - Resuming appends `{from: stopped, type:"off"}` and then the old schedule `{from: today, ...}`, and clears `stopped`. The `off` entry keeps the stopped stretch not due, so the past stays as it was.
- **`checks`:** maps a date key to the array of routine ids completed that day.
- **Meta key `kept-meta-v1`:** a separate key holding `{ "lastBackupAt": ISO string | null, "reminderDismissedOn": "YYYY-MM-DD" | null }`.

### 4.2 Rules

- **Dates are local.**
  - Build `YYYY-MM-DD` keys from `getFullYear()`, `getMonth()` and `getDate()`.
  - Never use `toISOString()` for date keys: it converts to UTC and shifts days.
  - Weeks start on Monday.
- **`isRest(d)`** is true on Saturday and Sunday.
- **`isDue(r, d)`** is false on rest days, before `created`, and on or after `stopped`. Otherwise it follows the schedule in effect on `d`. A weekly routine is due on every weekday.
- **Stopping and deleting:**
  - "Stop tracking" is the main option offered.
  - "Delete" removes the routine and all of its check-ins. It needs a two-step confirm with clear text: "Delete routine and all its history".
- **`normalize(data)`** runs on load and on import. It:
  - drops check-ins on rest days,
  - drops check-ins for unknown routine ids,
  - removes 5 and 6 from `days` (an empty list becomes daily),
  - clamps the weekly target to 1–5,
  - sorts `schedules`,
  - migrates the demo's shape (a single `sched` object) into `schedules: [{from: created, ...sched}]`,
  - maps the demo's six routine colors to the Apple routine colors in section 6.
- **Storage errors:** wrap every localStorage read and write in try/catch. If a save fails, show the toast "Couldn't save. Your iPhone storage may be full."
  - If the saved data cannot be read, copy it to `kept-data-v1-unreadable`, start empty, and show "Couldn't read your saved data. A copy was set aside."
- **Persistent storage:** on first run, call `navigator.storage?.persist?.()` and ignore the result.

## 5. Features and screens

The bottom tab bar is Today · Routines · Stats · Ranks · Settings.

### Today

- **Wildcard (weekends):** on Saturday or Sunday, if something was missed Monday to Friday of this week and a Wildcard is left, a gold card offers **Use a Wildcard**. Nothing opens until the user taps it and confirms in a pop-up. Then the whole weekend lists the missed routines by day; ticking one writes the check-in on the **missed weekday** (so a Wednesday at 70% becomes 100%) and marks it in `madeUp`, which lifts that day, the week, the month, the rank and repairs streaks. Tapping again undoes a make-up (never an on-time check-in). Weekly routines owe one check-in per one short of the target, on the earliest empty weekday. **Two Wildcards per calendar month** (by the day used), **only for the current week**. Data: `wildcards` {Monday: day used} and `madeUp` {weekday: [ids]}, kept by normalize and in backups. Past weekdays say "Made up with a Wildcard"; Stats marks made-up dots with a gold ring and calendar days with a gold diamond ("Made up" in the legend).
- **Header:**
  - a label: Today, Yesterday, or the weekday name,
  - the date,
  - ‹ › day arrows, with › disabled on today,
  - "Back to today" when another day is shown,
  - a progress ring showing done/due.
- **Today itself:**
  - The list shows routines due today, each with a big check circle. Tapping it toggles done.
  - The hint under each name shows the schedule: "Mon – Fri", "Mon · Wed · Fri", or "1 of 2 this week" for weekly routines.
- **A past weekday:**
  - A lock line at the top reads "Past day, view only. You can only check off today."
  - Each routine shows a status that cannot be tapped: a filled circle with ✓ means Completed, a dashed circle means Missed ("Not done" for weekly routines). No buttons are shown.
- **A rest day (today or in the past):**
  - A black card reads "Rest day. Saturdays and Sundays are for resting, so there is nothing to check off."
  - When the rest day is today, the card adds "Your routines start again on Monday."
  - A moon badge replaces the progress ring.
- **Empty states:**
  - no routines yet, with an "Add a routine" button,
  - nothing scheduled on this day.
- **Backup reminder:** a banner at the top when a reminder is due (see Settings).
- **Day change:** when the app returns to the foreground on a new day, it moves to the new today.

### Routines

- **New routine** sits at the top of the screen, above the routines, a little bigger than a routine row.
- **Active list:** active routines (tap to edit) and a "+ New routine" button.
- **Stopped section:** lists stopped routines. Resuming one appends a new schedule from today and clears `stopped`.
- **Editor (bottom sheet):**
  - Name: required, max 40 characters.
  - Icon: the 16 emoji from the demo.
  - Color: the 6 routine colors in section 6.
  - How often: a segmented control with "Mon – Fri", "Some days" and "× per week".
    - Some days: M T W T F chips, plus S S chips shown black and disabled.
    - × per week: a stepper from 1 to 5.
  - Always show the note "Saturday and Sunday are always rest days."
  - When editing, also show "Schedule changes apply from today. Past days keep their old schedule."
  - Buttons: Save; Stop tracking (edit only); Delete (edit only, two taps).

### Stats

- A segmented control switches between Week and Month.
- **Week:**
  - ‹ › week navigation, with no future weeks.
  - A big % for the week.
  - 7 bars, Monday to Sunday, each showing that day's completion %. Saturday and Sunday are full-height black columns with "REST" written vertically.
  - Per routine: done/expected and 7 dots (filled = done, empty = due but not done, dashed = not due, black = rest day).
- **Month:**
  - ‹ › month navigation.
  - The month's rank banner above the card, with a soft glow in the rank's color: "Rank so far" for the current month, "Final rank" with a lock for a finished one. Tapping it opens Ranks.
  - A big % for the month, to one decimal.
  - A calendar heatmap: weeks start Monday, 5 green levels, weekends black, future days dimmed, today outlined.
  - Tapping a past weekday opens it on the Today tab, read-only.
  - A legend from Less to More, plus Rest.
  - Per routine: a % bar and "x of y · streak N · best N".
- **Definitions** (keep these exactly as in the demo):
  - **Range:** clipped to today and to each routine's created/stopped dates.
  - **Expected:** for daily and days routines, the number of due days in the range. For weekly routines, 0 if the range has no weekdays, otherwise max(1, round(target × weekdays_in_range / 5)).
  - **Done:** check-ins on due days only.
  - **Range %:** Σ min(done, expected) / Σ expected.
  - **Day % (bars and heatmap):** done / due, counting only non-weekly routines due that day. Empty if none are due.
  - **Heat levels:** 0 = 0% or nothing due, 1 = under 34%, 2 = under 67%, 3 = under 100%, 4 = 100%.
  - **Streak (daily and days routines):**
    - Count consecutive completed due days, going back from today.
    - Today not being done yet does not break the streak.
    - Non-due days and rest days are skipped.
    - Best = the longest run ever.
  - **Streak (weekly routines):** consecutive weeks that met the target. The current week counts only once its target is met.
  - **Units:** "d" for days, "wk" for weeks.

### Ranks

- Every month earns a rank from its Range %, rounded to one decimal:

  | Month % | Rank |
  |---|---|
  | 0 – 50 | Comfort Zone |
  | 50.1 – 60 | Starter |
  | 60.1 – 70 | Student |
  | 70.1 – 78 | Builder |
  | 78.1 – 85 | Iron Will |
  | 85.1 – 95 | Stoic |
  | 95.1 – 100 | Focused ("The Chosen") |

- The current month's rank is "so far" (days up to today) and becomes final when the month ends. A month with nothing expected has no rank.
- Ranks are computed from the routines and check-ins each time; nothing extra is stored, so backups are unchanged.
- **Ranks tab:**
  - At the top: "Your rank this month" and its banner with a soft glow in the rank's color, then the % and how much more the next rank needs (not on Focused).
  - All ranks: the 7 banners from Comfort Zone up, full width at their own height (higher ranks are taller). Ranks above this month's are gray and faded, on a solid backing so the lake doesn't show through.
  - Past months: one row per finished month, newest first, from the month the first routine was created, with its badge, rank and %. Tapping one opens that month in Stats.
- **Rank card:** on every day, the date and title sit on a glass card in the style of this month's rank banner: the rank's colours, slightly see-through with the page blurred behind, a soft light on the right, a fine edge in the rank's accent colour, the banner's seven dashes lit up to the rank, and the rank's badge on the right, which opens Ranks. The badge comes alive like the banner on Ranks: comets round its ring, twinkling gems, a soft glow in the rank's colour. Below the card, the day arrows are centred and bigger. Changing day moves nothing: the card shows on every day (with the rank of that day's month), the arrows keep their place while a short Today button appears beside them on past days, and the ring only animates when something is ticked off. From Iron Will up, a sheen crosses it now and then.
- **Animation:** only the banner of the rank you hold moves (top of Ranks, and the month's banner in Stats): the picture stays still while two comets streak around the ring, appearing and fading away, the gems on the ring twinkle, the glow behind it pulses, and a sheen crosses the banner now and then. The loader marks up each banner for this: it wraps the medallion (everything between its glow and its first line of text) in `<g class="emblem">`, tags the gems on the ring, and lays the comets on the ring. Reduce Motion turns it off.
- **Artwork** (`app/ranks/`, from the owner's rank pack): the SVGs are put into the page inline, not with `<img>`, so their text uses the two fonts in `app/fonts/`. Each copy gets its own ids, so one artwork can appear twice on a page. Until they load, a block in the rank's colors holds each one's place. The service worker caches them all for offline use.

### Settings

- **Appearance:** a Dark mode switch. Until it is used, Kept follows the device's light or dark setting. Using it saves `theme` ('light' or 'dark') with the backup bookkeeping in localStorage, and "Use device setting" clears it. index.html applies the saved choice before the page draws, so it never flashes; the status bar colour and the lake follow it. Erase all data resets it.
- **Save backup:**
  - Create the file `kept-backup-YYYY-MM-DD.json` containing `{app:"kept", schema:1, exportedAt, routines, checks}`.
  - If `navigator.canShare({files:[file]})` is true, call `navigator.share({files:[file]})`. On the iPhone this opens the share sheet, where the owner chooses Save to Files or iCloud Drive.
  - Otherwise, download the file (desktop).
  - Set `lastBackupAt` only when the share or download completes. A cancelled share is not a backup.
  - Show "Last backup: 3 days ago", or "Never".
- **Restore from file:**
  - A file input that accepts `.json`.
  - Validate and normalize the file.
  - Show an in-page confirm, for example "Replace your current data with this backup? (5 routines, 312 check-ins)".
  - On confirm, replace the data and show the toast "Backup restored".
- **Backup reminder:**
  - Show it on Today when there is at least one check-in and the last backup is more than 7 days old, or there has never been one.
  - Buttons: "Save backup" and "Later" (Later hides it until tomorrow).
- **Erase all data:** two-tap confirm. Clears the data and the meta key.
- **About:** the app version and a short "How to install on iPhone" text.
- **No example data:** remove the demo's seed data and its "Load example data" button.
- **Credit:** "Powered by Krtse XO" at the bottom of Settings (the owner asked for it; spelled as on the owner's website).

## 6. Design

The owner changed the look on 2026-10-28: Kept should look like an Apple app (the iOS 26 Liquid Glass style) and use the owner's logo. The demo's screens, texts and rules stay the same.

- **Look:** iOS-native.
  - Large bold titles, a gray grouped background with rounded white lists and hairline separators, capsule segmented controls, iOS steppers and bottom sheets.
  - A glass (blurred, see-through) floating tab bar and round glass buttons.
  - A top bar with the logo and the name "Kept", on the left, is always visible on every screen. It turns to glass once content scrolls under it.
  - Light and dark follow the iPhone setting (`prefers-color-scheme`) unless Settings → Dark mode chooses one (the wording says "device", not "iPhone", so it fits any phone).
- **Font:** the iPhone system font (SF Pro) through `-apple-system`, with SF Pro Rounded (`ui-rounded`) for big numbers. No font files and no requests to Google. On Windows the preview falls back to Segoe UI.
- **Key colors** (Apple system colors, light / dark):
  - Buttons and links: #007AFF / #0A84FF.
  - Progress (ring, bars, heatmap): #34C759 / #30D158.
  - Background: #F2F2F7 / #000000. Lists and cards: #FFFFFF / #1C1C1E.
  - Rest days: #000000 in both, with a faint outline in dark mode so they stay visible.
  - Routine colors: #34C759 #007AFF #AF52DE #30B0C7 #FF9500 #FF2D55.
- **Scenery** from the owner's Krtse XO website (`E:\krste-xo\krste-website-xo\src\components`), ported to plain JavaScript in `js/scene.js`:
  - Lake Prespa along the bottom of every screen, behind the content and the tab bar: moving wave bands, Golem Grad, three pelicans riding the waves, and now and then a bird, a jumping fish and ripples. 30fps, paused in the background, a single still frame under reduced motion.
  - **"All done" pop-up:** when the last routine due today is checked off, a card opens in the middle of the screen: the dandelion blows inside it (its seeds drift out over the screen and the bare stem stays), "All done for today", and how many routines were kept. Done closes it, as do a tap outside and Escape. Under reduced motion the dandelion stands still.
  - With no routines yet, the empty state shows a slow dandelion instead of the logo: gusts every 15 seconds, the seeds leave one by one, and it is gone after about a minute. Under reduced motion it simply stays.
- **Logo:** the owner's studio mark (section 7) is the app icon. It also appears with the name in the top bar. Settings shows the name without the logo.
- **Layout and accessibility:**
  - Phone-first, max width 480px, centered.
  - Tap targets at least 40px; 44px is better.
  - Input text at least 16px, which stops iOS from zooming in.
  - Respect `prefers-reduced-motion`.
- **Safe areas:** use `env(safe-area-inset-*)` so the title bar clears the status bar and the floating tab bar clears the home indicator.

## 7. PWA and iPhone setup

- **`index.html` head:**
  - `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`
  - `<meta name="mobile-web-app-capable" content="yes">` and `<meta name="apple-mobile-web-app-capable" content="yes">`
  - `<meta name="apple-mobile-web-app-title" content="Kept">`
  - **Status bar:** choose `apple-mobile-web-app-status-bar-style` so the time and battery stay readable in both light and dark mode. `black-translucent` makes that text white, which is unreadable on the light background. Check it on the iPhone.
  - `<meta name="theme-color">` for light and dark, using `media` attributes.
  - `<link rel="manifest" href="manifest.webmanifest">` and `<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">`
- **`manifest.webmanifest`:**
  - name and short_name "Kept",
  - start_url and scope "./",
  - display "standalone",
  - background_color and theme_color from the tokens,
  - icons at 192 and 512, plus a maskable 512.
- **Icons:** the owner's logo (the Krtse XO studio mark), copied from `E:\krste-xo\krste-website-xo\dist`.
  - `icons/icon.svg` is the master (from `logo.svg`). `apple-touch-icon.png` (180, no transparency), `icon-192.png` and `icon-512.png` are copied as they are.
  - Still to make in milestone 4: `icon-maskable-512.png` with safe padding, rendered from `icon.svg`, for example with `npx sharp-cli` or a small Node script.
  - Commit the PNGs.
- **`sw.js`:**
  - Precache every app file (html, css, js, manifest, icons) in a cache named from a `VERSION` constant, for example `kept-v1`.
  - For navigations and same-origin GET requests, go network-first with a 3-second timeout, then fall back to the cache.
  - Write network responses back into the cache. That way updates arrive whenever the app opens online, it still opens offline, and no manual version bump is needed for normal updates.
  - Call `skipWaiting()` on install. On activate, delete old caches and call `clients.claim()`.
- **`staticwebapp.config.json`:**
  - `Cache-Control: no-cache` for `/sw.js`, `/index.html` and `/manifest.webmanifest`.
  - MIME type `application/manifest+json` for `.webmanifest`.

## 8. Scripts (Windows .cmd, so PowerShell's execution policy cannot block them)

> Update 2026-10-28: the host is **Vercel**. `deploy.cmd` runs `node --test`, then `npx --yes vercel deploy --prod` from the project folder (the Vercel project's Root Directory is `app`, and `.vercelignore` uploads only `app/`) (log in once through the browser; no token is stored by the script). `app/vercel.json` sets the no-cache and manifest headers. Both scripts keep npm's cache in `.npm-cache` on E:, because C: is nearly full.

- **`preview.cmd`:** opens http://localhost:3000 and runs `npx --yes serve app -l 3000`.
- **`deploy.cmd`:**
  - If `SWA_CLI_DEPLOYMENT_TOKEN` is not set, ask for it with `set /p`. Never write the token to a file.
  - Then run `npx --yes @azure/static-web-apps-cli deploy ./app --env production`.
  - Show the result and wait for a key press.

## 9. Milestones

1. **Scaffold:** create the structure and `git init`. Move the demo into `app/`, split into html, css and js modules, with a full document head. Remove the example data. The app runs with `preview.cmd`.
2. **Core rules and data model:** schedule history, stopped routines, locked past days, rest days, normalize and migration, storage error handling.
3. **Settings:** real backup and restore with the share sheet, the reminder banner, and erase.
4. **PWA:** manifest, the maskable icon, service worker, iOS meta tags, `staticwebapp.config.json`. Verify offline mode in the Edge or Chrome DevTools.
5. **Tests:** write `tests/logic.test.mjs` for `node --test` (see section 10). All tests pass.
6. **Ship:** write the scripts and README, then help the owner publish (section 11) and install (section 12).

## 10. Tests (`node --test`, logic.js only)

- Date keys are local and never shift. Test with a late-evening time.
- Saturday and Sunday are never due for any schedule type, and normalize removes weekend check-ins.
- Wildcards: a Wednesday at 2 of 3 becomes 3 of 3 after a Saturday make-up, counts in the week and month, and repairs the streak; only on a weekend, only with something missed, two per month (back on the 1st); weekly routines owe the shortfall on the earliest empty weekdays; normalize keeps good Wildcard data and drops bad entries.
- Done counts ignore days that are not due.
- Weekly expected for a full week equals the target; partial weeks prorate by weekdays.
- A streak continues across a weekend. Today not done yet doesn't break it. A missed weekday does break it.
- A schedule change from today leaves past expected counts unchanged.
- A stopped routine is not due after its stop date, and its history is kept.
- Demo-shaped data (a single `sched`) migrates to `schedules`.
- Ranks: the edges of every rank, a month's rank from its %, no rank when nothing was expected, and the list of months to rank. Every rank has its banner and badge, and sw.js caches them.

Manual checks:
- Edge or Chrome device toolbar at iPhone size.
- Light and dark mode.
- Reload while offline.
- Keyboard focus is visible.
- No horizontal scroll at 360px.

## 11. Publishing (the owner does the Azure portal part)

> Update 2026-10-28: the owner has no Azure account now. The host (Vercel, Netlify or GitHub Pages) is chosen at the start of milestone 6; `deploy.cmd` and the host's header settings file follow that choice instead of `staticwebapp.config.json`.

Use Azure Static Web Apps on the Free plan:

1. In the Azure portal, go to Create a resource → Static Web App. Use a new resource group `rg-kept`, name `kept`, Plan **Free**, Deployment source **Other**. Create it.
2. Open the resource, choose Manage deployment token, and copy the token.
3. Run `deploy.cmd` and paste the token. The site goes live at `https://<name>.azurestaticapps.net`; the exact address is on the resource's Overview page.

Alternative without Azure: Netlify Drop. Drag the `app` folder onto app.netlify.com/drop, then claim the site with a free account. Add a `_headers` file with the same headers as `staticwebapp.config.json`.

⚠️ The data on the iPhone belongs to the site's web address. Choose the host once. Moving later means reinstalling and restoring from a backup.

## 12. Installing on the iPhone (put this in the README)

1. Open the site link in **Safari**.
2. Tap Share → **Add to Home Screen** → Add.
3. Open Kept from the Home Screen once while online. After that it works offline.

- **Updating:** run `deploy.cmd`. The next time the iPhone app opens online, it loads the new version, and the data stays.
- ⚠️ **Deleting the Home Screen icon deletes the app's data.** Save a backup first.

## 13. Not in this version (don't build these yet)

- Daily reminder notifications.
- Cloud sync and multiple devices. This is planned for later on the same Static Web App: a managed Azure Function `/api/sync`, Azure Table Storage, Microsoft login through the built-in auth, and offline-first syncing when online. Keep `logic.js` and `store.js` separate so it can be added cleanly.
- Notes or mood per day.

## 14. Done when

- Kept is installed on the owner's iPhone, opens full screen without Safari bars, and works in airplane mode.
- Only today can be checked off, past days are read-only, and weekends are black rest days everywhere, except a weekend unlocked with a Wildcard, which can finish that week's missed routines.
- The stats match the definitions in section 5, and all tests pass.
- A backup saves to Files or iCloud Drive and restores correctly.
