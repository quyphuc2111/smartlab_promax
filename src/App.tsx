import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  Users,
  Calendar,
  MessageSquare,
  FileText,
  LogOut,
  Search,
  Bell,
  Menu,
  Monitor,
  MonitorPlay,
  Database,
  Server,
} from "lucide-react";
import Login from "./Login";
import SystemConfig from "./views/SystemConfig";
import LabControl from "./views/LabControl";
import RoomComputerManagement from "./views/RoomComputerManagement";
import UserManagement from "./views/UserManagement";
import SessionManagement from "./views/SessionManagement";
import OnlineClassroom from "./views/OnlineClassroom";
import DocumentManager from "./views/DocumentManager";
import Messaging from "./views/Messaging";
import { User, UserRole } from "./types";
import { getCurrentUser, setToken, getToken } from "./api";

// Tauri invoke
declare global {
  interface Window {
    __TAURI__?: {
      core: {
        invoke: <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;
      };
    };
  }
}

const invoke = window.__TAURI__?.core?.invoke;

interface BackendStatus {
  running: boolean;
  message: string;
}

const menuItems = [
  // Quản trị viên only
  { id: "config", label: "Danh mục hệ thống", icon: Database, roles: [UserRole.ADMINISTRATOR] },
  { id: "users", label: "Quản lý người dùng", icon: Users, roles: [UserRole.ADMINISTRATOR] },
  { id: "labs", label: "Quản lý phòng máy", icon: Monitor, roles: [UserRole.ADMINISTRATOR] },
  
  // Giáo viên only
  { id: "sessions", label: "Quản lý ca thực hành", icon: Calendar, roles: [UserRole.TEACHER] },
  { id: "lab-control", label: "Điều khiển phòng máy", icon: LayoutDashboard, roles: [UserRole.TEACHER] },
  { id: "documents", label: "Tài liệu giảng dạy", icon: FileText, roles: [UserRole.TEACHER] },
  
  // Giáo viên + Học sinh
  { id: "classroom", label: "Giảng dạy trực tuyến", icon: MonitorPlay, roles: [UserRole.TEACHER, UserRole.STUDENT] },
  { id: "messaging", label: "Trao đổi & Nhắn tin", icon: MessageSquare, roles: [UserRole.TEACHER, UserRole.STUDENT] },
  
  // Học sinh only
  { id: "my-sessions", label: "Ca thực hành của tôi", icon: Calendar, roles: [UserRole.STUDENT] },
  { id: "my-documents", label: "Tài liệu học tập", icon: FileText, roles: [UserRole.STUDENT] },
];

export default function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [backendStatus, setBackendStatus] = useState<BackendStatus | null>(null);

  // Start backend when Teacher/Admin logs in
  useEffect(() => {
    if (user && invoke) {
      const needsBackend = user.role === UserRole.TEACHER || user.role === UserRole.ADMINISTRATOR;
      if (needsBackend) {
        startBackendServer();
      }
    }
  }, [user]);

  const startBackendServer = async () => {
    if (!invoke) return;
    
    try {
      // Check if already running
      const status = await invoke<BackendStatus>('check_backend_status');
      if (status.running) {
        setBackendStatus(status);
        return;
      }
      
      // Start backend
      const result = await invoke<BackendStatus>('start_backend');
      setBackendStatus(result);
      console.log('Backend started:', result.message);
    } catch (error) {
      console.error('Failed to start backend:', error);
      setBackendStatus({ running: false, message: 'Failed to start backend' });
    }
  };

  // Set default tab based on user role
  useEffect(() => {
    if (user && !activeTab) {
      const availableMenus = menuItems.filter(item => item.roles.includes(user.role as UserRole));
      if (availableMenus.length > 0) {
        setActiveTab(availableMenus[0].id);
      }
    }
  }, [user, activeTab]);

  useEffect(() => {
    async function checkAuth() {
      if (getToken()) {
        try {
          const result = await getCurrentUser();
          if (result.success && result.data && result.data.user_name) {
            setUser(result.data);
          } else {
            setToken(null);
          }
        } catch {
          setToken(null);
        }
      }
      setLoading(false);
    }
    checkAuth();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400">Đang tải...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login onLogin={setUser} />;
  }

  function handleLogout() {
    setToken(null);
    setUser(null);
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`
        ${isSidebarOpen ? "w-64" : "w-20"} 
        transition-all duration-300 bg-slate-900 text-slate-300 flex flex-col border-r border-slate-800
      `}
      >
        <div className="p-6 flex items-center gap-3">
          <div className="bg-indigo-500 p-2 rounded-lg">
            <Monitor className="text-white w-6 h-6" />
          </div>
          {isSidebarOpen && (
            <span className="font-bold text-white text-xl tracking-tight">
              Smartlab <small className="text-green-500">Promax</small>
            </span>
          )}
        </div>

        <nav className="flex-1 px-3 space-y-1 mt-4 overflow-y-auto">
          {menuItems
            .filter((item) => user && item.roles.includes(user.role as UserRole))
            .map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`
                w-full flex items-center gap-3 p-3 rounded-xl transition-all
                ${
                  activeTab === item.id
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"
                    : "hover:bg-slate-800 hover:text-white"
                }
              `}
            >
              <item.icon className="w-5 h-5 min-w-[20px]" />
              {isSidebarOpen && (
                <span className="font-medium">{item.label}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-rose-600/10 hover:text-rose-500 transition-all text-slate-400"
          >
            <LogOut className="w-5 h-5 min-w-[20px]" />
            {isSidebarOpen && <span className="font-medium">Đăng xuất</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 z-10">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-slate-100 rounded-lg text-slate-500"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-semibold text-slate-800">
              {menuItems.find((i) => i.id === activeTab)?.label}
            </h2>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center bg-slate-100 rounded-full px-4 py-2 w-64">
              <Search className="w-4 h-4 text-slate-400 mr-2" />
              <input
                type="text"
                placeholder="Tìm kiếm nhanh..."
                className="bg-transparent border-none text-sm focus:outline-none w-full"
              />
            </div>

            <button className="p-2 hover:bg-slate-100 rounded-full text-slate-500 relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-emerald-500 rounded-full border-2 border-white"></span>
            </button>

            {/* Backend status indicator */}
            {(user?.role === UserRole.TEACHER || user?.role === UserRole.ADMINISTRATOR) && (
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
                backendStatus?.running 
                  ? 'bg-emerald-50 text-emerald-700' 
                  : 'bg-amber-50 text-amber-700'
              }`}>
                <Server className="w-3.5 h-3.5" />
                <span>{backendStatus?.running ? 'Server Online' : 'Server Offline'}</span>
              </div>
            )}

            <div className="flex items-center gap-3 pl-4 border-l border-slate-200">
              <div className="text-right hidden md:block">
                <p className="text-sm font-medium text-slate-800 leading-none">
                  {user?.user_name || 'User'}
                </p>
                <p className="text-xs text-slate-500 mt-1">{user?.role || ''}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold">
                {user?.user_name?.charAt(0)?.toUpperCase() || 'U'}
              </div>
            </div>
          </div>
        </header>

        {/* View Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto">
            {/* Admin views */}
            {activeTab === "config" && <SystemConfig />}
            {activeTab === "users" && <UserManagement />}
            {activeTab === "labs" && <RoomComputerManagement />}
            
            {/* Teacher views */}
            {activeTab === "sessions" && <SessionManagement role={user.role} />}
            {activeTab === "lab-control" && <LabControl />}
            {activeTab === "documents" && <DocumentManager user={user} />}
            
            {/* Teacher + Student views */}
            {activeTab === "classroom" && <OnlineClassroom user={user} />}
            {activeTab === "messaging" && <Messaging user={user} />}
            
            {/* Student views */}
            {activeTab === "my-sessions" && <SessionManagement role={user.role} />}
            {activeTab === "my-documents" && <DocumentManager user={user} />}
          </div>
        </div>
      </main>
    </div>
  );
}
