import React, { useState, useEffect } from "react";
import {
  HeartPulse,
  Apple,
  Dumbbell,
  Moon,
  Sparkles,
  ThumbsUp,
  X,
  ShieldCheck,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  BookOpen,
} from "lucide-react";
import { WellnessRecommendation, ViewTab } from "../../types/health.js";
import { useLanguage } from "../../context/LanguageContext.js";
import { useAuth } from "../../context/AuthContext.js";

interface WellnessCoachViewProps {
  onNavigateTab: (tab: ViewTab) => void;
  onLaunchAIBotWithContext?: (pageContext: string, initialPrompt?: string) => void;
}

export const WellnessCoachView: React.FC<WellnessCoachViewProps> = ({
  onNavigateTab,
  onLaunchAIBotWithContext,
}) => {
  const { t, language } = useLanguage();
  const { activeProfileKey } = useAuth();
  const [recommendations, setRecommendations] = useState<WellnessRecommendation[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [loading, setLoading] = useState<boolean>(true);

  const fetchRecommendations = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/wellness/recommendations");
      const data = await res.json();
      setRecommendations(data.recommendations || []);
    } catch (e) {
      console.warn("Failed to load recommendations:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecommendations();
  }, [activeProfileKey]);

  const handleFeedback = async (id: string, status: "helpful" | "dismissed") => {
    try {
      await fetch(`/api/wellness/recommendations/${id}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      setRecommendations((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status } : r))
      );
    } catch (e) {
      console.error("Feedback error:", e);
    }
  };

  const categories = [
    { key: "all", label: language === "te" ? "అన్నీ" : language === "hi" ? "सभी" : "All Guidance" },
    { key: "nutrition", label: language === "te" ? "పోషకాహారం" : language === "hi" ? "पोषण" : "Nutrition" },
    { key: "activity", label: language === "te" ? "వ్యాయామం" : language === "hi" ? "व्यायाम" : "Activity" },
    { key: "sleep", label: language === "te" ? "నిద్ర" : language === "hi" ? "नींद" : "Sleep" },
    { key: "habits", label: language === "te" ? "అలవాట్లు" : language === "hi" ? "आदतें" : "Habits" },
    { key: "preventive", label: language === "te" ? "ముందస్తు రక్షణ" : language === "hi" ? "निवारक देखभाल" : "Preventive" },
  ];

  const filtered = recommendations.filter((r) => {
    if (r.status === "dismissed") return false;
    if (selectedCategory === "all") return true;
    return r.category === selectedCategory;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-fade-in">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-[#101C31] via-[#172944] to-[#101C31] text-white border border-[#1B2D48] shadow-lg">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <div className="p-2 rounded-lg bg-[#16B8A6]/20 text-[#66E3D3]">
              <HeartPulse className="w-5 h-5" />
            </div>
            <h1 className="text-xl md:text-2xl font-black tracking-tight">
              {language === "te" ? "AI వెల్‌నెస్ కోచ్" : language === "hi" ? "एआई वेलनेस कोच" : "AI Wellness & Lifestyle Coach"}
            </h1>
          </div>
          <p className="text-xs md:text-sm text-slate-300 max-w-2xl">
            {language === "te"
              ? "మీ ఆరోగ్య స్థితికి అనుగుణంగా ఆహారం, నిద్ర, శారీరక శ్రమ మరియు అలవాట్లపై సాక్ష్యాధార మార్గదర్శకత్వం."
              : language === "hi"
              ? "आपकी व्यक्तिगत स्वास्थ्य स्थिति के अनुकूल भोजन, व्यायाम, नींद और आदतों पर प्रमाण-आधारित मार्गदर्शन।"
              : "Personalized lifestyle guidance adapted to your metabolic profile, sleep patterns, and confirmed prescriptions."}
          </p>
        </div>

        <button
          onClick={() => {
            if (onLaunchAIBotWithContext) {
              onLaunchAIBotWithContext(
                "wellness",
                "Recommend an optimal meal and hydration plan for a patient managing Type 2 Diabetes with Metformin."
              );
            }
          }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#16B8A6] hover:bg-[#66E3D3] text-[#101C31] text-xs font-bold transition-all shadow-md whitespace-nowrap self-start md:self-auto"
        >
          <Sparkles className="w-4 h-4" />
          <span>{language === "te" ? "వ్యక్తిగత ప్రణాళికను రూపొందించండి" : language === "hi" ? "कस्टम प्लान तैयार करें" : "Ask Coach AI"}</span>
        </button>
      </div>

      {/* Category Filter Pills */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        {categories.map((c) => (
          <button
            key={c.key}
            onClick={() => setSelectedCategory(c.key)}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
              selectedCategory === c.key
                ? "bg-[#16B8A6] text-white"
                : "bg-white dark:bg-[#101C31] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Recommendation Grid */}
      {loading ? (
        <div className="p-8 text-center text-slate-400 text-xs">Loading personalized guidance...</div>
      ) : filtered.length === 0 ? (
        <div className="p-8 rounded-2xl bg-white dark:bg-[#101C31] border border-slate-200 dark:border-slate-800 text-center space-y-2">
          <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto" />
          <div className="text-sm font-bold text-slate-800 dark:text-slate-200">
            All current recommendations reviewed!
          </div>
          <p className="text-xs text-slate-500">
            Log your daily meals or upload new medical records to generate refreshed coaching points.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filtered.map((item) => {
            const displayTitle =
              language === "te" && item.titleTe
                ? item.titleTe
                : language === "hi" && item.titleHi
                ? item.titleHi
                : item.title;

            const displaySuggestion =
              language === "te" && item.suggestionTe
                ? item.suggestionTe
                : language === "hi" && item.suggestionHi
                ? item.suggestionHi
                : item.suggestion;

            return (
              <div
                key={item.id}
                className="p-5 rounded-2xl bg-white dark:bg-[#101C31] border border-slate-200 dark:border-slate-800 shadow-xs hover:border-[#16B8A6]/40 transition-all flex flex-col justify-between"
              >
                <div className="space-y-3">
                  {/* Category Header */}
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-md text-[10px] font-extrabold uppercase bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300">
                      {item.category}
                    </span>
                    {item.status === "helpful" && (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                        <ThumbsUp className="w-3.5 h-3.5" />
                        <span>Saved as Helpful</span>
                      </span>
                    )}
                  </div>

                  <h3 className="font-extrabold text-base text-slate-900 dark:text-white leading-snug">
                    {displayTitle}
                  </h3>

                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                    {displaySuggestion}
                  </p>

                  {/* Why Relevant */}
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#172944] text-xs space-y-1">
                    <div className="font-bold text-slate-700 dark:text-slate-300">
                      Why Relevant For You:
                    </div>
                    <p className="text-slate-600 dark:text-slate-400 text-xs">
                      {item.whyRelevant}
                    </p>
                  </div>

                  {/* Supporting Evidence */}
                  <div className="text-xs text-slate-500 dark:text-slate-400 flex items-start gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-[#16B8A6] shrink-0 mt-0.5" />
                    <span><strong>Evidence:</strong> {item.supportingEvidence}</span>
                  </div>

                  {/* Practical Next Step */}
                  <div className="p-3 rounded-xl bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-900/40 text-xs space-y-1">
                    <div className="font-bold text-teal-800 dark:text-[#66E3D3] flex items-center gap-1">
                      <ArrowRight className="w-3.5 h-3.5" />
                      <span>Practical Action Step:</span>
                    </div>
                    <p className="text-teal-900 dark:text-teal-200 text-xs">
                      {item.practicalNextStep}
                    </p>
                  </div>

                  {/* Precaution */}
                  {item.precaution && (
                    <div className="text-[11px] text-amber-700 dark:text-amber-300/80 flex items-start gap-1.5">
                      <AlertCircle className="w-3 h-3 text-amber-500 shrink-0 mt-0.5" />
                      <span>{item.precaution}</span>
                    </div>
                  )}
                </div>

                {/* Feedback Actions */}
                <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleFeedback(item.id, "helpful")}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                        item.status === "helpful"
                          ? "bg-emerald-500 text-white"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                      }`}
                      title="Mark as helpful"
                    >
                      <ThumbsUp className="w-3.5 h-3.5" />
                      <span>Helpful</span>
                    </button>
                    <button
                      onClick={() => handleFeedback(item.id, "dismissed")}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      title="Dismiss this recommendation"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <button
                    onClick={() => {
                      if (onLaunchAIBotWithContext) {
                        onLaunchAIBotWithContext(
                          "wellness",
                          `Elaborate on this wellness recommendation: "${item.title}". How can I integrate "${item.practicalNextStep}" safely into my daily routine?`
                        );
                      }
                    }}
                    className="text-xs text-[#16B8A6] font-bold hover:underline flex items-center gap-1"
                  >
                    <span>Discuss with AI</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
