const BASE = 'https://timetable-backend.onrender.com/api';

function getToken() {
  return localStorage.getItem('token');
}

export async function login(email, password) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Login failed');
  return data;
}

export async function getClasses() {
  const res = await fetch(`${BASE}/classes`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to load classes');
  return data.classes;
}

export async function getTimetable(classId) {
  const res = await fetch(`${BASE}/timetable/${classId}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to load timetable');
  return data;
}

export async function updateSlot(classId, dayIndex, periodIndex, subject, department) {
  const body = { dayIndex, periodIndex, subject };
  if (department) body.department = department; // Optional for admin structure change

  const res = await fetch(`${BASE}/timetable/${classId}/slot`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Update failed');
  return data;
}
