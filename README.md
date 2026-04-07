# Asset Desk — IT Asset Management

Built with Next.js 15, TypeScript, Tailwind CSS, and Supabase.

## Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure Supabase**
   ```bash
   cp .env.local.example .env.local
   ```
   Then edit `.env.local` and fill in your Supabase project URL and anon key:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
   ```
   Find these in your Supabase dashboard under **Project Settings → API**.

3. **Run the database migration**
   Paste the SQL from the schema file into your Supabase SQL editor and run it.

4. **Start the dev server**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000)

## Pages

| Route | Description |
|-------|-------------|
| `/dashboard` | Overview — stats, status breakdown, recent assets, alerts |
| `/assets` | Full asset table with search + filters |
| `/assets/[id]` | Asset detail — info, assignment history, maintenance, status timeline |
| `/people` | People directory grouped by department, with assigned assets |

## Stack

- **Next.js 15** (App Router, server components)
- **TypeScript** — full types matching your Supabase schema
- **Tailwind CSS** — utility-first styling
- **Supabase JS** — database client
- **DM Sans + DM Mono** — typography via Google Fonts
- **Lucide React** — icons
