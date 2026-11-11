# Railway deployment

Deploy this repository as three separate Railway services: the Next.js website, the Spring Boot API, and MongoDB.

## Create the services

1. Create a Railway project and add a MongoDB database from Railway's database menu. Keep the database private.
2. Add the API from this GitHub repository. In **Settings**, set its **Root Directory** to `/services/api`. Railway will build the existing `Dockerfile` in that directory.
3. Add the website from the same repository as a separate Node service. Set its root directory to the repository root, build command to `npm ci && npm run build`, and start command to `npm run start`.
4. Deploy the API and MongoDB first. In the API service's **Variables**, add:
   - `MONGO_URL`: reference the MongoDB service's `MONGO_URL` using Railway's variable-reference picker.
   - `DB_NAME`: the database name the application should use.
   - `JWT_SECRET`: generate a long, random secret in Railway.
   - `APP_URL`: the website's public HTTPS URL.
   - `COOKIE_SECURE`: `true` when the website uses HTTPS.
5. Add a public domain to the API service, then set the website service's `API_SERVICE_URL` variable to that API origin, including `https://` and without a trailing slash. Redeploy the website so Next.js uses that origin for `/api/*` requests.
6. Add a public domain to the website service and update the API's `APP_URL` to match it. Redeploy both services after changing these values.

Check the API at `<API_SERVICE_URL>/api/health` and the website at its Railway domain. The website and API can also use custom domains once their DNS records are configured.

The Railway MongoDB service starts with a new database; existing MongoDB data is not copied automatically. Back up and migrate existing data separately if it needs to be preserved. Protect secrets by configuring them in Railway rather than committing them to the repository.

## Run locally

From the repository root, run `npm run dev`. The command starts the Next.js frontend and Spring Boot API. The API reads MongoDB configuration from the root `.env.local` file when present.