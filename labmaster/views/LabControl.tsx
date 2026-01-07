
import React, { useState } from 'react';
import { Monitor, Power, RotateCcw, ShieldAlert, Grid, List, Wrench, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { RoomComputer } from '../types';

const LabControl: React.FC = () => {
  const [selectedLab, setSelectedLab] = useState('Phòng thực hành 01');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const computers: RoomComputer[] = Array.from({ length: 24 }, (_, i) => ({
    roomComputerId: i + 1,
    computerName: `PC-${(i + 1).toString().padStart(2, '0')}`,
    ipAddress: `192.168.1.${10 + i}`,
    status: i % 8 === 0 ? 'Broken' : i % 10 === 0 ? 'Repairing' : 'Active'
  }));

  return (
    <div className="space-y-8">
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
            <CheckCircle2 className="w-4 h-4" /> Hệ thống ổn định
          </div>
        </div>

        <div className="flex items-center gap-2 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm">
          <button onClick={() => setViewMode('grid')} className={`p-3 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'text-slate-400 hover:text-slate-600'}`}><Grid className="w-5 h-5" /></button>
          <button onClick={() => setViewMode('list')} className={`p-3 rounded-xl transition-all ${viewMode === 'list' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'text-slate-400 hover:text-slate-600'}`}><List className="w-5 h-5" /></button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
        {computers.map((pc) => (
          <div key={pc.roomComputerId} className={`relative group p-6 rounded-3xl border-2 transition-all duration-500 cursor-pointer ${pc.status === 'Active' ? 'bg-white border-slate-100 hover:border-indigo-300 hover:shadow-2xl hover:-translate-y-1' : pc.status === 'Repairing' ? 'bg-amber-50 border-amber-200' : 'bg-rose-50 border-rose-200'}`}>
            <div className="flex justify-between items-start mb-6">
              <div className={`p-3 rounded-2xl ${pc.status === 'Active' ? 'bg-indigo-50 text-indigo-600' : pc.status === 'Repairing' ? 'bg-amber-100 text-amber-600' : 'bg-rose-100 text-rose-600'}`}>
                {pc.status === 'Active' ? <Monitor className="w-6 h-6" /> : pc.status === 'Repairing' ? <Wrench className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
              </div>
              <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">#{pc.roomComputerId}</span>
            </div>
            
            <h4 className="text-lg font-black text-slate-800">{pc.computerName}</h4>
            <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-tighter">{pc.ipAddress}</p>
            
            <div className="mt-4 flex items-center gap-1.5">
               <div className={`w-2 h-2 rounded-full ${pc.status === 'Active' ? 'bg-emerald-500' : pc.status === 'Repairing' ? 'bg-amber-500' : 'bg-rose-500'}`}></div>
               <span className="text-[10px] font-black uppercase text-slate-500">{pc.status}</span>
            </div>

            {pc.status === 'Active' && (
              <div className="absolute inset-0 bg-slate-900/95 rounded-3xl opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col items-center justify-center p-6 gap-3 scale-95 group-hover:scale-100">
                 <button className="w-full py-2.5 bg-indigo-600 text-white text-[10px] font-black rounded-xl uppercase tracking-widest hover:bg-indigo-500 transition-colors">Điều khiển</button>
                 <button className="w-full py-2.5 bg-slate-700 text-white text-[10px] font-black rounded-xl uppercase tracking-widest hover:bg-slate-600 transition-colors">Màn hình</button>
                 <button className="w-full py-2.5 bg-rose-600 text-white text-[10px] font-black rounded-xl uppercase tracking-widest hover:bg-rose-500 transition-colors">Ngắt điện</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default LabControl;
