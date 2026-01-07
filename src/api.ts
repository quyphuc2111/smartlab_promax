import { 
  User, 
  AuthResponse, 
  ApiResponse, 
  HostInfo, 
  PingResult,
  UserRole,
  RoomComputer
} from './types';

const API_BASE = "http://127.0.0.1:3000/api";

// Token management
let authToken: string | null = localStorage.getItem("token");

export function setToken(token: string | null) {
  authToken = token;
  if (token) {
    localStorage.setItem("token", token);
  } else {
    localStorage.removeItem("token");
  }
}

export function getToken() {
  return authToken;
}

function headers(): HeadersInit {
  const h: HeadersInit = { "Content-Type": "application/json" };
  if (authToken) {
    h["Authorization"] = `Bearer ${authToken}`;
  }
  return h;
}

// ==================== AUTH API ====================

export async function register(
  username: string, 
  password: string, 
  role: UserRole = UserRole.STUDENT
): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/register`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ username, password, role }),
  });
  return res.json();
}

export async function login(username: string, password: string): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/login`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ username, password }),
  });
  return res.json();
}

export async function getCurrentUser(): Promise<ApiResponse<User>> {
  const res = await fetch(`${API_BASE}/me`, { headers: headers() });
  return res.json();
}

// ==================== NETWORK API ====================

export async function scanNetwork(): Promise<ApiResponse<HostInfo[]>> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 min timeout
  
  try {
    const res = await fetch(`${API_BASE}/scan`, { 
      headers: headers(),
      signal: controller.signal 
    });
    clearTimeout(timeoutId);
    return res.json();
  } catch (e) {
    clearTimeout(timeoutId);
    throw e;
  }
}

export async function pingHost(ip: string): Promise<ApiResponse<PingResult>> {
  const res = await fetch(`${API_BASE}/ping/${ip}`, { headers: headers() });
  return res.json();
}

// Re-export types
export type { 
  User, 
  AuthResponse, 
  ApiResponse, 
  HostInfo, 
  PingResult,
  HostWithPing 
} from './types';


// ==================== ROOM COMPUTER API ====================

export async function getRoomComputers(): Promise<ApiResponse<RoomComputer[]>> {
  const res = await fetch(`${API_BASE}/room-computers`, { headers: headers() });
  return res.json();
}

export async function createRoomComputer(data: {
  computer_name: string;
  ip_address?: string;
  status?: string;
}): Promise<ApiResponse<RoomComputer>> {
  const res = await fetch(`${API_BASE}/room-computers`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function updateRoomComputer(
  id: number,
  data: {
    computer_name: string;
    ip_address?: string;
    status?: string;
  }
): Promise<ApiResponse<RoomComputer>> {
  const res = await fetch(`${API_BASE}/room-computers/${id}`, {
    method: "PUT",
    headers: headers(),
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function deleteRoomComputer(id: number): Promise<ApiResponse<string>> {
  const res = await fetch(`${API_BASE}/room-computers/${id}`, {
    method: "DELETE",
    headers: headers(),
  });
  return res.json();
}
