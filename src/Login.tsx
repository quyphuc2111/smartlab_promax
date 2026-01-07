import { useState, useEffect } from "react";
import { Monitor, ShieldCheck, Server, Wifi, WifiOff, Settings, Search, Loader2 } from "lucide-react";
import { login, setToken, User, getServerIP, setServerIP, checkServerConnection, discoverServer } from "./api";

interface LoginProps {
  onLogin: (user: User) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  
  // Server config
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [serverIP, setServerIPState] = useState(getServerIP());
  const [serverConnected, setServerConnected] = useState<boolean | null>(null);
  const [checkingConnection, setCheckingConnection] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [discoveryStatus, setDiscoveryStatus] = useState("");

  // Auto discover server on mount
  useEffect(() => {
    autoConnect();
  }, []);

  async function autoConnect() {
    setCheckingConnection(true);
    setDiscoveryStatus("Đang kiểm tra kết nối...");
    
    // First check current/saved IP
    const connected = await checkServerConnection();
    if (connected) {
      setServerConnected(true);
      setCheckingConnection(false);
      setDiscoveryStatus("");
      return;
    }
    
    // Auto discover
    setDiscoveryStatus("Đang tìm server trong mạng LAN...");
    setDiscovering(true);
    
    const foundIP = await discoverServer();
    
    if (foundIP) {
      setServerIP(foundIP);
      setServerIPState(foundIP);
      setServerConnected(true);
      setDiscoveryStatus(`Đã tìm thấy server: ${foundIP}`);
    } else {
      setServerConnected(false);
      setShowServerConfig(true);
      setDiscoveryStatus("Không tìm thấy server. Vui lòng nhập IP thủ công.");
    }
    
    setDiscovering(false);
    setCheckingConnection(false);
  }

  async function handleManualConnect() {
    setServerIP(serverIP);
    setError("");
    setCheckingConnection(true);
    
    const connected = await checkServerConnection();
    setServerConnected(connected);
    setCheckingConnection(false);
    
    if (connected) {
      setShowServerConfig(false);
      setDiscoveryStatus(`Đã kết nối: ${serverIP}`);
    } else {
      setDiscoveryStatus("Không thể kết nối đến server này");
    }
  }

  async function handleRescan() {
    setDiscovering(true);
    setDiscoveryStatus("Đang quét lại mạng LAN...");
    
    const foundIP = await discoverServer();
    
    if (foundIP) {
      setServerIP(foundIP);
      setServerIPState(foundIP);
      setServerConnected(true);
      setDiscoveryStatus(`Đã tìm thấy server: ${foundIP}`);
      setShowServerConfig(false);
    } else {
      setDiscoveryStatus("Không tìm thấy server");
    }
    
    setDiscovering(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!serverConnected) {
      setError("Chưa kết nối được đến server");
      setShowServerConfig(true);
      return;
    }

    setLoading(true);

    try {
      const result = await login(username, password);

      if (result.success && result.user && result.token) {
        setToken(result.token);
        if (result.user.user_name && result.user.role) {
          onLogin(result.user);
        } else {
          setError("Dữ liệu người dùng không hợp lệ");
        }
      } else {
        setError(result.message || "Đăng nhập thất bại");
      }
    } catch {
      setError("Lỗi kết nối đến server");
      setServerConnected(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="p-8 bg-indigo-600 text-white text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-white/20 rounded-xl">
              <Monitor className="w-10 h-10" />
            </div>
          </div>
          <h1 className="text-2xl font-bold">Smartlab <small className="text-green-400">Pro Max</small></h1>
          <p className="text-indigo-100 mt-2">Hệ thống quản lý phòng máy thông minh</p>
        </div>

        <div className="p-8">
          {/* Server Status */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {checkingConnection || discovering ? (
                  <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" />
                ) : serverConnected ? (
                  <Wifi className="w-4 h-4 text-emerald-500" />
                ) : (
                  <WifiOff className="w-4 h-4 text-rose-500" />
                )}
                <span className={`text-sm font-medium ${serverConnected ? 'text-emerald-600' : serverConnected === false ? 'text-rose-600' : 'text-slate-500'}`}>
                  {checkingConnection || discovering ? 'Đang tìm server...' : serverConnected ? `Server: ${getServerIP()}` : 'Chưa kết nối'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowServerConfig(!showServerConfig)}
                className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
            
            {discoveryStatus && (
              <p className="text-xs text-slate-500">{discoveryStatus}</p>
            )}
          </div>

          {/* Server Config Panel */}
          {showServerConfig && (
            <div className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div className="flex items-center gap-2 mb-3">
                <Server className="w-4 h-4 text-slate-600" />
                <span className="text-sm font-medium text-slate-700">Cấu hình Server</span>
              </div>
              
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={serverIP}
                  onChange={(e) => setServerIPState(e.target.value)}
                  placeholder="IP Server (vd: 192.168.1.100)"
                  className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="button"
                  onClick={handleManualConnect}
                  disabled={checkingConnection}
                  className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
                >
                  Kết nối
                </button>
              </div>
              
              <button
                type="button"
                onClick={handleRescan}
                disabled={discovering}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-200 text-slate-700 text-sm rounded-lg hover:bg-slate-300 transition disabled:opacity-50"
              >
                {discovering ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                {discovering ? 'Đang quét...' : 'Tự động tìm server'}
              </button>
              
              <p className="mt-3 text-xs text-slate-500">
                App sẽ tự động tìm server trong mạng LAN. Nếu không tìm thấy, nhập IP thủ công.
              </p>
            </div>
          )}

          <h2 className="text-lg font-semibold text-slate-800 mb-6 text-center">
            Đăng nhập để tiếp tục
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Tên đăng nhập
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Nhập tên đăng nhập"
                required
                minLength={3}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Mật khẩu
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nhập mật khẩu"
                required
                minLength={6}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
              />
            </div>

            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-600 text-sm text-center">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !serverConnected}
              className="w-full py-3 px-4 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition flex items-center justify-center gap-3 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ShieldCheck className="w-5 h-5" />
              {loading ? "Đang xử lý..." : "Đăng nhập"}
            </button>
          </form>

          <p className="mt-8 text-xs text-center text-slate-400">
            © 2024 SmartLab Pro Max. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
