import React, { useState, useEffect, useRef } from "react";
import {
  Brain,
  Plus,
  Send,
  Sparkles,
  Search,
  Trash2,
  Copy,
  Check,
  AlertTriangle,
  FileText,
  Activity,
  Calendar,
  Layers,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Globe,
  HelpCircle,
  Pill,
  ExternalLink,
  Lock,
  Stethoscope,
  BookOpen,
  Info,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext.js";
import { useLanguage } from "../../context/LanguageContext.js";
import { AIConversation, AIMessage, ViewTab } from "../../types/health.js";

interface AIBotsViewProps {
  onNavigateTab: (tab: ViewTab) => void;
  initialPageContext?: string;
  initialPrompt?: string;
}

export const AIBotsView: React.FC<AIBotsViewProps> = ({
  onNavigateTab,
  initialPageContext = "auto",
  initialPrompt = "",
}) => {
  const { user, activeProfileKey } = useAuth();
  const { t, language, setLanguage } = useLanguage();

  const [conversations, setConversations] = useState<AIConversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [inputText, setInputText] = useState<string>(initialPrompt);
  const [loadingConv, setLoadingConv] = useState<boolean>(true);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Context / Capability Selector
  // 'auto': Smart auto-routing (general medical Q&A vs personal vault records)
  // 'general': Explicit general health education (independent of documents)
  // 'records': Explicit medical records & laboratory reports
  // 'tracking': Explicit daily tracking (sleep, water, meals, activity, mood)
  // 'journal': Health journal & doctor questions
  // 'reminders': Reminders & active medications
  const [selectedContext, setSelectedContext] = useState<string>(initialPageContext || "auto");
  const [activeTabCategory, setActiveTabCategory] = useState<"general" | "medicines" | "tests" | "vault">("general");

  // Voice Assistant (Speech Recognition & Text to Speech)
  const [isListening, setIsListening] = useState<boolean>(false);
  const [speechSupported, setSpeechSupported] = useState<boolean>(false);
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  // Sync incoming initial prompt prop
  useEffect(() => {
    if (initialPrompt) {
      setInputText(initialPrompt);
    }
  }, [initialPrompt]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      setSpeechSupported(true);
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = language === "te" ? "te-IN" : language === "hi" ? "hi-IN" : "en-US";
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputText((prev) => (prev ? `${prev} ${transcript}` : transcript));
        setIsListening(false);
      };
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);
      recognitionRef.current = recognition;
    }
  }, [language]);

  const toggleVoiceInput = () => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.lang = language === "te" ? "te-IN" : language === "hi" ? "hi-IN" : "en-US";
        recognitionRef.current.start();
        setIsListening(true);
      } catch (e) {
        console.warn("Speech recognition error:", e);
      }
    }
  };

  const handleSpeak = (text: string, msgId: string) => {
    if (!("speechSynthesis" in window)) return;
    if (speakingMsgId === msgId) {
      window.speechSynthesis.cancel();
      setSpeakingMsgId(null);
      return;
    }
    window.speechSynthesis.cancel();
    const cleanText = text.replace(/[*_#`~[\]]/g, "").replace(/\n+/g, " ");
    const utterance = new SpeechSynthesisUtterance(cleanText.slice(0, 1000));
    utterance.lang = language === "te" ? "te-IN" : language === "hi" ? "hi-IN" : "en-US";
    utterance.onend = () => setSpeakingMsgId(null);
    utterance.onerror = () => setSpeakingMsgId(null);
    setSpeakingMsgId(msgId);
    window.speechSynthesis.speak(utterance);
  };

  // Fetch conversations
  const fetchConversations = async () => {
    try {
      setLoadingConv(true);
      const res = await fetch("/api/ai-bots/conversations");
      const data = await res.json();
      const list = data.conversations || [];
      setConversations(list);
      if (list.length > 0 && !activeConvId) {
        setActiveConvId(list[0].id);
      }
    } catch (err) {
      console.error("Failed to load conversations:", err);
    } finally {
      setLoadingConv(false);
    }
  };

  // Fetch messages for active conversation
  const fetchMessages = async (convId: string) => {
    try {
      const res = await fetch(`/api/ai-bots/conversations/${convId}/messages`);
      const data = await res.json();
      setMessages(data.messages || []);
      setTimeout(scrollToBottom, 100);
    } catch (err) {
      console.error("Failed to load messages:", err);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, [activeProfileKey]);

  useEffect(() => {
    if (activeConvId) {
      fetchMessages(activeConvId);
    } else {
      setMessages([]);
    }
  }, [activeConvId]);

  // Create new conversation
  const handleNewConversation = async () => {
    try {
      const title =
        language === "hi" ? "नई स्वास्थ्य परामर्श बातचीत" : "New Health Consultation";
      const res = await fetch("/api/ai-bots/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, pageContext: selectedContext }),
      });
      const data = await res.json();
      if (data.success) {
        setConversations([data.conversation, ...conversations]);
        setActiveConvId(data.conversation.id);
        setMessages([]);
      }
    } catch (err) {
      setChatError("Failed to create conversation");
    }
  };

  // Delete conversation
  const handleDeleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch(`/api/ai-bots/conversations/${id}`, { method: "DELETE" });
      const remaining = conversations.filter((c) => c.id !== id);
      setConversations(remaining);
      if (activeConvId === id) {
        setActiveConvId(remaining.length > 0 ? remaining[0].id : null);
      }
    } catch (err) {
      console.error("Failed to delete conversation:", err);
    }
  };

  // Clear current conversation messages
  const handleClearMessages = async () => {
    if (!activeConvId) return;
    try {
      await fetch(`/api/ai-bots/conversations/${activeConvId}/clear`, { method: "POST" });
      setMessages([]);
    } catch (err) {
      console.error("Failed to clear messages:", err);
    }
  };

  // Send message to Healthora AI
  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || isSending) return;

    setChatError(null);
    setIsSending(true);

    // Optimistically show user bubble
    const tempUserMsg: AIMessage = {
      id: `temp-${Date.now()}`,
      conversationId: activeConvId || "new",
      role: "user",
      content: text,
      timestamp: new Date().toISOString(),
      pageContext: selectedContext,
    };
    setMessages((prev) => [...prev, tempUserMsg]);
    setInputText("");
    setTimeout(scrollToBottom, 50);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 9000);

    try {
      const res = await fetch("/api/ai-bots/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          conversationId: activeConvId,
          message: text,
          pageContext: selectedContext,
          language: language,
        }),
      });

      const data = await res.json();
      if (data.success && data.message) {
        if (!activeConvId) {
          setActiveConvId(data.conversationId);
          fetchConversations();
        }
        // Replace temp or append model response
        setMessages((prev) => [
          ...prev.filter((m) => m.id !== tempUserMsg.id),
          {
            ...tempUserMsg,
            id: `msg-${Date.now()}-u`,
            conversationId: data.conversationId,
          },
          data.message,
        ]);
        setTimeout(scrollToBottom, 100);
      } else {
        setChatError(data.error || "Failed to get response from Healthora AI");
      }
    } catch (err: any) {
      if (err?.name === "AbortError") {
        setChatError("Request timed out. Please click retry to receive immediate grounded clinical guidance.");
      } else {
        setChatError(err?.message || "Network error communicating with Healthora AI");
      }
    } finally {
      clearTimeout(timeoutId);
      setIsSending(false);
    }
  };

  // Copy Response
  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Categorized Suggested Questions (Covering the 10 core criteria and medical education)
  const suggestedQuestionsByCategory = {
    general: [
      {
        en: "What is diabetes, and what are its common symptoms?",
        hi: "डायबिटीज क्या है और इसके मुख्य लक्षण क्या हैं?",
      },
      {
        en: "Why can someone experience frequent headaches?",
        hi: "बार-बार सिरदर्द होने के क्या कारण हो सकते हैं?",
      },
      {
        en: "What is the difference between a viral and a bacterial infection?",
        hi: "वायरल और बैक्टीरियल इन्फेक्शन में क्या अंतर है?",
      },
      {
        en: "Explain high blood pressure in simple language.",
        hi: "हाई ब्लड प्रेशर को सरल भाषा में समझाएं।",
      },
    ],
    medicines: [
      {
        en: "What does vitamin B12 do in the human body?",
        hi: "विटामिन बी12 मानव शरीर में क्या कार्य करता है?",
      },
      {
        en: "What are the common side effects of paracetamol?",
        hi: "पैरासिटामोल के सामान्य दुष्प्रभाव और सावधानियां क्या हैं?",
      },
      {
        en: "How can I improve my sleep habits?",
        hi: "मैं अपनी नींद की आदतों में कैसे सुधार कर सकता हूँ?",
      },
      {
        en: "What are good dietary sources of iron and vitamin C?",
        hi: "आयरन और विटामिन सी के अच्छे खाद्य स्रोत कौन से हैं?",
      },
    ],
    tests: [
      {
        en: "What is the purpose of a complete blood count test?",
        hi: "कम्प्लीट ब्लड काउंट (CBC) टेस्ट का उद्देश्य क्या है?",
      },
      {
        en: "How are lipid profile cholesterol tests interpreted?",
        hi: "लिपिड प्रोफाइल कोलेस्ट्रॉल टेस्ट की व्याख्या कैसे की जाती है?",
      },
      {
        en: "What is an HbA1c test and what does it measure?",
        hi: "HbA1c टेस्ट क्या है और यह क्या मापता है?",
      },
      {
        en: "Why do doctors order liver function tests (LFT)?",
        hi: "डॉक्टर लिवर फंक्शन टेस्ट (LFT) क्यों करवाते हैं?",
      },
    ],
    vault: [
      {
        en: "What was my latest HbA1c result?",
        hi: "मेरा नवीनतम HbA1c परिणाम क्या था?",
        te: "నా తాజా HbA1c ఫలితం ఎంత?",
      },
      {
        en: "What does my latest cholesterol report say?",
        hi: "मेरी नवीनतम कोलेस्ट्रॉल रिपोर्ट क्या कहती है?",
        te: "నా తాజా కొలెస్ట్రాల్ రిపోర్ట్ ఏమి చెబుతోంది?",
      },
      {
        en: "What were my previous blood pressure readings?",
        hi: "मेरे पिछले रक्तचाप (BP) की रीडिंग क्या थी?",
        te: "నా మునుపటి రక్తపోటు రీడింగులు ఏమిటి?",
      },
      {
        en: "Which medicines are currently prescribed to me?",
        hi: "वर्तमान में मुझे कौन सी दवाएं निर्धारित हैं?",
        te: "ప్రస్తుతం నాకు ఏ మందులు సూచించబడ్డాయి?",
      },
      {
        en: "When is my next appointment?",
        hi: "मेरी अगली डॉक्टर नियुक्ति कब है?",
        te: "నా తదుపరి డాక్టర్ అపాయింట్‌మెంట్ ఎప్పుడు?",
      },
      {
        en: "Have my laboratory results changed over time?",
        hi: "क्या समय के साथ मेरे लैब परिणाम बदले हैं?",
        te: "కాలక్రమేణా నా ల్యాబ్ ఫలితాలు ఎలా మారాయి?",
      },
      {
        en: "What should I discuss with my doctor?",
        hi: "मुझे अपने डॉक्टर से क्या चर्चा करनी चाहिए?",
        te: "నేను నా డాక్టర్‌తో ఏమి చర్చించాలి?",
      },
      {
        en: "Are any recorded follow-ups overdue?",
        hi: "क्या कोई अनुवर्ती कार्य (Follow-up) अतिदेय है?",
        te: "ఏవైనా రికార్డ్ చేయబడిన ఫాలో-అప్‌లు గడువు దాటిపోయాయా?",
      },
      {
        en: "Can you explain this medical term in simple English?",
        hi: "इस मेडिकल शब्द को सरल भाषा में समझाएं।",
        te: "ఈ వైద్య పదాన్ని సులభమైన ఆంగ్లంలో వివరించండి.",
      },
      {
        en: "Can you explain my report in Telugu?",
        hi: "क्या आप मेरी रिपोर्ट तेलुगु में समझा सकते हैं?",
        te: "నా రిపోర్టును తెలుగులో సమగ్రంగా వివరించండి.",
      },
    ],
  };

  const filteredConversations = conversations.filter((c) =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-[calc(100vh-5rem)] max-w-7xl mx-auto rounded-2xl overflow-hidden bg-white dark:bg-[#101C31] border border-[#E4EAF1] dark:border-[#1B2D48] shadow-xl animate-fade-in">
      {/* 1. LEFT SIDEBAR: Conversations List */}
      <div className="w-72 sm:w-80 border-r border-[#E4EAF1] dark:border-[#1B2D48] bg-slate-50/70 dark:bg-[#0D1628] flex flex-col justify-between shrink-0 hidden md:flex">
        {/* Top: Header & New Chat */}
        <div className="p-4 border-b border-[#E4EAF1] dark:border-[#1B2D48] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-[#16B8A6]/10 text-[#16B8A6]">
                <Brain className="w-4 h-4" />
              </span>
              <div>
                <h2 className="text-sm font-extrabold text-[#142238] dark:text-white flex items-center gap-1.5">
                  Healthora AI
                  <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-teal-500/10 text-teal-600 dark:text-teal-400 font-bold">
                    2.0
                  </span>
                </h2>
                <span className="text-[10px] text-[#16B8A6] font-semibold tracking-wide block">
                  Gemini 3.8 Flash • Dual-Mode
                </span>
              </div>
            </div>

            <button
              onClick={handleNewConversation}
              className="p-1.5 rounded-lg bg-[#16B8A6] hover:bg-[#66E3D3] text-[#101C31] font-bold transition-all shadow-xs cursor-pointer"
              title={t("newConversation") || "New Chat"}
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Search Conversations */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("searchConversations") || "Search conversations..."}
              className="w-full pl-8 pr-2.5 py-1.5 text-xs rounded-xl bg-white dark:bg-[#172944] border border-[#E4EAF1] dark:border-[#1B2D48] text-[#142238] dark:text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
          </div>
        </div>

        {/* Conversation Items */}
        <div className="flex-1 overflow-y-auto p-2.5 space-y-1">
          {filteredConversations.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400">
              No conversations found. Click + to begin a new health consultation.
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const isActive = activeConvId === conv.id;
              return (
                <div
                  key={conv.id}
                  onClick={() => setActiveConvId(conv.id)}
                  className={`group flex items-center justify-between p-2.5 rounded-xl cursor-pointer text-xs font-semibold transition-all ${
                    isActive
                      ? "bg-[#16B8A6]/15 text-[#16B8A6] dark:text-[#66E3D3] border border-[#16B8A6]/30 shadow-xs"
                      : "text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-[#172944]"
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <div className="truncate font-bold">{conv.title}</div>
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">
                      {new Date(conv.updatedAt || conv.createdAt).toLocaleDateString()}
                    </div>
                  </div>

                  <button
                    onClick={(e) => handleDeleteConversation(conv.id, e)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-500 rounded-md transition-opacity"
                    title="Delete Conversation"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Bottom Profile Info */}
        <div className="p-3 border-t border-[#E4EAF1] dark:border-[#1B2D48] text-[11px] text-slate-500 flex items-center justify-between bg-slate-100/50 dark:bg-[#0A1220]">
          <span className="truncate font-medium">{user?.name}</span>
          <button
            onClick={() => setLanguage(language === "en" ? "hi" : "en")}
            className="px-2 py-0.5 rounded-md bg-[#16B8A6]/10 text-[#16B8A6] hover:bg-[#16B8A6]/20 font-bold transition-colors cursor-pointer"
            title="Toggle Language"
          >
            {language === "hi" ? "हिन्दी" : "English"}
          </button>
        </div>
      </div>

      {/* 2. RIGHT / MAIN CHAT AREA */}
      <div className="flex-1 flex flex-col h-full min-w-0 bg-white dark:bg-[#101C31]">
        {/* Top Context & Capability Bar */}
        <div className="p-3.5 sm:p-4 border-b border-[#E4EAF1] dark:border-[#1B2D48] flex flex-wrap items-center justify-between gap-3 bg-white/90 dark:bg-[#101C31]/90 backdrop-blur-md">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="p-2 rounded-xl bg-gradient-to-tr from-[#16B8A6]/20 to-[#66E3D3]/20 text-[#16B8A6] shrink-0">
              <Stethoscope className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm font-extrabold text-[#142238] dark:text-white truncate">
                  AI Health Assistant
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-50 dark:bg-teal-950/60 text-[#16B8A6] border border-teal-200 dark:border-teal-900/60 shrink-0 flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5" />
                  Dual-Mode AI Active
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate">
                General Medical Knowledge & Authorized Personal Vault Records
              </p>
            </div>
          </div>

          {/* Context Selector Pill & Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1.5 bg-[#F5F7FB] dark:bg-[#172944] px-2.5 py-1 rounded-xl border border-[#E4EAF1] dark:border-[#1B2D48] text-xs">
              <Layers className="w-3.5 h-3.5 text-[#16B8A6]" />
              <span className="text-slate-400 text-[11px] font-medium hidden sm:inline">Mode:</span>
              <select
                value={selectedContext}
                onChange={(e) => setSelectedContext(e.target.value)}
                className="bg-transparent font-bold text-slate-800 dark:text-slate-200 focus:outline-none text-xs cursor-pointer"
              >
                <option value="auto">Auto-Detect (General AI & Vault Records)</option>
                <option value="general">General Health AI (Independent Medical Q&A)</option>
                <option value="records">Personal Records & Labs</option>
                <option value="tracking">Daily Tracking (Sleep, Water, Meals, Activity)</option>
                <option value="journal">Health Journal & Doctor Questions</option>
                <option value="reminders">Reminders & Medications</option>
              </select>
            </div>

            {messages.length > 0 && (
              <button
                onClick={handleClearMessages}
                className="p-1.5 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-[#172944] transition-colors cursor-pointer"
                title="Clear current conversation"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Messages Stream */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* Welcome Card if no messages */}
          {messages.length === 0 && (
            <div className="max-w-3xl mx-auto py-6 text-center space-y-5 animate-fade-in">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#16B8A6] to-[#66E3D3] flex items-center justify-center mx-auto shadow-lg shadow-teal-500/20">
                <Brain className="w-7 h-7 text-[#101C31]" />
              </div>

              <div>
                <h3 className="text-xl font-black text-[#142238] dark:text-white">
                  {language === "hi"
                    ? "हेल्थोरा संपूर्ण एआई स्वास्थ्य सहायक"
                    : "Healthora Complete AI Health Assistant"}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 max-w-xl mx-auto leading-relaxed">
                  {language === "hi"
                    ? "सामान्य स्वास्थ्य, बीमारियों, दवाओं और लक्षणों पर स्वतंत्र वैज्ञानिक मार्गदर्शन प्राप्त करें — या अपनी अधिकृत लैब रिपोर्टों और दैनिक ट्रैकिंग का व्यक्तिगत विश्लेषण करें।"
                    : "Ask broad medical education questions independently without requiring uploaded documents, or securely analyze your personal medical reports, lab results, and wellness tracking."}
                </p>
              </div>

              {/* Two Distinct Capabilities Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left max-w-xl mx-auto">
                <div className="p-3.5 rounded-xl bg-teal-50/60 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-900/40">
                  <div className="flex items-center gap-2 text-xs font-bold text-teal-800 dark:text-teal-300">
                    <BookOpen className="w-4 h-4 text-[#16B8A6]" />
                    <span>1. General Health AI</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 leading-normal">
                    Answers diseases, symptoms, tests, medicines, nutrition, fitness, and first aid independently using authoritative clinical evidence (WHO, MedlinePlus, CDC).
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-sky-50/60 dark:bg-sky-950/20 border border-sky-200 dark:border-sky-900/40">
                  <div className="flex items-center gap-2 text-xs font-bold text-sky-800 dark:text-sky-300">
                    <Lock className="w-4 h-4 text-sky-500" />
                    <span>2. Personal Medical Records AI</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 leading-normal">
                    Personalized explanations, trend comparisons, and doctor visit prep grounded strictly in your authenticated medical reports and daily tracking logs.
                  </p>
                </div>
              </div>

              {/* Emergency Banner Notice */}
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-left text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2.5 max-w-xl mx-auto">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span className="leading-relaxed">
                  <strong>Clinical Notice:</strong> Healthora is an educational healthcare assistant and does not provide definitive medical diagnoses or prescribe medications. For emergencies, please call emergency services immediately (108 / 112 in India, 911 in USA).
                </span>
              </div>

              {/* Suggested Inquiries Tabs & Grid */}
              <div className="pt-2 text-left max-w-2xl mx-auto">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    {language === "hi" ? "सुझाए गए प्रश्न:" : "Suggested Questions:"}
                  </span>

                  {/* Category Pills */}
                  <div className="flex gap-1">
                    <button
                      onClick={() => setActiveTabCategory("general")}
                      className={`px-2 py-0.5 text-[10px] rounded-lg font-bold transition-all ${
                        activeTabCategory === "general"
                          ? "bg-[#16B8A6] text-[#101C31]"
                          : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                      }`}
                    >
                      General Health
                    </button>
                    <button
                      onClick={() => setActiveTabCategory("medicines")}
                      className={`px-2 py-0.5 text-[10px] rounded-lg font-bold transition-all ${
                        activeTabCategory === "medicines"
                          ? "bg-[#16B8A6] text-[#101C31]"
                          : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                      }`}
                    >
                      Medicines & Nutrition
                    </button>
                    <button
                      onClick={() => setActiveTabCategory("tests")}
                      className={`px-2 py-0.5 text-[10px] rounded-lg font-bold transition-all ${
                        activeTabCategory === "tests"
                          ? "bg-[#16B8A6] text-[#101C31]"
                          : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                      }`}
                    >
                      Medical Tests
                    </button>
                    <button
                      onClick={() => setActiveTabCategory("vault")}
                      className={`px-2 py-0.5 text-[10px] rounded-lg font-bold transition-all ${
                        activeTabCategory === "vault"
                          ? "bg-[#16B8A6] text-[#101C31]"
                          : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                      }`}
                    >
                      Personal Vault
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {suggestedQuestionsByCategory[activeTabCategory].map((q, idx) => {
                    const label = language === "te" ? (q as any).te || q.en : language === "hi" ? q.hi : q.en;
                    return (
                      <button
                        key={idx}
                        onClick={() => handleSendMessage(label)}
                        className="p-3 text-left rounded-xl bg-[#F5F7FB] hover:bg-[#E6F8F4] dark:bg-[#172944] dark:hover:bg-[#1B2D48] text-xs font-semibold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 transition-colors flex items-center justify-between group cursor-pointer"
                      >
                        <span className="pr-2">{label}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#16B8A6] shrink-0" />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Render Messages */}
          {messages.map((msg) => {
            const isUser = msg.role === "user";
            const usesPersonalRecord = msg.isPersonalRecordUsed;
            const isGeneralMode = msg.mode === "general" || !usesPersonalRecord;

            return (
              <div
                key={msg.id}
                className={`flex gap-3 max-w-3xl ${
                  isUser ? "ml-auto justify-end" : "mr-auto justify-start"
                }`}
              >
                {!isUser && (
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#16B8A6]/20 to-[#66E3D3]/20 text-[#16B8A6] flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                    {usesPersonalRecord ? (
                      <Lock className="w-4 h-4 text-[#16B8A6]" />
                    ) : (
                      <Brain className="w-4 h-4 text-[#16B8A6]" />
                    )}
                  </div>
                )}

                <div
                  className={`rounded-2xl p-4 text-xs leading-relaxed transition-all ${
                    isUser
                      ? "bg-[#16B8A6] text-[#101C31] font-medium shadow-md rounded-br-xs"
                      : "bg-[#F8FAFC] dark:bg-[#172944] text-[#142238] dark:text-slate-100 border border-[#E4EAF1] dark:border-[#1B2D48] shadow-xs rounded-bl-xs"
                  }`}
                >
                  {/* Mode / Data Source Badge on Model Response */}
                  {!isUser && (
                    <div className="mb-2.5 pb-2 border-b border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between gap-2 flex-wrap">
                      {usesPersonalRecord ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 text-[10px] font-bold">
                          <Lock className="w-3 h-3 text-[#16B8A6]" />
                          Personal Health Vault Records Used
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-[10px] font-bold">
                          <Stethoscope className="w-3 h-3 text-indigo-500" />
                          General Medical AI Intelligence
                        </span>
                      )}

                      <span className="text-[10px] text-slate-400 font-mono">
                        {new Date(msg.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  )}

                  {/* Message Content with clean formatting */}
                  <div className="whitespace-pre-line prose-xs dark:prose-invert leading-relaxed space-y-1">
                    {msg.content}
                  </div>

                  {/* Sources Grounding Indicator & References */}
                  {!isUser && msg.sources && msg.sources.length > 0 && (
                    <div className="mt-3.5 pt-2.5 border-t border-slate-200 dark:border-slate-700/80 space-y-1.5">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#16B8A6] uppercase tracking-wider">
                        <ShieldCheck className="w-3 h-3" />
                        <span>Evidence & Clinical References:</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {msg.sources.map((src, i) => {
                          const isLink = !!src.url;
                          return isLink ? (
                            <a
                              key={i}
                              href={src.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-[#101C31] text-teal-700 dark:text-teal-300 hover:text-teal-900 dark:hover:text-white text-[10px] font-semibold border border-teal-200 dark:border-teal-800/80 hover:border-teal-400 transition-colors shadow-2xs"
                              title={src.detail}
                            >
                              <span>{src.label}</span>
                              <ExternalLink className="w-2.5 h-2.5 shrink-0 text-teal-500" />
                            </a>
                          ) : (
                            <button
                              key={i}
                              onClick={() => {
                                if (src.type === "document" || src.type === "lab") {
                                  onNavigateTab("records");
                                } else if (src.type === "medication") {
                                  onNavigateTab("medications");
                                } else if (src.type === "tracking") {
                                  onNavigateTab("tracking");
                                } else {
                                  onNavigateTab("appointments");
                                }
                              }}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-[#101C31] text-slate-700 dark:text-slate-200 hover:text-teal-600 dark:hover:text-[#66E3D3] hover:border-[#16B8A6] text-[10px] font-semibold border border-slate-200 dark:border-slate-800 shadow-2xs transition-all cursor-pointer group"
                              title={`Click to open source record: ${src.detail || src.label}`}
                            >
                              <FileText className="w-2.5 h-2.5 text-slate-400 group-hover:text-[#16B8A6]" />
                              <span>{src.label}</span>
                              <ArrowRight className="w-2.5 h-2.5 text-slate-400 group-hover:text-[#16B8A6] opacity-60 group-hover:opacity-100" />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Action toolbar (listen & copy) */}
                  {!isUser && (
                    <div className="mt-3 pt-1.5 flex items-center justify-between text-[10px] text-slate-400">
                      <span className="flex items-center gap-1">
                        <Info className="w-2.5 h-2.5" />
                        Informational health assistance
                      </span>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleSpeak(msg.content, msg.id)}
                          className={`flex items-center gap-1 transition-colors cursor-pointer font-medium ${
                            speakingMsgId === msg.id ? "text-[#16B8A6] font-bold animate-pulse" : "hover:text-[#16B8A6]"
                          }`}
                          title={speakingMsgId === msg.id ? "Stop Speaking" : "Read Answer Aloud"}
                        >
                          {speakingMsgId === msg.id ? (
                            <>
                              <VolumeX className="w-3 h-3 text-rose-500" />
                              <span className="text-rose-500">{t("voiceSpeaking")}</span>
                            </>
                          ) : (
                            <>
                              <Volume2 className="w-3 h-3" />
                              <span>Listen</span>
                            </>
                          )}
                        </button>

                        <button
                          onClick={() => handleCopy(msg.content, msg.id)}
                          className="flex items-center gap-1 hover:text-[#16B8A6] transition-colors cursor-pointer font-medium"
                        >
                          {copiedId === msg.id ? (
                            <>
                              <Check className="w-3 h-3 text-[#16B8A6]" />
                              <span className="text-[#16B8A6] font-bold">
                                {t("copied") || "Copied!"}
                              </span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>{t("copyResponse") || "Copy Answer"}</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Typing / Synthesis Indicator */}
          {isSending && (
            <div className="flex items-center gap-3 text-xs text-slate-400 mr-auto">
              <div className="w-8 h-8 rounded-xl bg-[#16B8A6]/10 text-[#16B8A6] flex items-center justify-center shrink-0">
                <Brain className="w-4 h-4 animate-pulse" />
              </div>
              <div className="flex items-center gap-1.5 p-3 rounded-2xl bg-[#F8FAFC] dark:bg-[#172944] border border-[#E4EAF1] dark:border-[#1B2D48]">
                <span
                  className="w-2 h-2 rounded-full bg-[#16B8A6] animate-bounce"
                  style={{ animationDelay: "0ms" }}
                />
                <span
                  className="w-2 h-2 rounded-full bg-[#16B8A6] animate-bounce"
                  style={{ animationDelay: "150ms" }}
                />
                <span
                  className="w-2 h-2 rounded-full bg-[#16B8A6] animate-bounce"
                  style={{ animationDelay: "300ms" }}
                />
                <span className="ml-2 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  Healthora Gemini synthesizing clinical guidance...
                </span>
              </div>
            </div>
          )}

          {/* Chat Error State with Retry Button */}
          {chatError && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{chatError}</span>
              </div>
              <button
                onClick={() => handleSendMessage()}
                className="px-2.5 py-1 rounded-md bg-rose-600 hover:bg-rose-500 text-white font-bold text-[11px] transition-colors cursor-pointer"
              >
                Retry
              </button>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-3.5 sm:p-4 border-t border-[#E4EAF1] dark:border-[#1B2D48] bg-white dark:bg-[#101C31]">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2"
          >
            <div className="relative flex-1">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={
                  language === "te"
                    ? "ఆరోగ్య సమస్యలు, మందులు లేదా మీ మెడికల్ రిపోర్టులపై ప్రశ్నలను అడగండి..."
                    : language === "hi"
                    ? "कोई भी स्वास्थ्य, बीमारी, लक्षण या अपनी रिपोर्ट संबंधी प्रश्न पूछें..."
                    : "Ask any general health question or inquire about your personal medical reports..."
                }
                disabled={isSending}
                className="w-full pl-4 pr-10 py-3 text-xs rounded-xl bg-[#F5F7FB] dark:bg-[#172944] border border-[#E4EAF1] dark:border-[#1B2D48] text-[#142238] dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#16B8A6] disabled:opacity-50"
              />
              {isListening && (
                <span className="absolute right-3 top-3 flex items-center gap-1 text-[11px] font-bold text-rose-500 animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
                  Listening...
                </span>
              )}
            </div>

            {speechSupported && (
              <button
                type="button"
                onClick={toggleVoiceInput}
                className={`p-3 rounded-xl border transition-all cursor-pointer ${
                  isListening
                    ? "bg-rose-500 text-white border-rose-600 animate-pulse ring-2 ring-rose-400"
                    : "bg-[#F5F7FB] dark:bg-[#172944] text-slate-600 dark:text-slate-300 border-[#E4EAF1] dark:border-[#1B2D48] hover:text-[#16B8A6]"
                }`}
                title={isListening ? "Listening... click to stop" : "Speak question (Voice input)"}
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
            )}

            <button
              type="submit"
              disabled={isSending || !inputText.trim()}
              className="p-3 rounded-xl bg-[#16B8A6] hover:bg-[#66E3D3] text-[#101C31] font-bold transition-all shadow-md active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              title="Send to Healthora AI"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>

          <div className="flex items-center justify-between text-[10px] text-slate-400 mt-2 px-1">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3 h-3 text-[#16B8A6]" />
              Dual-Capability AI: Answers general medical topics & analyzes uploaded reports
            </span>
            <span className="hidden sm:inline font-mono">Press Enter to send</span>
          </div>
        </div>
      </div>
    </div>
  );
};
