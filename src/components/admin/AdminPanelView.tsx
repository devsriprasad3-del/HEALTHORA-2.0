import React, { useState, useEffect } from "react";
import {
  Database,
  Users,
  Activity,
  FileText,
  FlaskConical,
  Pill,
  Calendar,
  BookOpen,
  Brain,
  RefreshCw,
  Download,
  ExternalLink,
  Copy,
  Check,
  Search,
  CheckCircle2,
  AlertTriangle,
  Globe,
  Monitor,
  Smartphone,
  Clock,
  UserCheck,
  Droplets,
  Moon,
  Utensils,
  Smile,
  ArrowRight,
  History,
  Sparkles,
} from "lucide-react";
import { ViewTab } from "../../types/health.js";
import { useAuth } from "../../context/AuthContext.js";
import {
  getOrCreateVisitorId,
  getOrCreateSessionId,
  getUsedProfilesHistory,
} from "../../lib/supabaseClient.js";

interface AdminPanelViewProps {
  onNavigateTab: (tab: ViewTab) => void;
}

type AdminSubTab =
  | "visitors"
  | "users"
  | "documents_labs"
  | "tracking_clinical"
  | "ai_logs"
  | "supabase_setup";

type UsageScope = "current_and_previous" | "current_only" | "previous_only" | "all_app_data";

export const AdminPanelView: React.FC<AdminPanelViewProps> = ({ onNavigateTab }) => {
  const { user, switchProfile, activeProfileKey } = useAuth();

  const [usageScope, setUsageScope] = useState<UsageScope>("current_and_previous");
  const [activeSubTab, setActiveSubTab] = useState<AdminSubTab>("visitors");
  const [adminData, setAdminData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [syncingSupabase, setSyncingSupabase] = useState<boolean>(false);
  const [simulatingVisit, setSimulatingVisit] = useState<boolean>(false);
  const [migrationSql, setMigrationSql] = useState<string>("");
  const [copiedSql, setCopiedSql] = useState<boolean>(false);
  const [toast, setToast] = useState<string | null>(null);

  // Filters for Visitors Tab
  const [visitorViewMode, setVisitorViewMode] = useState<"all_visits" | "unique_visitors" | "supabase_cloud">("all_visits");
  const [visitorSearch, setVisitorSearch] = useState<string>("");
  const [deviceFilter, setDeviceFilter] = useState<string>("ALL");

  // Filters for Tracking & Clinical Tab
  const [clinicalCategory, setClinicalCategory] = useState<
    "sleep" | "water" | "meals" | "activity" | "mood" | "journals" | "medications" | "appointments"
  >("sleep");

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const fetchAdminOverview = async (overrideScope?: UsageScope) => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const scopeToUse = overrideScope || usageScope;
      const visitorId = getOrCreateVisitorId();
      const sessionId = getOrCreateSessionId();
      const history = getUsedProfilesHistory();
      const currentKey = activeProfileKey || history.currentProfileKey || "rajesh";
      const prevKeys = history.previousProfileKeys.filter((k) => k !== currentKey);

      const params = new URLSearchParams({
        visitorId,
        sessionId,
        currentProfileKey: currentKey,
        previousProfileKeys: prevKeys.join(","),
        scope: scopeToUse,
      });

      const res = await fetch(`/api/admin/overview?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setAdminData(data);
      } else {
        setErrorMsg(data.error || "Could not load Admin Panel data.");
      }
    } catch (err: any) {
      console.error("Failed to fetch admin overview:", err);
      setErrorMsg(err?.message || "Network error while loading Admin Panel.");
    } finally {
      setLoading(false);
    }
  };

  const fetchMigrationSql = async () => {
    try {
      const res = await fetch("/api/supabase/migration-sql");
      const data = await res.json();
      if (data.sql) {
        setMigrationSql(data.sql);
      }
    } catch (err) {
      console.warn("Could not fetch migration SQL:", err);
    }
  };

  useEffect(() => {
    fetchAdminOverview(usageScope);
  }, [activeProfileKey, usageScope]);

  useEffect(() => {
    fetchMigrationSql();
  }, []);

  const handleSyncToSupabase = async () => {
    try {
      setSyncingSupabase(true);
      const visitorId = getOrCreateVisitorId();
      const sessionId = getOrCreateSessionId();
      const history = getUsedProfilesHistory();

      const res = await fetch("/api/admin/sync-supabase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visitorId,
          sessionId,
          currentProfileKey: activeProfileKey || history.currentProfileKey,
          previousProfileKeys: history.previousProfileKeys,
        }),
      });
      const data = await res.json();
      if (data.error) {
        showToast(`Supabase Note: ${data.error}`);
      } else {
        showToast(
          `Synced ${data.syncedVisitsCount || 0} of your visit logs & ${data.syncedVisitorsCount || 0} visitor records to Supabase!`
        );
      }
      await fetchAdminOverview();
    } catch (e) {
      showToast("Failed to sync with Supabase");
    } finally {
      setSyncingSupabase(false);
    }
  };

  const handleSimulateVisitor = async () => {
    try {
      setSimulatingVisit(true);
      const visitorId = getOrCreateVisitorId();
      const sessionId = getOrCreateSessionId();

      const res = await fetch("/api/visitor/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visitorId,
          sessionId,
          pagePath: "/admin",
          pageTitle: "Healthora — Admin Panel",
          deviceType: /mobile/i.test(navigator.userAgent) ? "Mobile" : "Desktop",
          browser: navigator.userAgent.includes("Chrome") ? "Chrome" : "Browser",
          os: navigator.userAgent.includes("Win")
            ? "Windows"
            : navigator.userAgent.includes("Mac")
            ? "macOS"
            : "OS",
          screenResolution: `${window.innerWidth}x${window.innerHeight}`,
          userId: activeProfileKey,
          userName: user?.name || activeProfileKey,
          metadata: { source: "Current User Admin Check-In" },
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(
          data.syncedToSupabase
            ? "Your current visit was logged & synced to Supabase PostgreSQL!"
            : "Your current visit was logged in the Admin Panel!"
        );
        await fetchAdminOverview();
      }
    } catch (e) {
      showToast("Failed to record visit");
    } finally {
      setSimulatingVisit(false);
    }
  };

  const handleExportMasterJson = () => {
    if (!adminData?.masterData) return;
    const jsonStr = JSON.stringify(adminData, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `healthora-my-admin-data-${activeProfileKey}-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Your Current & Previous Admin Data exported as JSON!");
  };

  const handleCopySql = () => {
    if (!migrationSql) return;
    navigator.clipboard.writeText(migrationSql);
    setCopiedSql(true);
    showToast("Supabase SQL Schema copied to clipboard!");
    setTimeout(() => setCopiedSql(false), 3000);
  };

  const renderUsageBadge = (status?: "current" | "previous") => {
    if (status === "previous") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-300/60 dark:border-amber-800">
          <History className="w-2.5 h-2.5" />
          Previous
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-300/60 dark:border-emerald-800">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        Current
      </span>
    );
  };

  const master = adminData?.masterData || {};
  const usageBreakdown = master.usageBreakdown || {
    currentProfileKey: activeProfileKey,
    previousProfileKeys: [],
    currentVisitsCount: 0,
    previousVisitsCount: 0,
    currentProfilesCount: 1,
    previousProfilesCount: 0,
  };
  const metrics = master.summaryMetrics || {
    totalSiteVisits: 0,
    uniqueVisitorsCount: 0,
    visitsToday: 0,
    totalUsers: 0,
    personalAccountsCount: 0,
    totalDocuments: 0,
    totalLabs: 0,
    totalMedications: 0,
    totalTrackingEntries: 0,
    totalJournals: 0,
    totalAppointments: 0,
    totalReminders: 0,
    totalAIConversations: 0,
    totalAIMessages: 0,
  };

  const allVisits: any[] = master.visitors?.allVisits || [];
  const uniqueVisitors: any[] = master.visitors?.uniqueVisitorsDirectory || [];
  const supabaseVisits: any[] = adminData?.supabase?.supabaseSiteVisits || [];
  const allUsers: any[] = master.users || [];
  const allDocuments: any[] = master.documents || [];
  const allLabs: any[] = master.labs || [];
  const allMedications: any[] = master.medications || [];
  const allJournals: any[] = master.journals || [];
  const allAppointments: any[] = master.appointments || [];
  const allMessages: any[] = master.ai?.messages || [];

  const filteredVisits = allVisits.filter((v) => {
    const matchesDevice =
      deviceFilter === "ALL" || (v.deviceType || "").toLowerCase() === deviceFilter.toLowerCase();
    const q = visitorSearch.trim().toLowerCase();
    const matchesSearch =
      !q ||
      (v.visitorId || "").toLowerCase().includes(q) ||
      (v.userName || "").toLowerCase().includes(q) ||
      (v.pagePath || "").toLowerCase().includes(q) ||
      (v.browser || "").toLowerCase().includes(q) ||
      (v.os || "").toLowerCase().includes(q);
    return matchesDevice && matchesSearch;
  });

  const filteredUniqueVisitors = uniqueVisitors.filter((v) => {
    const matchesDevice =
      deviceFilter === "ALL" || (v.deviceType || "").toLowerCase() === deviceFilter.toLowerCase();
    const q = visitorSearch.trim().toLowerCase();
    const matchesSearch =
      !q ||
      (v.visitorId || "").toLowerCase().includes(q) ||
      (v.userName || "").toLowerCase().includes(q) ||
      (v.lastPagePath || "").toLowerCase().includes(q) ||
      (v.browser || "").toLowerCase().includes(q) ||
      (v.os || "").toLowerCase().includes(q);
    return matchesDevice && matchesSearch;
  });

  const profileHistoryEntries = getUsedProfilesHistory().entries;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-14 animate-fade-in">
      {toast && (
        <div className="fixed top-4 right-4 z-50 px-4 py-2.5 rounded-xl bg-[#101C31] text-[#66E3D3] border border-[#16B8A6] text-xs font-bold shadow-2xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#16B8A6]" />
          <span>{toast}</span>
        </div>
      )}

      {/* 1. ADMIN PANEL HERO BANNER (SCOPED TO ACTIVE USER'S CURRENT & PREVIOUS DATA) */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#0F172A] via-[#101C31] to-[#132A4A] text-white p-6 sm:p-8 shadow-xl border border-[#1B2D48]">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-72 h-72 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <Database className="w-3.5 h-3.5" />
                Personal Admin Panel (Current &amp; Previous Usage)
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-[#16B8A6]/20 text-[#66E3D3] border border-[#16B8A6]/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Active User: {user?.name || activeProfileKey}
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono text-slate-300 bg-white/10 border border-white/15">
                Supabase: {adminData?.supabase?.projectId || "eltheprswohoxxhxxtdl"}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Admin Panel — Your Current &amp; Previous Website Data
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-slate-300 max-w-3xl leading-relaxed">
              Shows exclusively the data belonging to you — your <strong>current active session &amp; profile ({user?.name || activeProfileKey})</strong> and any <strong>previous sessions or profiles</strong> you have used on this website. Unused profiles are excluded.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              onClick={handleSimulateVisitor}
              disabled={simulatingVisit}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-all shadow-md cursor-pointer"
            >
              <Users className="w-3.5 h-3.5" />
              <span>{simulatingVisit ? "Recording..." : "Log My Current Visit"}</span>
            </button>

            <button
              onClick={handleSyncToSupabase}
              disabled={syncingSupabase}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-[#16B8A6] hover:bg-[#66E3D3] text-[#101C31] font-bold text-xs transition-all shadow-md cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncingSupabase ? "animate-spin" : ""}`} />
              <span>{syncingSupabase ? "Syncing..." : "Sync My Data to Supabase"}</span>
            </button>

            <button
              onClick={handleExportMasterJson}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/15 font-bold text-xs transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export My Data (JSON)</span>
            </button>

            <button
              onClick={() => fetchAdminOverview()}
              disabled={loading}
              className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/15 transition-all cursor-pointer"
              title="Refresh My Admin Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* CURRENT VS. PREVIOUS FILTER BAR & SESSION IDENTITY */}
        <div className="relative z-10 mt-6 pt-5 border-t border-white/10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className="text-slate-400 font-bold uppercase tracking-wider text-[11px]">
              Data Scope Filter:
            </span>
            <div className="inline-flex flex-wrap items-center p-1 rounded-xl bg-[#0B132B]/90 border border-white/15 gap-1">
              <button
                onClick={() => setUsageScope("current_and_previous")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  usageScope === "current_and_previous"
                    ? "bg-[#16B8A6] text-[#101C31] shadow-xs"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                Current + Previous ({usageBreakdown.currentVisitsCount + usageBreakdown.previousVisitsCount} visits)
              </button>
              <button
                onClick={() => setUsageScope("current_only")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  usageScope === "current_only"
                    ? "bg-emerald-500 text-slate-950 shadow-xs"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-300" />
                <span>Current Only ({usageBreakdown.currentVisitsCount})</span>
              </button>
              <button
                onClick={() => setUsageScope("previous_only")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  usageScope === "previous_only"
                    ? "bg-amber-400 text-slate-950 shadow-xs"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                <History className="w-3 h-3" />
                <span>Previous Only ({usageBreakdown.previousVisitsCount})</span>
              </button>
              <button
                onClick={() => setUsageScope("all_app_data")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  usageScope === "all_app_data"
                    ? "bg-indigo-500 text-white shadow-xs"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                <Database className="w-3 h-3" />
                <span>All App Data</span>
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
            <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
              Current Profile: <strong>{user?.name || activeProfileKey}</strong> ({activeProfileKey})
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300">
              Previous Profiles:{" "}
              <strong>
                {usageBreakdown.previousProfileKeys?.length > 0
                  ? usageBreakdown.previousProfileKeys.join(", ")
                  : "priya"}
              </strong>
            </span>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-center justify-between gap-4 text-xs text-rose-700 dark:text-rose-300">
          <div className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button
            onClick={() => fetchAdminOverview()}
            className="px-3 py-1.5 rounded-lg bg-rose-600 text-white font-bold hover:bg-rose-500 transition-colors shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* 2. MASTER KPI SUMMARY CARDS (SCOPED TO YOUR CURRENT / PREVIOUS SELECTION) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        <div
          onClick={() => setActiveSubTab("visitors")}
          className="p-3.5 rounded-2xl bg-white dark:bg-[#101C31] border border-[#E4EAF1] dark:border-[#1B2D48] shadow-xs cursor-pointer hover:border-[#16B8A6] transition-all"
        >
          <div className="flex items-center justify-between text-indigo-500 mb-1">
            <Globe className="w-4 h-4" />
            <span className="text-[10px] font-bold uppercase">My Visits</span>
          </div>
          <div className="text-xl font-black text-[#142238] dark:text-white tabular-nums">
            {metrics.totalSiteVisits}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            {usageBreakdown.currentVisitsCount} cur • {usageBreakdown.previousVisitsCount} prev
          </div>
        </div>

        <div
          onClick={() => {
            setActiveSubTab("visitors");
            setVisitorViewMode("unique_visitors");
          }}
          className="p-3.5 rounded-2xl bg-white dark:bg-[#101C31] border border-[#E4EAF1] dark:border-[#1B2D48] shadow-xs cursor-pointer hover:border-[#16B8A6] transition-all"
        >
          <div className="flex items-center justify-between text-emerald-500 mb-1">
            <Clock className="w-4 h-4" />
            <span className="text-[10px] font-bold uppercase">Sessions</span>
          </div>
          <div className="text-xl font-black text-[#142238] dark:text-white tabular-nums">
            {metrics.uniqueVisitorsCount}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Browser sessions</div>
        </div>

        <div
          onClick={() => setActiveSubTab("users")}
          className="p-3.5 rounded-2xl bg-white dark:bg-[#101C31] border border-[#E4EAF1] dark:border-[#1B2D48] shadow-xs cursor-pointer hover:border-[#16B8A6] transition-all"
        >
          <div className="flex items-center justify-between text-teal-500 mb-1">
            <UserCheck className="w-4 h-4" />
            <span className="text-[10px] font-bold uppercase">My Profiles</span>
          </div>
          <div className="text-xl font-black text-[#142238] dark:text-white tabular-nums">
            {metrics.totalUsers}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            1 cur • {usageBreakdown.previousProfilesCount} prev
          </div>
        </div>

        <div
          onClick={() => setActiveSubTab("documents_labs")}
          className="p-3.5 rounded-2xl bg-white dark:bg-[#101C31] border border-[#E4EAF1] dark:border-[#1B2D48] shadow-xs cursor-pointer hover:border-[#16B8A6] transition-all"
        >
          <div className="flex items-center justify-between text-blue-500 mb-1">
            <FileText className="w-4 h-4" />
            <span className="text-[10px] font-bold uppercase">Reports</span>
          </div>
          <div className="text-xl font-black text-[#142238] dark:text-white tabular-nums">
            {metrics.totalDocuments}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">My documents</div>
        </div>

        <div
          onClick={() => setActiveSubTab("documents_labs")}
          className="p-3.5 rounded-2xl bg-white dark:bg-[#101C31] border border-[#E4EAF1] dark:border-[#1B2D48] shadow-xs cursor-pointer hover:border-[#16B8A6] transition-all"
        >
          <div className="flex items-center justify-between text-amber-500 mb-1">
            <FlaskConical className="w-4 h-4" />
            <span className="text-[10px] font-bold uppercase">Lab Tests</span>
          </div>
          <div className="text-xl font-black text-[#142238] dark:text-white tabular-nums">
            {metrics.totalLabs}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Biomarkers</div>
        </div>

        <div
          onClick={() => {
            setActiveSubTab("tracking_clinical");
            setClinicalCategory("medications");
          }}
          className="p-3.5 rounded-2xl bg-white dark:bg-[#101C31] border border-[#E4EAF1] dark:border-[#1B2D48] shadow-xs cursor-pointer hover:border-[#16B8A6] transition-all"
        >
          <div className="flex items-center justify-between text-rose-500 mb-1">
            <Pill className="w-4 h-4" />
            <span className="text-[10px] font-bold uppercase">Meds</span>
          </div>
          <div className="text-xl font-black text-[#142238] dark:text-white tabular-nums">
            {metrics.totalMedications}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Prescriptions</div>
        </div>

        <div
          onClick={() => {
            setActiveSubTab("tracking_clinical");
            setClinicalCategory("sleep");
          }}
          className="p-3.5 rounded-2xl bg-white dark:bg-[#101C31] border border-[#E4EAF1] dark:border-[#1B2D48] shadow-xs cursor-pointer hover:border-[#16B8A6] transition-all"
        >
          <div className="flex items-center justify-between text-purple-500 mb-1">
            <Activity className="w-4 h-4" />
            <span className="text-[10px] font-bold uppercase">Wellness</span>
          </div>
          <div className="text-xl font-black text-[#142238] dark:text-white tabular-nums">
            {metrics.totalTrackingEntries}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Daily logs</div>
        </div>

        <div
          onClick={() => setActiveSubTab("ai_logs")}
          className="p-3.5 rounded-2xl bg-white dark:bg-[#101C31] border border-[#E4EAF1] dark:border-[#1B2D48] shadow-xs cursor-pointer hover:border-[#16B8A6] transition-all"
        >
          <div className="flex items-center justify-between text-[#16B8A6] mb-1">
            <Brain className="w-4 h-4" />
            <span className="text-[10px] font-bold uppercase">AI Logs</span>
          </div>
          <div className="text-xl font-black text-[#142238] dark:text-white tabular-nums">
            {metrics.totalAIMessages}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            {metrics.totalAIConversations} threads
          </div>
        </div>
      </div>

      {/* 3. ADMIN PANEL NAVIGATION TABS */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {[
          {
            id: "visitors",
            label: `My Visits & Sessions (${metrics.totalSiteVisits})`,
            icon: Globe,
          },
          {
            id: "users",
            label: `My Current & Previous Profiles (${metrics.totalUsers})`,
            icon: Users,
          },
          {
            id: "documents_labs",
            label: `My Medical Reports & Labs (${metrics.totalDocuments + metrics.totalLabs})`,
            icon: FileText,
          },
          {
            id: "tracking_clinical",
            label: `My Tracking, Meds & Journals (${metrics.totalTrackingEntries + metrics.totalJournals})`,
            icon: Activity,
          },
          {
            id: "ai_logs",
            label: `My AI Bot Chats (${metrics.totalAIMessages})`,
            icon: Brain,
          },
          {
            id: "supabase_setup",
            label: "Supabase Cloud & SQL Setup",
            icon: Database,
          },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as AdminSubTab)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? "bg-[#16B8A6] text-[#101C31] shadow-md"
                  : "bg-white dark:bg-[#101C31] text-slate-600 dark:text-slate-300 border border-[#E4EAF1] dark:border-[#1B2D48] hover:bg-slate-50 dark:hover:bg-[#172944]"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* 4. TAB CONTENT PANELS */}
      <div className="bg-white dark:bg-[#101C31] rounded-2xl p-6 border border-[#E4EAF1] dark:border-[#1B2D48] shadow-sm">
        {/* ================= TAB 1: MY CURRENT & PREVIOUS WEBSITE VISITS ================= */}
        {activeSubTab === "visitors" && (
          <div className="space-y-5">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-extrabold text-[#142238] dark:text-white flex items-center gap-2">
                  <Globe className="w-4 h-4 text-[#16B8A6]" />
                  <span>Your Current &amp; Previous Website Visits</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Displays only your own current session and previous session visits (<code className="font-mono text-emerald-600 dark:text-emerald-400">{master.currentVisitorId}</code>).
                </p>
              </div>

              {/* View Mode Switcher */}
              <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-[#172944] border border-slate-200 dark:border-slate-800 self-start">
                <button
                  onClick={() => setVisitorViewMode("all_visits")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    visitorViewMode === "all_visits"
                      ? "bg-white dark:bg-[#101C31] text-[#16B8A6] shadow-xs"
                      : "text-slate-600 dark:text-slate-400"
                  }`}
                >
                  My Page Visits ({allVisits.length})
                </button>
                <button
                  onClick={() => setVisitorViewMode("unique_visitors")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    visitorViewMode === "unique_visitors"
                      ? "bg-white dark:bg-[#101C31] text-[#16B8A6] shadow-xs"
                      : "text-slate-600 dark:text-slate-400"
                  }`}
                >
                  My Sessions ({uniqueVisitors.length})
                </button>
                <button
                  onClick={() => setVisitorViewMode("supabase_cloud")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    visitorViewMode === "supabase_cloud"
                      ? "bg-white dark:bg-[#101C31] text-emerald-500 shadow-xs"
                      : "text-slate-600 dark:text-slate-400"
                  }`}
                >
                  Supabase Cloud ({supabaseVisits.length})
                </button>
              </div>
            </div>

            {/* Search & Device Filter Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={visitorSearch}
                  onChange={(e) => setVisitorSearch(e.target.value)}
                  placeholder="Filter your visits by page path, profile name, browser, or OS..."
                  className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-[#F5F7FB] dark:bg-[#172944] border border-[#E4EAF1] dark:border-[#1B2D48] text-[#142238] dark:text-white focus:outline-none focus:ring-1 focus:ring-[#16B8A6]"
                />
              </div>

              <div className="flex items-center gap-1.5 text-xs">
                {["ALL", "Desktop", "Mobile", "Tablet"].map((dev) => (
                  <button
                    key={dev}
                    onClick={() => setDeviceFilter(dev)}
                    className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                      deviceFilter === dev
                        ? "bg-[#16B8A6] text-[#101C31]"
                        : "bg-slate-100 dark:bg-[#172944] text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                    }`}
                  >
                    {dev}
                  </button>
                ))}
              </div>
            </div>

            {/* 1A: My Page Visits Table */}
            {visitorViewMode === "all_visits" && (
              <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-[#172944] text-[10px] font-bold uppercase text-slate-400 tracking-wider border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="px-4 py-3">Usage State</th>
                      <th className="px-4 py-3">Your Visitor &amp; Session ID</th>
                      <th className="px-4 py-3">Profile Used</th>
                      <th className="px-4 py-3">Page Visited</th>
                      <th className="px-4 py-3">Device, Browser &amp; OS</th>
                      <th className="px-4 py-3">Visited Time</th>
                      <th className="px-4 py-3">Database Sync</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-[11px]">
                    {filteredVisits.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-slate-400 font-sans">
                          No visits found in this scope ({usageScope}). Switch to "Current + Previous" or click "Log My Current Visit".
                        </td>
                      </tr>
                    ) : (
                      filteredVisits.map((v: any) => (
                        <tr
                          key={v.id}
                          className="hover:bg-slate-50/70 dark:hover:bg-[#172944]/40 transition-colors"
                        >
                          <td className="px-4 py-2.5 font-sans">
                            {renderUsageBadge(v.usageStatus)}
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="font-bold text-slate-800 dark:text-slate-200">
                              {v.visitorId}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {v.sessionId || "direct-session"}
                            </div>
                          </td>
                          <td className="px-4 py-2.5 font-sans">
                            <div className="font-bold text-slate-800 dark:text-white">
                              {v.userName || "Active User"}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              Profile: {v.userId || activeProfileKey}
                            </div>
                          </td>
                          <td className="px-4 py-2.5">
                            <span className="px-2 py-0.5 rounded-md bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 font-bold border border-teal-200/60 dark:border-teal-800">
                              {v.pagePath}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 font-sans">
                            <div className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-300">
                              {v.deviceType === "Mobile" ? (
                                <Smartphone className="w-3.5 h-3.5 text-indigo-500" />
                              ) : (
                                <Monitor className="w-3.5 h-3.5 text-teal-500" />
                              )}
                              <span>
                                {v.deviceType} • {v.browser} ({v.os})
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">
                            {new Date(v.visitedAt).toLocaleString([], {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                            })}
                          </td>
                          <td className="px-4 py-2.5 font-sans">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                v.syncedToSupabase
                                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                  : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  v.syncedToSupabase ? "bg-emerald-500" : "bg-blue-500"
                                }`}
                              />
                              {v.syncedToSupabase ? "Supabase Synced" : "Stored in Vault"}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* 1B: My Sessions Directory */}
            {visitorViewMode === "unique_visitors" && (
              <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-[#172944] text-[10px] font-bold uppercase text-slate-400 tracking-wider border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="px-4 py-3">State</th>
                      <th className="px-4 py-3">Session / Visitor ID</th>
                      <th className="px-4 py-3">Profile Used</th>
                      <th className="px-4 py-3">Page Views</th>
                      <th className="px-4 py-3">Pages Explored</th>
                      <th className="px-4 py-3">First Seen</th>
                      <th className="px-4 py-3">Last Active</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[11px]">
                    {filteredUniqueVisitors.map((u: any, idx: number) => (
                      <tr
                        key={`${u.sessionId}-${idx}`}
                        className="hover:bg-slate-50/70 dark:hover:bg-[#172944]/40 transition-colors"
                      >
                        <td className="px-4 py-3">{renderUsageBadge(u.usageStatus)}</td>
                        <td className="px-4 py-3 font-mono">
                          <div className="font-bold text-emerald-600 dark:text-emerald-400">
                            {u.sessionId}
                          </div>
                          <div className="text-[10px] text-slate-400">{u.visitorId}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-900 dark:text-white">
                            {u.userName}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">{u.userId}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-black font-mono">
                            {u.totalVisits} views
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {(u.pagesVisited || []).slice(0, 6).map((p: string) => (
                              <span
                                key={p}
                                className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-[10px] text-slate-700 dark:text-slate-300"
                              >
                                {p}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-500">
                          {new Date(u.firstSeenAt).toLocaleString([], {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-500">
                          {new Date(u.lastSeenAt).toLocaleString([], {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* 1C: Direct Supabase Cloud Table Rows for Current User */}
            {visitorViewMode === "supabase_cloud" && (
              <div className="space-y-3">
                {!adminData?.supabase?.siteVisitsTableReady ? (
                  <div className="p-5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="font-bold text-xs text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4" />
                        <span>Supabase Table Setup Needed (public.site_visits)</span>
                      </div>
                      <p className="text-xs text-amber-700 dark:text-amber-400">
                        Run the SQL migration script in your Supabase project (<code className="font-mono font-bold">eltheprswohoxxhxxtdl</code>) so your visits stream directly into cloud PostgreSQL.
                      </p>
                    </div>
                    <button
                      onClick={() => setActiveSubTab("supabase_setup")}
                      className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shrink-0 cursor-pointer"
                    >
                      Open SQL Setup Guide
                    </button>
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-emerald-50/60 dark:bg-emerald-950/30 text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-300 tracking-wider border-b border-slate-200 dark:border-slate-800">
                        <tr>
                          <th className="px-4 py-3">Supabase Row UUID</th>
                          <th className="px-4 py-3">Your Visitor ID</th>
                          <th className="px-4 py-3">User Name</th>
                          <th className="px-4 py-3">Page Path</th>
                          <th className="px-4 py-3">Device / Browser</th>
                          <th className="px-4 py-3">Visited At (PostgreSQL)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-[11px]">
                        {supabaseVisits.map((sv: any) => (
                          <tr key={sv.id}>
                            <td className="px-4 py-2.5 text-emerald-600 dark:text-emerald-400">
                              {String(sv.id).substring(0, 13)}...
                            </td>
                            <td className="px-4 py-2.5 font-bold">{sv.visitor_id}</td>
                            <td className="px-4 py-2.5 font-sans">{sv.user_name || "Visitor"}</td>
                            <td className="px-4 py-2.5">{sv.page_path}</td>
                            <td className="px-4 py-2.5 font-sans">
                              {sv.device_type} • {sv.browser} ({sv.os})
                            </td>
                            <td className="px-4 py-2.5">
                              {new Date(sv.visited_at).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 2: MY CURRENT & PREVIOUS PROFILES ================= */}
        {activeSubTab === "users" && (
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-extrabold text-[#142238] dark:text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-[#16B8A6]" />
                <span>Your Current &amp; Previously Used Profiles ({allUsers.length})</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Only profiles that you are currently using or have previously used in your browser sessions are shown here.
              </p>
            </div>

            {allUsers.length === 0 ? (
              <div className="p-8 rounded-xl bg-slate-50 dark:bg-[#172944]/40 border border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400">
                No previous profiles found yet because you have only used your current profile ({user?.name || activeProfileKey}). Switch profiles or sign in to a personal account to see previous profile history here.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {allUsers.map((u: any) => {
                  const isCurrent = u.usageStatus === "current";
                  const histEntry = profileHistoryEntries.find((e) => e.profileKey === u.profileKey);
                  return (
                    <div
                      key={u.profileKey}
                      className={`p-5 rounded-2xl border transition-all flex flex-col justify-between gap-4 ${
                        isCurrent
                          ? "bg-teal-50/40 dark:bg-teal-950/20 border-[#16B8A6]"
                          : "bg-amber-50/20 dark:bg-[#172944]/60 border-amber-200/80 dark:border-slate-800"
                      }`}
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              {renderUsageBadge(u.usageStatus)}
                              <h3 className="text-sm font-extrabold text-[#142238] dark:text-white">
                                {u.name}
                              </h3>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                {u.accountType}
                              </span>
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-1">
                              {u.email} • Profile Key: <span className="font-bold">{u.profileKey}</span>
                            </div>
                            {histEntry && (
                              <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                Last used: {new Date(histEntry.lastUsedAt).toLocaleString()}
                              </div>
                            )}
                          </div>

                          {u.bloodGroup && (
                            <span className="px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-300 font-extrabold text-xs border border-rose-200 dark:border-rose-800">
                              {u.bloodGroup}
                            </span>
                          )}
                        </div>

                        {/* Metadata */}
                        <div className="flex flex-wrap gap-1.5 text-[11px]">
                          {u.abhaNumber && (
                            <span className="px-2 py-0.5 rounded bg-white dark:bg-[#101C31] border border-slate-200 dark:border-slate-700 font-mono text-slate-600 dark:text-slate-300">
                              ABHA: {u.abhaNumber}
                            </span>
                          )}
                          {(u.chronicConditions || []).map((c: string) => (
                            <span
                              key={c}
                              className="px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 font-semibold"
                            >
                              {c}
                            </span>
                          ))}
                        </div>

                        {/* Data Counts Grid */}
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 pt-2">
                          <div className="p-2 rounded-xl bg-white dark:bg-[#101C31] border border-slate-200/70 dark:border-slate-800 text-center">
                            <div className="text-xs font-black text-[#142238] dark:text-white">
                              {u.counts?.documents || 0}
                            </div>
                            <div className="text-[9px] uppercase text-slate-400 font-bold">Docs</div>
                          </div>
                          <div className="p-2 rounded-xl bg-white dark:bg-[#101C31] border border-slate-200/70 dark:border-slate-800 text-center">
                            <div className="text-xs font-black text-[#142238] dark:text-white">
                              {u.counts?.labs || 0}
                            </div>
                            <div className="text-[9px] uppercase text-slate-400 font-bold">Labs</div>
                          </div>
                          <div className="p-2 rounded-xl bg-white dark:bg-[#101C31] border border-slate-200/70 dark:border-slate-800 text-center">
                            <div className="text-xs font-black text-[#142238] dark:text-white">
                              {u.counts?.medications || 0}
                            </div>
                            <div className="text-[9px] uppercase text-slate-400 font-bold">Meds</div>
                          </div>
                          <div className="p-2 rounded-xl bg-white dark:bg-[#101C31] border border-slate-200/70 dark:border-slate-800 text-center">
                            <div className="text-xs font-black text-[#142238] dark:text-white">
                              {u.counts?.trackingLogs || 0}
                            </div>
                            <div className="text-[9px] uppercase text-slate-400 font-bold">Logs</div>
                          </div>
                          <div className="p-2 rounded-xl bg-white dark:bg-[#101C31] border border-slate-200/70 dark:border-slate-800 text-center">
                            <div className="text-xs font-black text-[#142238] dark:text-white">
                              {u.counts?.journals || 0}
                            </div>
                            <div className="text-[9px] uppercase text-slate-400 font-bold">Notes</div>
                          </div>
                          <div className="p-2 rounded-xl bg-white dark:bg-[#101C31] border border-slate-200/70 dark:border-slate-800 text-center">
                            <div className="text-xs font-black text-[#142238] dark:text-white">
                              {u.counts?.conversations || 0}
                            </div>
                            <div className="text-[9px] uppercase text-slate-400 font-bold">Chats</div>
                          </div>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-slate-200/70 dark:border-slate-800 flex items-center justify-between">
                        <span className="text-[11px] text-slate-400">
                          Targets: {u.settings?.waterTargetMl || 2500}ml • {u.settings?.sleepTargetHours || 8}h sleep
                        </span>
                        <button
                          onClick={() => {
                            switchProfile(u.profileKey);
                            showToast(`Switched active profile to ${u.name}`);
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                            isCurrent
                              ? "bg-emerald-600 text-white"
                              : "bg-[#16B8A6] hover:bg-[#66E3D3] text-[#101C31]"
                          }`}
                        >
                          {isCurrent ? "Currently Active" : "Restore Previous Profile"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 3: MY UPLOADED MEDICAL DOCUMENTS & LAB RESULTS ================= */}
        {activeSubTab === "documents_labs" && (
          <div className="space-y-8">
            {/* Section A: My Medical Documents */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-extrabold text-[#142238] dark:text-white flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-500" />
                    <span>Your Medical Documents ({allDocuments.length})</span>
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Medical reports belonging to your current and previously used profiles.
                  </p>
                </div>
                <button
                  onClick={() => onNavigateTab("records")}
                  className="text-xs font-bold text-[#16B8A6] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span>Open Records Vault</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-[#172944] text-[10px] font-bold uppercase text-slate-400 tracking-wider border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="px-4 py-3">Usage State</th>
                      <th className="px-4 py-3">Document Title &amp; File</th>
                      <th className="px-4 py-3">Profile</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3">Facility &amp; Doctor</th>
                      <th className="px-4 py-3">Document Date</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[11px]">
                    {allDocuments.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                          No medical documents in this scope.
                        </td>
                      </tr>
                    ) : (
                      allDocuments.map((doc: any) => (
                        <tr key={`${doc.ownerKey}-${doc.id}`} className="hover:bg-slate-50/70 dark:hover:bg-[#172944]/40">
                          <td className="px-4 py-3">{renderUsageBadge(doc.usageStatus)}</td>
                          <td className="px-4 py-3">
                            <div className="font-bold text-slate-900 dark:text-white">{doc.title}</div>
                            <div className="text-[10px] font-mono text-slate-400">{doc.fileName}</div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 font-bold text-slate-700 dark:text-slate-300">
                              {doc.ownerName}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-semibold text-teal-600 dark:text-teal-400">
                            {doc.documentType}
                          </td>
                          <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                            <div>{doc.facility || "Clinical Facility"}</div>
                            <div className="text-[10px] text-slate-400">{doc.doctor || "Physician"}</div>
                          </td>
                          <td className="px-4 py-3 font-mono text-slate-500">{doc.documentDate}</td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                              {doc.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Section B: My Extracted Lab Observations */}
            <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-extrabold text-[#142238] dark:text-white flex items-center gap-2">
                    <FlaskConical className="w-4 h-4 text-amber-500" />
                    <span>Your Extracted Lab Biomarkers ({allLabs.length})</span>
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Laboratory results from your current and previously used profiles.
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl max-h-[420px]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-[#172944] text-[10px] font-bold uppercase text-slate-400 tracking-wider border-b border-slate-200 dark:border-slate-800 sticky top-0">
                    <tr>
                      <th className="px-4 py-3">State</th>
                      <th className="px-4 py-3">Test Name</th>
                      <th className="px-4 py-3">Profile</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3">Observed Value</th>
                      <th className="px-4 py-3">Reference Range</th>
                      <th className="px-4 py-3">Interpretation</th>
                      <th className="px-4 py-3">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[11px]">
                    {allLabs.map((lab: any, i: number) => (
                      <tr key={`${lab.ownerKey}-${lab.id}-${i}`} className="hover:bg-slate-50/70 dark:hover:bg-[#172944]/40">
                        <td className="px-4 py-2.5">{renderUsageBadge(lab.usageStatus)}</td>
                        <td className="px-4 py-2.5 font-bold text-slate-900 dark:text-white">
                          {lab.testName}
                        </td>
                        <td className="px-4 py-2.5 font-semibold text-slate-600 dark:text-slate-300">
                          {lab.ownerName}
                        </td>
                        <td className="px-4 py-2.5 text-slate-500">{lab.category}</td>
                        <td className="px-4 py-2.5 font-mono font-bold text-slate-900 dark:text-white">
                          {lab.valueText} {lab.unit}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-slate-500">
                          {lab.referenceRangeText}
                        </td>
                        <td className="px-4 py-2.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              lab.sourceInterpretation === "Within Normal Range"
                                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                                : "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
                            }`}
                          >
                            {lab.sourceInterpretation}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-slate-500">{lab.observedDate}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 4: MY DAILY TRACKING, JOURNALS, MEDS & APPOINTMENTS ================= */}
        {activeSubTab === "tracking_clinical" && (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-extrabold text-[#142238] dark:text-white flex items-center gap-2">
                  <Activity className="w-4 h-4 text-[#16B8A6]" />
                  <span>Your Current &amp; Previous Daily Tracking, Journals &amp; Clinical Logs</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  All wellness entries, journals, medications, and appointments from your current and previously used profiles.
                </p>
              </div>
            </div>

            {/* Category Selector Pills */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {[
                { id: "sleep", label: `Sleep Logs (${(master.tracking?.sleep || []).length})`, icon: Moon },
                { id: "water", label: `Water Logs (${(master.tracking?.water || []).length})`, icon: Droplets },
                { id: "meals", label: `Meals & Nutrition (${(master.tracking?.meals || []).length})`, icon: Utensils },
                { id: "activity", label: `Activity & Steps (${(master.tracking?.activity || []).length})`, icon: Activity },
                { id: "mood", label: `Mood Logs (${(master.tracking?.mood || []).length})`, icon: Smile },
                { id: "journals", label: `Health Journals (${allJournals.length})`, icon: BookOpen },
                { id: "medications", label: `Medications (${allMedications.length})`, icon: Pill },
                { id: "appointments", label: `Appointments (${allAppointments.length})`, icon: Calendar },
              ].map((cat) => {
                const Icon = cat.icon;
                const active = clinicalCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setClinicalCategory(cat.id as any)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      active
                        ? "bg-[#16B8A6] text-[#101C31] shadow-xs"
                        : "bg-slate-100 dark:bg-[#172944] text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{cat.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Category Tables */}
            <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
              {clinicalCategory === "sleep" && (
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-[#172944] text-[10px] font-bold uppercase text-slate-400 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="px-4 py-3">State</th>
                      <th className="px-4 py-3">Profile</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Bedtime → Wake</th>
                      <th className="px-4 py-3">Duration</th>
                      <th className="px-4 py-3">Quality</th>
                      <th className="px-4 py-3">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[11px]">
                    {(master.tracking?.sleep || []).map((s: any, idx: number) => (
                      <tr key={`${s.id}-${idx}`}>
                        <td className="px-4 py-2.5">{renderUsageBadge(s.usageStatus)}</td>
                        <td className="px-4 py-2.5 font-bold">{s.ownerName}</td>
                        <td className="px-4 py-2.5 font-mono">{s.date}</td>
                        <td className="px-4 py-2.5 font-mono">
                          {s.bedtime} → {s.wakeTime}
                        </td>
                        <td className="px-4 py-2.5 font-bold text-indigo-600 dark:text-indigo-400">
                          {s.durationHours} hrs
                        </td>
                        <td className="px-4 py-2.5 uppercase font-bold text-[10px]">{s.quality}</td>
                        <td className="px-4 py-2.5 text-slate-500">{s.notes || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {clinicalCategory === "water" && (
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-[#172944] text-[10px] font-bold uppercase text-slate-400 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="px-4 py-3">State</th>
                      <th className="px-4 py-3">Profile</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Water Logged</th>
                      <th className="px-4 py-3">Daily Target</th>
                      <th className="px-4 py-3">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[11px]">
                    {(master.tracking?.water || []).map((w: any, idx: number) => (
                      <tr key={`${w.id}-${idx}`}>
                        <td className="px-4 py-2.5">{renderUsageBadge(w.usageStatus)}</td>
                        <td className="px-4 py-2.5 font-bold">{w.ownerName}</td>
                        <td className="px-4 py-2.5 font-mono">{w.date}</td>
                        <td className="px-4 py-2.5 font-mono font-bold text-blue-600 dark:text-blue-400">
                          {w.amountMl} ml
                        </td>
                        <td className="px-4 py-2.5 font-mono">{w.targetMl} ml</td>
                        <td className="px-4 py-2.5 text-slate-500">{w.notes || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {clinicalCategory === "meals" && (
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-[#172944] text-[10px] font-bold uppercase text-slate-400 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="px-4 py-3">State</th>
                      <th className="px-4 py-3">Profile</th>
                      <th className="px-4 py-3">Date &amp; Meal</th>
                      <th className="px-4 py-3">Meal Name &amp; Foods</th>
                      <th className="px-4 py-3">Calories</th>
                      <th className="px-4 py-3">Macros (P / C / F)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[11px]">
                    {(master.tracking?.meals || []).map((m: any, idx: number) => (
                      <tr key={`${m.id}-${idx}`}>
                        <td className="px-4 py-2.5">{renderUsageBadge(m.usageStatus)}</td>
                        <td className="px-4 py-2.5 font-bold">{m.ownerName}</td>
                        <td className="px-4 py-2.5 font-mono">
                          {m.date} ({m.mealType})
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="font-bold">{m.mealName}</div>
                          <div className="text-slate-500 text-[10px]">{m.foods}</div>
                        </td>
                        <td className="px-4 py-2.5 font-mono font-bold">
                          {m.calories || 0} kcal
                        </td>
                        <td className="px-4 py-2.5 font-mono">
                          {m.proteinG || 0}g / {m.carbsG || 0}g / {m.fatG || 0}g
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {clinicalCategory === "activity" && (
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-[#172944] text-[10px] font-bold uppercase text-slate-400 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="px-4 py-3">State</th>
                      <th className="px-4 py-3">Profile</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Activity</th>
                      <th className="px-4 py-3">Duration</th>
                      <th className="px-4 py-3">Steps</th>
                      <th className="px-4 py-3">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[11px]">
                    {(master.tracking?.activity || []).map((a: any, idx: number) => (
                      <tr key={`${a.id}-${idx}`}>
                        <td className="px-4 py-2.5">{renderUsageBadge(a.usageStatus)}</td>
                        <td className="px-4 py-2.5 font-bold">{a.ownerName}</td>
                        <td className="px-4 py-2.5 font-mono">{a.date}</td>
                        <td className="px-4 py-2.5 font-bold text-teal-600 dark:text-teal-400">
                          {a.activityType}
                        </td>
                        <td className="px-4 py-2.5 font-mono">{a.durationMinutes} mins</td>
                        <td className="px-4 py-2.5 font-mono">{a.steps || 0}</td>
                        <td className="px-4 py-2.5 text-slate-500">{a.notes || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {clinicalCategory === "mood" && (
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-[#172944] text-[10px] font-bold uppercase text-slate-400 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="px-4 py-3">State</th>
                      <th className="px-4 py-3">Profile</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Mood</th>
                      <th className="px-4 py-3">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[11px]">
                    {(master.tracking?.mood || []).map((m: any, idx: number) => (
                      <tr key={`${m.id}-${idx}`}>
                        <td className="px-4 py-2.5">{renderUsageBadge(m.usageStatus)}</td>
                        <td className="px-4 py-2.5 font-bold">{m.ownerName}</td>
                        <td className="px-4 py-2.5 font-mono">{m.date}</td>
                        <td className="px-4 py-2.5 uppercase font-bold text-amber-600">
                          {m.mood}
                        </td>
                        <td className="px-4 py-2.5 text-slate-500">{m.notes || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {clinicalCategory === "journals" && (
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-[#172944] text-[10px] font-bold uppercase text-slate-400 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="px-4 py-3">State</th>
                      <th className="px-4 py-3">Profile</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Title &amp; Content</th>
                      <th className="px-4 py-3">Tags</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[11px]">
                    {allJournals.map((j: any, idx: number) => (
                      <tr key={`${j.id}-${idx}`}>
                        <td className="px-4 py-2.5">{renderUsageBadge(j.usageStatus)}</td>
                        <td className="px-4 py-2.5 font-bold">{j.ownerName}</td>
                        <td className="px-4 py-2.5 font-mono">{j.date}</td>
                        <td className="px-4 py-2.5 max-w-xl">
                          <div className="font-bold text-slate-900 dark:text-white">{j.title}</div>
                          <div className="text-slate-500 line-clamp-2">{j.content}</div>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex flex-wrap gap-1">
                            {(j.tags || []).map((t: string) => (
                              <span
                                key={t}
                                className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px]"
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {clinicalCategory === "medications" && (
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-[#172944] text-[10px] font-bold uppercase text-slate-400 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="px-4 py-3">State</th>
                      <th className="px-4 py-3">Profile</th>
                      <th className="px-4 py-3">Medication &amp; Strength</th>
                      <th className="px-4 py-3">Dosage &amp; Frequency</th>
                      <th className="px-4 py-3">Prescribing Doctor</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[11px]">
                    {allMedications.map((m: any, idx: number) => (
                      <tr key={`${m.id}-${idx}`}>
                        <td className="px-4 py-2.5">{renderUsageBadge(m.usageStatus)}</td>
                        <td className="px-4 py-2.5 font-bold">{m.ownerName}</td>
                        <td className="px-4 py-2.5 font-bold text-slate-900 dark:text-white">
                          {m.name} ({m.strength})
                        </td>
                        <td className="px-4 py-2.5">
                          {m.dosage} • {m.frequency}
                        </td>
                        <td className="px-4 py-2.5 text-slate-500">
                          {m.prescribingDoctor || "Clinician"}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                            {m.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {clinicalCategory === "appointments" && (
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-[#172944] text-[10px] font-bold uppercase text-slate-400 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="px-4 py-3">State</th>
                      <th className="px-4 py-3">Profile</th>
                      <th className="px-4 py-3">Title &amp; Purpose</th>
                      <th className="px-4 py-3">Doctor &amp; Facility</th>
                      <th className="px-4 py-3">Date &amp; Time</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[11px]">
                    {allAppointments.map((a: any, idx: number) => (
                      <tr key={`${a.id}-${idx}`}>
                        <td className="px-4 py-2.5">{renderUsageBadge(a.usageStatus)}</td>
                        <td className="px-4 py-2.5 font-bold">{a.ownerName}</td>
                        <td className="px-4 py-2.5">
                          <div className="font-bold text-slate-900 dark:text-white">{a.title}</div>
                          <div className="text-[10px] text-slate-500">{a.purpose}</div>
                        </td>
                        <td className="px-4 py-2.5">
                          {a.doctorName} ({a.facility})
                        </td>
                        <td className="px-4 py-2.5 font-mono">
                          {a.date} {a.time}
                        </td>
                        <td className="px-4 py-2.5 uppercase text-[10px] font-bold">
                          {a.status}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ================= TAB 5: MY AI COPILOT CONVERSATIONS & MESSAGES ================= */}
        {activeSubTab === "ai_logs" && (
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-extrabold text-[#142238] dark:text-white flex items-center gap-2">
                <Brain className="w-4 h-4 text-[#16B8A6]" />
                <span>Your AI Copilot Conversations &amp; Messages ({allMessages.length})</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Complete log of questions asked to the AI Bots from your current and previously used profiles.
              </p>
            </div>

            {allMessages.length === 0 ? (
              <div className="p-8 rounded-xl bg-slate-50 dark:bg-[#172944]/40 border border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400">
                No AI Bot messages logged yet in this scope. Ask a question in the AI Bots tab to see your interactions here.
              </div>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {allMessages.map((msg: any, idx: number) => (
                  <div
                    key={`${msg.id}-${idx}`}
                    className={`p-4 rounded-xl border text-xs ${
                      msg.role === "user"
                        ? "bg-slate-50 dark:bg-[#172944] border-slate-200 dark:border-slate-800"
                        : "bg-teal-50/40 dark:bg-teal-950/20 border-teal-200/70 dark:border-teal-900/50"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        {renderUsageBadge(msg.usageStatus)}
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            msg.role === "user"
                              ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300"
                              : "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300"
                          }`}
                        >
                          {msg.role === "user" ? `You (${msg.ownerName})` : "Healthora AI Copilot"}
                        </span>
                        {msg.pageContext && (
                          <span className="text-[10px] font-mono text-slate-400">
                            Context: {msg.pageContext}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-mono text-slate-400">
                        {msg.timestamp ? new Date(msg.timestamp).toLocaleString() : ""}
                      </span>
                    </div>
                    <p className="text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                      {msg.content}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 6: SUPABASE CLOUD & SQL SETUP ================= */}
        {activeSubTab === "supabase_setup" && (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-extrabold text-[#142238] dark:text-white flex items-center gap-2">
                  <Database className="w-4 h-4 text-emerald-500" />
                  <span>Supabase Cloud PostgreSQL Connection (eltheprswohoxxhxxtdl)</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Run the SQL script below in your Supabase SQL Editor to create all tables (<code className="font-mono">site_visits</code>, <code className="font-mono">website_visitors</code>, <code className="font-mono">profiles</code>, <code className="font-mono">daily_tracking_entries</code>, <code className="font-mono">medical_documents</code>, <code className="font-mono">lab_results</code>).
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleCopySql}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#16B8A6] hover:bg-[#66E3D3] text-[#101C31] font-bold text-xs transition-all cursor-pointer"
                >
                  {copiedSql ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedSql ? "Copied SQL!" : "Copy SQL Schema"}</span>
                </button>

                <a
                  href="https://supabase.com/dashboard/project/eltheprswohoxxhxxtdl/sql/new"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 font-bold text-xs transition-all"
                >
                  <span>Open Supabase SQL Editor</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            {/* Connection Details */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#172944] border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] font-bold uppercase text-slate-400">Project ID</span>
                <div className="font-mono font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                  eltheprswohoxxhxxtdl
                </div>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#172944] border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] font-bold uppercase text-slate-400">Supabase URL</span>
                <div className="font-mono text-slate-700 dark:text-slate-200 mt-1 truncate">
                  https://eltheprswohoxxhxxtdl.supabase.co
                </div>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#172944] border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] font-bold uppercase text-slate-400">Publishable API Key</span>
                <div className="font-mono text-slate-700 dark:text-slate-200 mt-1 truncate">
                  sb_publishable_Avnfpe_Z_PLGf497ATLuyw_zjF7aLXA
                </div>
              </div>
            </div>

            {/* SQL Code Preview */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-[#0F172A] p-4 text-xs font-mono text-teal-300 overflow-x-auto max-h-[420px]">
              <pre>{migrationSql || "-- Loading SQL Schema..."}</pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
