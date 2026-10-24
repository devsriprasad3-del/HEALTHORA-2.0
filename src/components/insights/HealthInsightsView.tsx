import React, { useState, useEffect } from "react";
import {
  Sparkles,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  FileText,
  HelpCircle,
  ArrowRight,
  Copy,
  Check,
  ShieldCheck,
  Activity,
  Layers,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { HealthInsight, AgentAction, ViewTab } from "../../types/health.js";
import { useLanguage } from "../../context/LanguageContext.js";
import { useAuth } from "../../context/AuthContext.js";

interface HealthInsightsViewProps {
  onNavigateTab: (tab: ViewTab) => void;
  onLaunchAIBotWithContext?: (pageContext: string, initialPrompt?: string) => void;
}

export const HealthInsightsView: React.FC<HealthInsightsViewProps> = ({
  onNavigateTab,
  onLaunchAIBotWithContext,
}) => {
  const { t, language } = useLanguage();
  const { activeProfileKey } = useAuth();
  const [insights, setInsights] = useState<HealthInsight[]>([]);
  const [agentActions, setAgentActions] = useState<AgentAction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [actionProcessing, setActionProcessing] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [insightsRes, actionsRes] = await Promise.all([
        fetch("/api/insights"),
        fetch("/api/agent/actions"),
      ]);
      const insightsData = await insightsRes.json();
      const actionsData = await actionsRes.json();
      setInsights(insightsData.insights || []);
      setAgentActions(actionsData.actions || []);
    } catch (e) {
      console.warn("Failed to load insights:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeProfileKey]);

  const handleApproveAction = async (id: string) => {
    try {
      setActionProcessing(id);
      const res = await fetch(`/api/agent/actions/${id}/approve`, { method: "POST" });
      if (res.ok) {
        fetchData();
      }
    } catch (e) {
      console.error("Failed to approve action:", e);
    } finally {
      setActionProcessing(null);
    }
  };

  const handleRejectAction = async (id: string) => {
    try {
      setActionProcessing(id);
      const res = await fetch(`/api/agent/actions/${id}/reject`, { method: "POST" });
      if (res.ok) {
        fetchData();
      }
    } catch (e) {
      console.error("Failed to reject action:", e);
    } finally {
      setActionProcessing(null);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const pendingAgentActions = agentActions.filter((a) => a.status === "pending_approval");

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-fade-in">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-[#101C31] via-[#172944] to-[#101C31] text-white border border-[#1B2D48] shadow-lg">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <div className="p-2 rounded-lg bg-[#16B8A6]/20 text-[#66E3D3]">
              <Sparkles className="w-5 h-5" />
            </div>
            <h1 className="text-xl md:text-2xl font-black tracking-tight">
              {language === "te" ? "AI ఆరోగ్య విశ్లేషణలు & సిఫార్సులు" : language === "hi" ? "एआई स्वास्थ्य अंतर्दृष्टि व सिफारिशें" : "AI Health Insights & Intelligence"}
            </h1>
          </div>
          <p className="text-xs md:text-sm text-slate-300 max-w-2xl">
            {language === "te"
              ? "ధృవీకరించబడిన ల్యాబ్ రిపోర్టులు, జీవనశైలి ట్రెండ్లు మరియు ప్రిస్క్రిప్షన్ల ఆధారంగా స్వయంచాలక విశ్లేషణ."
              : language === "hi"
              ? "सत्यापित लैब रिपोर्ट, दैनिक जीवनशैली ट्रैकिंग और दवाओं के आधार पर प्रमाण-आधारित विश्लेषण।"
              : "Evidence-based health trajectories derived from your authenticated lab reports and daily logs."}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (onLaunchAIBotWithContext) {
                onLaunchAIBotWithContext(
                  "insights",
                  "Synthesize my key laboratory trends over the past 6 months and summarize what I should discuss with my endocrinologist."
                );
              }
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#16B8A6] hover:bg-[#66E3D3] text-[#101C31] text-xs font-bold transition-all shadow-md whitespace-nowrap"
          >
            <Sparkles className="w-4 h-4" />
            <span>{language === "te" ? "AI తో లోతుగా చర్చించండి" : language === "hi" ? "एआई से चर्चा करें" : "Discuss with AI Copilot"}</span>
          </button>
        </div>
      </div>

      {/* PROACTIVE AGENTIC AI WORKFLOWS (Awaiting User Approval) */}
      {pendingAgentActions.length > 0 && (
        <div className="p-5 rounded-2xl bg-gradient-to-r from-[#16B8A6]/10 to-teal-500/5 border border-[#16B8A6]/30 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-[#16B8A6]">
              <Activity className="w-4 h-4 animate-pulse" />
              <span>{language === "te" ? "ఏజెంటిక్ AI సిఫార్సులు (మీ ఆమోదం అవసరం)" : language === "hi" ? "एजेंटिक एआई सिफारिशें (आपकी स्वीकृति आवश्यक)" : "Proactive AI Recommendations (Approval Required)"}</span>
            </div>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#16B8A6]/20 text-[#16B8A6] font-bold">
              {pendingAgentActions.length} Pending
            </span>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-300">
            {language === "te"
              ? "హెల్తోరా మీ తాజా పత్రాల ఆధారంగా క్రింది చర్యలను గుర్తించింది. మీ ఆమోదం తర్వాతే ఇవి మీ షెడ్యూల్‌లో అమలవుతాయి."
              : language === "hi"
              ? "हेल्थोरा ने आपके रिकॉर्ड्स के आधार पर ये उपयोगी कदम पहचाने हैं। आपकी पुष्टि के बाद ही ये स्वतः निर्धारित होंगे।"
              : "Healthora detected events in your recent clinical records. These actions will only take effect after your explicit confirmation."}
          </p>

          <div className="space-y-3 pt-1">
            {pendingAgentActions.map((action) => (
              <div
                key={action.id}
                className="p-4 rounded-xl bg-white dark:bg-[#101C31] border border-[#16B8A6]/20 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                      {action.workflowType === "new_prescription"
                        ? "New Medication Detected"
                        : action.workflowType === "repeat_test"
                        ? "Repeat Lab Test Due"
                        : action.workflowType === "doctor_visit_prep"
                        ? "Doctor Visit Prep"
                        : "Clinical Follow-up"}
                    </span>
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      {action.proposedAction}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    <strong className="text-slate-700 dark:text-slate-300">Clinical Reason:</strong> {action.reason}
                  </p>
                  {action.sourceRecordTitle && (
                    <div className="text-[11px] text-[#16B8A6] flex items-center gap-1 font-semibold">
                      <FileText className="w-3 h-3" />
                      <span>Grounded in: {action.sourceRecordTitle}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleRejectAction(action.id)}
                    disabled={actionProcessing === action.id}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                  >
                    {t("rejectAction")}
                  </button>
                  <button
                    onClick={() => handleApproveAction(action.id)}
                    disabled={actionProcessing === action.id}
                    className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-lg bg-[#16B8A6] hover:bg-[#66E3D3] text-[#101C31] shadow-xs transition-colors"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>{t("approveAction")}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* HEALTH INSIGHT CARDS */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#16B8A6]" />
            <span>{language === "te" ? "వైద్య రికార్డుల ఆధారిత విశ్లేషణలు" : language === "hi" ? "प्रमाण-आधारित स्वास्थ्य अंतर्दृष्टि" : "Evidence-Based Clinical Trajectories"}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold">
              {insights.length}
            </span>
          </h2>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-400 text-xs">Analyzing records...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {insights.map((insight) => {
              const isUrgent = insight.severity === "urgent_review";
              const isModerate = insight.severity === "moderate";

              return (
                <div
                  key={insight.id}
                  className={`p-5 rounded-2xl bg-white dark:bg-[#101C31] border transition-all shadow-xs flex flex-col justify-between ${
                    isUrgent
                      ? "border-rose-300 dark:border-rose-900/60 bg-rose-50/20"
                      : isModerate
                      ? "border-amber-300 dark:border-amber-900/60 bg-amber-50/10"
                      : "border-slate-200 dark:border-slate-800"
                  }`}
                >
                  <div className="space-y-3">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3">
                      <span
                        className={`px-2.5 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider ${
                          isUrgent
                            ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300"
                            : isModerate
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300"
                            : "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300 border border-teal-300"
                        }`}
                      >
                        {insight.severity.replace("_", " ")}
                      </span>
                      <span className="text-xs font-mono text-slate-400">{insight.dates}</span>
                    </div>

                    <h3 className="font-extrabold text-base text-slate-900 dark:text-white leading-snug">
                      {insight.title}
                    </h3>

                    {/* Measured Values Badge */}
                    <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-[#172944] text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center justify-between">
                      <span>Recorded Range:</span>
                      <span className="font-mono font-bold text-[#16B8A6]">{insight.relevantValues}</span>
                    </div>

                    {/* Detailed Observation */}
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      {insight.observation}
                    </p>

                    {/* Why Attention is Needed */}
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#172944]/60 border border-slate-100 dark:border-slate-800 space-y-1">
                      <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span>Why Attention is Needed</span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        {insight.whyAttentionNeeded}
                      </p>
                    </div>

                    {/* Recommended Next Step */}
                    <div className="text-xs text-teal-700 dark:text-[#66E3D3] font-medium flex items-start gap-1.5">
                      <ArrowRight className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#16B8A6]" />
                      <span>{insight.recommendedNextStep}</span>
                    </div>

                    {/* Supporting Records Tag */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {insight.supportingRecords.map((rec, i) => (
                        <span
                          key={i}
                          className="text-[10px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium"
                        >
                          📄 {rec}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Question to Ask Doctor button */}
                  <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                    <button
                      onClick={() =>
                        copyToClipboard(
                          `Doctor discussion point on ${insight.title}: ${insight.whyAttentionNeeded} Measured: ${insight.relevantValues}`,
                          insight.id
                        )
                      }
                      className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                    >
                      {copiedId === insight.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                          <span className="text-emerald-500 font-bold">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy for Doctor Visit</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => {
                        if (onLaunchAIBotWithContext) {
                          onLaunchAIBotWithContext(
                            "insights",
                            `Explain the clinical implications of my insight: "${insight.title}" (${insight.relevantValues}). What should I ask my doctor?`
                          );
                        }
                      }}
                      className="flex items-center gap-1 text-xs font-bold text-[#16B8A6] hover:underline"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Deep Dive</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
