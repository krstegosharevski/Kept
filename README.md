# Kept

A personal routine tracker for one iPhone. It's a web app (HTML, CSS and JavaScript) that installs on the Home Screen and works offline. Your data stays on the phone.

Powered by Krtse XO.

## Preview on this computer

Double-click `preview.cmd`, or run `.\preview.cmd` in VS Code's terminal. Your browser opens at http://localhost:3000. Close the window (or press Ctrl+C) to stop it.

To check the rules: `node --test`.

To see all seven ranks and their animation, double-click `ranks-demo.html`. After changing the rank artwork, run `node tools/ranks-demo.mjs` to rebuild it. It is never published.

## Publish (Vercel)

Run `deploy.cmd`. It runs the tests, then publishes the `app` folder.

The first time only:

1. The Vercel CLI asks you to log in. Choose how (for example "Continue with GitHub"); your browser opens to confirm.
2. Answer the setup questions:
   - Set up and deploy? **Y**
   - Which scope? Your own account.
   - Link to existing project? **N**
   - Project name: **kept**
   - In which directory is your code located? **./** (press Enter)
   - Want to modify the settings? **N**
3. At the end it prints your address, for example `https://kept-yourname.vercel.app`.
   The short address is also shown in your project on vercel.com.

⚠️ Your data on the iPhone belongs to that web address. Keep the same project; moving to another address means installing again and restoring a backup.

## Install on the iPhone

1. Open your Kept address in **Safari**.
2. Tap Share → **Add to Home Screen** → Add.
3. Open Kept from the Home Screen once while online. After that it works offline, even in airplane mode.

## Update

Run `deploy.cmd` again. The next time Kept opens on the iPhone with internet, it loads the new version. Your data stays.

## Backups

- Settings → **Save backup** opens the share sheet. Choose **Save to Files** (On My iPhone or iCloud Drive).
- Settings → **Restore from file** brings a backup back. It asks before replacing anything.
- Kept reminds you on the Today screen when you haven't saved a backup for 7 days.

⚠️ **Deleting the Kept icon from the Home Screen deletes its data.** Save a backup first.
