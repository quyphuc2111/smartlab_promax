import React, { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { 
  Monitor, X, Maximize2, Minimize2, Settings, Wifi, WifiOff,
  MousePointer, Keyboard, RefreshCw
} from 'lucide-react';

interface RemoteViewerProps {
  ip: string;
  port?: number;
  computerName?: string;
  onClose: () => void;
}

interface FrameMessage {
  type: 'frame';
  data: string; // base64 encoded JPEG
}

const RemoteViewer: React.FC<RemoteViewerProps> = ({ ip, port = 5960, computerName, onClose }) => {
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [fps, setFps] = useState(0);
  const [inputEnabled, setInputEnabled] = useState(true);
  
  const wsRef = useRef<WebSocket | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const frameCountRef = useRef(0);
  const lastFpsUpdateRef = useRef(Date.now());
  const imageRef = useRef<HTMLImageElement | null>(null);

  // Connect to remote server
  useEffect(() => {
    const wsUrl = `ws://${ip}:${port}`;
    console.log('Connecting to:', wsUrl);
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connected');
      setConnected(true);
      setConnecting(false);
      setError(null);
    };

    ws.onmessage = (event) => {
      try {
        const msg: FrameMessage = JSON.parse(event.data);
        if (msg.type === 'frame' && msg.data) {
          renderFrame(msg.data);
          
          // Update FPS counter
          frameCountRef.current++;
          const now = Date.now();
          if (now - lastFpsUpdateRef.current >= 1000) {
            setFps(frameCountRef.current);
            frameCountRef.current = 0;
            lastFpsUpdateRef.current = now;
          }
        }
      } catch (e) {
        console.error('Failed to parse message:', e);
      }
    };

    ws.onerror = (e) => {
      console.error('WebSocket error:', e);
      setError('Lỗi kết nối');
      setConnecting(false);
    };

    ws.onclose = () => {
      console.log('WebSocket closed');
      setConnected(false);
      setConnecting(false);
    };

    return () => {
      ws.close();
    };
  }, [ip, port]);

  // Render frame to canvas
  const renderFrame = useCallback((base64Data: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (!imageRef.current) {
      imageRef.current = new Image();
    }

    const img = imageRef.current;
    img.onload = () => {
      // Resize canvas to match image
      if (canvas.width !== img.width || canvas.height !== img.height) {
        canvas.width = img.width;
        canvas.height = img.height;
      }
      ctx.drawImage(img, 0, 0);
    };
    img.src = `data:image/jpeg;base64,${base64Data}`;
  }, []);

  // Send input event to remote
  const sendInput = useCallback((event: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN && inputEnabled) {
      wsRef.current.send(JSON.stringify(event));
    }
  }, [inputEnabled]);

  // Calculate scaled coordinates
  const getScaledCoords = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    return {
      x: Math.round((e.clientX - rect.left) * scaleX),
      y: Math.round((e.clientY - rect.top) * scaleY)
    };
  }, []);

  // Mouse event handlers
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getScaledCoords(e);
    sendInput({ type: 'mouse_move', x, y });
  }, [getScaledCoords, sendInput]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const { x, y } = getScaledCoords(e);
    const button = e.button === 2 ? 'right' : e.button === 1 ? 'middle' : 'left';
    sendInput({ type: 'mouse_down', x, y, button });
  }, [getScaledCoords, sendInput]);

  const handleMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const { x, y } = getScaledCoords(e);
    const button = e.button === 2 ? 'right' : e.button === 1 ? 'middle' : 'left';
    sendInput({ type: 'mouse_up', x, y, button });
  }, [getScaledCoords, sendInput]);

  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    sendInput({ 
      type: 'mouse_scroll', 
      delta_x: Math.sign(e.deltaX) * -3,
      delta_y: Math.sign(e.deltaY) * -3
    });
  }, [sendInput]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  // Keyboard event handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!inputEnabled || !connected) return;
      
      // Prevent default for most keys when focused on canvas
      if (document.activeElement === canvasRef.current) {
        e.preventDefault();
        sendInput({ type: 'key_down', key: e.key });
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (!inputEnabled || !connected) return;
      
      if (document.activeElement === canvasRef.current) {
        e.preventDefault();
        sendInput({ type: 'key_up', key: e.key });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [inputEnabled, connected, sendInput]);

  // Toggle fullscreen
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;

    if (!fullscreen) {
      containerRef.current.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
    setFullscreen(!fullscreen);
  }, [fullscreen]);

  return (
    <div 
      ref={containerRef}
      className={`fixed inset-0 z-50 bg-slate-900 flex flex-col ${fullscreen ? '' : 'p-4'}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800 rounded-t-xl">
        <div className="flex items-center gap-3">
          <Monitor className="w-5 h-5 text-indigo-400" />
          <span className="font-bold text-white">
            {computerName || ip}
          </span>
          <span className="text-xs text-slate-400">
            {ip}:{port}
          </span>
          {connected ? (
            <span className="flex items-center gap-1 text-xs text-emerald-400">
              <Wifi className="w-3 h-3" /> Connected
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-rose-400">
              <WifiOff className="w-3 h-3" /> Disconnected
            </span>
          )}
          <span className="text-xs text-slate-500">
            {fps} FPS
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setInputEnabled(!inputEnabled)}
            className={`p-2 rounded-lg transition ${
              inputEnabled 
                ? 'bg-indigo-600 text-white' 
                : 'bg-slate-700 text-slate-400'
            }`}
            title={inputEnabled ? 'Disable input' : 'Enable input'}
          >
            <MousePointer className="w-4 h-4" />
          </button>
          <button
            onClick={toggleFullscreen}
            className="p-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition"
            title="Toggle fullscreen"
          >
            {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button
            onClick={onClose}
            className="p-2 bg-rose-600 text-white rounded-lg hover:bg-rose-500 transition"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Canvas container */}
      <div className="flex-1 flex items-center justify-center bg-black overflow-hidden rounded-b-xl">
        {connecting && (
          <div className="flex flex-col items-center gap-4 text-white">
            <RefreshCw className="w-8 h-8 animate-spin text-indigo-400" />
            <span>Đang kết nối đến {ip}...</span>
          </div>
        )}

        {error && !connecting && (
          <div className="flex flex-col items-center gap-4 text-white">
            <WifiOff className="w-12 h-12 text-rose-400" />
            <span className="text-rose-400">{error}</span>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-indigo-600 rounded-lg hover:bg-indigo-500 transition"
            >
              Thử lại
            </button>
          </div>
        )}

        {connected && (
          <canvas
            ref={canvasRef}
            tabIndex={0}
            className="max-w-full max-h-full object-contain cursor-crosshair focus:outline-none"
            onMouseMove={handleMouseMove}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onWheel={handleWheel}
            onContextMenu={handleContextMenu}
          />
        )}
      </div>

      {/* Footer with instructions */}
      {connected && inputEnabled && (
        <div className="px-4 py-2 bg-slate-800 text-xs text-slate-400 flex items-center gap-4">
          <span className="flex items-center gap-1">
            <MousePointer className="w-3 h-3" /> Click vào canvas để điều khiển
          </span>
          <span className="flex items-center gap-1">
            <Keyboard className="w-3 h-3" /> Nhấn phím để gửi keyboard input
          </span>
        </div>
      )}
    </div>
  );
};

export default RemoteViewer;
