const BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
console.log('API BASE URL:', BASE); // Debugging

function getToken() {
  return localStorage.getItem('token');
}

// Helper to handle response
async function handleResponse(res) {
  const contentType = res.headers.get("content-type");
  if (contentType && contentType.indexOf("application/json") !== -1) {
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
    return data;
  } else {
    const text = await res.text();
    if (!res.ok) throw new Error(`Server Error (${res.status}): ${text.slice(0, 100)}...`);
    return { message: 'Success' }; // Fallback for empty ok responses
  }
}

export async function login(email, password) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return handleResponse(res);
}

export async function register(formData) {
  const res = await fetch(`${BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(formData),
  });
  return handleResponse(res);
}

export async function getClasses() {
  const res = await fetch(`${BASE}/classes`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  const data = await handleResponse(res);
  return data.classes;
}

export async function getTimetable(classId) {
  const res = await fetch(`${BASE}/timetable/${classId}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  return handleResponse(res);
}

export async function updateSlot(classId, dayIndex, periodIndex, subject, department) {
  const body = { dayIndex, periodIndex, subject };
  if (department) body.department = department;

  const res = await fetch(`${BASE}/timetable/${classId}/slot`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify(body),
  });
  return handleResponse(res);
}

export async function getUsers() {
  const res = await fetch(`${BASE}/admin/users`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  const data = await handleResponse(res);
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
  return handleResponse(res);
}

export async function createClass(classId, days, periods, timeSlots) {
  const res = await fetch(`${BASE}/admin/classes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify({ classId, days, periods, timeSlots }),
  });
  return handleResponse(res);
}

export async function deleteClass(classId) {
  const res = await fetch(`${BASE}/admin/classes/${classId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  return handleResponse(res);
}
