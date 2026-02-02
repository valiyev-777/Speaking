# IELTS Speaking Partner Platform

O'zbekistonlik IELTS tayyorlanuvchilar uchun ovozli suhbat va chat platformasi.

## Features / Imkoniyatlar

- **Ruletka rejimi**: Tasodifiy sherik bilan juftlash (har 20 soniyada)
- **Daraja bo'yicha**: O'xshash IELTS darajasidagi (±0.5) sherik bilan juftlash
- **Ovozli qo'ng'iroq**: Telegram kabi real-time audio (kamera yo'q!)
- **Matnli chat**: Suhbat vaqtida yozishmalar
- **Foydalanuvchi profili**: Daraja, maqsad ball, online status

## Tech Stack / Texnologiyalar

- **Backend**: FastAPI, PostgreSQL, WebSocket, JWT
- **Frontend**: Next.js 14, React, Tailwind CSS, Zustand
- **Real-time**: WebSocket (chat), WebRTC (audio-only)
- **Deployment**: Docker, docker-compose

## Project Structure / Loyiha tuzilishi

```
Speaking/
├── backend/
│   ├── app/
│   │   ├── main.py           # FastAPI application
│   │   ├── config.py         # Sozlamalar
│   │   ├── database.py       # Database connection
│   │   ├── models/           # SQLAlchemy models
│   │   ├── schemas/          # Pydantic schemas
│   │   ├── routers/          # API endpoints
│   │   ├── services/         # Business logic
│   │   └── utils/            # Utilities
│   ├── alembic/              # Database migrations
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── app/              # Next.js pages
│   │   ├── components/       # React components
│   │   ├── hooks/            # Custom hooks (WebRTC, WebSocket)
│   │   ├── lib/              # Utilities & state
│   │   └── types/            # TypeScript types
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml
└── README.md
```

## Quick Start / Tez boshlash

### Option 1: Docker (Tavsiya etiladi)

```bash
# Loyihaga o'ting
cd Speaking

# Barcha servislarni ishga tushiring
docker-compose up -d

# Loglarni ko'ring
docker-compose logs -f
```

### Option 2: Local Development

#### Talablar
- Python 3.11+
- Node.js 18+
- PostgreSQL 15+

#### 1. Database ishga tushiring

```bash
# Docker orqali faqat database
docker-compose -f docker-compose.dev.yml up -d
```

#### 2. Backend sozlash

```bash
cd backend

# Virtual environment yarating
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Kutubxonalarni o'rnating
pip install -r requirements.txt

# Serverni ishga tushiring
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

#### 3. Frontend sozlash

```bash
cd frontend

# Kutubxonalarni o'rnating
npm install

# Development serverni ishga tushiring
npm run dev
```

## Kirish nuqtalari

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

## API Endpoints

### Authentication
| Endpoint | Method | Tavsif |
|----------|--------|--------|
| `/auth/register` | POST | Ro'yxatdan o'tish |
| `/auth/login` | POST | Kirish (JWT qaytaradi) |
| `/auth/me` | GET | Joriy foydalanuvchi |

### Users
| Endpoint | Method | Tavsif |
|----------|--------|--------|
| `/users` | GET | Foydalanuvchilar ro'yxati |
| `/users/{id}` | GET | Foydalanuvchi ma'lumoti |
| `/users/{id}` | PATCH | Profilni yangilash |

### Queue
| Endpoint | Method | Tavsif |
|----------|--------|--------|
| `/queue/roulette` | POST | Ruletka navbatiga qo'shilish |
| `/queue/level-filter` | POST | Daraja bo'yicha navbatga qo'shilish |
| `/queue/leave` | POST | Navbatdan chiqish |
| `/queue/status` | GET | Navbat holati |

### WebSocket
| Endpoint | Tavsif |
|----------|--------|
| `/ws/match/{user_id}?token=JWT` | Matchmaking + Audio signaling |

## WebSocket Message Types

**Client → Server:**
- `join_queue`: Navbatga qo'shilish
- `leave_queue`: Navbatdan chiqish
- `offer/answer/ice_candidate`: WebRTC audio signaling
- `end_session`: Sessiyani tugatish
- `chat`: Matn xabari

**Server → Client:**
- `queue_joined`: Navbatga qo'shildi
- `matched`: Sherik topildi
- `offer/answer/ice_candidate`: WebRTC signaling
- `session_ended`: Sessiya tugadi
- `chat`: Sherikdan xabar

## Audio-Only WebRTC

Platforma **faqat audio** qo'llab-quvvatlaydi:

```javascript
// Faqat audio stream
const stream = await navigator.mediaDevices.getUserMedia({
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  },
  video: false, // VIDEO YO'Q
});
```

## Configuration / Sozlamalar

### Backend (.env)

```env
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/ielts_speaking
SECRET_KEY=your-secret-key
ROULETTE_INTERVAL_SECONDS=20
CORS_ORIGINS=["http://localhost:3000"]
```

### Frontend (.env.local)

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000
```

## Deployment / Joylash

### Railway

1. Railway'da yangi project yarating
2. PostgreSQL service qo'shing
3. Backend deploy qiling
4. Frontend deploy qiling (API URL'ni o'zgartiring)

### Render

1. PostgreSQL database yarating
2. Backend uchun Web Service yarating
3. Frontend uchun Web Service yarating

### VPS (Ubuntu)

```bash
# Kerakli dasturlarni o'rnating
sudo apt update
sudo apt install docker.io docker-compose nginx

# Loyihani clone qiling
git clone <your-repo> /opt/ielts-speaking
cd /opt/ielts-speaking

# Servislarni ishga tushiring
docker-compose up -d
```

## Scaling / Masshtablash

50-200 foydalanuvchi uchun:
- Hozirgi setup yetarli
- WebSocket va WebRTC yaxshi ishlaydi
- Audio P2P - server faqat signaling

Kattaroq masshtab uchun:
- Redis qo'shing (session/queue)
- Load balancer
- TURN server (NAT muammolari uchun)

## License

MIT

## Muallif

O'zbekistonlik IELTS tayyorlanuvchilar uchun ❤️ bilan yaratildi
