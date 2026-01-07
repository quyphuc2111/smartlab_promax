import { 
  User, 
  AuthResponse, 
  ApiResponse, 
  HostInfo, 
  PingResult,
  UserRole,
  RoomComputer
} from './types';

// Server configuration
const SERVER_IP_KEY = "server_ip";
const DEFAULT_SERVER_IP = "127.0.0.1";
const SERVER_PORT = "3000";

// Get/Set server IP
export function getServerIP(): string {
  return localStorage.getItem(SERVER_IP_KEY) || DEFAULT_SERVER_IP;
}

export function setServerIP(ip: string) {
  localStorage.setItem(SERVER_IP_KEY, ip);
}

export function isServerConfigured(): boolean {
  return localStorage.getItem(SERVER_IP_KEY) !== null;
}

// Dynamic API base URL
function getApiBase(): string {
  return `http://${getServerIP()}:${SERVER_PORT}/api`;
}

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

// ==================== SERVER CONNECTION ====================

export async function checkServerConnection(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    
    const res = await fetch(`${getApiBase()}/health`, { 
      signal: controller.signal 
    });
    clearTimeout(timeoutId);
    return res.ok;
  } catch {
    return false;
  }
}

// Check if a specific IP has the server running
async function checkServerAtIP(ip: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1000); // Fast timeout
    
    const res = await fetch(`http://${ip}:${SERVER_PORT}/api/health`, { 
      signal: controller.signal 
    });
    clearTimeout(timeoutId);
    return res.ok;
  } catch {
    return false;
  }
}

// Auto discover server in LAN
export async function discoverServer(): Promise<string | null> {
  // First check current configured IP
  const currentIP = getServerIP();
  if (await checkServerAtIP(currentIP)) {
    return currentIP;
  }
  
  // Check localhost
  if (await checkServerAtIP("127.0.0.1")) {
    return "127.0.0.1";
  }
  
  // Try to get local IP and scan subnet
  try {
    // Get local IP from WebRTC (works in browser)
    const localIP = await getLocalIP();
    if (!localIP) return null;
    
    const subnet = localIP.split('.').slice(0, 3).join('.');
    
    // Scan common IPs in parallel (1-50, then 51-100, etc.)
    const batchSize = 25;
    for (let start = 1; start < 255; start += batchSize) {
      const promises: Promise<string | null>[] = [];
      
      for (let i = start; i < Math.min(start + batchSize, 255); i++) {
        const ip = `${subnet}.${i}`;
        promises.push(
          checkServerAtIP(ip).then(found => found ? ip : null)
        );
      }
      
      const results = await Promise.all(promises);
      const foundIP = results.find(ip => ip !== null);
      if (foundIP) {
        return foundIP;
      }
    }
  } catch (e) {
    console.error("Discovery error:", e);
  }
  
  return null;
}

// Get local IP using WebRTC
async function getLocalIP(): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const pc = new RTCPeerConnection({ iceServers: [] });
      pc.createDataChannel('');
      
      pc.onicecandidate = (e) => {
        if (!e.candidate) return;
        const match = e.candidate.candidate.match(/(\d+\.\d+\.\d+\.\d+)/);
        if (match && !match[1].startsWith('0.')) {
          pc.close();
          resolve(match[1]);
        }
      };
      
      pc.createOffer().then(offer => pc.setLocalDescription(offer));
      
      // Timeout after 3 seconds
      setTimeout(() => {
        pc.close();
        resolve(null);
      }, 3000);
    } catch {
      resolve(null);
    }
  });
}

// ==================== AUTH API ====================

export async function register(
  username: string, 
  password: string, 
  role: UserRole = UserRole.STUDENT
): Promise<AuthResponse> {
  const res = await fetch(`${getApiBase()}/register`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ username, password, role }),
  });
  return res.json();
}

export async function login(username: string, password: string): Promise<AuthResponse> {
  const res = await fetch(`${getApiBase()}/login`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ username, password }),
  });
  return res.json();
}

export async function getCurrentUser(): Promise<ApiResponse<User>> {
  const res = await fetch(`${getApiBase()}/me`, { headers: headers() });
  return res.json();
}

// ==================== NETWORK API ====================

export async function scanNetwork(): Promise<ApiResponse<HostInfo[]>> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 min timeout
  
  try {
    const res = await fetch(`${getApiBase()}/scan`, { 
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
  const res = await fetch(`${getApiBase()}/ping/${ip}`, { headers: headers() });
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
  const res = await fetch(`${getApiBase()}/room-computers`, { headers: headers() });
  return res.json();
}

export async function createRoomComputer(data: {
  computer_name: string;
  ip_address?: string;
  status?: string;
}): Promise<ApiResponse<RoomComputer>> {
  const res = await fetch(`${getApiBase()}/room-computers`, {
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
  const res = await fetch(`${getApiBase()}/room-computers/${id}`, {
    method: "PUT",
    headers: headers(),
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function deleteRoomComputer(id: number): Promise<ApiResponse<string>> {
  const res = await fetch(`${getApiBase()}/room-computers/${id}`, {
    method: "DELETE",
    headers: headers(),
  });
  return res.json();
}
