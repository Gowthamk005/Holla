# Olla server (Node + Express + MongoDB + Socket.io)

## Setup (once)
1. Install MongoDB Community Server, or use MongoDB Atlas (free cloud).
2. `cp .env.example .env` and edit it (see the comments inside).
3. `npm install`
4. `npm run seed`   (demo creators, videos and an admin account)

## Run
- Terminal 1: `npm run dev`      -> API on http://localhost:5000
- Terminal 2: `cd ../client && npm run dev` -> app on http://localhost:5173

Open http://localhost:5173. The Vite dev server forwards `/api`, `/uploads` and `/socket.io` to port 5000.

## Folder map
- `src/index.js`        app setup, routes, error handler, start
- `src/config.js`       reads `.env`
- `src/models/`         MongoDB schemas (User, Video, Subscription, Friendship, Message, Wallet...)
- `src/routes/`         one file per feature (auth, videos, channels, me, friends, people, messages, wallet, admin)
- `src/middleware/auth.js`  login cookie + JWT checks
- `src/socket.js`       realtime: messages, typing, presence for admins
- `src/seed.js`         demo data
- `uploads/`            uploaded video and thumbnail files

## Quick API checks (PowerShell: use curl.exe)
    curl.exe http://localhost:5000/api/health
    curl.exe "http://localhost:5000/api/videos?sort=views"
    curl.exe http://localhost:5000/api/channels/olla_music

## Notes
- Demo wallet only: no real money. Do not connect real payments without a licensed provider.
- Video duration comes from the browser at upload time (the client sends it).
- Uploaded files are kept on disk in `uploads/`. For production use cloud storage (S3, Cloudinary).
- Set `NODE_ENV=production` and a 32+ character `JWT_SECRET` before deploying.

## YouTube setup (optional)
1. Go to https://console.cloud.google.com and create a project.
2. APIs & Services -> Library -> "YouTube Data API v3" -> Enable.
3. APIs & Services -> Credentials -> Create credentials -> API key.
   Recommended: restrict the key to "YouTube Data API v3".
4. In `server/.env` set `YOUTUBE_API_KEY=your-key` and `YOUTUBE_REGION=IN` (your country code).
5. Restart `npm run dev`. The Home page shows "Trending on YouTube" and the new **▶ YouTube** page works.

Quota: 10,000 units a day by default. A search uses about 101 units, a trending list 1 unit.
Results are cached for 10 minutes. If you see "daily quota used up", wait until the next day
or request a higher quota in Google Cloud.

## Google sign-in setup (optional)
1. https://console.cloud.google.com -> create/select a project.
2. APIs & Services -> OAuth consent screen -> User type "External" -> fill in app name and your email.
   While the app is in "Testing", add your Google account under "Test users".
3. APIs & Services -> Credentials -> Create credentials -> OAuth client ID -> "Web application".
   - Authorized JavaScript origins: `http://localhost:5173`
   - Authorized redirect URIs: `http://localhost:5173/api/auth/google/callback`
4. Copy the Client ID and Client secret into `server/.env`:
   ```
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   GOOGLE_REDIRECT_URI=http://localhost:5173/api/auth/google/callback
   ```
5. Restart the server. The Login page now shows "Continue with Google".

Notes: Google accounts have no Olla password. A Google email that matches an existing account links to it.
Before going live, publish the consent screen (or add users as testers).

## Chat v2 (attachments, emoji, camera, edit/delete, online and last seen)
- Attachments: photos, videos, audio, PDF, Word, Excel, PowerPoint, text, zip. Each file's real type is checked from its contents, so renamed files are rejected. Size limits: photos 16 MB, videos 100 MB, audio and documents 25 MB.
- Edit: your own text messages, within 15 minutes.
- Delete for everyone: removes the text and the attachment file for both people.
- Online / last seen: a user is online while any tab is connected. Friends are told in realtime when someone comes online or goes offline.
- Files are stored in `uploads/chat/`. For production use cloud storage.

## Admin login (forgot password)
Try `admin` / `admin12345` first (the seed sets this). If that doesn't work, set a new one:
    cd server
    npm run reset-admin -- admin YourNewPass123
The password must be at least 8 characters. Then log in with that username and password.

## Apps page (admin-managed)
Admins add apps in Admin → Apps page: name, category (Foods, Travel, Movies & tickets, Shopping, Other), app link (https), description, and an icon (upload PNG/JPG/WebP/GIF up to 2 MB, or an icon link).
Users see them on the Apps page, with Foods at the top.
