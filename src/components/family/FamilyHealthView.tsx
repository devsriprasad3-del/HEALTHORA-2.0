import React, { useState, useEffect } from "react";
import {
  Users,
  UserPlus,
  ShieldCheck,
  CheckCircle,
  Lock,
  ArrowRight,
  HeartPulse,
  Pill,
  FileText,
  Calendar,
  Sparkles,
  AlertCircle,
} from "lucide-react";
import { FamilyMember, ViewTab } from "../../types/health.js";
import { useLanguage } from "../../context/LanguageContext.js";
import { useAuth } from "../../context/AuthContext.js";

interface FamilyHealthViewProps {
  onNavigateTab: (tab: ViewTab) => void;
  onLaunchAIBotWithContext?: (pageContext: string, initialPrompt?: string) => void;
}

export const FamilyHealthView: React.FC<FamilyHealthViewProps> = ({
  onNavigateTab,
  onLaunchAIBotWithContext,
}) => {
  const { t, language } = useLanguage();
  const { activeProfileKey, switchProfile, user } = useAuth();
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);

  // Add Member Form
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState<FamilyMember["relationship"]>("Parent");
  const [age, setAge] = useState<string>("");
  const [gender, setGender] = useState<string>("Male");
  const [bloodGroup, setBloodGroup] = useState<string>("O+");
  const [conditions, setConditions] = useState<string>("");
  const [isGuardianAccess, setIsGuardianAccess] = useState<boolean>(true);
  const [saving, setSaving] = useState(false);

  const fetchMembers = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/family");
      const data = await res.json();
      setMembers(data.members || []);
    } catch (e) {
      console.warn("Failed to load family members:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, [activeProfileKey]);

  const handleSwitchMember = async (profileKey: string) => {
    switchProfile(profileKey);
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !relationship) return;

    try {
      setSaving(true);
      const chronicList = conditions
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean);

      const res = await fetch("/api/family", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          relationship,
          age: age ? Number(age) : undefined,
          gender,
          bloodGroup,
          chronicConditions: chronicList,
          isGuardianAccess,
        }),
      });

      if (res.ok) {
        setShowAddModal(false);
        setName("");
        setAge("");
        setConditions("");
        fetchMembers();
      }
    } catch (e) {
      console.error("Failed to add member:", e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-fade-in">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-[#101C31] via-[#172944] to-[#101C31] text-white border border-[#1B2D48] shadow-lg">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <div className="p-2 rounded-lg bg-[#16B8A6]/20 text-[#66E3D3]">
              <Users className="w-5 h-5" />
            </div>
            <h1 className="text-xl md:text-2xl font-black tracking-tight">
              {language === "te" ? "కుటుంబ ఆరోగ్య నిర్వహణ" : language === "hi" ? "पारिवारिक स्वास्थ्य प्रबंधन" : "Family Health Manager"}
            </h1>
          </div>
          <p className="text-xs md:text-sm text-slate-300 max-w-2xl">
            {language === "te"
              ? "కుటుంబ సభ్యుల వైద్య రికార్డులు, మందులు మరియు అపాయింట్‌మెంట్లను పూర్తి డేటా భద్రతతో నిర్వహించండి."
              : language === "hi"
              ? "परिवार के सदस्यों के मेडिकल रिकॉर्ड, दवाइयां और स्वास्थ्य प्रोफाइल का पूर्ण डेटा पृथक्करण के साथ प्रबंधन।"
              : "Manage health profiles for parents, spouse, and dependents with strict data isolation and guardian access."}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#16B8A6] hover:bg-[#66E3D3] text-[#101C31] text-xs font-bold transition-all shadow-md whitespace-nowrap"
          >
            <UserPlus className="w-4 h-4" />
            <span>{language === "te" ? "సభ్యుడిని చేర్చండి" : language === "hi" ? "सदस्य जोड़ें" : "Add Family Member"}</span>
          </button>
        </div>
      </div>

      {/* Security & Isolation Callout */}
      <div className="p-4 rounded-xl bg-slate-100 dark:bg-[#172944]/50 border border-slate-200 dark:border-slate-800 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-[#16B8A6] shrink-0 mt-0.5" />
        <div className="text-xs text-slate-600 dark:text-slate-300">
          <strong className="text-slate-900 dark:text-white">ABDM & HIPAA Isolated Medical Portfolios: </strong>
          Each family member maintains completely separate medical vaults, prescriptions, laboratory results, and AI conversation histories. Switching accounts instantly scopes all copilot insights to the selected patient.
        </div>
      </div>

      {/* Family Member Cards Grid */}
      {loading ? (
        <div className="p-8 text-center text-slate-400 text-xs">Loading family health profiles...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {members.map((member) => {
            const isActive = activeProfileKey === member.profileKey;

            return (
              <div
                key={member.id}
                className={`p-5 rounded-2xl bg-white dark:bg-[#101C31] border transition-all shadow-xs flex flex-col justify-between ${
                  isActive
                    ? "border-[#16B8A6] ring-2 ring-[#16B8A6]/20 bg-[#16B8A6]/5 dark:bg-[#16B8A6]/10"
                    : "border-slate-200 dark:border-slate-800 hover:border-slate-400"
                }`}
              >
                <div className="space-y-3">
                  {/* Top Badges */}
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {member.relationship}
                    </span>
                    {isActive ? (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-[#16B8A6]">
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>Active Portfolio</span>
                      </span>
                    ) : member.isGuardianAccess ? (
                      <span className="text-[10px] text-teal-600 dark:text-[#66E3D3] font-semibold flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        <span>Guardian</span>
                      </span>
                    ) : null}
                  </div>

                  {/* Name & Basic Info */}
                  <div>
                    <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                      {member.name}
                    </h3>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {member.age ? `${member.age} yrs` : "Age unspecified"} • {member.gender || "Gender unspecified"} • {member.bloodGroup || "Blood Group O+"}
                    </div>
                  </div>

                  {/* Conditions */}
                  <div>
                    <div className="text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      Chronic Health Context:
                    </div>
                    {member.chronicConditions && member.chronicConditions.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {member.chronicConditions.map((cond, i) => (
                          <span
                            key={i}
                            className="text-[10px] px-2 py-0.5 rounded bg-slate-100 dark:bg-[#172944] text-slate-700 dark:text-slate-300 font-medium"
                          >
                            {cond}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">None reported</span>
                    )}
                  </div>
                </div>

                {/* Switch Button */}
                <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800">
                  {isActive ? (
                    <button
                      disabled
                      className="w-full py-2 px-3 rounded-xl bg-[#16B8A6]/20 text-[#16B8A6] font-bold text-xs text-center cursor-default"
                    >
                      Currently Viewing
                    </button>
                  ) : (
                    <button
                      onClick={() => handleSwitchMember(member.profileKey)}
                      className="w-full py-2 px-3 rounded-xl bg-slate-100 dark:bg-[#172944] hover:bg-[#16B8A6] hover:text-[#101C31] text-slate-700 dark:text-slate-200 font-bold text-xs transition-colors flex items-center justify-center gap-1.5"
                    >
                      <span>Switch to Profile</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Member Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-[#101C31] w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-[#16B8A6]" />
                <span>Add Family Health Profile</span>
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddMember} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Sharma"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#172944] text-slate-900 dark:text-white focus:outline-none focus:border-[#16B8A6]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Relationship
                  </label>
                  <select
                    value={relationship}
                    onChange={(e) => setRelationship(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#172944] text-slate-900 dark:text-white focus:outline-none focus:border-[#16B8A6]"
                  >
                    <option value="Parent">Parent</option>
                    <option value="Spouse">Spouse</option>
                    <option value="Child">Child</option>
                    <option value="Other">Other Dependent</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Age
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 74"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#172944] text-slate-900 dark:text-white focus:outline-none focus:border-[#16B8A6]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Gender
                  </label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#172944] text-slate-900 dark:text-white focus:outline-none focus:border-[#16B8A6]"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Blood Group
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. B+, O+, A-"
                    value={bloodGroup}
                    onChange={(e) => setBloodGroup(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#172944] text-slate-900 dark:text-white focus:outline-none focus:border-[#16B8A6]"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Chronic Health Conditions (comma separated)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Hypertension, Osteoarthritis"
                  value={conditions}
                  onChange={(e) => setConditions(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#172944] text-slate-900 dark:text-white focus:outline-none focus:border-[#16B8A6]"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="guardianAccess"
                  checked={isGuardianAccess}
                  onChange={(e) => setIsGuardianAccess(e.target.checked)}
                  className="rounded text-[#16B8A6] focus:ring-[#16B8A6]"
                />
                <label htmlFor="guardianAccess" className="text-xs text-slate-600 dark:text-slate-300">
                  Grant guardian access to manage prescriptions and view lab tests
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-[#16B8A6] hover:bg-[#66E3D3] text-[#101C31] text-xs font-bold shadow-md transition-colors"
                >
                  {saving ? "Saving..." : "Add Member"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
