import React, { useState, useEffect } from "react";
import {
  Calendar,
  Clock,
  MapPin,
  User,
  Plus,
  CheckCircle,
  AlertTriangle,
  FileText,
  CalendarCheck,
  CalendarX,
  Stethoscope,
  Filter,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { AppointmentItem, ViewTab } from "../../types/health.js";
import { useLanguage } from "../../context/LanguageContext.js";
import { useAuth } from "../../context/AuthContext.js";

interface AppointmentsViewProps {
  onNavigateTab: (tab: ViewTab) => void;
  onLaunchAIBotWithContext?: (pageContext: string, initialPrompt?: string) => void;
}

export const AppointmentsView: React.FC<AppointmentsViewProps> = ({
  onNavigateTab,
  onLaunchAIBotWithContext,
}) => {
  const { t, language } = useLanguage();
  const { activeProfileKey } = useAuth();
  const [appointments, setAppointments] = useState<AppointmentItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filterType, setFilterType] = useState<"all" | "appointment" | "follow_up_task" | "repeat_test_task">("all");
  const [showScheduleModal, setShowScheduleModal] = useState<boolean>(false);

  // Form states
  const [title, setTitle] = useState("");
  const [doctorName, setDoctorName] = useState("");
  const [specialty, setSpecialty] = useState("Endocrinology");
  const [facility, setFacility] = useState("Apollo Specialty Hospital");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [time, setTime] = useState("10:00");
  const [purpose, setPurpose] = useState("");
  const [type, setType] = useState<"appointment" | "follow_up_task" | "repeat_test_task">("appointment");
  const [followUpInstructions, setFollowUpInstructions] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/appointments");
      const data = await res.json();
      setAppointments(data.appointments || []);
    } catch (e) {
      console.warn("Failed to load appointments:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, [activeProfileKey]);

  const handleUpdateStatus = async (id: string, status: "completed" | "cancelled" | "scheduled") => {
    try {
      await fetch(`/api/appointments/${id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      fetchAppointments();
    } catch (e) {
      console.error("Status update error:", e);
    }
  };

  const handleCreateAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !doctorName || !date || !time) return;

    try {
      setSaving(true);
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          doctorName,
          specialty,
          facility,
          date,
          time,
          purpose,
          type,
          followUpInstructions,
        }),
      });
      if (res.ok) {
        setShowScheduleModal(false);
        setTitle("");
        setDoctorName("");
        setPurpose("");
        setFollowUpInstructions("");
        fetchAppointments();
      }
    } catch (e) {
      console.error("Failed to create appointment:", e);
    } finally {
      setSaving(false);
    }
  };

  const filteredAppointments = appointments.filter((a) => {
    if (filterType === "all") return true;
    return a.type === filterType;
  });

  const upcomingList = filteredAppointments.filter((a) => a.status === "scheduled");
  const pastList = filteredAppointments.filter((a) => a.status !== "scheduled");
  const overdueCount = appointments.filter((a) => a.isOverdue || (a.status === "scheduled" && a.dueDate && a.dueDate < new Date().toISOString().split("T")[0])).length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-fade-in">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-[#101C31] via-[#172944] to-[#101C31] text-white border border-[#1B2D48] shadow-lg">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <div className="p-2 rounded-lg bg-[#16B8A6]/20 text-[#66E3D3]">
              <Calendar className="w-5 h-5" />
            </div>
            <h1 className="text-xl md:text-2xl font-black tracking-tight">
              {language === "te" ? "అపాయింట్‌మెంట్లు & క్లినికల్ ఫాలో-అప్‌లు" : language === "hi" ? "अपॉइंटमेंट्स व क्लिनिकल फॉलो-अप" : "Appointments & Clinical Follow-ups"}
            </h1>
          </div>
          <p className="text-xs md:text-sm text-slate-300 max-w-2xl">
            {language === "te"
              ? "వైద్యుల సందర్శనలు, పునరావృత పరీక్షలు మరియు తదుపరి కేర్ టాస్క్‌లను షెడ్యూల్ చేయండి."
              : language === "hi"
              ? "डॉक्टर परामर्श, दोबारा जरूरी टेस्ट और फॉलो-अप केयर टास्क का समयबद्ध प्रबंधन।"
              : "Track doctor visits, scheduled lab repeat tests, and clinical follow-up actions with smart alerts."}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowScheduleModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#16B8A6] hover:bg-[#66E3D3] text-[#101C31] text-xs font-bold transition-all shadow-md whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>{language === "te" ? "అపాయింట్‌మెంట్ జోడించండి" : language === "hi" ? "नया अपॉइंटमेंट जोड़ें" : "Schedule Appointment"}</span>
          </button>
        </div>
      </div>

      {/* Overdue Alert Banner if any */}
      {overdueCount > 0 && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start justify-between gap-3 text-amber-300">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-sm text-amber-200">
                {language === "te" ? `${overdueCount} ఫాలో-అప్ లేదా ల్యాబ్ టెస్ట్ గడువు ముగిసింది` : language === "hi" ? `${overdueCount} फॉलो-अप या टेस्ट का समय हो चुका है` : `${overdueCount} Overdue Follow-up / Lab Test Detected`}
              </div>
              <div className="text-xs text-amber-300/80 mt-0.5">
                {language === "te"
                  ? "మీ తాజా ప్రిస్క్రిప్షన్ ప్రకారం 3-నెలల HbA1c మరియు లిపిడ్ పరీక్షలను వెంటనే సమీక్షించండి."
                  : language === "hi"
                  ? "डिस्चार्ज समरी और पर्चे के अनुसार 3 माह की अवधि में HbA1c व लिपिड जांच की सिफारिश की गई थी।"
                  : "Clinical recommendations from your medical report suggest re-checking HbA1c & Lipid profile."}
              </div>
            </div>
          </div>
          <button
            onClick={() => onNavigateTab("insights")}
            className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-xs font-bold whitespace-nowrap transition-colors"
          >
            {language === "te" ? "ఇన్‌సైట్స్ చూడండి" : language === "hi" ? "इंसाइड देखें" : "View Insights"}
          </button>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <button
          onClick={() => setFilterType("all")}
          className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
            filterType === "all"
              ? "bg-[#16B8A6] text-white"
              : "bg-white dark:bg-[#101C31] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800"
          }`}
        >
          {language === "te" ? "అన్నీ" : language === "hi" ? "सभी" : "All Tasks"} ({appointments.length})
        </button>
        <button
          onClick={() => setFilterType("appointment")}
          className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
            filterType === "appointment"
              ? "bg-[#16B8A6] text-white"
              : "bg-white dark:bg-[#101C31] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800"
          }`}
        >
          {language === "te" ? "డాక్టర్ విజిట్లు" : language === "hi" ? "डॉक्टर अपॉइंटमेंट्स" : "Doctor Visits"}
        </button>
        <button
          onClick={() => setFilterType("repeat_test_task")}
          className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
            filterType === "repeat_test_task"
              ? "bg-[#16B8A6] text-white"
              : "bg-white dark:bg-[#101C31] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800"
          }`}
        >
          {language === "te" ? "ల్యాబ్ రీటెస్ట్ టాస్క్‌లు" : language === "hi" ? "रिपीट टेस्ट्स" : "Lab Repeat Tests"}
        </button>
        <button
          onClick={() => setFilterType("follow_up_task")}
          className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
            filterType === "follow_up_task"
              ? "bg-[#16B8A6] text-white"
              : "bg-white dark:bg-[#101C31] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800"
          }`}
        >
          {language === "te" ? "ఫాలో-అప్ యాక్షన్స్" : language === "hi" ? "फॉलो-अप कार्य" : "Follow-up Actions"}
        </button>
      </div>

      {/* UPCOMING SECTION */}
      <div className="space-y-4">
        <h2 className="text-sm font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
          <CalendarCheck className="w-4 h-4 text-[#16B8A6]" />
          <span>{language === "te" ? "షెడ్యూల్ చేయబడిన రాబోయే అపాయింట్‌మెంట్లు" : language === "hi" ? "आगामी निर्धारित अपॉइंटमेंट्स" : "Upcoming Scheduled Appointments"}</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold">
            {upcomingList.length}
          </span>
        </h2>

        {loading ? (
          <div className="p-8 text-center text-slate-400 text-xs">Loading appointments...</div>
        ) : upcomingList.length === 0 ? (
          <div className="p-8 rounded-2xl bg-white dark:bg-[#101C31] border border-slate-200 dark:border-slate-800 text-center space-y-3">
            <Calendar className="w-8 h-8 text-slate-400 mx-auto" />
            <div className="text-sm font-bold text-slate-700 dark:text-slate-300">
              {language === "te" ? "రాబోయే అపాయింట్‌మెంట్లు ఏవీ లేవు" : language === "hi" ? "कोई आगामी अपॉइंटमेंट नहीं है" : "No upcoming appointments scheduled"}
            </div>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Schedule your next quarterly checkup or diagnostic lab test to keep your health plan on track.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {upcomingList.map((apt) => (
              <div
                key={apt.id}
                className="p-5 rounded-2xl bg-white dark:bg-[#101C31] border border-slate-200 dark:border-slate-800 shadow-xs hover:border-[#16B8A6]/50 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <span className="px-2.5 py-1 rounded-md text-[10px] font-extrabold uppercase bg-[#16B8A6]/10 text-[#16B8A6] border border-[#16B8A6]/20">
                      {apt.type === "repeat_test_task"
                        ? "Repeat Lab Test"
                        : apt.type === "follow_up_task"
                        ? "Follow-up Task"
                        : apt.specialty || "Clinic Visit"}
                    </span>
                    <span className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {apt.date} • {apt.time}
                    </span>
                  </div>

                  <h3 className="font-extrabold text-base text-slate-900 dark:text-white mb-1">
                    {apt.title}
                  </h3>

                  <div className="space-y-1 text-xs text-slate-600 dark:text-slate-300 mt-2">
                    <div className="flex items-center gap-1.5 font-semibold">
                      <Stethoscope className="w-3.5 h-3.5 text-[#16B8A6]" />
                      <span>{apt.doctorName}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                      <MapPin className="w-3.5 h-3.5" />
                      <span>{apt.facility}</span>
                    </div>
                    {apt.purpose && (
                      <p className="mt-2 text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-[#172944] p-2.5 rounded-lg text-xs leading-relaxed">
                        {apt.purpose}
                      </p>
                    )}
                    {apt.followUpInstructions && (
                      <div className="mt-2 text-[11px] text-teal-600 dark:text-[#66E3D3] font-medium">
                        📌 {apt.followUpInstructions}
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Actions */}
                <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                  <button
                    onClick={() => {
                      if (onLaunchAIBotWithContext) {
                        onLaunchAIBotWithContext(
                          "overview",
                          `Prepare a focused 4-question checklist for my upcoming visit with ${apt.doctorName} (${apt.specialty}) on ${apt.date}. Purpose: ${apt.purpose}`
                        );
                      }
                    }}
                    className="flex items-center gap-1.5 text-xs text-[#16B8A6] font-bold hover:underline"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Prep Questions</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleUpdateStatus(apt.id, "cancelled")}
                      className="px-2.5 py-1 text-xs font-semibold rounded-lg text-slate-500 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(apt.id, "completed")}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold hover:bg-emerald-500/20 transition-colors"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>Mark Done</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* PAST / COMPLETED SECTION */}
      {pastList.length > 0 && (
        <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
          <h2 className="text-sm font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-500" />
            <span>{language === "te" ? "గత అపాయింట్‌మెంట్లు & పూర్తయిన టాస్క్‌లు" : language === "hi" ? "पिछले परामर्श व पूर्ण कार्य" : "Past & Completed Visits"}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold">
              {pastList.length}
            </span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pastList.map((apt) => (
              <div
                key={apt.id}
                className="p-4 rounded-xl bg-slate-50 dark:bg-[#172944]/40 border border-slate-200 dark:border-slate-800/80 opacity-80"
              >
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-semibold text-slate-600 dark:text-slate-300">{apt.title}</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      apt.status === "completed"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                        : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                    }`}
                  >
                    {apt.status}
                  </span>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {apt.doctorName} • {apt.date}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Schedule Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-[#101C31] w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[#16B8A6]" />
                <span>Schedule New Appointment</span>
              </h3>
              <button
                onClick={() => setShowScheduleModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateAppointment} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Title / Reason
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Quarterly Diabetes & Lipid Review"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#172944] text-slate-900 dark:text-white focus:outline-none focus:border-[#16B8A6]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Doctor Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Dr. Neha Verma"
                    value={doctorName}
                    onChange={(e) => setDoctorName(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#172944] text-slate-900 dark:text-white focus:outline-none focus:border-[#16B8A6]"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Specialty
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Endocrinology"
                    value={specialty}
                    onChange={(e) => setSpecialty(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#172944] text-slate-900 dark:text-white focus:outline-none focus:border-[#16B8A6]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#172944] text-slate-900 dark:text-white focus:outline-none focus:border-[#16B8A6]"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Time
                  </label>
                  <input
                    type="time"
                    required
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#172944] text-slate-900 dark:text-white focus:outline-none focus:border-[#16B8A6]"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Facility / Hospital
                </label>
                <input
                  type="text"
                  placeholder="e.g. Apollo Specialty Clinic"
                  value={facility}
                  onChange={(e) => setFacility(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#172944] text-slate-900 dark:text-white focus:outline-none focus:border-[#16B8A6]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Purpose / Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="What would you like to discuss or test?"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#172944] text-slate-900 dark:text-white focus:outline-none focus:border-[#16B8A6]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-[#16B8A6] hover:bg-[#66E3D3] text-[#101C31] text-xs font-bold shadow-md transition-colors"
                >
                  {saving ? "Saving..." : "Save Appointment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
