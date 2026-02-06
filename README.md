# College Timetable — Department-based edit access

Timetable is shown as **periods × days**. Each slot is assigned a **department**. Only the professor of that department can edit and set the **subject** for that slot.

## Run the project

### Backend (Node.js)

```bash
cd timetable-app/backend
npm install
npm start
```

Runs at http://localhost:4000

### Frontend (React)

```bash
cd timetable-app/frontend
npm install
npm run dev
```

Opens at http://localhost:5173

## Login

- **Department:** CSE, ECE, MECH, MATH, PHYSICS (dropdown)
- **Password:** `departmentname123` (e.g. CSE123, ECE123, MECH123, MATH123, PHYSICS123)

After login, select a class (E101, E102, E103). Only slots assigned to your department are editable (click to add/edit subject).
