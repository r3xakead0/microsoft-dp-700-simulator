# Microsoft DP-700 Simulator

Lightweight web simulator to practice **Microsoft DP-700** exam questions.

No backend or build process is required: everything runs in the browser with static files (`HTML + CSS + JavaScript + JSON`).

## Features

- Exam flow with a start screen, question navigation, and final results.
- Support for both single-select and multi-select questions.
- Button to reveal/hide the correct answer for each question.
- Local progress persistence with `localStorage`.
- Compatible with Cloudflare Pages deployment.

## Project structure

```text
.
├── index.html
├── assets/
│   ├── app.js
│   └── styles.css
├── questions/
│   └── <topic>-<number>.json
├── robots.txt
└── wrangler.toml
```

## Question format

Each question is stored as JSON in `questions/<topic>-<number>.json`.

Example:

```json
{
  "url": "https://www.examtopics.com/...",
  "published_iso": "2024-12-08T16:47:00",
  "number": 10,
  "topic": 1,
  "question": "...",
  "options": [
    { "key": "A", "text": "..." },
    { "key": "B", "text": "..." }
  ],
  "answers": {
    "platform": ["A"],
    "community": ["A"]
  }
}
```

Important rules:

- `options[].key` must be unique per question.
- Answers must reference existing keys from `options[].key`.
- If `answers.platform` is unavailable, the app falls back to `answers.community`.

## Run locally

Because this is a static site, you can serve it with any HTTP server.

### Option 1: Python

```bash
python3 -m http.server 8080
```

Then open: `http://localhost:8080`

### Option 2: Node

```bash
npx serve .
```

## Deploy to Cloudflare Pages (Wrangler)

Prerequisites:

- Node.js 18+
- `wrangler` (via `npx` or globally installed)
- Cloudflare API token with Pages/Workers permissions

1. Export your token:

```bash
export CLOUDFLARE_API_TOKEN="<YOUR_TOKEN>"
```

2. (Optional) Define the Account ID:

```bash
export CLOUDFLARE_ACCOUNT_ID="<YOUR_ACCOUNT_ID>"
```

3. Create the project (first time only):

```bash
npx wrangler pages project create ms-dp-700-simulator --production-branch main
```

4. Deploy:

```bash
npx wrangler pages deploy . --project-name ms-dp-700-simulator --commit-dirty=true
```

## Notes

- This repo may contain image/hotspot questions that require additional dataset curation.
- Never commit tokens or secrets to the repository (`.env`, API keys, etc.).
