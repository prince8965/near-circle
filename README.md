# NearCircle — Hyperlocal Campus & Tech Event Platform

NearCircle is a full-stack, hyperlocal community and event discovery platform designed specifically for students, campus organizers, and tech communities across **Mumbai & Navi Mumbai**.

Built with **React, TypeScript, Vite, Tailwind CSS**, and powered by a robust **Supabase (PostgreSQL)** backend with **Row-Level Security (RLS)** and atomic database procedures.

---

## 🌟 Key Highlights

- **Hyperlocal Discovery**: Auto-detects user location on login to pinpoint nearest campus hubs across 30+ localities in Mumbai & Navi Mumbai.
- **Smart Geocoding & Maps**: Automatic real-time venue geocoding with interactive OpenStreetMap fallback and Google Maps integration.
- **Full Auth & Role-Based Access**: Role-based access control (Participants, Campus Organizers, Judges, Admins) secured with Supabase Auth and RLS.
- **Atomic Registrations & Capacity Locking**: Concurrency-safe event RSVP and ticket code generation with database transactions.
- **Team Management & Hackathons**: Create and join teams via secure invite codes with strict duplicate prevention and team size limits.
- **Project Submissions & Judging Workflow**: Track configurations, submission deadlines, multi-criteria scoring rubrics, and automated ranking calculations.
- **Organizer Dashboard & Attendee Rosters**: Complete event lifecycle management (drafts, publishing, attendee rosters with live check-in toggle, and analytics).

---

## 🚀 Quick Start

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/prince8965/NearCircle.git
cd NearCircle
npm install
```

### 2. Environment Configuration
Create a `.env` file in the root directory:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_GOOGLE_MAPS_API_KEY=your-optional-google-maps-key
```

### 3. Run Development Server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 📋 Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Launch the local development server with Vite |
| `npm run build` | Compile TypeScript and bundle production assets in `dist/` |
| `npm run typecheck` | Run complete TypeScript validation (`tsc -b --noEmit`) |
| `npm run preview` | Locally preview the production build |
| `npm test` | Execute automated test suites |

---

## 🏗️ Architecture & Technology Stack

```
NearCircle Architecture
 ├── Frontend Client
 │    ├── React 19 + TypeScript + Vite
 │    ├── Tailwind CSS for rich modern UI
 │    ├── Lucide React icon system
 │    └── Leaflet / OpenStreetMap / Google Maps integration
 └── Backend & Database (Supabase)
      ├── PostgreSQL 15 with Row-Level Security (RLS)
      ├── Supabase Auth (JWT sessions & bcrypt passwords)
      ├── PostgreSQL Functions (RPC) for atomic operations
      └── Supabase Storage for poster and project assets
```

---

## 📍 Supported Coverage
NearCircle is currently tailored for the **Mumbai Metropolitan Region & Navi Mumbai**:
* **Mumbai Central / Suburbs**: Andheri, Bandra, BKC, Borivali, Dadar, Churchgate, Colaba, Lower Parel, Powai, Juhu, Goregaon, Malad, Kandivali, Ghatkopar, Kurla, Chembur, Vikhroli, Mulund, Thane.
* **Navi Mumbai**: Vashi, Nerul, CBD Belapur, Kharghar, Seawoods, Airoli, Ghansoli, Kopar Khairane, Panvel, Ulwe.

---

## 📄 License
This project is licensed under the MIT License.
