# FinPilot

FinPilot is a full-stack personal finance platform built to provide a secure, modern, and scalable foundation for personal financial management.

The project was developed as a portfolio application with production-oriented practices, including authentication, email verification, password recovery, security controls, automated testing, CI pipelines, cloud deployment, custom domains, and transactional email infrastructure.

## Live Application

- Web: https://finpilotapp.com.br
- API: https://api.finpilotapp.com.br

## Overview

FinPilot was designed as a real-world full-stack application rather than a simple demo project.

The platform currently includes a complete authentication and account-management system, with a React frontend communicating with a Fastify API backed by PostgreSQL.

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