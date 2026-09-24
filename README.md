# FinPilot

[![Backend CI](https://github.com/EricCareli/FinPilot/actions/workflows/backend-ci.yml/badge.svg)](https://github.com/EricCareli/FinPilot/actions/workflows/backend-ci.yml)
[![Frontend CI](https://github.com/EricCareli/FinPilot/actions/workflows/frontend-ci.yml/badge.svg)](https://github.com/EricCareli/FinPilot/actions/workflows/frontend-ci.yml)

FinPilot is a full-stack financial management platform built for both personal and business use, providing a secure, modern, and scalable foundation for managing finances.

The project was developed as a portfolio application with production-oriented practices, including authentication, email verification, password recovery, security controls, automated testing, CI pipelines, cloud deployment, custom domains, and transactional email infrastructure.

## Live Application

- Web: https://finpilotapp.com.br
- API: https://api.finpilotapp.com.br

## Screenshots

### Login

![FinPilot login screen](docs/images/login.png)

### Dashboard

![FinPilot dashboard](docs/images/dashboard.png)

## Overview

FinPilot was designed as a real-world full-stack application rather than a simple demo project.

The platform provides a foundation for personal and business financial management, with a React frontend communicating with a Fastify API backed by PostgreSQL.

The application is deployed in production and operates independently from the local development environment.

## Main Features

### Authentication

- User registration
- Secure login with JWT
- Email verification with 6-digit codes
- Verification code expiration
- Verification resend cooldown
- Password recovery by email
- Password reset tokens
- Authenticated password change
- Protection against login attempts from unverified accounts

### Account Management

- Profile name editing
- Secure email change flow
- Current password confirmation for sensitive operations
- New email verification before account email replacement
- JWT renewal after email changes

### Security

- Password hashing with bcrypt
- JWT authentication
- Security headers with Helmet
- Global API rate limiting
- Stricter authentication rate limits
- Restricted production CORS
- Sensitive environment variables stored outside the repository
- Generic responses for password recovery to reduce account enumeration
- Temporary verification codes stored as hashes
- Expiring password reset tokens
- HTTPS in production

### Reliability

- Application health checks
- Database readiness checks
- Production database connectivity monitoring
- Dedicated liveness and readiness endpoints

### Testing

The backend currently contains a comprehensive integration test suite covering the main authentication and account flows.

Current status:

- 13 integration test files
- 106 passing tests

### Continuous Integration

GitHub Actions automatically validates both parts of the project.

Backend CI includes:

- Dependency installation
- Prisma Client generation
- Database migrations
- Prisma schema validation
- TypeScript type checking
- Production build
- Integration tests with PostgreSQL

Frontend CI includes:

- Dependency installation
- ESLint validation
- Production build

## Tech Stack

### Frontend

- React
- TypeScript
- Vite
- ESLint

### Backend

- Node.js
- TypeScript
- Fastify
- Prisma ORM
- PostgreSQL
- JWT
- bcrypt
- Resend
- Helmet
- Rate limiting

### Infrastructure

- Render
- PostgreSQL
- GitHub Actions
- Registro.br
- Resend
- Custom DNS
- HTTPS

## Project Structure

```text
FinPilot/
├── .github/
│   └── workflows/
│       ├── backend-ci.yml
│       └── frontend-ci.yml
│
├── backend/
│   ├── prisma/
│   ├── src/
│   │   ├── controllers/
│   │   ├── lib/
│   │   ├── routes/
│   │   ├── services/
│   │   └── tests/
│   ├── package.json
│   └── tsconfig.json
│
├── docs/
│   ├── images/
│   │   ├── dashboard.png
│   │   └── login.png
│   ├── ARCHITECTURE.md
│   └── PRD.md
│
├── frontend/
│   ├── src/
│   ├── package.json
│   └── vite.config.ts
│
├── render.yaml
└── README.md
```

## Architecture

The application follows a client-server architecture.

```text
Browser
   │
   ▼
React + TypeScript
finpilotapp.com.br
   │
   │ HTTPS / REST API
   ▼
Fastify + TypeScript
api.finpilotapp.com.br
   │
   ▼
Prisma ORM
   │
   ▼
PostgreSQL
```

Transactional emails are delivered through Resend using the dedicated email subdomain:

```text
mail.finpilotapp.com.br
```

## Health Endpoints

The backend exposes health endpoints for monitoring:

```http
GET /health
GET /health/live
GET /health/ready
```

The readiness endpoint also verifies database connectivity.

Example:

```json
{
  "status": "ok",
  "service": "finpilot-api",
  "environment": "production",
  "checks": {
    "database": {
      "status": "ok"
    }
  }
}
```

## Local Development

### Requirements

Install:

- Node.js 24+
- npm
- PostgreSQL
- Git

Clone the repository:

```bash
git clone git@github.com:EricCareli/FinPilot.git
cd FinPilot
```

## Backend Setup

Enter the backend directory:

```bash
cd backend
```

Install dependencies:

```bash
npm install
```

Create a `.env` file based on `.env.example`.

Example:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE?schema=public"
JWT_SECRET="replace-with-a-strong-secret"
RESEND_API_KEY="re_replace_me"
EMAIL_FROM="FinPilot <no-reply@your-domain.com>"
CORS_ORIGIN="http://localhost:5173"
```

Generate Prisma Client:

```bash
npx prisma generate
```

Apply database migrations:

```bash
npx prisma migrate deploy
```

Start the development server:

```bash
npm run dev
```

The API runs by default at:

```text
http://localhost:3333
```

## Frontend Setup

Enter the frontend directory:

```bash
cd frontend
```

Install dependencies:

```bash
npm install
```

Create `.env.local`:

```env
VITE_API_URL="http://localhost:3333"
```

Start the frontend:

```bash
npm run dev
```

The development application runs by default at:

```text
http://localhost:5173
```

## Quality Checks

### Backend

Type checking:

```bash
npm run typecheck
```

Production build:

```bash
npm run build
```

Tests:

```bash
npm test
```

### Frontend

Lint:

```bash
npm run lint
```

Production build:

```bash
npm run build
```

## Production Deployment

The production infrastructure is described through `render.yaml`.

Production services:

```text
Frontend
https://finpilotapp.com.br

Backend API
https://api.finpilotapp.com.br

Transactional Email
mail.finpilotapp.com.br
```

The frontend and backend are automatically rebuilt when production configuration changes are pushed to the main branch.

## Documentation

Additional project documentation is available in:

- `docs/PRD.md`
- `docs/ARCHITECTURE.md`

## Development Status

FinPilot is actively being developed.

Current focus areas include expanding personal and business financial management features, increasing automated frontend coverage, expanding end-to-end testing, and preparing the architecture for future mobile applications.

## Future

The backend was designed so it can later serve additional clients besides the web application.

Planned clients include:

- iOS application
- Android application

Both mobile applications will reuse the same FinPilot API.

## Author

**Eric Careli**

GitHub: [@EricCareli](https://github.com/EricCareli)

---

FinPilot is a portfolio project focused on full-stack development, software architecture, application security, testing, CI/CD, and production deployment.