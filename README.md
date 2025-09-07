# GPT-OSS Chat

Local inference app using GPT-OSS 20B with Harmony format.

## Setup

1. Install dependencies:
```bash
pnpm install
```

2. Configure model:
```bash
cp apps/server/.env.example apps/server/.env
```

Edit `.env` with:
- `MODEL_URL`: Direct HTTPS link to the GGUF model file
- `MODEL_SHA256`: SHA-256 checksum of the model file

## Run

Development:
```bash
pnpm dev
```

Production:
```bash
pnpm build
pnpm start
```

## Features

- Local inference with GPT-OSS 20B Q4_K_M
- Harmony prompt format
- Token streaming with stop button
- Automatic model download with resume support
- SHA-256 verification
- Light/dark mode

## Ports

- Frontend: http://localhost:5173
- Backend: http://localhost:5174