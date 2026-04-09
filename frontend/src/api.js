const BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

function getToken() {
  return localStorage.getItem('token');
}

// Helper with timeout support
async function fetchWithTimeout(url, options = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('Request timed out. The server may be starting up — please try again.');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function handleResponse(res) {
  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
    return data;
  } else {
    const text = await res.text();
    if (!res.ok) throw new Error(`Server Error (${res.status}): ${text.slice(0, 100)}`);
    return { message: 'Success' };
  }
}

// Ping backend for cold-start detection
export async function pingBackend() {
  try {
    const res = await fetchWithTimeout(`${BASE}/health`, {}, 20000);
    return res.ok;
  } catch {
    return false;
  }
}

export async function login(email, password) {
  const res = await fetchWithTimeout(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return handleResponse(res);
}

export async function register(formData) {
  const res = await fetchWithTimeout(`${BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(formData),
  });
  return handleResponse(res);
}

export async function getClasses() {
  const res = await fetchWithTimeout(`${BASE}/classes`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  const data = await handleResponse(res);
  return data.classes;
}

export async function getTimetable(classId) {
  const res = await fetchWithTimeout(`${BASE}/timetable/${classId}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  return handleResponse(res);
}

export async function updateSlot(classId, dayIndex, periodIndex, subject, department) {
  const body = { dayIndex, periodIndex, subject };
  if (department) body.department = department;
  const res = await fetchWithTimeout(`${BASE}/timetable/${classId}/slot`, {
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
  const res = await fetchWithTimeout(`${BASE}/admin/users`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  const data = await handleResponse(res);
  return data.users;
}

export async function approveUser(userId, approve) {
  const res = await fetchWithTimeout(`${BASE}/admin/approve`, {
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
  const res = await fetchWithTimeout(`${BASE}/admin/classes`, {
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
  const res = await fetchWithTimeout(`${BASE}/admin/classes/${classId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  return handleResponse(res);
}

export async function searchTimetable(query) {
  const res = await fetchWithTimeout(`${BASE}/search?q=${encodeURIComponent(query)}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  const data = await handleResponse(res);
  return data.results;
}

export async function getStats() {
  const res = await fetchWithTimeout(`${BASE}/stats`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  return handleResponse(res);
}

export function getExportUrl(classId) {
  return `${BASE}/timetable/${classId}/export?token=${getToken()}`;
}
