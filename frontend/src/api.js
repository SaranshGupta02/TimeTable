const BASE = import.meta.env.VITE_API_URL || 'https://timetable-fzoe.onrender.com/api';

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

export async function register(formData) {
  const res = await fetch(`${BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(formData),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Registration failed');
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

export async function getUsers() {
  const res = await fetch(`${BASE}/admin/users`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to fetch users');
  return data.users;
}

export async function approveUser(userId, approve) {
  const res = await fetch(`${BASE}/admin/approve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify({ userId, approve }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Action failed');
  return data;
}

export async function createClass(classId) {
  const res = await fetch(`${BASE}/admin/classes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify({ classId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to create class');
  return data;
}
