# YASH API deployment

The API is a Spring Boot service backed by MongoDB. The repository includes a Render Blueprint in `render.yaml` and a Dockerfile for the API.

## Deploy on Render

1. In Render, create a Blueprint from `https://github.com/yashcoofficial/YASHCo`.
2. Set `MONGO_URL`, `DB_NAME`, and `JWT_SECRET` when Render prompts for the unsynced environment variables. Use the existing MongoDB connection and database; keep these values private.
3. Wait for the `yashco-api` service to become healthy at `/api/health`. Its default URL is `https://yashco-api.onrender.com`.
4. In Vercel, set `API_SERVICE_URL` to the actual public origin of that Render service if it differs from the default, then redeploy the production deployment.
5. Check `https://www.yashatelier.store/api/health` and `https://www.yashatelier.store/api/settings`.

Vercel uses `API_SERVICE_URL` when provided; otherwise it uses the Render URL in production and `http://localhost:4000` in local development. Render's free service can sleep after inactivity, so its first request may be delayed.

## Run locally

From the repository root, run `npm run dev`. The command starts the Next.js frontend and Spring Boot API. The API reads MongoDB configuration from the root `.env.local` file when present.