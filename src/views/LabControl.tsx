import React, { useState, useEffect } from 'react';
import { 
  Monitor, Grid, List, Wrench, AlertTriangle, CheckCircle2, RefreshCw,
  PowerOff, Eye, RotateCcw, Wifi, WifiOff
} from 'lucide-react';
import { RoomComputer, ComputerStatus } from '../types';
import { getRoomComputers, checkComputerStatus } from '../api';

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

interface RemoteCommandResult {
  success: boolean;
  message: string;
  ip: string;
}

const LabControl: React.FC = () => {
  const [selectedLab, setSelectedLab] = useState('Phòng thực hành 01');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [computers, setComputers] = useState<RoomComputer[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [notification, setNotification] = useState<{type: 'success' | 'error', message: string} | null>(null);
  const [computerStatuses, setComputerStatuses] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadComputers();
  }, []);

  useEffect(() => {
    if (computers.length > 0) {
      checkAllStatuses();
    }
  }, [computers]);

  const loadComputers = async () => {
    setLoading(true);
    try {
      const result = await getRoomComputers();
      if (result.success && result.data) {
        setComputers(result.data.map(c => ({
          ...c,
          status: c.status as ComputerStatus
        })));
      }
    } catch (error) {
      console.error('Failed to load computers:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkAllStatuses = async () => {
    const statuses: Record<string, boolean> = {};
    for (const pc of computers) {
      if (pc.ip_address) {
        try {
          const result = await checkComputerStatus(pc.ip_address);
          if (result.success && result.data) {
            statuses[pc.ip_address] = result.data.online;
          } else {
            statuses[pc.ip_address] = false;
          }
        } catch {
          statuses[pc.ip_address] = false;
        }
      }
    }
    setComputerStatuses(statuses);
  };

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleViewScreen = async (pc: RoomComputer) => {
    if (!invoke || !pc.ip_address) return;
    
    setActionLoading(`view-${pc.room_computer_id}`);
    try {
      // Thử VNC trước
      let result = await invoke<RemoteCommandResult>('open_vnc_viewer', { ip: pc.ip_address });
      
      if (!result.success) {
        // Fallback sang RDP
        result = await invoke<RemoteCommandResult>('open_remote_desktop', { ip: pc.ip_address });
      }
      
      if (result.success) {
        showNotification('success', result.message);
      } else {
        showNotification('error', result.message);
      }
    } catch (error) {
      showNotification('error', 'Không thể kết nối đến máy');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemoteDesktop = async (pc: RoomComputer) => {
    if (!invoke || !pc.ip_address) return;
    
    setActionLoading(`rdp-${pc.room_computer_id}`);
    try {
      const result = await invoke<RemoteCommandResult>('open_remote_desktop', { ip: pc.ip_address });
      if (result.success) {
        showNotification('success', result.message);
      } else {
        showNotification('error', result.message);
      }
    } catch (error) {
      showNotification('error', 'Không thể mở Remote Desktop');
    } finally {
      setActionLoading(null);
    }
  };

  const handleShutdown = async (pc: RoomComputer) => {
    if (!invoke || !pc.ip_address) return;
    if (!confirm(`Bạn có chắc muốn tắt máy ${pc.computer_name}?`)) return;
    
    setActionLoading(`shutdown-${pc.room_computer_id}`);
    try {
      const result = await invoke<RemoteCommandResult>('remote_shutdown', { ip: pc.ip_address });
      if (result.success) {
        showNotification('success', `Đã gửi lệnh tắt máy đến ${pc.computer_name}`);
        // Cập nhật trạng thái sau vài giây
        setTimeout(() => checkAllStatuses(), 5000);
      } else {
        showNotification('error', result.message);
      }
    } catch (error) {
      showNotification('error', 'Không thể tắt máy');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRestart = async (pc: RoomComputer) => {
    if (!invoke || !pc.ip_address) return;
    if (!confirm(`Bạn có chắc muốn khởi động lại máy ${pc.computer_name}?`)) return;
    
    setActionLoading(`restart-${pc.room_computer_id}`);
    try {
      const result = await invoke<RemoteCommandResult>('remote_restart', { ip: pc.ip_address });
      if (result.success) {
        showNotification('success', `Đã gửi lệnh khởi động lại ${pc.computer_name}`);
      } else {
        showNotification('error', result.message);
      }
    } catch (error) {
      showNotification('error', 'Không thể khởi động lại máy');
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusColor = (status?: ComputerStatus | string) => {
    switch (status) {
      case ComputerStatus.ACTIVE:
      case 'Active': return { bg: 'bg-white border-slate-100 hover:border-indigo-300 hover:shadow-2xl hover:-translate-y-1', icon: 'bg-indigo-50 text-indigo-600', dot: 'bg-emerald-500' };
      case ComputerStatus.REPAIRING:
      case 'Repairing': return { bg: 'bg-amber-50 border-amber-200', icon: 'bg-amber-100 text-amber-600', dot: 'bg-amber-500' };
      case ComputerStatus.BROKEN:
      case 'Broken': return { bg: 'bg-rose-50 border-rose-200', icon: 'bg-rose-100 text-rose-600', dot: 'bg-rose-500' };
      default: return { bg: 'bg-slate-50 border-slate-200', icon: 'bg-slate-100 text-slate-600', dot: 'bg-slate-500' };
    }
  };

  const isActive = (status?: ComputerStatus | string) => 
    status === ComputerStatus.ACTIVE || status === 'Active';

  const isRepairing = (status?: ComputerStatus | string) => 
    status === ComputerStatus.REPAIRING || status === 'Repairing';

  const isOnline = (ip?: string) => ip ? computerStatuses[ip] : false;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-xl shadow-lg flex items-center gap-2 ${
          notification.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
        }`}>
          {notification.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
          {notification.message}
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <div className="bg-white p-2 rounded-2xl shadow-sm border border-slate-200">
            <select 
              value={selectedLab}
              onChange={(e) => setSelectedLab(e.target.value)}
              className="text-xl font-black text-slate-800 bg-transparent border-none outline-none cursor-pointer px-4"
            >
              <option>Phòng thực hành 01 (Dãy A)</option>
              <option>Phòng thực hành 02 (Dãy A)</option>
              <option>Phòng thực hành 03 (Dãy B)</option>
            </select>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-black uppercase tracking-tighter border border-emerald-100">
            <CheckCircle2 className="w-4 h-4" /> {computers.length} máy tính
          </div>
          <button 
            onClick={checkAllStatuses}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-xl text-xs font-bold hover:bg-indigo-100 transition"
          >
            <RefreshCw className="w-4 h-4" /> Kiểm tra trạng thái
          </button>
        </div>

        <div className="flex items-center gap-2 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm">
          <button onClick={() => setViewMode('grid')} className={`p-3 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'text-slate-400 hover:text-slate-600'}`}><Grid className="w-5 h-5" /></button>
          <button onClick={() => setViewMode('list')} className={`p-3 rounded-xl transition-all ${viewMode === 'list' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'text-slate-400 hover:text-slate-600'}`}><List className="w-5 h-5" /></button>
        </div>
      </div>

      {computers.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <Monitor className="w-12 h-12 mx-auto mb-4 text-slate-300" />
          <p className="text-slate-500">Chưa có máy tính nào trong phòng máy.</p>
          <p className="text-slate-400 text-sm mt-1">Liên hệ quản trị viên để thêm máy.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
          {computers.map((pc) => {
            const colors = getStatusColor(pc.status);
            const online = isOnline(pc.ip_address);
            return (
              <div key={pc.room_computer_id} className={`relative group p-6 rounded-3xl border-2 transition-all duration-500 cursor-pointer ${colors.bg}`}>
                {/* Online indicator */}
                <div className="absolute top-3 right-3">
                  {online ? (
                    <Wifi className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <WifiOff className="w-4 h-4 text-slate-300" />
                  )}
                </div>

                <div className="flex justify-between items-start mb-6">
                  <div className={`p-3 rounded-2xl ${colors.icon}`}>
                    {isActive(pc.status) ? <Monitor className="w-6 h-6" /> : isRepairing(pc.status) ? <Wrench className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
                  </div>
                </div>
                
                <h4 className="text-lg font-black text-slate-800">{pc.computer_name}</h4>
                <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-tighter">{pc.ip_address}</p>
                
                <div className="mt-4 flex items-center gap-1.5">
                   <div className={`w-2 h-2 rounded-full ${online ? 'bg-emerald-500 animate-pulse' : colors.dot}`}></div>
                   <span className="text-[10px] font-black uppercase text-slate-500">
                     {online ? 'Online' : pc.status}
                   </span>
                </div>

                {/* Control overlay for active & online computers */}
                {isActive(pc.status) && (
                  <div className="absolute inset-0 bg-slate-900/95 rounded-3xl opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col items-center justify-center p-4 gap-2 scale-95 group-hover:scale-100">
                     <button 
                       onClick={() => handleRemoteDesktop(pc)}
                       disabled={!online || actionLoading !== null}
                       className="w-full py-2 bg-indigo-600 text-white text-[10px] font-black rounded-xl uppercase tracking-widest hover:bg-indigo-500 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                     >
                       <Monitor className="w-3 h-3" />
                       {actionLoading === `rdp-${pc.room_computer_id}` ? 'Đang mở...' : 'Điều khiển'}
                     </button>
                     <button 
                       onClick={() => handleViewScreen(pc)}
                       disabled={!online || actionLoading !== null}
                       className="w-full py-2 bg-slate-700 text-white text-[10px] font-black rounded-xl uppercase tracking-widest hover:bg-slate-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                     >
                       <Eye className="w-3 h-3" />
                       {actionLoading === `view-${pc.room_computer_id}` ? 'Đang mở...' : 'Xem màn hình'}
                     </button>
                     <div className="flex gap-2 w-full">
                       <button 
                         onClick={() => handleRestart(pc)}
                         disabled={!online || actionLoading !== null}
                         className="flex-1 py-2 bg-amber-600 text-white text-[10px] font-black rounded-xl uppercase hover:bg-amber-500 transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                       >
                         <RotateCcw className="w-3 h-3" />
                         {actionLoading === `restart-${pc.room_computer_id}` ? '...' : 'Restart'}
                       </button>
                       <button 
                         onClick={() => handleShutdown(pc)}
                         disabled={!online || actionLoading !== null}
                         className="flex-1 py-2 bg-rose-600 text-white text-[10px] font-black rounded-xl uppercase hover:bg-rose-500 transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                       >
                         <PowerOff className="w-3 h-3" />
                         {actionLoading === `shutdown-${pc.room_computer_id}` ? '...' : 'Tắt'}
                       </button>
                     </div>
                     {!online && (
                       <p className="text-[9px] text-slate-400 mt-1">Máy đang offline</p>
                     )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default LabControl;
