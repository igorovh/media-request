# Media Request Dashboard

A comprehensive Next.js 14+ application for Twitch streamers to manage viewer media requests through their chat. Viewers can submit videos via `!mr [url]` command, and streamers can manage the queue through a dashboard. The application includes an OBS-compatible player that automatically plays videos from the queue.

## Features

- **Twitch Authentication**: Secure login with Twitch OAuth using NextAuth.js v5
- **Twitch Chat Bot**: Connects to your Twitch chat and listens for `!mr [url]` commands
- **Video Queue Management**: Dashboard to view, skip, and remove queued videos
- **Video Scraping**: Automatically extracts direct video URLs from various platforms (TikTok, Twitter, Streamable, etc.) using yt-dlp
- **OBS Player**: Token-protected player page that automatically plays videos from the queue
- **Continuous Playback**: Automatically transitions to the next video when one finishes

## Technology Stack

- **Framework**: Next.js 14+ (App Router, SSR)
- **Authentication**: NextAuth.js v5 with Twitch Provider
- **Database**: Prisma ORM with PostgreSQL
- **Twitch Bot**: tmi.js
- **Video Player**: react-player (YouTube) + HTML5 video (MP4)
- **Video Scraping**: youtube-dl-exec (yt-dlp wrapper)
- **Styling**: Tailwind CSS
- **State Management**: Zustand

## Prerequisites

- Node.js 18+ and npm/yarn
- PostgreSQL database
- Twitch Developer Application (Client ID and Client Secret)
- yt-dlp installed on your system (for video scraping)

## Setup Instructions

### 1. Clone and Install Dependencies

```bash
npm install
```

### 2. Set Up Environment Variables

Create a `.env` file in the root directory:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/media_request?schema=public"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key-here-generate-with-openssl-rand-base64-32"

# Twitch OAuth
TWITCH_CLIENT_ID="your-twitch-client-id"
TWITCH_CLIENT_SECRET="your-twitch-client-secret"

# Encryption key for tokens (generate with: openssl rand -base64 32)
ENCRYPTION_KEY="your-encryption-key-here"
```

**Generate secrets:**
```bash
# Generate NEXTAUTH_SECRET
openssl rand -base64 32

# Generate ENCRYPTION_KEY
openssl rand -base64 32
```

### 3. Set Up Twitch Application

1. Go to [Twitch Developer Console](https://dev.twitch.tv/console)
2. Create a new application
3. Set OAuth Redirect URL to: `http://localhost:3000/api/auth/callback/twitch` (for development)
4. Copy the Client ID and Client Secret to your `.env` file
5. Make sure to request the following scopes: `openid user:read:email chat:read chat:edit`

### 4. Set Up Database

```bash
# Generate Prisma Client
npm run db:generate

# Push schema to database
npm run db:push
```

### 5. Install yt-dlp

**Windows:**
```bash
# Using pip
pip install yt-dlp

# Or download from: https://github.com/yt-dlp/yt-dlp/releases
```

**macOS:**
```bash
brew install yt-dlp
```

**Linux:**
```bash
sudo pip install yt-dlp
# or
sudo apt-get install yt-dlp
```

### 6. Run the Development Server

```bash
npm run dev
```

Visit `http://localhost:3000` to get started.

## Usage

### For Streamers

1. **Sign In**: Click "Sign in with Twitch" and authorize the application
2. **Connect Bot**: On the dashboard, click "Connect Bot" to start listening to your Twitch chat
3. **Get Player URL**: Copy your unique OBS Player URL from the dashboard
4. **Add to OBS**: 
   - In OBS, add a "Browser Source"
   - Paste your player URL
   - Set width: 1920, height: 1080 (or your preferred resolution)
   - Check "Shutdown source when not visible" (optional)

### For Viewers

In the streamer's Twitch chat, type:
```
!mr https://youtube.com/watch?v=...
```

The bot will:
- Process the video URL
- Add it to the queue
- Confirm in chat: `@username, video added to queue!`

## Supported Video Platforms

- **YouTube**: Direct support via react-player
- **TikTok**: Scraped to direct MP4
- **Twitter/X**: Scraped to direct MP4
- **Streamable**: Scraped to direct MP4
- **Other platforms**: Any platform supported by yt-dlp

## Project Structure

```
├── app/
│   ├── api/
│   │   ├── auth/[...nextauth]/    # NextAuth.js routes
│   │   ├── bot/                    # Bot connection endpoints
│   │   └── queue/                  # Queue management endpoints
│   ├── dashboard/                  # Streamer dashboard
│   ├── player/[token]/             # OBS player page
│   └── page.tsx                    # Home/login page
├── components/                     # React components
├── lib/                            # Utility functions
│   ├── auth.ts                     # NextAuth configuration
│   ├── encryption.ts               # Token encryption
│   ├── prisma.ts                   # Prisma client
│   ├── twitch-bot.ts               # Twitch bot service
│   └── video-scraper.ts            # Video URL extraction
├── prisma/
│   └── schema.prisma               # Database schema
└── store/
    └── queue-store.ts              # Zustand store
```

## API Endpoints

### Queue Management

- `POST /api/queue/add` - Add a video to the queue
- `GET /api/queue/list` - Get all pending requests
- `GET /api/queue/current` - Get current playing request (authenticated)
- `GET /api/queue/current-by-token` - Get current playing request (token-based)
- `POST /api/queue/complete` - Mark request as complete (authenticated)
- `POST /api/queue/complete-by-token` - Mark request as complete (token-based)
- `POST /api/queue/skip` - Skip/remove a request

### Bot

- `POST /api/bot/connect` - Initiate bot connection
- `GET /api/bot/token` - Get bot OAuth token

## Database Schema

### User
- `id`: Unique identifier
- `twitchId`: Twitch user ID
- `username`: Twitch username
- `accessToken`: Encrypted OAuth access token
- `refreshToken`: Encrypted OAuth refresh token
- `playerToken`: Unique token for OBS player URL

### MediaRequest
- `id`: Unique identifier
- `originalUrl`: Original URL submitted by viewer
- `processedUrl`: Final URL to play (YouTube URL or direct MP4)
- `playerType`: `YOUTUBE` or `MP4`
- `requestedBy`: Twitch username of requester
- `status`: `PENDING`, `PLAYING`, or `PLAYED`
- `streamerId`: Foreign key to User

## Security Considerations

- OAuth tokens are encrypted before storage
- Player URLs are protected by unique, unguessable tokens
- All API endpoints validate authentication/authorization
- Bot connections use secure OAuth tokens

## Troubleshooting

### Bot won't connect
- Ensure your Twitch application has the correct OAuth scopes
- Check that your access token hasn't expired
- Verify your Twitch username is correct

### Videos won't play
- Check that yt-dlp is installed and accessible
- Verify the video URL is supported
- Check browser console for errors

### Database errors
- Ensure PostgreSQL is running
- Verify DATABASE_URL is correct
- Run `npm run db:push` to sync schema

## Production Deployment

1. Update `NEXTAUTH_URL` to your production domain
2. Set up a production PostgreSQL database
3. Configure environment variables on your hosting platform
4. Ensure yt-dlp is installed on your server
5. Build and deploy:
   ```bash
   npm run build
   npm start
   ```

## License

MIT

## Support

For issues and questions, please open an issue on the repository.

