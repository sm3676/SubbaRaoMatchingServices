SUPABASE + META SETUP CHECKLIST

SUPABASE
1. Create project at https://supabase.com/dashboard.
2. Run ../supabase/migrations/001_initial.sql in SQL Editor.
3. Create/invite 5 Auth users with email/password. Sign in once to trigger user_profiles row.
4. In SQL Editor, set exactly one admin:
   UPDATE public.user_profiles SET role='admin' WHERE id='ADMIN-UUID';
   Keep the other four as role='member'.
5. Copy Project URL, anon/publishable key, service_role key to backend/.env.
6. Create private bucket profile-images (migration attempts to create it).
7. Configure SMTP and disable public signups after inviting the five approved accounts.

META / WHATSAPP
1. Create a Meta developer app and add WhatsApp product.
2. Configure a WhatsApp Business phone number and webhook callback:
   https://YOUR-API-HOST/api/whatsapp/webhook
3. Use WHATSAPP_VERIFY_TOKEN from backend/.env as the webhook verify token.
4. Set WHATSAPP_APP_SECRET and WHATSAPP_ACCESS_TOKEN on backend host.
5. Subscribe the webhook to supported messages fields.
6. Send a test message to the business number and inspect whatsapp_events.
Note: This does not import personal WhatsApp group chats. Meta's official Cloud API has restrictions and does not provide a general group-chat export endpoint. For group messages/images use WhatsApp export/share then upload manually.

TESSERACT
Windows installer: https://github.com/UB-Mannheim/tesseract/wiki
Install English and Telugu language data. Set TESSERACT_CMD if tesseract.exe is not on PATH.
