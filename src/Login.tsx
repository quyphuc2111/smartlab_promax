import { useState } from "react";
import { Monitor, ShieldCheck } from "lucide-react";
import { login, register, setToken, User } from "./api";

interface LoginProps {
  onLogin: (user: User) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (isRegister && password !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp");
      return;
    }

    setLoading(true);

    try {
      const result = isRegister
        ? await register(username, password)
        : await login(username, password);

      if (result.success && result.user && result.token) {
        setToken(result.token);
        // Ensure user has required fields
        if (result.user.user_name && result.user.role) {
          onLogin(result.user);
        } else {
          setError("Dữ liệu người dùng không hợp lệ");
        }
      } else {
        setError(result.message || "Đăng nhập thất bại");
      }
    } catch {
      setError("Lỗi kết nối. Backend đang chạy chưa?");
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
          <h1 className="text-2xl font-bold">Smartlab <small className="text-green-500">Pro Max</small></h1>
          <p className="text-indigo-100 mt-2">Hệ thống hack mạng lan cho trường học của bạn</p>
        </div>

        <div className="p-8">
          <h2 className="text-lg font-semibold text-slate-800 mb-6 text-center">
            {isRegister ? "Đăng ký tài khoản" : "Đăng nhập để tiếp tục"}
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

            {isRegister && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Xác nhận mật khẩu
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Nhập lại mật khẩu"
                  required
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                />
              </div>
            )}

            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-600 text-sm text-center">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition flex items-center justify-center gap-3 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ShieldCheck className="w-5 h-5" />
              {loading ? "Đang xử lý..." : isRegister ? "Đăng ký" : "Đăng nhập"}
            </button>
          </form>

          <p className="mt-6 text-center text-slate-500 text-sm">
            {isRegister ? "Đã có tài khoản?" : "Chưa có tài khoản?"}
            <button
              type="button"
              onClick={() => {
                setIsRegister(!isRegister);
                setError("");
              }}
              className="ml-2 text-indigo-600 font-medium hover:underline"
            >
              {isRegister ? "Đăng nhập" : "Đăng ký"}
            </button>
          </p>

          <p className="mt-8 text-xs text-center text-slate-400">
            © 2024 IP Scanner Pro. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
