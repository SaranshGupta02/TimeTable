# Deployment Guide (Render + Neon)

This guide explains how to deploy your Timetable App using **Render** (for the server) and **Neon** (for the database).

## Prerequisites
*   GitHub Account
*   Render Account (Sign up at render.com)
*   The code pushed to your GitHub repository

## Phase 1: Database (Neon PostgreSQL)
You typically already have this running.
**Your Connection String**: `postgresql://neondb_owner:npg_Fo7cGeuUaK3g@ep-bold-forest-a1fzbchk-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require`

## Phase 2: Deploy Backend (Web Service)
1.  Log in to [Render Dashboard](https://dashboard.render.com/).
2.  Click **New +** -> **Web Service**.
3.  Connect your GitHub repository.
4.  **Settings**:
    *   **Name**: `timetable-backend` (or similar)
    *   **Root Directory**: `backend`
    *   **Runtime**: Node
    *   **Build Command**: `npm install`
    *   **Start Command**: `node server.js`
5.  **Environment Variables** (Critical step):
    *   Scroll down to "Environment Variables".
    *   Add:
        *   `JWT_SECRET`: `(Enter a random secret key here like mysecret123)`
        *   `DATABASE_URL`: `postgresql://neondb_owner:npg_Fo7cGeuUaK3g@ep-bold-forest-a1fzbchk-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require`
6.  Click **Create Web Service**.
7.  **Wait** for the deployment to finish.
8.  **Copy the Service URL** (e.g., `https://timetable-backend.onrender.com`).

## Phase 3: Deploy Frontend (Static Site)
1.  **Update API URL**:
    *   Open `frontend/src/api.js` locally.
    *   Update `const BASE` to use your **Render Backend URL** from Phase 2.
    ```javascript
    const BASE = 'https://timetable-backend.onrender.com/api';
    ```
    *   Commit and push this change to GitHub.

2.  **Deploy on Render**:
    *   Go to Render Dashboard -> **New +** -> **Static Site**.
    *   Connect your GitHub repo.
    *   **Settings**:
        *   **Root Directory**: `frontend`
        *   **Build Command**: `npm install && npm run build`
        *   **Publish Directory**: `dist`
    *   Click **Create Static Site**.

## Phase 4: Submit to Professor
*   **Live Link**: Share the Frontend URL (e.g., `https://timetable-frontend.onrender.com`).
*   **Documentation**: Share `PROFESSOR_GUIDE.md` and this file.
