import React, { useState, useEffect } from 'react';
import { 
  Search, Plus, Edit2, Trash2, Monitor, 
  Wifi, RefreshCw, Save, X,
  CheckCircle2, AlertTriangle, Wrench
} from 'lucide-react';
import { RoomComputer, ComputerStatus, HostInfo } from '../types';
import { scanNetwork, getRoomComputers, createRoomComputer, updateRoomComputer, deleteRoomComputer } from '../api';

const RoomComputerManagement: React.FC = () => {
  const [computers, setComputers] = useState<RoomComputer[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scannedHosts, setScannedHosts] = useState<HostInfo[]>([]);
  const [showScanResults, setShowScanResults] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    computer_name: '',
    ip_address: '',
    status: ComputerStatus.ACTIVE
  });

  // Load computers on mount
  useEffect(() => {
    loadComputers();
  }, []);

  const loadComputers = async () => {
    try {
      const result = await getRoomComputers();
      if (result.success && result.data) {
        setComputers(result.data.map(c => ({
          ...c,
          status: c.status as ComputerStatus
        })));
      }
    } catch (err) {
      setError('Không thể tải danh sách máy tính');
    } finally {
      setLoading(false);
    }
  };

  const handleScanNetwork = async () => {
    setScanning(true);
    setError('');
    try {
      const result = await scanNetwork();
      if (result.success && result.data) {
        setScannedHosts(result.data);
        setShowScanResults(true);
      }
    } catch (err) {
      setError('Quét mạng thất bại');
    } finally {
      setScanning(false);
    }
  };

  const handleAddFromScan = async (host: HostInfo) => {
    setError('');
    const nextNum = computers.length + 1;
    try {
      const result = await createRoomComputer({
        computer_name: `PC-${nextNum.toString().padStart(2, '0')}`,
        ip_address: host.ip,
        status: ComputerStatus.ACTIVE
      });
      if (result.success && result.data) {
        setComputers([...computers, { ...result.data, status: result.data.status as ComputerStatus }]);
        setScannedHosts(scannedHosts.filter(h => h.ip !== host.ip));
      } else {
        setError(result.error || 'Thêm máy thất bại');
      }
    } catch (err) {
      setError('Thêm máy thất bại');
    }
  };

  const handleAddManual = async () => {
    if (!formData.computer_name || !formData.ip_address) {
      setError('Vui lòng nhập đầy đủ thông tin');
      return;
    }
    setError('');
    try {
      const result = await createRoomComputer({
        computer_name: formData.computer_name,
        ip_address: formData.ip_address,
        status: formData.status
      });
      if (result.success && result.data) {
        setComputers([...computers, { ...result.data, status: result.data.status as ComputerStatus }]);
        setFormData({ computer_name: '', ip_address: '', status: ComputerStatus.ACTIVE });
        setShowAddModal(false);
      } else {
        setError(result.error || 'Thêm máy thất bại');
      }
    } catch (err) {
      setError('Thêm máy thất bại');
    }
  };

  const handleEdit = (computer: RoomComputer) => {
    setEditingId(computer.room_computer_id || null);
    setFormData({
      computer_name: computer.computer_name,
      ip_address: computer.ip_address || '',
      status: computer.status || ComputerStatus.ACTIVE
    });
  };

  const handleSaveEdit = async (id: number) => {
    setError('');
    try {
      const result = await updateRoomComputer(id, {
        computer_name: formData.computer_name,
        ip_address: formData.ip_address,
        status: formData.status
      });
      if (result.success && result.data) {
        setComputers(computers.map(c => 
          c.room_computer_id === id 
            ? { ...result.data!, status: result.data!.status as ComputerStatus }
            : c
        ));
        setEditingId(null);
        setFormData({ computer_name: '', ip_address: '', status: ComputerStatus.ACTIVE });
      } else {
        setError(result.error || 'Cập nhật thất bại');
      }
    } catch (err) {
      setError('Cập nhật thất bại');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Bạn có chắc muốn xóa máy tính này?')) return;
    setError('');
    try {
      const result = await deleteRoomComputer(id);
      if (result.success) {
        setComputers(computers.filter(c => c.room_computer_id !== id));
      } else {
        setError(result.error || 'Xóa thất bại');
      }
    } catch (err) {
      setError('Xóa thất bại');
    }
  };

  const filteredComputers = computers.filter(c => 
    c.computer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.ip_address?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusIcon = (status?: ComputerStatus | string) => {
    switch (status) {
      case ComputerStatus.ACTIVE:
      case 'Active': return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case ComputerStatus.REPAIRING:
      case 'Repairing': return <Wrench className="w-4 h-4 text-amber-500" />;
      case ComputerStatus.BROKEN:
      case 'Broken': return <AlertTriangle className="w-4 h-4 text-rose-500" />;
      default: return <Monitor className="w-4 h-4 text-slate-400" />;
    }
  };

  const getStatusBadge = (status?: ComputerStatus | string) => {
    switch (status) {
      case ComputerStatus.ACTIVE:
      case 'Active': return 'bg-emerald-100 text-emerald-700';
      case ComputerStatus.REPAIRING:
      case 'Repairing': return 'bg-amber-100 text-amber-700';
      case ComputerStatus.BROKEN:
      case 'Broken': return 'bg-rose-100 text-rose-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Quản lý phòng máy</h1>
          <p className="text-slate-500">Quét mạng LAN, thêm và quản lý các máy tính trong phòng thực hành.</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={handleScanNetwork}
            disabled={scanning}
            className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-900 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${scanning ? 'animate-spin' : ''}`} />
            {scanning ? 'Đang quét...' : 'Quét mạng LAN'}
          </button>
          <button 
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition"
          >
            <Plus className="w-4 h-4" /> Thêm thủ công
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm">
          {error}
        </div>
      )}

      {/* Scan Results */}
      {showScanResults && scannedHosts.length > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-emerald-800 flex items-center gap-2">
              <Wifi className="w-5 h-5" /> Phát hiện {scannedHosts.length} thiết bị trong mạng
            </h3>
            <button onClick={() => setShowScanResults(false)} className="text-emerald-600 hover:text-emerald-800">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {scannedHosts.filter(h => !computers.some(c => c.ip_address === h.ip)).map((host) => (
              <div key={host.ip} className="bg-white p-3 rounded-xl border border-emerald-100 flex items-center justify-between">
                <span className="text-sm font-mono text-slate-700">{host.ip}</span>
                <button 
                  onClick={() => handleAddFromScan(host)}
                  className="p-1 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Tìm theo tên hoặc IP..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Computer List */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 text-[10px] uppercase font-black text-slate-400 border-b">
              <th className="px-6 py-4 text-left">STT</th>
              <th className="px-6 py-4 text-left">Tên máy</th>
              <th className="px-6 py-4 text-left">Địa chỉ IP</th>
              <th className="px-6 py-4 text-left">Trạng thái</th>
              <th className="px-6 py-4 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredComputers.map((computer, idx) => (
              <tr key={computer.room_computer_id} className="hover:bg-slate-50 transition group">
                <td className="px-6 py-4 text-sm text-slate-400">{idx + 1}</td>
                <td className="px-6 py-4">
                  {editingId === computer.room_computer_id ? (
                    <input 
                      type="text" 
                      value={formData.computer_name}
                      onChange={(e) => setFormData({...formData, computer_name: e.target.value})}
                      className="px-3 py-1.5 border rounded-lg text-sm w-32"
                    />
                  ) : (
                    <div className="flex items-center gap-2">
                      <Monitor className="w-4 h-4 text-indigo-500" />
                      <span className="font-bold text-slate-700">{computer.computer_name}</span>
                    </div>
                  )}
                </td>
                <td className="px-6 py-4">
                  {editingId === computer.room_computer_id ? (
                    <input 
                      type="text" 
                      value={formData.ip_address}
                      onChange={(e) => setFormData({...formData, ip_address: e.target.value})}
                      className="px-3 py-1.5 border rounded-lg text-sm font-mono w-36"
                    />
                  ) : (
                    <span className="font-mono text-sm text-slate-600">{computer.ip_address}</span>
                  )}
                </td>
                <td className="px-6 py-4">
                  {editingId === computer.room_computer_id ? (
                    <select 
                      value={formData.status}
                      onChange={(e) => setFormData({...formData, status: e.target.value as ComputerStatus})}
                      className="px-3 py-1.5 border rounded-lg text-sm"
                    >
                      <option value={ComputerStatus.ACTIVE}>Hoạt động</option>
                      <option value={ComputerStatus.REPAIRING}>Đang sửa</option>
                      <option value={ComputerStatus.BROKEN}>Hỏng</option>
                    </select>
                  ) : (
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${getStatusBadge(computer.status)}`}>
                      {getStatusIcon(computer.status)}
                      {computer.status}
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 text-right">
                  {editingId === computer.room_computer_id ? (
                    <div className="flex justify-end gap-1">
                      <button onClick={() => handleSaveEdit(computer.room_computer_id!)} className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg">
                        <Save className="w-4 h-4" />
                      </button>
                      <button onClick={() => setEditingId(null)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition">
                      <button onClick={() => handleEdit(computer)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(computer.room_computer_id!)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {filteredComputers.length === 0 && (
          <div className="p-12 text-center text-slate-400">
            <Monitor className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p>Chưa có máy tính nào. Hãy quét mạng hoặc thêm thủ công.</p>
          </div>
        )}
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Thêm máy tính mới</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tên máy</label>
                <input 
                  type="text" 
                  value={formData.computer_name}
                  onChange={(e) => setFormData({...formData, computer_name: e.target.value})}
                  placeholder="VD: PC-01"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Địa chỉ IP</label>
                <input 
                  type="text" 
                  value={formData.ip_address}
                  onChange={(e) => setFormData({...formData, ip_address: e.target.value})}
                  placeholder="VD: 192.168.1.10"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Trạng thái</label>
                <select 
                  value={formData.status}
                  onChange={(e) => setFormData({...formData, status: e.target.value as ComputerStatus})}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value={ComputerStatus.ACTIVE}>Hoạt động</option>
                  <option value={ComputerStatus.REPAIRING}>Đang sửa chữa</option>
                  <option value={ComputerStatus.BROKEN}>Hỏng</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button 
                onClick={() => {
                  setShowAddModal(false);
                  setFormData({ computer_name: '', ip_address: '', status: ComputerStatus.ACTIVE });
                }}
                className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl font-medium hover:bg-slate-50"
              >
                Hủy
              </button>
              <button 
                onClick={handleAddManual}
                className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700"
              >
                Thêm máy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoomComputerManagement;
