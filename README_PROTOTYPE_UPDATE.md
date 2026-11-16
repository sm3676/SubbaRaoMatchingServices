# Prototype-matched cloud frontend

Deploy the `frontend` directory to the existing Vercel frontend project. Keep `config.js` pointing at your existing backend. The original FastAPI backend and database migration files are included unchanged.

The frontend uses the supplied prototype markup and styles, existing Supabase-backed login, cloud profile list/create/edit and private photo upload. Existing cloud data is not migrated or deleted.

IMPORTANT LIMITATIONS: Delete is intentionally disabled because the supplied backend has no profile DELETE endpoint. Some prototype-only fields are stored in `notes` on new/edited profiles; these fields cannot be queried individually. Photos use one-hour signed URLs and may need reopening after expiry. Prototype's WhatsApp share uses browser-native sharing, not automatic WhatsApp ingestion. No real deployment or live cloud integration tests were performed. Test in a staging deployment first.

Do not commit `.env` or service-role keys. The ZIP excludes the original `.env`, git history, Python virtual environment and cached files.
