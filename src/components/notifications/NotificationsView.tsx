import React, { useState, useEffect } from "react";
import {
  Bell,
  CheckCircle,
  AlertTriangle,
  Pill,
  Calendar,
  Sparkles,
  HeartPulse,
  Activity,
  CheckCheck,
  ArrowRight,
  Filter,
} from "lucide-react";
import { NotificationItem, ViewTab } from "../../types/health.js";
import { useLanguage } from "../../context/LanguageContext.js";
import { useAuth } from "../../context/AuthContext.js";

interface NotificationsViewProps {
  onNavigateTab: (tab: ViewTab) => void;
}

export const NotificationsView: React.FC<NotificationsViewProps> = ({ onNavigateTab }) => {
  const { t, language } = useLanguage();
  const { activeProfileKey } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [filter, setFilter] = useState<"all" | "unread" | "medication" | "appointment" | "agent_action">("all");
  const [loading, setLoading] = useState<boolean>(true);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/notifications");
      const data = await res.json();
      setNotifications(data.notifications || []);
    } catch (e) {
      console.warn("Failed to load notifications:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [activeProfileKey]);

  const handleMarkRead = async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}/read`, { method: "POST" });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
    } catch (e) {
      console.error("Mark read error:", e);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await fetch("/api/notifications/mark-all-read", { method: "POST" });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch (e) {
      console.error("Mark all read error:", e);
    }
  };

  const filteredNotifications = notifications.filter((n) => {
    if (filter === "unread") return !n.isRead;
    if (filter === "all") return true;
    return n.category === filter;
  });

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "medication":
        return <Pill className="w-4 h-4 text-emerald-500" />;
      case "appointment":
        return <Calendar className="w-4 h-4 text-blue-500" />;
      case "agent_action":
        return <Activity className="w-4 h-4 text-[#16B8A6]" />;
      case "wellness":
        return <HeartPulse className="w-4 h-4 text-pink-500" />;
      default:
        return <Sparkles className="w-4 h-4 text-amber-500" />;
    }
  };

  const getActionTab = (category: string): ViewTab => {
    switch (category) {
      case "medication":
        return "medications";
      case "appointment":
        return "appointments";
      case "agent_action":
        return "insights";
      case "wellness":
        return "wellness";
      default:
        return "overview";
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12 animate-fade-in">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-[#101C31] via-[#172944] to-[#101C31] text-white border border-[#1B2D48] shadow-lg">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <div className="p-2 rounded-lg bg-[#16B8A6]/20 text-[#66E3D3]">
              <Bell className="w-5 h-5" />
            </div>
            <h1 className="text-xl md:text-2xl font-black tracking-tight">
              {language === "te" ? "నోటిఫికేషన్ సెంటర్" : language === "hi" ? "सूचना केंद्र" : "Health Notification Center"}
            </h1>
          </div>
          <p className="text-xs md:text-sm text-slate-300 max-w-2xl">
            {language === "te"
              ? "మందుల సమయాలు, అపాయింట్‌మెంట్ అలర్టులు మరియు AI విశ్లేషణల ముఖ్యమైన సమాచారం."
              : language === "hi"
              ? "दवाओं के समय, अपॉइंटमेंट अलर्ट और एआई सिफारिशों की महत्वपूर्ण सूचनाएं।"
              : "Real-time medication alerts, follow-up reminders, and AI clinical proposals."}
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all border border-white/20 whitespace-nowrap self-start md:self-auto"
          >
            <CheckCheck className="w-4 h-4 text-[#66E3D3]" />
            <span>Mark All as Read ({unreadCount})</span>
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <button
          onClick={() => setFilter("all")}
          className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
            filter === "all"
              ? "bg-[#16B8A6] text-white"
              : "bg-white dark:bg-[#101C31] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800"
          }`}
        >
          All ({notifications.length})
        </button>
        <button
          onClick={() => setFilter("unread")}
          className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
            filter === "unread"
              ? "bg-[#16B8A6] text-white"
              : "bg-white dark:bg-[#101C31] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800"
          }`}
        >
          Unread ({unreadCount})
        </button>
        <button
          onClick={() => setFilter("medication")}
          className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
            filter === "medication"
              ? "bg-[#16B8A6] text-white"
              : "bg-white dark:bg-[#101C31] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800"
          }`}
        >
          Medications
        </button>
        <button
          onClick={() => setFilter("appointment")}
          className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
            filter === "appointment"
              ? "bg-[#16B8A6] text-white"
              : "bg-white dark:bg-[#101C31] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800"
          }`}
        >
          Appointments
        </button>
        <button
          onClick={() => setFilter("agent_action")}
          className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
            filter === "agent_action"
              ? "bg-[#16B8A6] text-white"
              : "bg-white dark:bg-[#101C31] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800"
          }`}
        >
          AI Recommendations
        </button>
      </div>

      {/* Notifications List */}
      {loading ? (
        <div className="p-8 text-center text-slate-400 text-xs">Loading notifications...</div>
      ) : filteredNotifications.length === 0 ? (
        <div className="p-8 rounded-2xl bg-white dark:bg-[#101C31] border border-slate-200 dark:border-slate-800 text-center space-y-2">
          <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto" />
          <div className="text-sm font-bold text-slate-700 dark:text-slate-300">
            No notifications in this filter!
          </div>
          <p className="text-xs text-slate-500">You are all caught up on your health alerts.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredNotifications.map((notif) => {
            const isWarning = notif.severity === "warning" || notif.severity === "urgent";

            return (
              <div
                key={notif.id}
                className={`p-4 rounded-xl border transition-all flex items-start justify-between gap-4 ${
                  !notif.isRead
                    ? "bg-white dark:bg-[#101C31] border-[#16B8A6]/40 shadow-xs ring-1 ring-[#16B8A6]/10"
                    : "bg-slate-50/60 dark:bg-[#172944]/30 border-slate-200 dark:border-slate-800 opacity-75"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                      isWarning
                        ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                        : "bg-slate-100 dark:bg-slate-800"
                    }`}
                  >
                    {getCategoryIcon(notif.category)}
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3
                        className={`text-xs font-extrabold ${
                          !notif.isRead ? "text-slate-900 dark:text-white" : "text-slate-600 dark:text-slate-300"
                        }`}
                      >
                        {notif.title}
                      </h3>
                      {!notif.isRead && (
                        <span className="w-2 h-2 rounded-full bg-[#16B8A6]"></span>
                      )}
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                      {notif.message}
                    </p>

                    <div className="text-[10px] text-slate-400 font-mono pt-1">
                      {new Date(notif.timestamp).toLocaleString()}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-center">
                  <button
                    onClick={() => {
                      handleMarkRead(notif.id);
                      onNavigateTab(getActionTab(notif.category));
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#16B8A6]/10 hover:bg-[#16B8A6]/20 text-[#16B8A6] text-xs font-bold transition-colors"
                  >
                    <span>View</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>

                  {!notif.isRead && (
                    <button
                      onClick={() => handleMarkRead(notif.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-semibold"
                      title="Mark as read"
                    >
                      <CheckCircle className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
