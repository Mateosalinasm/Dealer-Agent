# Dealer Agent — Facebook Marketplace Poster (browser extension)

Posts queued vehicle listings from the Dealer Agent app to Facebook
Marketplace, in your own logged-in browser, on a schedule you set from the
app's Settings page. This app never sees or stores your Facebook
password — the extension only ever acts inside your own browser session.

## Install (unpacked, for now — not published to the Chrome Web Store)

1. Open `chrome://extensions`.
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and select this `browser-extension` folder.
4. Click the extension's icon → **Pairing settings** (or right-click the
   icon → Options).
5. In Dealer Agent, go to **Settings → Facebook Marketplace auto-post**,
   generate a token, and paste the app's URL and that token into the
   extension's options page. Click **Save and test connection**.
6. In Dealer Agent, turn on auto-post and set your schedule (times of day,
   max per day).
7. On the **Marketing** page, click **Queue for auto-post** on any listing
   you want it to post.

The extension checks in with the app every 15 minutes (or click **Check
now** in the popup) and posts whatever's due, respecting the schedule and
daily cap.

## Known limitation — read this before relying on it

`content-script.js` (the part that actually fills out Facebook's listing
form) was written without ever loading the real page — this project's dev
sandbox can't reach facebook.com. The selectors in it are a best-effort
based on general knowledge of how that form is built, not something
verified against the live DOM, and Facebook changes this UI over time.

If a post fails, the popup and the Marketing page will show the specific
error (e.g. "Could not find the Price field on the page"). That tells you
which `find*` helper in `content-script.js` needs fixing — open dev tools
on the Facebook tab it leaves open after a failed attempt, inspect the
field in question, and either send the relevant HTML back for a fix or
adjust the label text candidates in the relevant `findInputByLabel(...)`
call yourself.

Year/Make/Model/Body style/Fuel type/Transmission/Exterior color are
deliberately left unfilled in this first version — they're normally
searchable comboboxes on Facebook's form, which are trickier to automate
correctly than a plain text field, and filling them wrong (selecting the
wrong option) is worse than not filling them at all. If Facebook requires
them before it'll let you publish, you'll see the "Could not find the
Publish button" error until those are added.
