# Olla client (React + Vite)

## Run
    npm install
    npm run dev        # http://localhost:5173  (needs the server on :5000)

The dev server proxies `/api`, `/uploads` and `/socket.io` to `localhost:5000`.

## Pages
| Route | Page | Login? |
|---|---|---|
| `/` | Home feed, search (`?q=`), category chips | no |
| `/trending`, `/category/:cat` | Feeds | no |
| `/watch/:id` | Video player, like / save / share, subscribe, up next | no |
| `/c/:username` | **Creator channel**: banner, subscribers, Subscribe button, friend + message, uploads, about | no (actions need login) |
| `/subscriptions`, `/library/like`, `/library/save`, `/people`, `/messages`, `/messages/:userId`, `/wallet`, `/studio` | Member pages | yes |
| `/admin` | Live dashboard | admin role |
| `/login`, `/register` | Auth | no |

## API the server must provide (all JSON, cookie auth `olla_token`, httpOnly)
Errors: `{ "error": "message" }` with a 4xx status.

Auth
- `POST /api/auth/register` `{name, username, password}` -> `{user}` (sets cookie)
- `POST /api/auth/login` `{username, password}` -> `{user}`
- `POST /api/auth/logout`
- `GET /api/auth/me` -> `{user}` or 401
- `user` = `{id, username, name, avatarUrl, bannerUrl, bio, subscribersCount, createdAt, role, interests}`

Videos
- `GET /api/videos?sort=latest|views&category=&q=&limit=` -> `{videos:[video]}`
- `GET /api/videos/:id` -> `{video, viewer:{liked, saved, subscribed}}`
- `POST /api/videos/:id/view`
- `POST /api/videos/:id/interact` `{type:"like"|"save", on:bool}` -> `{likesCount}`
- `POST /api/videos` multipart: `video` (file), optional `thumb`, `title`, `description`, `category`
- `DELETE /api/videos/:id` (owner or admin)
- `video` = `{id, title, description, category, videoUrl, thumbnailUrl, duration, views, likesCount, createdAt, owner: user}`

Channels and subscriptions
- `GET /api/channels/:username` -> `{channel: user + createdAt, videos:[video], viewer:{subscribed, friendStatus}}`
  - `friendStatus`: `none | pending_out | pending_in | friends`
- `POST /api/channels/:id/subscribe` `{on}` -> `{subscribed, subscribersCount}`
- `GET /api/me/subscriptions` -> `{channels:[user], videos:[video]}`
- `GET /api/me/library?type=like|save` -> `{videos}`
- `GET /api/me/videos` -> `{videos, stats:{videos, views, bytes}}`
- `PATCH /api/me` `{name, bio}` -> `{user}`

People and friends
- `GET /api/people/suggestions` -> `{people:[{user, reasons:[string]}]}`
- `GET /api/friends` -> `{friends:[user], incoming:[user], outgoing:[user]}`
- `POST /api/friends/request` `{userId}`
- `POST /api/friends/respond` `{userId, accept}`

Messages
- `GET /api/messages/threads` -> `{threads:[{user, last:{from, preview, createdAt}|null, unread}]}`
- `GET /api/messages/unread` -> `{count}`
- `GET /api/messages/:userId` -> `{user, messages:[{id, from, to, text, createdAt, readAt}]}`
- `POST /api/messages/:userId` `{text}` -> `{message}`
- `POST /api/messages/:userId/read`

Olla Pay (demo, play money, amounts in paise)
- `GET /api/wallet` -> `{me, balance, hasPin, transactions:[{id, txId, from, to, amount, kind, note, createdAt}], requests:{incoming, outgoing}}`
- `POST /api/wallet/pin` `{pin}`
- `POST /api/wallet/pay` `{toUsername, amount, note, pin, requestId?}`
- `POST /api/wallet/request` `{toUsername, amount, note}`
- `POST /api/wallet/requests/:id/decline`
- `POST /api/wallet/topup`

Admin (role admin only)
- `GET /api/admin/stats` -> `{users, videos, subscriptions, payments, volume}`
- `GET /api/admin/users`, `PATCH /api/admin/users/:id` `{disabled}`
- `GET /api/admin/videos`, `DELETE /api/admin/videos/:id`

Socket.io (cookie auth on handshake)
- server -> client `message:new` `{message}` (to both people)
- server -> client `typing` `{from}` ; client -> server `typing` `{to}`
- server -> client `messages:unread` `{count}`
- client -> server `admin:join` / `admin:leave`; server -> admin `presence` every 2 s `{online, loggedIn, guests, byPage, sessions}`

## YouTube (optional)
- `GET /api/youtube/status` -> `{enabled, region}`
- `GET /api/youtube/search?q=&limit=` -> `{videos}`
- `GET /api/youtube/trending?limit=` -> `{videos}`
- `GET /api/youtube/video/:id` -> `{video}`
Each video: `{source:"youtube", id, title, description, channelTitle, channelUrl, thumbnailUrl, duration, views, createdAt, embedUrl, watchUrl}`.
YouTube videos play in YouTube's embedded player; they are not stored or downloaded by Olla.
