# MixMate — Production-ready starter

MixMate is a collaborative playlist room: each participant gets 10 song picks, exact duplicates are blocked, and similar songs are flagged so the final mix stays varied.

## Stack

- Next.js App Router
- TypeScript
- PostgreSQL + Prisma
- Vercel-compatible serverless API routes
- iTunes Search API for legal song metadata/search
- 2-second room refresh for near-real-time collaboration
- Similarity engine using normalized title/artist/album/duration features

## Local setup

Requirements: Node.js 20+ and a PostgreSQL database.

```bash
npm install
cp .env.example .env
```

Set `DATABASE_URL` in `.env`:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/mixmate?schema=public"
```

Initialize Prisma:

```bash
npx prisma generate
npx prisma db push
npm run dev
```

Open `http://localhost:3000`.

## Production deployment on Vercel

1. Put this project in a GitHub repository.
2. Import the repository into Vercel.
3. Add a PostgreSQL integration from the Vercel Marketplace, or provide your own PostgreSQL connection string.
4. Add `DATABASE_URL` to the Vercel Production environment.
5. Deploy.

Vercel's current Next.js deployment is zero-config, and Prisma Postgres can be provisioned through the Vercel Marketplace.

## Important deployment note

The application is designed for Vercel's serverless model. The room UI refreshes every two seconds, which gives near-real-time collaboration without requiring a permanently running socket server. This is deliberately robust for a first public release.

For a higher-scale release, replace the refresh loop with a managed realtime provider (for example Ably, Pusher, Supabase Realtime, or Redis-backed Vercel WebSockets).


## MP3 uploads

MixMate supports MP3 uploads through Vercel Blob client uploads, so files larger than Vercel Functions' 4.5 MB request limit can be uploaded directly from the browser. Create a **public Vercel Blob store** and add the generated `BLOB_READ_WRITE_TOKEN` to the Vercel project. The UI limits uploads to 30 MB, MP3 only, and requires the uploader to confirm they own the file or have permission to share it.

The room creator can choose whether the UI shows download buttons for uploaded tracks. Public Blob URLs are still directly accessible to anyone who obtains the URL; hiding the button is not an access-control mechanism.

## Music licensing

MixMate stores/searches song metadata and provides the provider's supported track link. It does not scrape or redistribute copyrighted audio. Offline playback should be performed inside a user's licensed music service, or with audio files the user has the rights to use.

## Production checklist

- [x] Persistent PostgreSQL schema
- [x] Unique room codes
- [x] Unique song per room enforced by database constraint
- [x] 10-song limit per participant
- [x] Race-safe duplicate handling
- [x] Input validation
- [x] Similarity warnings
- [x] Mobile-first UI
- [x] Shareable room URLs
- [x] Supported external track links
- [x] Vercel-compatible architecture
- [ ] Add authentication if rooms need ownership/accounts
- [ ] Add rate limiting/WAF before large-scale public traffic
- [ ] Add managed realtime for instant push updates

## Commands

```bash
npm run dev
npm run build
npm run start
npm run db:generate
npm run db:push
npm run db:migrate
```
