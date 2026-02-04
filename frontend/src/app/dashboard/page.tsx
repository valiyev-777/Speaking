"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { useWebSocket } from "@/hooks/useWebSocket";
import { api } from "@/lib/api";
import { formatLevel } from "@/lib/utils";
import VoiceChat from "@/components/VoiceChat";

export default function DashboardPage() {
  const router = useRouter();
  const user = useStore(state => state.user);
  const isAuthenticated = useStore(state => state.isAuthenticated);
  const _hasHydrated = useStore(state => state._hasHydrated);
  const queueStatus = useStore(state => state.queueStatus);
  const currentMatch = useStore(state => state.currentMatch);
  const isInSession = useStore(state => state.isInSession);
  const logout = useStore(state => state.logout);
  const { isConnected, joinQueue, leaveQueue } = useWebSocket();

  const [selectedMode, setSelectedMode] = useState<"roulette" | "level_filter">(
    "roulette"
  );
  const [levelFilter, setLevelFilter] = useState(6.0);
  const [waitTime, setWaitTime] = useState(0);
  const [onlineCount, setOnlineCount] = useState(0);

  // Redirect if not authenticated (only after store has loaded from storage)
  useEffect(() => {
    if (!_hasHydrated) return;
    if (!isAuthenticated) {
      router.push("/login");
    }
  }, [_hasHydrated, isAuthenticated, router]);

  // Fallback: if store doesn't hydrate within 1s, treat as ready
  useEffect(() => {
    const timer = setTimeout(() => {
      useStore.setState({ _hasHydrated: true });
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  // Fetch online users count
  useEffect(() => {
    const fetchOnlineCount = async () => {
      try {
        const users = await api.getUsers(true); // online_only=true
        setOnlineCount(users.length);
      } catch (error) {
        console.error("Failed to fetch online count:", error);
      }
    };

    if (isAuthenticated) {
      fetchOnlineCount();
      // Refresh every 10 seconds
      const interval = setInterval(fetchOnlineCount, 10000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  // Track wait time when in queue
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (queueStatus?.in_queue) {
      interval = setInterval(() => {
        setWaitTime((prev) => prev + 1);
      }, 1000);
    } else {
      setWaitTime(0);
    }
    return () => clearInterval(interval);
  }, [queueStatus?.in_queue]);

  const handleJoinQueue = () => {
    if (selectedMode === "roulette") {
      joinQueue("roulette");
    } else {
      joinQueue("level_filter", levelFilter);
    }
  };

  const handleLeaveQueue = () => {
    leaveQueue();
  };

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  const levelOptions = [5.0, 5.5, 6.0, 6.5, 7.0, 7.5, 8.0, 8.5, 9.0];

  if (!user) return null;

  // Show voice chat if in session
  if (isInSession && currentMatch) {
    return <VoiceChat />;
  }

  return (
    <main className="min-h-screen p-3 sm:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <header className="mb-6">
          {/* Top row - Title and Logout */}
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white">
                Dashboard
              </h1>
              <p className="text-slate-400 text-sm sm:text-base">
                Salom, {user.username}! 👋
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="btn btn-secondary text-xs sm:text-sm px-3 py-1.5"
            >
              Chiqish
            </button>
          </div>

          {/* Status row */}
          <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
            {/* Partners Button */}
            <button
              onClick={() => router.push('/partners')}
              className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 px-3 py-1.5 rounded-lg transition-colors"
            >
              <span>👥</span>
              <span className="text-white text-xs sm:text-sm font-medium">Sheriklar</span>
            </button>

            {/* Online Users Count */}
            <div className="flex items-center gap-1.5 bg-slate-800 px-2 sm:px-3 py-1.5 rounded-lg">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-emerald-400 font-semibold text-sm">
                {onlineCount}
              </span>
              <span className="text-slate-400 text-xs sm:text-sm">online</span>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-800 px-2 sm:px-3 py-1.5 rounded-lg">
              <div
                className={`w-2 h-2 rounded-full ${isConnected ? "bg-emerald-500" : "bg-red-500"
                  }`}
              />
              <span className="text-xs sm:text-sm text-slate-400">
                {isConnected ? "Ulangan" : "Ulanmoqda..."}
              </span>
            </div>
          </div>
        </header>

        {/* Online Users Banner */}
        <div className="bg-gradient-to-r from-emerald-600/20 to-primary-600/20 border border-emerald-500/30 rounded-xl p-3 sm:p-4 mb-6">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-emerald-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-xl sm:text-2xl">👥</span>
              </div>
              <div>
                <p className="text-white font-semibold text-sm sm:text-base">
                  {onlineCount} ta online
                </p>
                <p className="text-slate-400 text-xs sm:text-sm">
                  Sherik topish oson!
                </p>
              </div>
            </div>
            {onlineCount > 1 && (
              <div className="text-emerald-400 text-xs sm:text-sm flex-shrink-0">
                ✓ Sherik bor
              </div>
            )}
          </div>
        </div>

        {/* User Stats */}
        <div className="card mb-6">
          {/* Mobile: Stack vertically, Desktop: Row */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            {/* Avatar and Name */}
            <div className="flex items-center gap-3 sm:gap-4 sm:flex-1">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-primary-600 rounded-full flex items-center justify-center text-xl sm:text-2xl font-bold text-white flex-shrink-0">
                {user.username[0].toUpperCase()}
              </div>
              <div className="min-w-0">
                <h2 className="text-lg sm:text-xl font-semibold text-white truncate">
                  {user.username}
                </h2>
                <p className="text-slate-400 text-sm truncate">{user.email}</p>
              </div>
            </div>

            {/* Level Stats - Side by side on mobile */}
            <div className="flex items-center justify-around sm:justify-end gap-4 sm:gap-6 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-700">
              <div className="text-center sm:text-right">
                <div className="text-xs sm:text-sm text-slate-400">Daraja</div>
                <div className="text-xl sm:text-2xl font-bold text-primary-400">
                  {formatLevel(user.current_level)}
                </div>
              </div>
              <div className="text-center sm:text-right">
                <div className="text-xs sm:text-sm text-slate-400">Maqsad</div>
                <div className="text-xl sm:text-2xl font-bold text-emerald-400">
                  {formatLevel(user.target_score)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Matchmaking Section */}
        {queueStatus?.in_queue ? (
          // Waiting for match
          <div className="card text-center">
            <div className="mb-6">
              <div className="relative inline-flex">
                <div className="w-24 h-24 bg-primary-600/20 rounded-full flex items-center justify-center">
                  <div className="w-16 h-16 bg-primary-600/40 rounded-full flex items-center justify-center">
                    <div className="flex items-end gap-1 h-8">
                      <div
                        className="w-1.5 bg-primary-500 rounded-full animate-pulse"
                        style={{ height: "40%", animationDelay: "0ms" }}
                      />
                      <div
                        className="w-1.5 bg-primary-500 rounded-full animate-pulse"
                        style={{ height: "70%", animationDelay: "150ms" }}
                      />
                      <div
                        className="w-1.5 bg-primary-500 rounded-full animate-pulse"
                        style={{ height: "100%", animationDelay: "300ms" }}
                      />
                      <div
                        className="w-1.5 bg-primary-500 rounded-full animate-pulse"
                        style={{ height: "60%", animationDelay: "450ms" }}
                      />
                      <div
                        className="w-1.5 bg-primary-500 rounded-full animate-pulse"
                        style={{ height: "30%", animationDelay: "600ms" }}
                      />
                    </div>
                  </div>
                </div>
                <div className="absolute inset-0 rounded-full border-4 border-primary-600/30 animate-ping" />
              </div>
            </div>

            <h2 className="text-2xl font-bold text-white mb-2">
              Sherik qidirilmoqda...
            </h2>
            <p className="text-slate-400 mb-1">
              Rejim:{" "}
              <span className="text-primary-400 capitalize">
                {queueStatus.mode === "roulette"
                  ? "Ruletka"
                  : "Daraja bo'yicha"}
              </span>
            </p>
            <p className="text-slate-400 mb-1">
              Online: <span className="text-emerald-400">{onlineCount} ta</span>
            </p>
            <p className="text-slate-400 mb-6">
              Kutish vaqti:{" "}
              <span className="text-white font-mono">{waitTime} soniya</span>
            </p>

            <button onClick={handleLeaveQueue} className="btn btn-danger">
              Bekor qilish
            </button>
          </div>
        ) : (
          // Mode selection
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Roulette Mode */}
            <div
              className={`card cursor-pointer transition-all ${selectedMode === "roulette"
                  ? "ring-2 ring-primary-500 bg-primary-600/10"
                  : "hover:bg-slate-700/50"
                }`}
              onClick={() => setSelectedMode("roulette")}
            >
              <div className="text-4xl mb-4">🎲</div>
              <h3 className="text-xl font-semibold text-white mb-2">
                Ruletka rejimi
              </h3>
              <p className="text-slate-400 text-sm mb-4">
                Tasodifiy sherik bilan bog'laning. Yangi odamlar bilan tanishing
                va speaking mashq qiling!
              </p>
              <ul className="text-sm text-slate-400 space-y-1">
                <li>• Har 20 soniyada juftlash</li>
                <li>• Turli darajadagi foydalanuvchilar</li>
                <li>• Tez va oson</li>
              </ul>
            </div>

            {/* Level Filter Mode */}
            <div
              className={`card cursor-pointer transition-all ${selectedMode === "level_filter"
                  ? "ring-2 ring-primary-500 bg-primary-600/10"
                  : "hover:bg-slate-700/50"
                }`}
              onClick={() => setSelectedMode("level_filter")}
            >
              <div className="text-4xl mb-4">🎯</div>
              <h3 className="text-xl font-semibold text-white mb-2">
                Daraja bo'yicha
              </h3>
              <p className="text-slate-400 text-sm mb-4">
                O'zingizga yaqin darajadagi sherik bilan mashq qiling. Maqsadli
                va samarali!
              </p>

              {selectedMode === "level_filter" && (
                <div className="mt-4 p-4 bg-slate-900/50 rounded-lg">
                  <label className="label">Maqsad daraja</label>
                  <select
                    value={levelFilter}
                    onChange={(e) => setLevelFilter(parseFloat(e.target.value))}
                    className="input"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {levelOptions.map((level) => (
                      <option key={level} value={level}>
                        {formatLevel(level)}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500 mt-2">
                    ±0.5 daraja oralig'idagi foydalanuvchilar bilan juftlashasiz
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Start Button */}
        {!queueStatus?.in_queue && (
          <div className="mt-8 text-center">
            <button
              onClick={handleJoinQueue}
              disabled={!isConnected}
              className="btn btn-primary text-lg px-12 py-4"
            >
              {selectedMode === "roulette"
                ? "🎲 Ruletka boshlash"
                : "🎯 Sherik topish"}
            </button>
            {!isConnected && (
              <p className="text-red-400 text-sm mt-2">Serverga ulanmoqda...</p>
            )}
          </div>
        )}

        {/* Features Info */}
        <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="card bg-slate-800/30 text-center p-6">
            <div className="text-3xl mb-3">🎤</div>
            <h4 className="text-white font-semibold mb-2">Ovozli qo'ng'iroq</h4>
            <p className="text-slate-400 text-sm">
              Telegram kabi real-time ovozli aloqa. Kamera talab qilinmaydi!
            </p>
          </div>
          <div className="card bg-slate-800/30 text-center p-6">
            <div className="text-3xl mb-3">💬</div>
            <h4 className="text-white font-semibold mb-2">Matnli chat</h4>
            <p className="text-slate-400 text-sm">
              Gaplashish vaqtida yozishingiz ham mumkin. So'zlarni yozing!
            </p>
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-8 card bg-slate-800/30">
          <h3 className="text-lg font-semibold text-white mb-4">
            Qanday ishlaydi?
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="text-center p-4">
              <div className="text-2xl mb-2">1️⃣</div>
              <p className="text-slate-300 text-sm">Rejimni tanlang</p>
            </div>
            <div className="text-center p-4">
              <div className="text-2xl mb-2">2️⃣</div>
              <p className="text-slate-300 text-sm">Sherik kutib turing</p>
            </div>
            <div className="text-center p-4">
              <div className="text-2xl mb-2">3️⃣</div>
              <p className="text-slate-300 text-sm">Ovozli suhbat boshlang</p>
            </div>
            <div className="text-center p-4">
              <div className="text-2xl mb-2">4️⃣</div>
              <p className="text-slate-300 text-sm">Speaking mashq qiling!</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
