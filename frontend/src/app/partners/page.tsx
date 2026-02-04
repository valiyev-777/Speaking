"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { api, Partner, PartnerRequest, UserSearchResult } from "@/lib/api";
import { formatLevel } from "@/lib/utils";
import { wsManager } from "@/lib/websocket";
import { WSMessage } from "@/types";

export default function PartnersPage() {
  const router = useRouter();
  const { isAuthenticated, _hasHydrated } = useStore();

  const [tab, setTab] = useState<"partners" | "search" | "requests">(
    "partners"
  );
  const [partners, setPartners] = useState<Partner[]>([]);
  const [requests, setRequests] = useState<PartnerRequest[]>([]);
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [inviteSending, setInviteSending] = useState<string | null>(null);

  // Auth check
  useEffect(() => {
    if (_hasHydrated && !isAuthenticated) {
      router.push("/login");
    }
  }, [_hasHydrated, isAuthenticated, router]);

  // Fallback: if store does not hydrate (e.g. after refresh), treat as ready after 1.5s
  useEffect(() => {
    const timer = setTimeout(() => {
      useStore.setState({ _hasHydrated: true });
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  // Load data
  useEffect(() => {
    if (isAuthenticated) {
      loadPartners();
      loadRequests();
    }
  }, [isAuthenticated]);

  // Listen for WebSocket messages
  useEffect(() => {
    const handleMessage = (msg: WSMessage) => {
      if (msg.type === "invite_sent") {
        setMessage("Taklif yuborildi! Javob kutilmoqda...");
        setInviteSending(null);
        setTimeout(() => setMessage(""), 3000);
      } else if (msg.type === "invite_error") {
        setMessage(msg.message || "Taklif yuborishda xatolik");
        setInviteSending(null);
        setTimeout(() => setMessage(""), 3000);
      } else if (msg.type === "invite_rejected") {
        setMessage("Taklif rad etildi");
        setTimeout(() => setMessage(""), 3000);
      } else if (msg.type === "matched" && msg.data) {
        // Invited partner accepted: set match in store then go to dashboard (useWebSocket is not mounted on this page)
        useStore.getState().setCurrentMatch(msg.data);
        useStore.getState().setQueueStatus(null);
        useStore.getState().setIsInSession(true);
        router.push("/dashboard");
      }
    };

    wsManager.addMessageHandler(handleMessage);
    return () => wsManager.removeMessageHandler(handleMessage);
  }, [router]);

  const handleInvite = (partnerUserId: string) => {
    setInviteSending(partnerUserId);
    wsManager.invitePartner(partnerUserId);
  };

  const loadPartners = async () => {
    try {
      const data = await api.getPartners();
      setPartners(data);
    } catch (err) {
      console.error("Failed to load partners:", err);
    }
  };

  const loadRequests = async () => {
    try {
      const data = await api.getIncomingRequests();
      setRequests(data);
    } catch (err) {
      console.error("Failed to load requests:", err);
    }
  };

  const handleSearch = async () => {
    if (searchQuery.length < 2) return;
    setLoading(true);
    try {
      const results = await api.searchUsers(searchQuery);
      setSearchResults(results);
    } catch (err) {
      console.error("Search failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSendRequest = async (userId: string) => {
    try {
      await api.sendPartnerRequest(userId);
      setMessage("So'rov yuborildi!");
      handleSearch(); // Refresh results
      setTimeout(() => setMessage(""), 3000);
    } catch (err: any) {
      setMessage(err.message || "Xatolik yuz berdi");
      setTimeout(() => setMessage(""), 3000);
    }
  };

  const handleAcceptRequest = async (requestId: string) => {
    try {
      await api.acceptRequest(requestId);
      setMessage("Sherik qo'shildi!");
      loadRequests();
      loadPartners();
      setTimeout(() => setMessage(""), 3000);
    } catch (err: any) {
      setMessage(err.message || "Xatolik yuz berdi");
      setTimeout(() => setMessage(""), 3000);
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    try {
      await api.rejectRequest(requestId);
      loadRequests();
    } catch (err) {
      console.error("Reject failed:", err);
    }
  };

  const handleRemovePartner = async (userId: string) => {
    if (!confirm("Sherikni o'chirishni xohlaysizmi?")) return;
    try {
      await api.removePartner(userId);
      loadPartners();
    } catch (err) {
      console.error("Remove failed:", err);
    }
  };

  if (!_hasHydrated || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <header className="bg-slate-800 px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => router.push("/dashboard")}
          className="text-slate-400"
        >
          ← Orqaga
        </button>
        <h1 className="text-lg font-semibold">Sheriklar</h1>
        <div className="w-16" />
      </header>

      {/* Message */}
      {message && (
        <div className="mx-4 mt-4 p-3 bg-violet-600 rounded-lg text-center text-sm">
          {message}
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-700">
        <button
          onClick={() => setTab("partners")}
          className={`flex-1 py-3 text-sm font-medium ${
            tab === "partners"
              ? "text-violet-400 border-b-2 border-violet-400"
              : "text-slate-400"
          }`}
        >
          Sheriklar ({partners.length})
        </button>
        <button
          onClick={() => setTab("search")}
          className={`flex-1 py-3 text-sm font-medium ${
            tab === "search"
              ? "text-violet-400 border-b-2 border-violet-400"
              : "text-slate-400"
          }`}
        >
          Qidirish
        </button>
        <button
          onClick={() => setTab("requests")}
          className={`flex-1 py-3 text-sm font-medium relative ${
            tab === "requests"
              ? "text-violet-400 border-b-2 border-violet-400"
              : "text-slate-400"
          }`}
        >
          So'rovlar
          {requests.length > 0 && (
            <span className="absolute top-2 right-4 w-5 h-5 bg-red-500 rounded-full text-xs flex items-center justify-center">
              {requests.length}
            </span>
          )}
        </button>
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Partners Tab */}
        {tab === "partners" && (
          <div className="space-y-3">
            {partners.length === 0 ? (
              <p className="text-center text-slate-400 py-8">
                Hali sheriklar yo'q. Qidiruv orqali sherik toping!
              </p>
            ) : (
              partners.map((partner) => (
                <div
                  key={partner.id}
                  className="bg-slate-800 rounded-xl p-4 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${
                        partner.is_online ? "bg-green-600" : "bg-slate-600"
                      }`}
                    >
                      {partner.username[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium">{partner.username}</p>
                      <p className="text-xs text-slate-400">
                        {formatLevel(partner.current_level)} •
                        {partner.is_online ? (
                          <span className="text-green-400"> Online</span>
                        ) : (
                          <span> Offline</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {partner.is_online && (
                      <button
                        onClick={() => handleInvite(partner.user_id)}
                        disabled={inviteSending === partner.user_id}
                        className="px-3 py-1.5 bg-violet-600 rounded-lg text-sm disabled:bg-violet-800"
                      >
                        {inviteSending === partner.user_id
                          ? "..."
                          : "Chaqirish"}
                      </button>
                    )}
                    <button
                      onClick={() => handleRemovePartner(partner.user_id)}
                      className="px-3 py-1.5 bg-slate-700 rounded-lg text-sm text-red-400"
                    >
                      O'chirish
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Search Tab */}
        {tab === "search" && (
          <div>
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Username kiriting..."
                className="flex-1 bg-slate-800 text-white px-4 py-2.5 rounded-lg outline-none"
                style={{ fontSize: "16px" }}
              />
              <button
                onClick={handleSearch}
                disabled={loading || searchQuery.length < 2}
                className="px-4 py-2.5 bg-violet-600 rounded-lg disabled:bg-slate-600"
              >
                {loading ? "..." : "Qidirish"}
              </button>
            </div>

            <div className="space-y-3">
              {searchResults.map((user) => (
                <div
                  key={user.id}
                  className="bg-slate-800 rounded-xl p-4 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${
                        user.is_online ? "bg-green-600" : "bg-slate-600"
                      }`}
                    >
                      {user.username[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium">{user.username}</p>
                      <p className="text-xs text-slate-400">
                        {formatLevel(user.current_level)} •
                        {user.is_online ? (
                          <span className="text-green-400"> Online</span>
                        ) : (
                          <span> Offline</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div>
                    {user.is_partner ? (
                      <span className="text-green-400 text-sm">✓ Sherik</span>
                    ) : user.has_pending_request ? (
                      <span className="text-yellow-400 text-sm">
                        Kutilmoqda...
                      </span>
                    ) : (
                      <button
                        onClick={() => handleSendRequest(user.id)}
                        className="px-3 py-1.5 bg-violet-600 rounded-lg text-sm"
                      >
                        + Sherik bo'laylik
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {searchResults.length === 0 &&
                searchQuery.length >= 2 &&
                !loading && (
                  <p className="text-center text-slate-400 py-8">
                    Hech kim topilmadi
                  </p>
                )}
            </div>
          </div>
        )}

        {/* Requests Tab */}
        {tab === "requests" && (
          <div className="space-y-3">
            {requests.length === 0 ? (
              <p className="text-center text-slate-400 py-8">
                Yangi so'rovlar yo'q
              </p>
            ) : (
              requests.map((req) => (
                <div key={req.id} className="bg-slate-800 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-violet-600 flex items-center justify-center text-white font-bold">
                        {req.from_username[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium">{req.from_username}</p>
                        <p className="text-xs text-slate-400">
                          {formatLevel(req.from_level)}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAcceptRequest(req.id)}
                      className="flex-1 py-2 bg-green-600 rounded-lg text-sm font-medium"
                    >
                      ✓ Qabul qilish
                    </button>
                    <button
                      onClick={() => handleRejectRequest(req.id)}
                      className="flex-1 py-2 bg-slate-700 rounded-lg text-sm"
                    >
                      ✗ Rad etish
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
