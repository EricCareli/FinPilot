# FinPilot Architecture

## Overview

FinPilot will use a modular full-stack architecture designed to separate presentation, business logic, data persistence, and external services.

## Main Components

### Frontend

Responsible for the user interface, navigation, forms, dashboards, charts, and user interactions.

Planned technology:

- React
- TypeScript

### Backend

Responsible for business rules, authentication, APIs, validation, and communication with the database and external services.

Planned technology:

- Node.js
- TypeScript

### Database

PostgreSQL will store application data such as:

- Users
- Accounts
- Categories
- Transactions
- Budgets
- Goals

### Infrastructure

Docker will be used to provide consistent development environments.

### External Services

The system will eventually integrate with an AI service to provide personalized financial insights.

## High-Level Architecture

Frontend
↓
Backend API
↓
PostgreSQL

Backend
↓
AI Service

## Core Principles

- Separation of responsibilities
- Secure data handling
- Modular architecture
- Maintainable code
- Scalable structure