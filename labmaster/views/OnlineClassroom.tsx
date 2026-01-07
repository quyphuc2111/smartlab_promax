
import React, { useState, useEffect, useRef } from 'react';
import { 
  MonitorPlay, MessageCircle, Hand, 
  Users, Mic, MicOff, Video, VideoOff,
  ScreenShare, X, Send, Smile, User,
  Bot
} from 'lucide-react';
import { getAIHelp } from '../services/geminiService';
// Fix: Use UserAccount instead of User and import UserRole
import { UserAccount as UserType, Message, UserRole } from '../types';

const OnlineClassroom: React.FC<{ user: UserType }> = ({ user }) => {
  const [isTeaching, setIsTeaching] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    // Fix: Updated properties to match the new Message interface
    { id: '1', senderId: 'ai', senderName: 'LabMaster AI', content: 'Chào thầy cô, tôi là trợ lý AI. Tôi có thể giúp gì cho ca dạy hôm nay?', timestamp: '14:00', role: UserRole.ADMIN }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;

    // Fix: Updated property names (userId/userName) and senderId/role
    const newMsg: Message = {
      id: Date.now().toString(),
      senderId: user.userId.toString(),
      senderName: user.userName,
      content: inputMessage,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      role: user.role
    };

    setMessages(prev => [...prev, newMsg]);
    setInputMessage('');

    // If starts with @ai or similar, trigger Gemini
    if (inputMessage.toLowerCase().startsWith('@ai')) {
      setIsAiLoading(true);
      const aiResponse = await getAIHelp(inputMessage.replace('@ai', ''), { session: 'Lab 01 - ReactJS' });
      // Fix: Updated properties to match Message interface
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        senderId: 'ai',
        senderName: 'LabMaster AI',
        content: aiResponse || 'Rất tiếc, tôi không thể xử lý yêu cầu lúc này.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        role: UserRole.ADMIN
      };
      setMessages(prev => [...prev, aiMsg]);
      setIsAiLoading(false);
    }
  };

  return (
    <div className="h-[calc(100vh-10rem)] flex flex-col lg:flex-row gap-6">
      {/* Main Stream Area */}
      <div className="flex-1 bg-slate-900 rounded-3xl overflow-hidden flex flex-col relative">
        <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
          <div className="bg-rose-600 text-white text-[10px] font-bold px-2 py-0.5 rounded animate-pulse">LIVE</div>
          <div className="bg-slate-800/80 backdrop-blur-md text-white text-xs px-3 py-1 rounded-full flex items-center gap-2 border border-white/10">
            <Users className="w-3 h-3" /> 24 học sinh đang tham gia
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center bg-slate-950">
          {isTeaching ? (
            <div className="w-full h-full relative">
              <img 
                src="https://picsum.photos/seed/code/1200/800" 
                alt="Screen share" 
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-6 right-6 w-48 aspect-video bg-slate-800 rounded-xl border-2 border-white/20 overflow-hidden shadow-2xl">
                 {/* Fix: UserAccount doesn't have avatar, using dicebear instead */}
                 <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.userName}`} className="w-full h-full object-cover" alt="Teacher" />
                 <div className="absolute bottom-2 left-2 text-[10px] text-white bg-black/50 px-1 rounded">Bạn (Giáo viên)</div>
              </div>
            </div>
          ) : (
            <div className="text-center p-8">
              <div className="w-20 h-20 bg-indigo-600/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-indigo-500/30">
                <MonitorPlay className="w-10 h-10 text-indigo-400" />
              </div>
              <h3 className="text-white text-xl font-bold">Chưa bắt đầu chia sẻ</h3>
              <p className="text-slate-400 mt-2 max-w-sm">Nhấn nút "Bắt đầu ca dạy" để chia sẻ màn hình và bắt đầu bài giảng của bạn.</p>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="bg-slate-900/90 backdrop-blur-md border-t border-white/10 p-6 flex items-center justify-center gap-4">
          <button className="p-3 rounded-full bg-slate-800 text-slate-400 hover:text-white transition">
            <MicOff className="w-6 h-6" />
          </button>
          <button className="p-3 rounded-full bg-slate-800 text-slate-400 hover:text-white transition">
            <VideoOff className="w-6 h-6" />
          </button>
          <button 
            onClick={() => setIsTeaching(!isTeaching)}
            className={`px-8 py-3 rounded-2xl font-bold transition flex items-center gap-3 ${isTeaching ? 'bg-rose-600 text-white' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
          >
            {isTeaching ? <><X className="w-5 h-5" /> Kết thúc ca dạy</> : <><ScreenShare className="w-5 h-5" /> Bắt đầu ca dạy</>}
          </button>
          <button className="p-3 rounded-full bg-slate-800 text-slate-400 hover:text-white transition">
            <Hand className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Sidebar Chat & Users */}
      <div className="w-full lg:w-80 flex flex-col gap-4">
        <div className="flex-1 bg-white rounded-3xl border border-slate-200 flex flex-col overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-indigo-500" />
              <h3 className="font-bold text-slate-800">Trao đổi lớp học</h3>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-slate-400 font-bold uppercase">
               <Bot className="w-3 h-3" /> Trợ lý AI sẵn sàng
            </div>
          </div>

          <div 
            ref={scrollRef}
            className="flex-1 p-4 space-y-4 overflow-y-auto scrollbar-hide bg-slate-50"
          >
            {messages.map((msg) => (
              // Fix: Corrected property access to senderId and userId
              <div key={msg.id} className={`flex flex-col ${msg.senderId === user.userId.toString() ? 'items-end' : 'items-start'}`}>
                <div className="flex items-center gap-1.5 mb-1 px-1">
                  <span className="text-[10px] font-bold text-slate-500">{msg.senderName}</span>
                  <span className="text-[10px] text-slate-400">{msg.timestamp}</span>
                </div>
                <div className={`
                  max-w-[85%] p-3 rounded-2xl text-sm shadow-sm
                  ${msg.senderId === user.userId.toString() 
                    ? 'bg-indigo-600 text-white rounded-tr-none' 
                    : msg.senderId === 'ai' 
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-100 rounded-tl-none italic'
                      : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none'}
                `}>
                  {msg.content}
                </div>
              </div>
            ))}
            {isAiLoading && (
              <div className="flex flex-col items-start">
                <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-100">
                   <div className="flex gap-1">
                     <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce"></span>
                     <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                     <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                   </div>
                </div>
              </div>
            )}
          </div>

          <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-100">
            <div className="relative">
              <input 
                type="text" 
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Nhập tin nhắn (Gõ @ai để hỏi)..."
                className="w-full bg-slate-100 border-none rounded-2xl pl-4 pr-12 py-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all outline-none"
              />
              <button type="submit" className="absolute right-2 top-2 p-1.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>

        <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm">
           <div className="flex items-center gap-2 mb-4">
              <Users className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Danh sách lớp</span>
           </div>
           <div className="grid grid-cols-4 gap-2">
             {Array.from({length: 12}).map((_, i) => (
               <div key={i} className="relative group">
                 <img src={`https://i.pravatar.cc/150?u=${i}`} className="w-full aspect-square rounded-xl object-cover ring-2 ring-transparent group-hover:ring-indigo-500 transition cursor-pointer" alt="student" />
                 <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full"></div>
               </div>
             ))}
             <div className="w-full aspect-square bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 text-xs font-bold cursor-pointer hover:bg-slate-200 transition">+12</div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default OnlineClassroom;
