# Kova — Front end

**Kova** is a classic, premium messenger that works on laptops and phones: chats, groups, channels with posts and comments, Moments that disappear after 24 hours, and voice/video calls — with light and dark mode.

Built with **React + Vite + Tailwind CSS**, following the Kova design from Stitch (ivory, midnight navy and champagne gold; Playfair Display + Inter).

The backend lives in a separate repo (`kova-backend`). This app needs it running.

---

## Run it on your laptop (Ubuntu)

```bash
npm install
cp .env.example .env      # VITE_API_URL=http://localhost:4000
npm run dev
```

Open <http://localhost:5173>. Start the backend first (`npm run dev` in `kova-backend`).

To test chatting with yourself, open a second browser (or a private window), create another account, and search for the first one by @username.

---

## Deploy to Netlify (free)

1. Push this folder to its own GitHub repo (e.g. `kova-frontend`).
2. Go to <https://app.netlify.com> → **Add new site → Import an existing project** → GitHub → choose `kova-frontend`.
3. Build settings are read from `netlify.toml` (build: `npm run build`, publish: `dist`).
4. Before deploying, open **Site configuration → Environment variables** and add:
   - `VITE_API_URL` = your Render backend URL, e.g. `https://kova-backend.onrender.com` (no slash at the end)
5. **Deploy**. Rename the site under **Site configuration → Change site name** (e.g. `kova-chat` → `https://kova-chat.netlify.app`).
6. Go back to Render and set the backend's `CLIENT_URL` to that exact Netlify URL, then redeploy the backend. (If you skip this, the browser will block requests — that's CORS.)

> If you change `VITE_API_URL` later, trigger a new deploy on Netlify — Vite bakes it in at build time.

Share the Netlify link with your friends. They create an account, find each other by @username, and start chatting.

---

## Features

- **Chats:** real-time messages, typing and recording indicators, online / last seen, sent ✓ / delivered ✓✓ / read (gold ✓✓) ticks, replies, reactions, edit, delete for me / everyone, forward, star, search in chat, photos, videos, documents, voice notes, location sharing, drag-and-drop on desktop
- **Chat list:** pinned, archived, favourites, unread filters, mute
- **Groups:** create with photo and description, admins, add/remove members, invite links, "only admins can send"
- **Channels:** create, follow, publish posts with media, reactions, comments and replies; comments land in the owner's **Activity** inbox
- **Moments:** text, photo or video stories that vanish after 24 hours, with viewers list and private replies
- **Calls:** one-to-one voice and video calls (WebRTC), call history, missed calls
- **Settings:** profile and photo, **light / dark / system** theme, text size, chat background, sent-bubble colour, privacy (last seen, read receipts), blocked contacts, starred messages, notifications, password, delete account
- **Notifications:** sound + system alerts, including when the app is closed (Web Push)
- **Installable:** on a phone, use the browser menu → **Add to Home screen** and Kova opens like an app

## Project structure

```
src/
  context/   AppContext (auth, socket, chats state), CallContext (WebRTC calls)
  pages/     one file per screen (ChatList, Conversation, Channels, Moments, Settings…)
  components/ shared UI (bubbles, composer, voice player, layout…)
  lib/       API client, formatting, sounds, push helpers
public/      icons, manifest, service worker (sw.js), Netlify _redirects
```
