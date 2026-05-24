# Nightwire Terminal Chat

A stylized terminal chat client for your logged-in ChatGPT browser account.

It uses a local browser-backed relay instead of API keys, includes local macOS text-to-speech, and ships with configurable themes, glyph packs, and speaker tags.

## What it does

- Uses your existing ChatGPT account through a browser relay
- Auto-refreshes the relay when you run `npm start`
- Runs the browser relay in the background during normal use
- Opens a visible browser only for one-time login when needed
- Supports local macOS voices through `say`
- Lets you change theme, glyph pack, voice, and chat tags in-terminal
- Supports tab-autocomplete for slash commands

## Quick start

```bash
npm install
npm run setup:chatgpt-browser
npm run login:chatgpt-browser
npm start
```

After login is saved, normal runs are just:

```bash
npm start
```

`npm start` now auto-runs the relay refresh path for the ChatGPT backend.

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

## ChatGPT browser relay

This project uses a real browser session saved in its own Chromium profile.

Important notes:

- it uses your ChatGPT account, not API keys
- normal runtime is headless and backgrounded
- login stays visible through `/chatgpt login`
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
