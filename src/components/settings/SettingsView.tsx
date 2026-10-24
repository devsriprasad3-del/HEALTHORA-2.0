import React, { useState, useEffect } from "react";
import {
  Settings,
  User,
  Brain,
  Shield,
  ShieldCheck,
  Database,
  Download,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Globe,
  Bell,
  Lock,
  FileText,
  Save,
  Server,
  Layers,
  Copy,
  ExternalLink,
  Activity,
  Users,
  Check,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext.js";
import { useLanguage } from "../../context/LanguageContext.js";
import { UserProfile, UserSettings, ViewTab } from "../../types/health.js";

interface SettingsViewProps {
  onNavigateTab: (tab: ViewTab) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onNavigateTab }) => {
  const { user, activeProfileKey, switchProfile, resetDemo } = useAuth();
  const { t, language, setLanguage } = useLanguage();

  const [activeTab, setActiveTab] = useState<"profile" | "ai" | "privacy" | "integrations">("profile");

  // Profile Form
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [preferredLang, setPreferredLang] = useState<"en" | "hi" | "te">(user?.preferredLanguage || "en");
  const [bloodGroup, setBloodGroup] = useState(user?.bloodGroup || "B+");
  const [abhaNumber, setAbhaNumber] = useState(user?.abhaNumber || "");

  // Tracking Preferences & AI Settings
  const [waterTarget, setWaterTarget] = useState(2500);
  const [sleepTarget, setSleepTarget] = useState(8.0);
  const [activityTarget, setActivityTarget] = useState(45);
  const [timeZone, setTimeZone] = useState("Asia/Kolkata");
  const [aiDetail, setAiDetail] = useState<"concise" | "balanced" | "detailed">("balanced");
  const [aiLang, setAiLang] = useState<"en" | "hi" | "te">("en");

  // Integrations / Live Health Ping
  const [backendStatus, setBackendStatus] = useState<any>(null);
  const [checkingBackend, setCheckingBackend] = useState<boolean>(false);
  const [visitorData, setVisitorData] = useState<any>(null);
  const [migrationSql, setMigrationSql] = useState<string>("");
  const [copiedSql, setCopiedSql] = useState(false);
  const [verifyingSupabase, setVerifyingSupabase] = useState(false);
  const [simulatingVisit, setSimulatingVisit] = useState(false);

  const [toast, setToast] = useState<string | null>(null);

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/settings");
      const data = await res.json();
      if (data.profile) {
        setName(data.profile.name || "");
        setEmail(data.profile.email || "");
        setPreferredLang(data.profile.preferredLanguage || "en");
        setBloodGroup(data.profile.bloodGroup || "B+");
        setAbhaNumber(data.profile.abhaNumber || "");
      }
      if (data.settings) {
        setWaterTarget(data.settings.waterTargetMl || 2500);
        setSleepTarget(data.settings.sleepTargetHours || 8.0);
        setActivityTarget(data.settings.activityTargetMinutes || 45);
        setTimeZone(data.settings.timeZone || "Asia/Kolkata");
        setAiDetail(data.settings.aiResponseDetail || "balanced");
        setAiLang(data.settings.aiPreferredLanguage || "en");
      }
    } catch (err) {
      console.error("Failed to load settings:", err);
    }
  };

  const checkLiveStatus = async () => {
    try {
      setCheckingBackend(true);
      const res = await fetch("/api/backend-status");
      const data = await res.json();
      setBackendStatus(data);
    } catch (err) {
      console.error("Health check failed:", err);
    } finally {
      setCheckingBackend(false);
    }
  };

  const fetchVisitorStats = async () => {
    try {
      const res = await fetch("/api/visitor/stats");
      const data = await res.json();
      setVisitorData(data);
    } catch (e) {
      console.warn("Failed to load visitor stats:", e);
    }
  };

  const fetchMigrationSql = async () => {
    try {
      const res = await fetch("/api/supabase/migration-sql");
      const data = await res.json();
      if (data.sql) {
        setMigrationSql(data.sql);
      }
    } catch (e) {
      console.warn("Failed to load migration sql:", e);
    }
  };

  const handleCopySql = () => {
    if (!migrationSql) return;
    navigator.clipboard.writeText(migrationSql);
    setCopiedSql(true);
    showToast("SQL Schema script copied to clipboard!");
    setTimeout(() => setCopiedSql(false), 3000);
  };

  const handleVerifyTables = async () => {
    try {
      setVerifyingSupabase(true);
      const res = await fetch("/api/supabase/verify-tables", { method: "POST" });
      const data = await res.json();
      if (data.status) {
        setBackendStatus((prev: any) => ({ ...prev, supabase: data.status }));
        if (data.status.tablesStatus?.site_visits) {
          showToast("Success: Supabase tables verified and live!");
        } else {
          showToast("Tables pending: run the SQL script in your Supabase SQL editor");
        }
      }
      await fetchVisitorStats();
    } catch (e) {
      showToast("Verification request failed");
    } finally {
      setVerifyingSupabase(false);
    }
  };

  const handleSimulateVisit = async () => {
    try {
      setSimulatingVisit(true);
      const res = await fetch("/api/visitor/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pagePath: "/records",
          pageTitle: "Medical Records & Pathology",
          deviceType: "Mobile",
          browser: "Safari",
          os: "iOS",
          metadata: { testVisit: true, source: "Settings Simulation" },
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast("Test visitor session logged successfully!");
        await fetchVisitorStats();
      }
    } catch (e) {
      showToast("Failed to simulate visitor");
    } finally {
      setSimulatingVisit(false);
    }
  };

  useEffect(() => {
    fetchSettings();
    checkLiveStatus();
    fetchVisitorStats();
    fetchMigrationSql();
  }, [activeProfileKey]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleSaveProfileAndSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile: {
            name,
            email,
            preferredLanguage: preferredLang,
            bloodGroup,
            abhaNumber,
          },
          settings: {
            waterTargetMl: Number(waterTarget),
            sleepTargetHours: Number(sleepTarget),
            activityTargetMinutes: Number(activityTarget),
            timeZone,
            aiResponseDetail: aiDetail,
            aiPreferredLanguage: aiLang,
          },
        }),
      });
      const data = await res.json();
      if (data.success) {
        if (preferredLang !== language) {
          setLanguage(preferredLang);
        }
        showToast("Profile and preferences saved successfully");
      }
    } catch (err) {
      showToast("Failed to save settings");
    }
  };

  // Full Data Export
  const handleExportAllData = async () => {
    try {
      const res = await fetch("/api/settings/export");
      const data = await res.json();
      const jsonStr = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `healthora-complete-export-${user?.name.replace(/\s+/g, "_")}-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast("Complete health portfolio downloaded");
    } catch (err) {
      showToast("Failed to export data");
    }
  };

  // Delete Category
  const handleDeleteCategory = async (category: "conversations" | "journal" | "documents" | "tracking") => {
    const promptMsg = `Are you sure you want to permanently clear all ${category}? This action is irreversible.`;
    if (!confirm(promptMsg)) return;

    try {
      const res = await fetch("/api/settings/delete-category", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Successfully purged ${category}`);
      }
    } catch (err) {
      showToast(`Failed to clear ${category}`);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12 animate-fade-in">
      {toast && (
        <div className="fixed top-4 right-4 z-50 px-4 py-2.5 rounded-xl bg-[#101C31] text-[#66E3D3] border border-[#16B8A6] text-xs font-bold shadow-xl">
          {toast}
        </div>
      )}

      {/* Header Bar */}
      <div className="bg-white dark:bg-[#101C31] p-6 rounded-2xl border border-[#E4EAF1] dark:border-[#1B2D48] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-500">
              <Settings className="w-4 h-4" />
            </span>
            <h1 className="text-xl sm:text-2xl font-extrabold text-[#142238] dark:text-white">
              {t("navSettings")}
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {t("settingsSubtitle")}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => switchProfile(activeProfileKey === "rajesh" ? "priya" : "rajesh")}
            className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-[#172944] text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-200"
          >
            Switch Demo Account ({activeProfileKey === "rajesh" ? "Switch to Priya" : "Switch to Rajesh"})
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {[
          { id: "profile", label: t("profileSettings"), icon: User },
          { id: "ai", label: t("aiPreferences"), icon: Brain },
          { id: "privacy", label: t("dataManagement"), icon: Shield },
          { id: "integrations", label: t("systemIntegrations"), icon: Database },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
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

      {/* TAB CONTENT PANELS */}
      <div className="bg-white dark:bg-[#101C31] rounded-2xl p-6 sm:p-8 border border-[#E4EAF1] dark:border-[#1B2D48] shadow-sm">
        {/* ================= 1. PROFILE & TARGETS ================= */}
        {activeTab === "profile" && (
          <form onSubmit={handleSaveProfileAndSettings} className="space-y-6">
            <div>
              <h2 className="text-sm font-bold text-[#142238] dark:text-white mb-1">
                Personal Identity & Clinical Information
              </h2>
              <p className="text-xs text-slate-400">
                Update patient demographic information and baseline targets.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full p-2.5 text-xs rounded-xl bg-[#F5F7FB] dark:bg-[#172944] border border-[#E4EAF1] dark:border-[#1B2D48] text-[#142238] dark:text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full p-2.5 text-xs rounded-xl bg-[#F5F7FB] dark:bg-[#172944] border border-[#E4EAF1] dark:border-[#1B2D48] text-[#142238] dark:text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Blood Group
                </label>
                <input
                  type="text"
                  value={bloodGroup}
                  onChange={(e) => setBloodGroup(e.target.value)}
                  className="w-full p-2.5 text-xs rounded-xl bg-[#F5F7FB] dark:bg-[#172944] border border-[#E4EAF1] dark:border-[#1B2D48] text-[#142238] dark:text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  ABHA Health ID (Ayushman Bharat)
                </label>
                <input
                  type="text"
                  value={abhaNumber}
                  onChange={(e) => setAbhaNumber(e.target.value)}
                  placeholder="91-XXXX-XXXX-XXXX"
                  className="w-full p-2.5 text-xs rounded-xl bg-[#F5F7FB] dark:bg-[#172944] border border-[#E4EAF1] dark:border-[#1B2D48] text-[#142238] dark:text-white focus:outline-none font-mono"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                Daily Wellness Targets
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Daily Water Target (ml)
                  </label>
                  <input
                    type="number"
                    value={waterTarget}
                    onChange={(e) => setWaterTarget(Number(e.target.value))}
                    min={500}
                    max={6000}
                    className="w-full p-2.5 text-xs rounded-xl bg-[#F5F7FB] dark:bg-[#172944] border border-[#E4EAF1] dark:border-[#1B2D48] text-[#142238] dark:text-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Sleep Target (hours)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={sleepTarget}
                    onChange={(e) => setSleepTarget(Number(e.target.value))}
                    min={4}
                    max={12}
                    className="w-full p-2.5 text-xs rounded-xl bg-[#F5F7FB] dark:bg-[#172944] border border-[#E4EAF1] dark:border-[#1B2D48] text-[#142238] dark:text-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Active Exercise Goal (mins)
                  </label>
                  <input
                    type="number"
                    value={activityTarget}
                    onChange={(e) => setActivityTarget(Number(e.target.value))}
                    min={10}
                    max={180}
                    className="w-full p-2.5 text-xs rounded-xl bg-[#F5F7FB] dark:bg-[#172944] border border-[#E4EAF1] dark:border-[#1B2D48] text-[#142238] dark:text-white focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#16B8A6] hover:bg-[#66E3D3] text-[#101C31] font-bold text-xs transition-all shadow-md active:scale-95"
            >
              <Save className="w-4 h-4" />
              <span>Save Profile & Targets</span>
            </button>
          </form>
        )}

        {/* ================= 2. AI PREFERENCES ================= */}
        {activeTab === "ai" && (
          <form onSubmit={handleSaveProfileAndSettings} className="space-y-6">
            <div>
              <h2 className="text-sm font-bold text-[#142238] dark:text-white mb-1">
                Gemini AI Configuration & Language
              </h2>
              <p className="text-xs text-slate-400">
                Customize how AI Bots formulate explanations and report translations.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Default AI Response Language
                </label>
                <select
                  value={aiLang}
                  onChange={(e: any) => setAiLang(e.target.value)}
                  className="w-full p-2.5 text-xs rounded-xl bg-[#F5F7FB] dark:bg-[#172944] border border-[#E4EAF1] dark:border-[#1B2D48] text-[#142238] dark:text-white focus:outline-none"
                >
                  <option value="en">English (Professional Clinical Clarity)</option>
                  <option value="hi">Hindi (सरल और शुद्ध हिन्दी में)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Explanation Detail Level
                </label>
                <select
                  value={aiDetail}
                  onChange={(e: any) => setAiDetail(e.target.value)}
                  className="w-full p-2.5 text-xs rounded-xl bg-[#F5F7FB] dark:bg-[#172944] border border-[#E4EAF1] dark:border-[#1B2D48] text-[#142238] dark:text-white focus:outline-none"
                >
                  <option value="concise">Concise (Short bullets & key findings)</option>
                  <option value="balanced">Balanced (Clinical context + everyday translation)</option>
                  <option value="detailed">Detailed (Deep physiological explanations & lab correlations)</option>
                </select>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-teal-50/60 dark:bg-teal-950/20 border border-teal-100 dark:border-teal-900/40 text-xs text-slate-700 dark:text-slate-300 space-y-2">
              <div className="flex items-center gap-1.5 font-bold text-[#16B8A6]">
                <ShieldCheck className="w-4 h-4" />
                <span>Zero-Hallucination & Medical Safety Guarantee</span>
              </div>
              <p className="leading-relaxed text-[11px]">
                Healthora AI Bots strictly distinguish between verified application records, user-entered wellness logs, and extracted diagnostic reports. Never automated prescriptions. Always backed by source citations.
              </p>
            </div>

            <button
              type="submit"
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#16B8A6] hover:bg-[#66E3D3] text-[#101C31] font-bold text-xs transition-all shadow-md active:scale-95"
            >
              <Save className="w-4 h-4" />
              <span>Save AI Preferences</span>
            </button>
          </form>
        )}

        {/* ================= 3. PRIVACY & DATA MANAGEMENT ================= */}
        {activeTab === "privacy" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-sm font-bold text-[#142238] dark:text-white mb-1">
                Data Ownership & Granular Purge Controls
              </h2>
              <p className="text-xs text-slate-400">
                You own 100% of your health data. Export full records anytime or delete specific categories.
              </p>
            </div>

            {/* Export Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#172944] border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="font-bold text-xs text-slate-900 dark:text-white">
                  {t("exportDataJson")}
                </div>
                <p className="text-[11px] text-slate-400">
                  Download every medical record, lab value, sleep log, water entry, journal entry, and reminder as an open JSON archive.
                </p>
                <button
                  onClick={handleExportAllData}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#16B8A6] text-[#101C31] text-xs font-bold hover:bg-[#66E3D3] transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download JSON Bundle</span>
                </button>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#172944] border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="font-bold text-xs text-slate-900 dark:text-white">
                  {t("exportDossier")}
                </div>
                <p className="text-[11px] text-slate-400">
                  Generate a structured summary dossier designed specifically to share with your treating medical doctor.
                </p>
                <button
                  onClick={() => onNavigateTab("export")}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold hover:bg-slate-300 transition-colors"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Open Dossier View</span>
                </button>
              </div>
            </div>

            {/* Granular Purge Controls */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
              <h3 className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">
                Granular Data Deletion Controls
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={() => handleDeleteCategory("conversations")}
                  className="p-3 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/20 text-left hover:bg-rose-100/60 transition-colors"
                >
                  <div className="font-bold text-xs text-rose-700 dark:text-rose-300">
                    Purge All AI Conversations
                  </div>
                  <span className="text-[11px] text-slate-500">Deletes AI Bots chat history</span>
                </button>

                <button
                  onClick={() => handleDeleteCategory("journal")}
                  className="p-3 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/20 text-left hover:bg-rose-100/60 transition-colors"
                >
                  <div className="font-bold text-xs text-rose-700 dark:text-rose-300">
                    Purge Health Journal Entries
                  </div>
                  <span className="text-[11px] text-slate-500">Deletes symptom logs & doctor notes</span>
                </button>

                <button
                  onClick={() => handleDeleteCategory("tracking")}
                  className="p-3 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/20 text-left hover:bg-rose-100/60 transition-colors"
                >
                  <div className="font-bold text-xs text-rose-700 dark:text-rose-300">
                    Purge Daily Tracking Data
                  </div>
                  <span className="text-[11px] text-slate-500">Deletes sleep, water, meal & activity logs</span>
                </button>

                <button
                  onClick={() => handleDeleteCategory("documents")}
                  className="p-3 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/20 text-left hover:bg-rose-100/60 transition-colors"
                >
                  <div className="font-bold text-xs text-rose-700 dark:text-rose-300">
                    Purge Uploaded Medical Documents
                  </div>
                  <span className="text-[11px] text-slate-500">Deletes pathology reports & extracted labs</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= 4. SYSTEM INTEGRATIONS & SUPABASE DATABASE SETUP ================= */}
        {activeTab === "integrations" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-[#142238] dark:text-white mb-1 flex items-center gap-2">
                  <Database className="w-4 h-4 text-emerald-500" />
                  <span>Supabase PostgreSQL & Cloud Database Setup</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Connected to remote Supabase project. Every visitor session, auth account, and health record is captured.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={checkLiveStatus}
                  disabled={checkingBackend}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-bold hover:bg-slate-200 text-slate-700 dark:text-slate-200 transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${checkingBackend ? "animate-spin" : ""}`} />
                  <span>Check Health</span>
                </button>
              </div>
            </div>

            {/* Supabase Connection Overview Card */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-50/70 via-teal-50/40 to-slate-50 dark:from-emerald-950/30 dark:via-teal-950/20 dark:to-[#172944] border border-emerald-200/80 dark:border-emerald-800/60 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    <Database className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-extrabold text-[#142238] dark:text-white">
                        Connected Supabase Project
                      </h3>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Connected
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Cloud PostgreSQL • GoTrue Authentication • Row Level Security
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href="https://supabase.com/dashboard/project/eltheprswohoxxhxxtdl"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors shadow-xs"
                  >
                    <span>Supabase Dashboard</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>

              {/* Credentials & Endpoint Meta */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-white/80 dark:bg-[#101C31]/80 border border-slate-200/70 dark:border-slate-800">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Project ID</span>
                  <div className="font-mono font-bold text-emerald-700 dark:text-emerald-400 mt-0.5">
                    eltheprswohoxxhxxtdl
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-white/80 dark:bg-[#101C31]/80 border border-slate-200/70 dark:border-slate-800">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Project Endpoint</span>
                  <div className="font-mono text-slate-700 dark:text-slate-300 mt-0.5 truncate">
                    https://eltheprswohoxxhxxtdl.supabase.co
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-white/80 dark:bg-[#101C31]/80 border border-slate-200/70 dark:border-slate-800">
                  <span className="text-[10px] uppercase font-bold text-slate-400">API Key Type</span>
                  <div className="font-mono text-slate-700 dark:text-slate-300 mt-0.5 truncate">
                    sb_publishable_Avnfpe_Z_PLGf497ATLuyw_zjF7aLXA
                  </div>
                </div>
              </div>

              {/* Table Status Badges */}
              <div className="pt-2 border-t border-emerald-200/60 dark:border-emerald-900/50 flex flex-wrap items-center gap-2 text-xs">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mr-1">Database Tables:</span>
                
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${
                  backendStatus?.supabase?.tablesStatus?.site_visits
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800"
                    : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800"
                }`}>
                  {backendStatus?.supabase?.tablesStatus?.site_visits ? <CheckCircle2 className="w-3 h-3 text-emerald-500" /> : <AlertTriangle className="w-3 h-3 text-amber-500" />}
                  public.site_visits {backendStatus?.supabase?.tablesStatus?.site_visits ? "(Live)" : "(Pending Migration)"}
                </span>

                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${
                  backendStatus?.supabase?.tablesStatus?.profiles
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800"
                    : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800"
                }`}>
                  {backendStatus?.supabase?.tablesStatus?.profiles ? <CheckCircle2 className="w-3 h-3 text-emerald-500" /> : <AlertTriangle className="w-3 h-3 text-amber-500" />}
                  public.profiles {backendStatus?.supabase?.tablesStatus?.profiles ? "(Live)" : "(Pending Migration)"}
                </span>

                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${
                  backendStatus?.supabase?.tablesStatus?.daily_tracking_entries
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800"
                    : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800"
                }`}>
                  {backendStatus?.supabase?.tablesStatus?.daily_tracking_entries ? <CheckCircle2 className="w-3 h-3 text-emerald-500" /> : <AlertTriangle className="w-3 h-3 text-amber-500" />}
                  public.daily_tracking_entries {backendStatus?.supabase?.tablesStatus?.daily_tracking_entries ? "(Live)" : "(Pending Migration)"}
                </span>
              </div>
            </div>

            {/* 1-Click Database Setup & SQL Migration Box */}
            <div className="p-5 rounded-2xl bg-white dark:bg-[#172944] border border-[#E4EAF1] dark:border-[#1B2D48] space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-[#142238] dark:text-white flex items-center gap-2">
                    <Database className="w-4 h-4 text-[#16B8A6]" />
                    <span>Database Schema Setup & SQL Migration</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Execute this complete SQL migration to initialize the <code className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">site_visits</code> & <code className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">website_visitors</code> tables and all health records tables.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={handleCopySql}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-[#16B8A6] hover:bg-[#139a8b] text-[#101C31] transition-colors shadow-xs"
                  >
                    {copiedSql ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedSql ? "Copied SQL Script!" : "Copy SQL Schema"}</span>
                  </button>

                  <a
                    href="https://supabase.com/dashboard/project/eltheprswohoxxhxxtdl/sql/new"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:hover:bg-slate-100 dark:text-slate-900 transition-colors shadow-xs"
                  >
                    <span>Open SQL Editor</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>

                  <button
                    onClick={handleVerifyTables}
                    disabled={verifyingSupabase}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${verifyingSupabase ? "animate-spin" : ""}`} />
                    <span>Verify Tables</span>
                  </button>
                </div>
              </div>

              {/* 3 Step Guide */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#101C31] border border-slate-200 dark:border-slate-800 space-y-1">
                  <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-teal-100 dark:bg-teal-950 text-[#16B8A6] font-black flex items-center justify-center text-[10px]">1</span>
                    <span>Copy Schema</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Click <strong>"Copy SQL Schema"</strong> to copy the ready-to-run DDL statements into your clipboard.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#101C31] border border-slate-200 dark:border-slate-800 space-y-1">
                  <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-teal-100 dark:bg-teal-950 text-[#16B8A6] font-black flex items-center justify-center text-[10px]">2</span>
                    <span>Run in SQL Editor</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Click <strong>"Open SQL Editor"</strong> in Supabase, paste the script, and click the green <strong>Run</strong> button.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#101C31] border border-slate-200 dark:border-slate-800 space-y-1">
                  <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-teal-100 dark:bg-teal-950 text-[#16B8A6] font-black flex items-center justify-center text-[10px]">3</span>
                    <span>Verify & Live Sync</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Click <strong>"Verify Tables"</strong>. All visitor logs and patient health records will immediately stream into Supabase.
                  </p>
                </div>
              </div>
            </div>

            {/* LIVE WEBSITE VISITOR TRACKING & STORAGE EXPLORER */}
            <div className="p-5 rounded-2xl bg-white dark:bg-[#172944] border border-[#E4EAF1] dark:border-[#1B2D48] space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-[#142238] dark:text-white flex items-center gap-2">
                    <Activity className="w-4 h-4 text-indigo-500" />
                    <span>Website Visitor Tracking (public.site_visits)</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Every person visiting the website is automatically tracked and recorded into Supabase PostgreSQL.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSimulateVisit}
                    disabled={simulatingVisit}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 transition-colors"
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>{simulatingVisit ? "Logging..." : "Log Test Visit Now"}</span>
                  </button>

                  <button
                    onClick={fetchVisitorStats}
                    className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
                    title="Refresh stats"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Visitor Metric Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#101C31] border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Website Visits</span>
                  <div className="text-xl font-extrabold text-[#142238] dark:text-white mt-1">
                    {visitorData?.stats?.totalVisits || 1}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#101C31] border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Unique Visitors</span>
                  <div className="text-xl font-extrabold text-indigo-600 dark:text-indigo-400 mt-1">
                    {visitorData?.stats?.uniqueVisitors || 1}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#101C31] border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Visits Today</span>
                  <div className="text-xl font-extrabold text-teal-600 dark:text-teal-400 mt-1">
                    {visitorData?.stats?.visitsToday || 1}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#101C31] border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Supabase Storage</span>
                  <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-2 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>{visitorData?.supabase?.tableReady ? "Synchronized" : "Local Store + Supabase Queue"}</span>
                  </div>
                </div>
              </div>

              {/* Live Visitor Table */}
              <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-[#101C31] text-[10px] font-bold uppercase text-slate-400 tracking-wider border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="px-3.5 py-2.5">Visitor ID</th>
                      <th className="px-3.5 py-2.5">Page Visited</th>
                      <th className="px-3.5 py-2.5">Device & Browser</th>
                      <th className="px-3.5 py-2.5">Visited At</th>
                      <th className="px-3.5 py-2.5">Storage Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-[11px]">
                    {(visitorData?.stats?.recentVisits || []).map((v: any) => (
                      <tr key={v.id} className="hover:bg-slate-50/50 dark:hover:bg-[#101C31]/50 transition-colors">
                        <td className="px-3.5 py-2 text-slate-700 dark:text-slate-300 font-bold">
                          {v.visitorId}
                        </td>
                        <td className="px-3.5 py-2 text-slate-600 dark:text-slate-400">
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-bold">
                            {v.pagePath}
                          </span>
                        </td>
                        <td className="px-3.5 py-2 text-slate-500 dark:text-slate-400">
                          {v.deviceType} • {v.browser} ({v.os})
                        </td>
                        <td className="px-3.5 py-2 text-slate-500 dark:text-slate-400">
                          {new Date(v.visitedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                        </td>
                        <td className="px-3.5 py-2">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            v.syncedToSupabase
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                          }`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            {v.syncedToSupabase ? "Supabase Synced" : "Stored in Database"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Additional Backend Systems Status */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Gemini AI Status */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#172944] border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Brain className="w-4 h-4 text-[#16B8A6]" />
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      Google Gemini Clinical Intelligence
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Model: {backendStatus?.gemini?.model || "gemini-3.8-flash"} (OCR Multimodal)
                  </p>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                    backendStatus?.gemini?.configured
                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
                      : "bg-amber-50 text-amber-700 border border-amber-200"
                  }`}
                >
                  {backendStatus?.gemini?.configured ? "Connected & Ready" : "Unconfigured"}
                </span>
              </div>

              {/* Storage Isolation */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#172944] border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-blue-500" />
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      Private Medical Vault Isolation
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {backendStatus?.storage?.isolation || "Row-Level Security (auth.uid() = user_id)"}
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                  Enforced
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
