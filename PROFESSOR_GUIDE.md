# Timetable System - Professor's & Reviewer's Guide

## Introduction
This web application handles dynamic timetable scheduling with strict Role-Based Access Control (RBAC). It prevents scheduling conflicts and unauthorized edits by adhering to a clear departmental structure.

## 🚀 Quick Start
*   **Admin Login**:
    *   **Email**: `admin@nitkkr.ac.in`
    *   **Password**: `Admin@123`
    *   *(Note: This is the super-user account that sets up the system)*

## 🛠️ Features & Workflow

### 1. Admin Workflow (Setting up the College)
1.  **Login as Admin**.
2.  **Create a Class**:
    *   Go to Dashboard -> "Manage Classes".
    *   Enter a Class ID (e.g., `IT-third-Year`) and click **Add**.
    *   *System Action*: Creates a full empty weekly schedule for this class.
3.  **Define Slot Ownership**:
    *   Go to **Timetable** view for the new class.
    *   **Admin Mode** is active.
    *   Click any slot (e.g., Mon 9 AM).
    *   Assign it to a Department (e.g., `CSE`).
    *   *Result*: Only `CSE` professors can now edit this slot. `ECE` professors cannot touch it.
4.  **Approve Professors**:
    *   When new professors sign up, they are **Pending**.
    *   Go to Dashboard -> "Pending Approvals".
    *   Click **Approve** to give them access.

### 2. Professor Workflow (Daily Usage)
1.  **Registration**:
    *   Sign up with an `@nitkkr.ac.in` email.
    *   Wait for Admin approval.
2.  **Editing Schedule**:
    *   Login and open a Class Timetable.
    *   Slots belonging to your Department are **Editable**.
    *   Slots belonging to other Departments are **Read-Only** (Locked).
    *   Click a valid slot -> Enter Subject Name -> Save.

## 💻 Tech Stack
*   **Frontend**: React.js, Vite, Modern CSS (Glassmorphism).
*   **Backend**: Node.js, Express.js.
*   **Database**: PostgreSQL (Neon Cloud) - Persistent & Reliable.
*   **Security**: JWT Authentication, Bcrypt Password Hashing.

## Deployment
The application is deployed on Render/Neon to ensure 24/7 availability and data persistence.
