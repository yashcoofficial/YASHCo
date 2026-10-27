# Authentication architecture and storefront refinement notes

## Components and request flow

- `app/page.js` contains the login/register UI, client auth state, API wrapper, and admin dashboard.
- `app/api/[[...path]]/route.js` implements authentication and protected API routes, backed by MongoDB.
- `README.md` describes the optional separate API runtime (`services/api/server.mjs`). Check both implementations when modifying auth.

1. Customer registers with `POST /api/auth/register` or signs in with `POST /api/auth/login`.
2. The server looks up the account in MongoDB and compares a salted `scrypt` password hash (registration stores the salt and hash).
3. On success it creates an HMAC-SHA256 signed JWT with `sub`, role, email, issued-at and expiry claims, then stores **a SHA-256 hash of the token** in the `sessions` collection with an expiry.
4. The response includes a token and safe user object and sets an HTTP-only, SameSite=Lax `yash_auth` cookie (`Secure` in production).
5. The browser also stores the token under `localStorage.yash_token` and sends `Authorization: Bearer ...` on protected requests. The API accepts the header or cookie.
6. On protected requests, the API validates the JWT signature and expiry, checks the matching session hash/expiry in MongoDB, loads the user, and rejects unauthenticated users with 401. Admin routes additionally check the role and return 403 for non-admins.
7. Logout removes the matching session; password reset generates a random token, stores only its hash in `resetTokens`, emails a 30-minute reset URL, and allows the password hash to be replaced after validation.

## Security issues to resolve before production

- **Critical:** a predictable default admin account/password is automatically seeded in the API route. Remove this bootstrap password; provision the initial admin through a private, one-time procedure, and rotate the existing admin credentials.
- **Critical:** the JWT signing key falls back to a hardcoded development string. Require a strong server-only `JWT_SECRET` in production and rotate it if the fallback was ever used.
- **Critical:** an `.env.local` file is committed in this public repository. Audit for exposed secrets, rotate any real credentials, move secrets to Vercel environment variables, stop tracking the file, and consider repository history remediation. Do not put credential values in documentation or PRs.
- **High:** the client stores bearer credentials in localStorage, leaving them accessible to injected JavaScript; prefer HTTP-only cookie sessions, and add CSRF protection to state-changing cookie-authenticated routes.
- **High:** MongoDB client TLS verification is explicitly disabled with `tlsAllowInvalidCertificates` and `tlsAllowInvalidHostnames`. Restore certificate and hostname validation.
- **Medium:** rate limiting uses an in-memory Map, which is not shared across serverless instances. Use a central rate limiter and review password-reset abuse controls.
- Review session invalidation after password reset, cookie deletion on logout, JWT algorithm/header checks, constant-time signature validation, and testing of admin permission boundaries.

## Design guardrails

This branch refines the storefront's presentation without changing the original logo, YASH brand identity, “Own Every Moment” slogan, catalog data, billing, cart, or admin logic. New global design tokens are in `app/globals.css`, covering typography, subtle hover states, focus visibility, responsive hero text and reduced-motion preferences.

## Verification checklist

- Run `npm run build` and review Vercel's preview deployment.
- Check home, collection, product detail, cart, checkout, login, admin, and Page Studio pages on desktop and mobile.
- Confirm no visual regression for logo contrast, image ratios and responsive navigation.
- Treat the security review as actionable findings, not as already-remediated changes.
