# Nightwire Terminal Chat

A terminal chat client for your logged-in ChatGPT browser account.

It uses a local browser-backed relay instead of API keys, runs ChatGPT headlessly in the background during normal use, and lets you choose which recent chat to continue when the app starts.

## What it does

- Uses your existing ChatGPT account through a browser relay
- Starts the headless relay in the background when you run `npm start`
- Opens a visible login helper only when ChatGPT sign-in is needed
- Closes the helper Terminal window automatically after login succeeds
- Lets you choose a recent ChatGPT thread or start a new one
- Supports local macOS voices through `say`
- Lets you change theme, glyph pack, voice, and chat tags in-terminal
- Supports tab-autocomplete for slash commands

## Quick start

```bash
npm install
npm run setup:chatgpt-browser
npm start
```

On the first run:

- `npm start` checks the local relay
- if ChatGPT login is missing, it opens a visible helper Terminal window
- sign in there
- that helper starts the hidden background relay and closes itself
- then rerun `npm start`

After login is saved, normal runs are just:

```bash
npm start
```

Each normal run:

- verifies the headless ChatGPT relay
- asks which recent chat to continue
- lets you start a fresh chat if you want

## Main commands

- `/terminal config`
- `/terminal stop`
- `/chatgpt login`
- `/chatgpt stop`
- `/status`
- `/voice list`
- `/voice preview NAME`
- `/voice set NAME`
- `/name me NAME`
- `/name bot NAME`

Press `Tab` while typing a slash command to autocomplete it. If you mistype one, the app suggests close matches.

## Terminal control deck

`/terminal config` opens an in-terminal menu for:

- theme selection
- glyph pack selection
- your speaker tag
- assistant speaker tag
- voice selection
- voice preview
- model path selection

For now, the model path stays on the ChatGPT browser relay.

## Themes and glyph packs

Built-in themes:

- `nightwire`
- `matrix`
- `dracula`
- `amber`
- `frost`

Built-in glyph packs:

- `operator`
- `matrix`
- `arcade`
- `ghost`
- `runes`

## Voice notes

Current local speech uses macOS `say`.

To explore voices:

```text
/voice list
/voice preview Samantha
/voice set Daniel
```

If you want more expressive local speech later, the best next upgrade is integrating a local engine such as `Piper` or `Kokoro`.

## Login flow

This project uses a real browser session saved in its own Chromium profile.

The intended flow is:

1. Run `npm start`.
2. If you are already logged in, the app opens the chat chooser.
3. If you are not logged in, the app launches a visible login helper and exits the current chat session.
4. After login finishes, the helper starts ChatGPT in hidden background mode and closes its own Terminal window.
5. Run `npm start` again and choose which chat to continue.

Important notes:

- it uses your ChatGPT account, not API keys
- normal runtime is headless and backgrounded
- login stays visible only through the helper flow
- Google login can be unreliable in automated Chromium contexts
- email/password, Apple, Microsoft, or magic-link login is safer if Google login fights you

## GitHub publishing checklist

Before pushing:

1. Review `package.json` and rename the package if you want a different public name.
2. Update the copyright line in `LICENSE`.
3. Check `README.md` for your preferred screenshots or branding.
4. Make sure you do not commit any local secrets.

The app stores runtime config and chat state under your local application support directory, not inside this repo.

## Useful scripts

```bash
npm start
npm run doctor
npm run setup:chatgpt-browser
npm run login:chatgpt-browser
npm run start:chatgpt-browser
npm run stop:chatgpt-browser
```

`npm run login:chatgpt-browser` is still available if you want to trigger login manually, but the normal path is just `npm start`.
