<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/07093fba-927b-41aa-bdab-44b753a5a9f7

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Backend initial administrator

The database seed no longer creates demo staff, inventory, categories, or racks. To create the first administrator, configure `SEED_ADMIN_USERNAME`, `SEED_ADMIN_PASSWORD`, `SEED_ADMIN_FIRST_NAME`, and `SEED_ADMIN_LAST_NAME` in the backend environment (see [backend/.env.example](./backend/.env.example)), then run `npm run seed` from the `backend` directory. `SEED_ADMIN_EMAIL` is optional. The seed leaves an existing account with that username unchanged.
