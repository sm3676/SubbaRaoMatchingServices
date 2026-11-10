# Father's Matchmaking — Cloud-ready upgrade

This is a deployable application scaffold for a private matchmaking office:
- 1 Admin + 4 members, with role-based access control
- Supabase Auth (password login), PostgreSQL database, private Storage bucket
- Profile intake, source attribution, duplicate detection, audit events
- OCR-assisted image intake (Tesseract); OCR output is a draft and must be reviewed
- Matching using exactly three configurable criteria
- WhatsApp import paths: (A) manual WhatsApp-export/image upload; (B) official WhatsApp Cloud API webhook scaffold
- English/Telugu UI strings and responsive frontend starter

## Important truth about "ready to use"
The files are prepared, but this cannot become a live cloud service until you create/configure your Supabase and Meta WhatsApp Business accounts and deploy it. Never paste secrets into chat or commit them to Git. The WhatsApp Cloud API does not let an ordinary app silently read personal WhatsApp groups. Official API access is subject to Meta's supported business messaging rules; group import is not generally available through the Cloud API. For group profiles, use WhatsApp's permitted export/share flow and upload the exported images/files. The webhook scaffold is for messages delivered to an authorized business number, not arbitrary group scraping.

## Stack
- Backend: FastAPI + Supabase Python client + Pillow + pytesseract
- Database/Auth/Storage: Supabase
- Frontend: responsive plain HTML/CSS/JS starter (can later be moved to Next.js)
- Deployment: Render/Railway/Fly.io backend + static hosting (Vercel/Netlify) frontend

## Local run (backend)
1. Install Python 3.11+ and Tesseract OCR.
2. Copy `backend/.env.example` to `backend/.env`, fill Supabase URL, anon key, service role key, JWT secret if applicable.
3. In a terminal:
   ```powershell
   cd backend
   py -m venv .venv
   .\.venv\Scripts\Activate.ps1
   pip install -r requirements.txt
   uvicorn app.main:app --reload
   ```
4. API docs: http://127.0.0.1:8000/docs

## Frontend
Set `frontend/config.js` with your deployed backend URL, then serve the frontend folder using any static host or locally:
```powershell
cd frontend
py -m http.server 5173
```
Open http://localhost:5173

## Supabase setup
1. Create a Supabase project.
2. Run `supabase/migrations/001_initial.sql` in SQL Editor.
3. Create a private Storage bucket named `profile-images`.
4. In Authentication > Users, invite exactly five users (one admin, four members).
5. In SQL Editor, set each user's role using the user UUID:
   ```sql
   update public.user_profiles set role='admin' where id='ADMIN-AUTH-USER-UUID';
   update public.user_profiles set role='member' where id in ('MEMBER1-UUID','MEMBER2-UUID','MEMBER3-UUID','MEMBER4-UUID');
   ```
6. Enable email/password auth and configure SMTP before sending invitations.
7. Add allowed frontend/backend origins in Auth URL Configuration.

## OCR
The `/api/intake/ocr` endpoint accepts an image upload and returns OCR text plus suggested fields. OCR is not a verified profile; a human must correct/confirm it before saving. Install Tesseract OCR and Telugu language data (`tel`) if you need Telugu text recognition. OCR accuracy depends on image quality and script.

## WhatsApp
### Method A — manual import (works for groups)
In WhatsApp, use Export chat (without media or with media as appropriate), save the exported images/files, then upload the relevant profile image(s) in the app. The source group/sender/date must be recorded. Respect privacy and obtain consent before storing/sharing matrimonial profiles.

### Method B — official WhatsApp Cloud API
Configure a Meta app and WhatsApp Business number, then set webhook URL to `/api/whatsapp/webhook` and verify token. This scaffold verifies the webhook challenge and accepts authorized inbound messages. It does NOT read personal WhatsApp groups, scrape chats, or bypass Meta restrictions. Add your Meta access token and app secret in backend environment variables.

## Security checklist before production
- Set a long random `APP_SESSION_SECRET`; configure HTTPS.
- Keep Supabase service role key backend-only.
- Use private bucket and short-lived signed URLs.
- Restrict invited accounts to the five approved users; disable public sign-up.
- Review Supabase RLS policies and run tests with each role.
- Configure backups/PITR and retention policy.
- Add SMTP, password reset, MFA, rate limiting, monitoring and incident process.
- Obtain informed consent for profile data and images; implement deletion/export requests.
- Conduct security and privacy review before storing real personal data.

## Known scope
This scaffold provides the cloud schema and application integration. It is not a legal/compliance certification, and deployment requires account-specific credentials and a security review.
