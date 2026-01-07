
import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, Users, Monitor, Calendar, 
  MessageSquare, FileText, LogOut, 
  Search, Bell, ShieldCheck, 
  MonitorPlay, GraduationCap, BookOpen, Menu, Database, Layers
} from 'lucide-react';
import Dashboard from './views/Dashboard';
import LabControl from './views/LabControl';
import UserManagement from './views/UserManagement';
import SessionManagement from './views/SessionManagement';
import OnlineClassroom from './views/OnlineClassroom';
import DocumentManager from './views/DocumentManager';
import Messaging from './views/Messaging';
import SystemConfig from './views/SystemConfig';
import { UserAccount as User, UserRole } from './types';

const App: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoginView, setIsLoginView] = useState(true);

  const handleLogin = (role: UserRole) => {
    setCurrentUser({
      userId: 1,
      userName: role === UserRole.ADMIN ? 'Administrator' : role === UserRole.TEACHER ? 'Giáo viên - Nguyễn A' : 'Học sinh - Trần B',
      role,
      status: true
    });
    setIsLoginView(false);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setIsLoginView(true);
  };

  if (isLoginView) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-[40px] shadow-2xl overflow-hidden">
          <div className="p-12 bg-indigo-600 text-white text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-10"><Monitor className="w-32 h-32" /></div>
            <Monitor className="w-16 h-16 mx-auto mb-6 bg-white/20 p-4 rounded-2xl" />
            <h1 className="text-3xl font-black uppercase tracking-tight">Smart Lab</h1>
            <p className="text-indigo-100 mt-2 text-sm font-medium">Hệ thống quản lý phòng máy số hóa</p>
          </div>
          <div className="p-12 space-y-4 bg-slate-50">
            <button onClick={() => handleLogin(UserRole.ADMIN)} className="w-full py-4.5 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest hover:scale-[1.02] transition active:scale-95 flex items-center justify-center gap-3 shadow-xl"><ShieldCheck className="w-5 h-5" /> Admin Portal</button>
            <button onClick={() => handleLogin(UserRole.TEACHER)} className="w-full py-4.5 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest hover:scale-[1.02] transition active:scale-95 flex items-center justify-center gap-3 shadow-xl shadow-indigo-600/20"><GraduationCap className="w-5 h-5" /> Teacher Portal</button>
            <button onClick={() => handleLogin(UserRole.STUDENT)} className="w-full py-4.5 bg-emerald-600 text-white rounded-2xl font-black uppercase tracking-widest hover:scale-[1.02] transition active:scale-95 flex items-center justify-center gap-3 shadow-xl shadow-emerald-600/20"><BookOpen className="w-5 h-5" /> Student Portal</button>
          </div>
        </div>
      </div>
    );
  }

  const menuItems = [
    { id: 'dashboard', label: 'Trung tâm điều khiển', icon: LayoutDashboard, roles: [UserRole.ADMIN, UserRole.TEACHER] },
    { id: 'system', label: 'Danh mục & Mapping', icon: Database, roles: [UserRole.ADMIN] },
    { id: 'users', label: 'Người dùng & Phân quyền', icon: Users, roles: [UserRole.ADMIN] },
    { id: 'labs', label: 'Quản lý Phòng máy', icon: Monitor, roles: [UserRole.ADMIN, UserRole.TEACHER] },
    { id: 'sessions', label: 'Ca thực hành', icon: Calendar, roles: [UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT] },
    { id: 'classroom', label: 'Hỗ trợ giảng dạy', icon: MonitorPlay, roles: [UserRole.TEACHER, UserRole.STUDENT] },
    { id: 'messaging', label: 'Hệ thống nhắn tin', icon: MessageSquare, roles: [UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT] },
    { id: 'documents', label: 'Phân phối tài liệu', icon: FileText, roles: [UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT] },
  ];

  const filteredMenuItems = menuItems.filter(item => item.roles.includes(currentUser!.role));

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <aside className={`${isSidebarOpen ? 'w-80' : 'w-24'} transition-all duration-500 bg-slate-950 flex flex-col z-50`}>
        <div className="p-10 flex items-center gap-4">
          <div className="p-3 bg-indigo-500 rounded-2xl shadow-lg shadow-indigo-500/40 animate-pulse"><Monitor className="text-white w-6 h-6" /></div>
          {isSidebarOpen && <span className="font-black text-white text-2xl tracking-tighter italic">SMART LAB</span>}
        </div>
        <nav className="flex-1 px-5 space-y-2 overflow-y-auto scrollbar-hide">
          {filteredMenuItems.map(item => (
            <button 
              key={item.id} 
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-5 p-4.5 rounded-[24px] font-black transition-all group ${activeTab === item.id ? 'bg-indigo-600 text-white shadow-2xl shadow-indigo-600/40' : 'text-slate-500 hover:bg-white/5 hover:text-white'}`}
            >
              <item.icon className={`w-5 h-5 min-w-[20px] transition-transform group-hover:scale-110 ${activeTab === item.id ? 'text-white' : 'text-slate-600'}`} />
              {isSidebarOpen && <span className="text-sm uppercase tracking-widest">{item.label}</span>}
            </button>
          ))}
        </nav>
        <div className="p-8">
          <button onClick={handleLogout} className="w-full flex items-center gap-5 p-4.5 rounded-[24px] font-black text-rose-500 hover:bg-rose-500/10 transition-all uppercase tracking-widest text-xs">
            <LogOut className="w-5 h-5 min-w-[20px]" />
            {isSidebarOpen && <span>Thoát Smart Lab</span>}
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 bg-[#f8fafc]">
        <header className="h-24 bg-white border-b border-slate-200 flex items-center justify-between px-12 sticky top-0 z-40">
          <div className="flex items-center gap-8">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-3 hover:bg-slate-100 rounded-2xl text-slate-400 transition-colors"><Menu className="w-6 h-6" /></button>
            <div>
              <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">{menuItems.find(i => i.id === activeTab)?.label}</h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-1">Smart Lab Management System</p>
            </div>
          </div>
          <div className="flex items-center gap-8">
            <button className="p-3 bg-slate-50 text-slate-400 rounded-2xl relative hover:bg-slate-100 transition-colors group">
              <Bell className="w-6 h-6 group-hover:rotate-12 transition-transform" />
              <span className="absolute top-2.5 right-2.5 w-3 h-3 bg-rose-500 rounded-full border-2 border-white"></span>
            </button>
            <div className="flex items-center gap-5 pl-8 border-l border-slate-200">
              <div className="text-right">
                <p className="text-sm font-black text-slate-800 leading-none">{currentUser?.userName}</p>
                <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mt-1.5">{currentUser?.role}</p>
              </div>
              <div className="w-14 h-14 rounded-2xl bg-slate-900 border-4 border-white shadow-xl overflow-hidden transform hover:rotate-6 transition-transform cursor-pointer">
                <img src={`https://api.dicebear.com/7.x/bottts/svg?seed=${currentUser?.userName}`} alt="avatar" />
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-12">
          <div className="max-w-7xl mx-auto">
            {activeTab === 'dashboard' && <Dashboard role={currentUser!.role} />}
            {activeTab === 'system' && <SystemConfig />}
            {activeTab === 'labs' && <LabControl />}
            {activeTab === 'users' && <UserManagement />}
            {activeTab === 'sessions' && <SessionManagement role={currentUser!.role} />}
            {activeTab === 'classroom' && <OnlineClassroom user={currentUser as any} />}
            {activeTab === 'documents' && <DocumentManager user={currentUser as any} />}
            {activeTab === 'messaging' && <Messaging user={currentUser as any} />}
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
