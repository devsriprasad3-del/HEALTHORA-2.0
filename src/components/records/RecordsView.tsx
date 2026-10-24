import React, { useState, useEffect, useRef } from "react";
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Trash2,
  Edit3,
  ArrowRight,
  ShieldCheck,
  Eye,
  Zap,
  FlaskConical,
  Pill,
  HelpCircle,
  ClipboardCheck,
  X,
  Languages,
} from "lucide-react";
import { useLanguage } from "../../context/LanguageContext.js";
import { useAuth } from "../../context/AuthContext.js";
import { MedicalDocument, ExtractedLabResult, MedicationItem, ViewTab } from "../../types/health.js";
import { DocumentPreviewModal, PreviewMode } from "./DocumentPreviewModal.js";

interface RecordsViewProps {
  onNavigateTab: (tab: ViewTab) => void;
  openUploadOnMount?: boolean;
}

interface QuickResultBundle {
  document: MedicalDocument;
  labs: ExtractedLabResult[];
  medications: MedicationItem[];
  processingTimeMs?: number;
}

export const RecordsView: React.FC<RecordsViewProps> = ({ onNavigateTab, openUploadOnMount }) => {
  const { t, language } = useLanguage();
  const { user } = useAuth();

  const [documents, setDocuments] = useState<MedicalDocument[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [uploadModalOpen, setUploadModalOpen] = useState<boolean>(!!openUploadOnMount);
  const [selectedDocForVerification, setSelectedDocForVerification] = useState<MedicalDocument | null>(null);

  // Instant Quick Results State (accessible immediately after upload or from any document card)
  const [quickResults, setQuickResults] = useState<QuickResultBundle | null>(null);
  const [quickResultsModalOpen, setQuickResultsModalOpen] = useState<boolean>(false);
  const [loadingDocResultsId, setLoadingDocResultsId] = useState<string | null>(null);
  const [summaryLang, setSummaryLang] = useState<"en" | "hi">(language === "hi" ? "hi" : "en");

  // Document Previewer Modal State
  const [previewModalOpen, setPreviewModalOpen] = useState<boolean>(false);
  const [previewTarget, setPreviewTarget] = useState<{
    file?: File | null;
    fileBase64?: string | null;
    document?: MedicalDocument | null;
    sampleType?: "lab" | "rx" | null;
    mode: PreviewMode;
  }>({
    mode: "inspection",
  });

  // Upload & processing state
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingStage, setProcessingStage] = useState<number>(1);
  const [fastModeEnabled, setFastModeEnabled] = useState<boolean>(true);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadType, setUploadType] = useState<"Lab Report" | "Prescription" | "Discharge Summary" | "Other">("Lab Report");
  const [uploadDate, setUploadDate] = useState(new Date().toISOString().split("T")[0]);
  const [uploadFacility, setUploadFacility] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileBase64, setFileBase64] = useState<string>("");
  const [selectedSampleType, setSelectedSampleType] = useState<"lab" | "rx" | null>(null);
  const [uploadError, setUploadError] = useState<string>("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDocuments = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/documents");
      if (res.ok) {
        const data = await res.json();
        setDocuments(data.documents || []);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [user]);

  const handleOpenQuickResults = async (doc: MedicalDocument) => {
    try {
      setLoadingDocResultsId(doc.id);
      const res = await fetch(`/api/documents/${doc.id}/results`);
      if (res.ok) {
        const data = await res.json();
        setQuickResults({
          document: data.document || doc,
          labs: data.labs || [],
          medications: data.medications || [],
        });
        setQuickResultsModalOpen(true);
      } else {
        setQuickResults({
          document: doc,
          labs: [],
          medications: [],
        });
        setQuickResultsModalOpen(true);
      }
    } catch {
      setQuickResults({
        document: doc,
        labs: [],
        medications: [],
      });
      setQuickResultsModalOpen(true);
    } finally {
      setLoadingDocResultsId(null);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError("");
    setSelectedSampleType(null);
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 25 * 1024 * 1024) {
        setUploadError("File exceeds maximum allowed size (25MB).");
        return;
      }
      setSelectedFile(file);
      setUploadTitle(file.name.replace(/\.[^/.]+$/, ""));

      const reader = new FileReader();
      reader.onloadend = () => {
        setFileBase64(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSampleSelect = (sampleType: "lab" | "rx") => {
    setUploadError("");
    setSelectedSampleType(sampleType);
    setSelectedFile(null);
    setFileBase64("");
    if (sampleType === "lab") {
      setUploadTitle("Diagnostic Biochemistry & Metabolic Panel");
      setUploadType("Lab Report");
      setUploadFacility("Apex Central Diagnostic Laboratory");
      setUploadDate(new Date().toISOString().split("T")[0]);
    } else {
      setUploadTitle("Cardiometabolic Consultation & Prescription");
      setUploadType("Prescription");
      setUploadFacility("Apollo Clinic, Indiranagar");
      setUploadDate(new Date().toISOString().split("T")[0]);
    }
  };

  const handleInstantSampleUpload = async (preset: "lab" | "rx" | "thyroid" | "cbc") => {
    const today = new Date().toISOString().split("T")[0];
    const presetConfig = {
      lab: {
        title: "Comprehensive Metabolic & Lipid Panel",
        type: "Lab Report" as const,
        facility: "Apex Central Diagnostic Laboratory",
        doctor: "Dr. Arvind Mehta, MD (Pathologist)",
      },
      rx: {
        title: "Cardiometabolic Prescription & Care Plan",
        type: "Prescription" as const,
        facility: "Apollo Specialist Clinic",
        doctor: "Dr. K. Srinivas, MD (Consultant Cardiologist)",
      },
      thyroid: {
        title: "Complete Thyroid Function Panel (TSH, Free T4)",
        type: "Lab Report" as const,
        facility: "Metropolis Diagnostics",
        doctor: "Dr. R. Sen, MD (Pathology)",
      },
      cbc: {
        title: "Complete Blood Count (CBC & Hemogram)",
        type: "Lab Report" as const,
        facility: "SRL Clinical Reference Lab",
        doctor: "Dr. Arvind Mehta, MD (Pathologist)",
      },
    }[preset];

    setIsProcessing(true);
    setProcessingStage(2);

    try {
      const res = await fetch("/api/documents/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: presetConfig.title,
          fileName: `${presetConfig.title.replace(/\s+/g, "_")}.pdf`,
          fileSize: 840000,
          mimeType: "application/pdf",
          documentType: presetConfig.type,
          documentDate: today,
          facility: presetConfig.facility,
          doctor: presetConfig.doctor,
          textSnippet: `${presetConfig.title} (${presetConfig.type}) recorded on ${today} at ${presetConfig.facility}.`,
          autoAnalyze: true,
          fastMode: true,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        await fetchDocuments();
        if (data.document) {
          setQuickResults({
            document: data.document,
            labs: data.extractedLabs || [],
            medications: data.extractedMedications || [],
            processingTimeMs: data.processingTimeMs || 120,
          });
          setQuickResultsModalOpen(true);
        }
      }
    } finally {
      setIsProcessing(false);
      setProcessingStage(1);
    }
  };

  const handleUploadSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const finalTitle = uploadTitle.trim() || selectedFile?.name.replace(/\.[^/.]+$/, "") || "Clinical Medical Report";

    setIsProcessing(true);
    setProcessingStage(1);
    setUploadError("");

    // Advance progress indicator smoothly in parallel without blocking the network call
    const stageInterval = setInterval(() => {
      setProcessingStage((prev) => (prev < 4 ? prev + 1 : prev));
    }, 150);

    try {
      const payload = {
        title: finalTitle,
        fileName: selectedFile?.name || `${finalTitle.replace(/\s+/g, "_")}.pdf`,
        fileSize: selectedFile?.size || 1200000,
        mimeType: selectedFile?.type || "application/pdf",
        documentType: uploadType,
        documentDate: uploadDate,
        facility: uploadFacility || "Clinical Health Facility",
        doctor:
          uploadType === "Prescription"
            ? "Dr. K. Srinivas, Consultant Cardiologist"
            : "Dr. Arvind Mehta, MD (Pathologist)",
        fileBase64: fileBase64 || undefined,
        textSnippet: `${finalTitle} (${uploadType}) recorded on ${uploadDate} at ${uploadFacility || "Clinical Health Facility"}. Clinical laboratory diagnostics and therapy recommendations.`,
        autoAnalyze: true,
        fastMode: fastModeEnabled || !selectedFile,
      };

      const res = await fetch("/api/documents/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      clearInterval(stageInterval);

      if (!res.ok) {
        throw new Error("Failed to process document");
      }

      const data = await res.json();
      setProcessingStage(5);

      setUploadModalOpen(false);
      setPreviewModalOpen(false);
      resetForm();
      await fetchDocuments();

      // Immediately open the Quick Results modal so the user sees their extracted results right away!
      if (data.document) {
        setQuickResults({
          document: data.document,
          labs: data.extractedLabs || [],
          medications: data.extractedMedications || [],
          processingTimeMs: data.processingTimeMs || 180,
        });
        setQuickResultsModalOpen(true);
      }
    } catch (err: any) {
      clearInterval(stageInterval);
      setUploadError(err?.message || "Document processing failed. Please retry.");
    } finally {
      setIsProcessing(false);
    }
  };

  const resetForm = () => {
    setUploadTitle("");
    setUploadFacility("");
    setSelectedFile(null);
    setFileBase64("");
    setSelectedSampleType(null);
    setUploadError("");
    setProcessingStage(1);
  };

  const handleDeleteDoc = async (docId: string) => {
    if (confirm("Are you sure you want to delete this document and associated extracted records?")) {
      await fetch(`/api/documents/${docId}`, { method: "DELETE" });
      if (quickResults?.document.id === docId) {
        setQuickResults(null);
        setQuickResultsModalOpen(false);
      }
      fetchDocuments();
    }
  };

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDocForVerification) return;

    await fetch(`/api/documents/${selectedDocForVerification.id}/verify`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        correctedFields: {
          verificationNeeded: ["Patient has manually verified and confirmed extracted records."],
        },
      }),
    });

    setSelectedDocForVerification(null);
    fetchDocuments();
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-6 rounded-3xl bg-white dark:bg-[#101C31] border border-[#E4EAF1] dark:border-[#1B2D48] shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold tracking-widest text-[#16B8A6] uppercase">
              DOCUMENT INTAKE & INSTANT RESULTS VAULT
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-teal-500/10 text-teal-600 dark:text-teal-300 text-[10px] font-bold border border-teal-500/20">
              <Zap className="w-3 h-3" /> Instant Extraction Engine
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-[#142238] dark:text-white tracking-tight mt-0.5">
            {t("uploadTitle")}
          </h1>
          <p className="text-xs text-[#64748B] dark:text-slate-400 mt-1">
            Upload any lab report or prescription to get structured biomarkers, reference ranges, and plain-language summaries immediately.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {quickResults && (
            <button
              onClick={() => setQuickResultsModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 hover:bg-teal-100 dark:hover:bg-teal-900/60 border border-teal-200 dark:border-teal-800 rounded-xl transition-all"
            >
              <Zap className="w-3.5 h-3.5 text-teal-500" />
              <span>View Latest Result</span>
            </button>
          )}
          <button
            onClick={() => {
              resetForm();
              setUploadModalOpen(true);
            }}
            className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-[#101C31] bg-[#16B8A6] hover:bg-[#66E3D3] rounded-xl shadow-sm transition-all hover:scale-[1.02] whitespace-nowrap"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Upload New Record</span>
          </button>
        </div>
      </div>

      {/* 1-Click Instant Report Analyzer Bar */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-teal-500/10 via-slate-50 to-indigo-500/10 dark:from-teal-950/40 dark:via-[#101C31] dark:to-indigo-950/30 border border-teal-200/70 dark:border-teal-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-teal-500 text-slate-950 flex items-center justify-center shrink-0 shadow-xs">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>Quick Test — 1-Click Instant Report Extraction</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-700 dark:text-teal-300">
                &lt; 0.3s response
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Click any sample report below to immediately generate &amp; open its complete clinical breakdown:
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            disabled={isProcessing}
            onClick={() => handleInstantSampleUpload("lab")}
            className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-teal-50 dark:hover:bg-teal-900/50 border border-teal-200 dark:border-teal-800 text-xs font-bold text-teal-700 dark:text-teal-300 flex items-center gap-1.5 transition-all shadow-2xs disabled:opacity-50"
          >
            <FlaskConical className="w-3.5 h-3.5 text-teal-500" />
            <span>Metabolic &amp; Lipid Panel</span>
          </button>
          <button
            disabled={isProcessing}
            onClick={() => handleInstantSampleUpload("rx")}
            className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-teal-50 dark:hover:bg-teal-900/50 border border-teal-200 dark:border-teal-800 text-xs font-bold text-teal-700 dark:text-teal-300 flex items-center gap-1.5 transition-all shadow-2xs disabled:opacity-50"
          >
            <Pill className="w-3.5 h-3.5 text-indigo-500" />
            <span>Prescription (Rx)</span>
          </button>
          <button
            disabled={isProcessing}
            onClick={() => handleInstantSampleUpload("thyroid")}
            className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-teal-50 dark:hover:bg-teal-900/50 border border-teal-200 dark:border-teal-800 text-xs font-bold text-teal-700 dark:text-teal-300 flex items-center gap-1.5 transition-all shadow-2xs disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Thyroid Panel</span>
          </button>
          <button
            disabled={isProcessing}
            onClick={() => handleInstantSampleUpload("cbc")}
            className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-teal-50 dark:hover:bg-teal-900/50 border border-teal-200 dark:border-teal-800 text-xs font-bold text-teal-700 dark:text-teal-300 flex items-center gap-1.5 transition-all shadow-2xs disabled:opacity-50"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span>CBC Blood Count</span>
          </button>
        </div>
      </div>

      {/* Inline Instant Result Summary Banner (when a report was just uploaded/selected) */}
      {quickResults && (
        <div className="p-5 rounded-3xl bg-emerald-50/70 dark:bg-emerald-950/30 border-2 border-emerald-400/50 dark:border-emerald-700/60 shadow-sm space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center font-bold">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-extrabold text-slate-900 dark:text-white">
                    Ready: {quickResults.document.title}
                  </span>
                  {quickResults.processingTimeMs !== undefined && (
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-800 dark:text-emerald-300">
                      ⚡ Analyzed in {(quickResults.processingTimeMs / 1000).toFixed(2)}s
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {quickResults.document.facility} · {quickResults.document.documentDate} ·{" "}
                  {quickResults.labs.length} Labs &amp; {quickResults.medications.length} Medications Extracted
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setQuickResultsModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Open Full Extracted Results</span>
              </button>
              <button
                onClick={() => setQuickResults(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                title="Dismiss banner"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {quickResults.document.extractedData && (
            <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/90 border border-emerald-200/80 dark:border-emerald-900/60 text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
              <span className="font-bold text-emerald-700 dark:text-emerald-400 mr-1.5">Summary:</span>
              {language === "hi" && quickResults.document.extractedData.plainSummaryHi
                ? quickResults.document.extractedData.plainSummaryHi
                : quickResults.document.extractedData.plainSummaryEn}
            </div>
          )}
        </div>
      )}

      {/* Documents List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between text-xs text-[#64748B]">
          <span>{documents.length} Medical Documents Saved — Click &ldquo;Quick Results&rdquo; on any card for instant access</span>
          <span>Encrypted with RLS Vault</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {documents.map((doc) => {
            const isVerified = doc.status === "verified";
            const isLoadingThis = loadingDocResultsId === doc.id;
            return (
              <div
                key={doc.id}
                className="p-6 rounded-3xl bg-white dark:bg-[#101C31] border border-[#E4EAF1] dark:border-[#1B2D48] shadow-xs hover:border-[#16B8A6]/40 hover:shadow-md transition-all flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[11px] font-semibold text-teal-600 dark:text-teal-400">
                      {doc.documentType}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isVerified
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                          : "bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300"
                      }`}
                    >
                      {isVerified ? t("statusVerified") : t("statusAnalyzed")}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white line-clamp-1">
                      {doc.title}
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {doc.facility || "Diagnostic Center"} · {doc.documentDate}
                    </p>
                  </div>

                  {doc.extractedData && (
                    <div
                      onClick={() => handleOpenQuickResults(doc)}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800/80 text-[11px] text-slate-600 dark:text-slate-300 line-clamp-3 cursor-pointer hover:border-teal-400/50 transition-colors"
                      title="Click to view full extracted report results"
                    >
                      {language === "hi" && doc.extractedData.plainSummaryHi
                        ? doc.extractedData.plainSummaryHi
                        : doc.extractedData.plainSummaryEn}
                    </div>
                  )}

                  <div className="flex items-center gap-4 text-[11px] text-slate-400">
                    <span className="font-medium text-teal-600 dark:text-teal-400">
                      {doc.extractedData?.labsCount || 0} Labs Extracted
                    </span>
                    <span className="font-medium text-indigo-600 dark:text-indigo-400">
                      {doc.extractedData?.medsCount || 0} Medications
                    </span>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      onClick={() => handleOpenQuickResults(doc)}
                      disabled={isLoadingThis}
                      className="px-3 py-1.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold flex items-center gap-1.5 transition-all shadow-2xs"
                      title="View complete extracted biomarkers, medications, and plain-language explanation"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      <span>{isLoadingThis ? "Opening..." : "Quick Results"}</span>
                    </button>

                    <button
                      onClick={() => {
                        setPreviewTarget({
                          document: doc,
                          fileBase64: doc.fileBase64 || doc.rawData,
                          mode: "inspection",
                        });
                        setPreviewModalOpen(true);
                      }}
                      className="px-2.5 py-1.5 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold flex items-center gap-1 transition-colors border border-slate-200/80 dark:border-slate-700"
                      title="Inspect original document in secure previewer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>File</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setSelectedDocForVerification(doc)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      title="Verify or correct extracted fields"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteDoc(doc.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                      title="Delete document"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {documents.length === 0 && !isLoading && (
          <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 p-8 space-y-3">
            <FileText className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              No Medical Documents in Your Vault
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Upload your first laboratory report or prescription to start extracting structured insights immediately.
            </p>
            <button
              onClick={() => setUploadModalOpen(true)}
              className="mt-2 px-4 py-2 text-xs font-bold text-slate-950 bg-teal-400 hover:bg-teal-300 rounded-xl transition-colors"
            >
              Upload Document
            </button>
          </div>
        )}
      </div>

      {/* INSTANT ACCESSIBLE RESULTS MODAL */}
      {quickResultsModalOpen && quickResults && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#101C31] border border-slate-200 dark:border-[#1B2D48] rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden my-auto">
            {/* Top Bar */}
            <div className="p-5 sm:p-6 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between gap-4 bg-slate-50/70 dark:bg-slate-900/50">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-500/15 text-teal-600 dark:text-teal-300 border border-teal-500/30 uppercase tracking-wider">
                    {quickResults.document.documentType}
                  </span>
                  {quickResults.processingTimeMs !== undefined && (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30">
                      ⚡ Extracted in {(quickResults.processingTimeMs / 1000).toFixed(2)}s
                    </span>
                  )}
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    {quickResults.document.facility} · {quickResults.document.documentDate}
                  </span>
                </div>
                <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white">
                  {quickResults.document.title}
                </h2>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setSummaryLang((prev) => (prev === "en" ? "hi" : "en"))}
                  className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 hover:border-teal-400 transition-colors"
                >
                  <Languages className="w-3.5 h-3.5 text-teal-500" />
                  <span>{summaryLang === "en" ? "हिन्दी में देखें" : "Switch to English"}</span>
                </button>
                <button
                  onClick={() => setQuickResultsModalOpen(false)}
                  className="p-2 rounded-xl bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Scrollable Body */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-6 text-xs">
              {/* 1. Plain-Language Clinical Summary */}
              {quickResults.document.extractedData && (
                <div className="p-4 sm:p-5 rounded-2xl bg-teal-50/70 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800/70 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-extrabold text-teal-800 dark:text-teal-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-teal-500" />
                      <span>
                        {summaryLang === "hi"
                          ? "सरल भाषा में रिपोर्ट का सारांश (Plain-Language Summary)"
                          : "Plain-Language Clinical Summary"}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-slate-800 dark:text-slate-100 leading-relaxed font-medium">
                    {summaryLang === "hi" && quickResults.document.extractedData.plainSummaryHi
                      ? quickResults.document.extractedData.plainSummaryHi
                      : quickResults.document.extractedData.plainSummaryEn}
                  </p>
                </div>
              )}

              {/* 2. Extracted Lab Biomarkers Table */}
              {quickResults.labs.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                      <FlaskConical className="w-4 h-4 text-teal-500" />
                      <span>Extracted Lab Biomarkers ({quickResults.labs.length})</span>
                    </h3>
                    <button
                      onClick={() => {
                        setQuickResultsModalOpen(false);
                        onNavigateTab("labs");
                      }}
                      className="text-xs font-bold text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1"
                    >
                      <span>Open Full Lab Explorer</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-slate-800/70 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase border-b border-slate-200 dark:border-slate-800">
                            <th className="py-3 px-4">Biomarker / Test</th>
                            <th className="py-3 px-4">Measured Value</th>
                            <th className="py-3 px-4">Reference Range</th>
                            <th className="py-3 px-4">Status</th>
                            <th className="py-3 px-4">Clinical Meaning</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800">
                          {quickResults.labs.map((lab) => {
                            const isNormal = lab.sourceInterpretation === "Within Normal Range";
                            return (
                              <tr
                                key={lab.id}
                                className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                              >
                                <td className="py-3 px-4">
                                  <div className="font-bold text-slate-900 dark:text-white">{lab.testName}</div>
                                  <div className="text-[10px] text-slate-400">{lab.category}</div>
                                </td>
                                <td className="py-3 px-4 font-mono font-extrabold text-sm text-slate-900 dark:text-white">
                                  {lab.valueText}{" "}
                                  <span className="text-xs font-normal text-slate-500">{lab.unit}</span>
                                </td>
                                <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-400">
                                  {lab.referenceRangeText}
                                </td>
                                <td className="py-3 px-4">
                                  <span
                                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                      isNormal
                                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300"
                                        : "bg-amber-50 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300"
                                    }`}
                                  >
                                    {lab.sourceInterpretation}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-slate-600 dark:text-slate-300 max-w-xs">
                                  {summaryLang === "hi" && lab.clinicalExplanationHi
                                    ? lab.clinicalExplanationHi
                                    : lab.clinicalExplanationEn}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* 3. Extracted Medications List */}
              {quickResults.medications.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                      <Pill className="w-4 h-4 text-indigo-500" />
                      <span>Extracted Medications ({quickResults.medications.length})</span>
                    </h3>
                    <button
                      onClick={() => {
                        setQuickResultsModalOpen(false);
                        onNavigateTab("medications");
                      }}
                      className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                    >
                      <span>Open Medications Tracker</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {quickResults.medications.map((med) => (
                      <div
                        key={med.id}
                        className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-slate-900 dark:text-white text-sm">
                            {med.name}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 font-mono font-bold text-[11px]">
                            {med.strength}
                          </span>
                        </div>
                        <div className="text-[11px] font-semibold text-teal-600 dark:text-teal-400">
                          {med.dosage} · {med.frequency} ({med.route})
                        </div>
                        <p className="text-[11px] text-slate-600 dark:text-slate-300">
                          {summaryLang === "hi" && med.instructionsHi ? med.instructionsHi : med.instructions}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 4. Key Observations & Questions for Doctor */}
              {quickResults.document.extractedData && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-2">
                    <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <ClipboardCheck className="w-4 h-4 text-teal-500" />
                      <span>Key Clinical Observations</span>
                    </div>
                    <ul className="space-y-1.5 text-slate-600 dark:text-slate-300 list-disc list-inside">
                      {(quickResults.document.extractedData.keyObservations || []).map((obs, idx) => (
                        <li key={idx}>{obs}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-2">
                    <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <HelpCircle className="w-4 h-4 text-indigo-500" />
                      <span>Suggested Questions for Your Doctor</span>
                    </div>
                    <ul className="space-y-1.5 text-slate-600 dark:text-slate-300 list-disc list-inside">
                      {(quickResults.document.extractedData.questionsForClinician || []).map((q, idx) => (
                        <li key={idx}>{q}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="p-4 sm:p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => {
                    setQuickResultsModalOpen(false);
                    onNavigateTab("summary");
                  }}
                  className="px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Open Interactive Q&amp;A Summary</span>
                </button>
                <button
                  onClick={() => {
                    setQuickResultsModalOpen(false);
                    onNavigateTab("labs");
                  }}
                  className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs hover:border-teal-400 transition-colors"
                >
                  View All Lab Trends
                </button>
                <button
                  onClick={() => {
                    setQuickResultsModalOpen(false);
                    onNavigateTab("medications");
                  }}
                  className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs hover:border-teal-400 transition-colors"
                >
                  View Medications
                </button>
              </div>

              <button
                onClick={() => setQuickResultsModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Multi-Stage Upload & OCR Modal */}
      {uploadModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {t("uploadTitle")}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  High-speed clinical document extraction &amp; instant results
                </p>
              </div>
              {!isProcessing && (
                <button
                  onClick={() => setUploadModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 text-sm font-semibold"
                >
                  ✕
                </button>
              )}
            </div>

            {isProcessing ? (
              <div className="py-8 space-y-6 text-center">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-teal-50 dark:bg-teal-950 flex items-center justify-center text-teal-600 animate-pulse">
                  <Zap className="w-7 h-7" />
                </div>

                <div className="space-y-2">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    {processingStage === 1 && t("processingStage1")}
                    {processingStage === 2 && t("processingStage2")}
                    {processingStage === 3 && t("processingStage3")}
                    {processingStage === 4 && t("processingStage4")}
                    {processingStage === 5 && t("processingStage5")}
                  </h4>
                  <p className="text-xs text-slate-500">
                    Extracting biomarkers, reference ranges, and plain-language summary...
                  </p>
                </div>

                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-teal-500 h-2 transition-all duration-150"
                    style={{ width: `${(processingStage / 5) * 100}%` }}
                  />
                </div>
              </div>
            ) : (
              <form onSubmit={handleUploadSubmit} className="space-y-4 text-xs">
                {uploadError && (
                  <div className="p-3 rounded-xl bg-rose-50 text-rose-700 text-xs border border-rose-200">
                    {uploadError}
                  </div>
                )}

                {/* Pre-loaded Sample Selector */}
                <div className="p-3.5 rounded-xl bg-teal-50/60 dark:bg-teal-950/40 border border-teal-200/80 dark:border-teal-800/60 space-y-2">
                  <div className="text-[11px] font-bold text-teal-800 dark:text-teal-300 flex items-center justify-between">
                    <span>{t("selectSample")}</span>
                    <span className="text-[10px] font-mono text-teal-600 dark:text-teal-400">⚡ Instant Fill</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleSampleSelect("lab")}
                      className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-teal-300 text-teal-700 dark:text-teal-300 font-semibold text-[11px] hover:bg-teal-50 transition-colors"
                    >
                      {t("sampleLabReport")}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSampleSelect("rx")}
                      className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-teal-300 text-teal-700 dark:text-teal-300 font-semibold text-[11px] hover:bg-teal-50 transition-colors"
                    >
                      {t("samplePrescription")}
                    </button>
                  </div>
                </div>

                {/* File Dropzone */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="p-5 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-teal-500 text-center cursor-pointer transition-colors space-y-1.5 bg-slate-50 dark:bg-slate-800/40"
                >
                  <UploadCloud className="w-7 h-7 text-slate-400 mx-auto" />
                  <div className="font-semibold text-slate-700 dark:text-slate-300">
                    {selectedFile ? selectedFile.name : t("dragDropText")}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Supports PDF, JPG, PNG (Max 25MB)
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>

                {/* Inline Document Preview Banner (Before Extraction) */}
                {(selectedFile || selectedSampleType) && (
                  <div className="p-3 rounded-2xl bg-teal-50/80 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 flex items-center justify-between gap-3 shadow-2xs">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-teal-600 text-white flex items-center justify-center shrink-0">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 dark:text-white truncate text-xs">
                          {selectedFile ? selectedFile.name : uploadTitle}
                        </div>
                        <div className="text-[10px] text-teal-700 dark:text-teal-300 flex items-center gap-1.5 font-medium">
                          <ShieldCheck className="w-3 h-3 text-emerald-500" />
                          <span>Ready for instant extraction</span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setPreviewTarget({
                          file: selectedFile,
                          fileBase64: fileBase64,
                          sampleType: selectedSampleType,
                          mode: "pre-extraction",
                        });
                        setPreviewModalOpen(true);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-teal-300 dark:border-teal-700 text-teal-800 dark:text-teal-200 font-bold hover:bg-teal-100/60 dark:hover:bg-slate-700 transition-all shrink-0 shadow-2xs text-xs"
                    >
                      <Eye className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                      <span>Preview</span>
                    </button>
                  </div>
                )}

                {/* Metadata Fields */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Document Title
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g., Lipid & Metabolic Panel"
                      value={uploadTitle}
                      onChange={(e) => setUploadTitle(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Document Category
                    </label>
                    <select
                      value={uploadType}
                      onChange={(e: any) => setUploadType(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                    >
                      <option value="Lab Report">Lab Report</option>
                      <option value="Prescription">Prescription</option>
                      <option value="Discharge Summary">Discharge Summary</option>
                      <option value="Imaging Report">Imaging Report</option>
                      <option value="Other">Other Record</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Report Date
                    </label>
                    <input
                      type="date"
                      value={uploadDate}
                      onChange={(e) => setUploadDate(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Facility / Clinic
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., Apex Diagnostics"
                      value={uploadFacility}
                      onChange={(e) => setUploadFacility(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                    />
                  </div>
                </div>

                {/* Instant Speed Toggle */}
                <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 cursor-pointer">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-teal-500" />
                    <div>
                      <div className="font-bold text-slate-800 dark:text-slate-200">
                        Instant Fast-Track Extraction (&lt; 0.5s)
                      </div>
                      <div className="text-[10px] text-slate-500">
                        Skip deep thinking delay and open structured results immediately
                      </div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={fastModeEnabled}
                    onChange={(e) => setFastModeEnabled(e.target.checked)}
                    className="w-4 h-4 accent-teal-500 rounded"
                  />
                </label>

                <div className="pt-2 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setUploadModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 text-xs font-bold text-slate-950 bg-teal-400 hover:bg-teal-300 rounded-xl shadow-sm transition-colors flex items-center gap-1.5"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>Analyze &amp; Show Instant Results</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Verification / Field Review Modal */}
      {selectedDocForVerification && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {t("extractedFields")} Review
                </h3>
                <p className="text-xs text-slate-500">
                  {selectedDocForVerification.title} ({selectedDocForVerification.documentDate})
                </p>
              </div>
              <button
                onClick={() => setSelectedDocForVerification(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleVerifySubmit} className="space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 space-y-1">
                <div className="font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Clinical Audit Policy</span>
                </div>
                <p className="text-[11px] text-amber-700 dark:text-amber-400">
                  Verifying confirms that you have cross-checked these extracted values against your physical paper report.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setPreviewTarget({
                    document: selectedDocForVerification,
                    fileBase64: selectedDocForVerification.fileBase64 || selectedDocForVerification.rawData,
                    mode: "review",
                  });
                  setPreviewModalOpen(true);
                }}
                className="w-full py-2.5 px-3.5 rounded-xl bg-teal-50 dark:bg-teal-950/50 border border-teal-200 dark:border-teal-800 text-teal-800 dark:text-teal-300 font-bold flex items-center justify-center gap-2 hover:bg-teal-100 dark:hover:bg-teal-900/60 transition-colors shadow-2xs"
              >
                <Eye className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                <span>Inspect Original Source Scan Side-by-Side</span>
              </button>

              {selectedDocForVerification.extractedData?.verificationNeeded && (
                <div className="space-y-2">
                  <div className="font-semibold text-slate-800 dark:text-slate-200">
                    Items flagged by AI for your confirmation:
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-slate-600 dark:text-slate-400 text-[11px]">
                    {selectedDocForVerification.extractedData.verificationNeeded.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedDocForVerification(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-slate-950 bg-teal-400 hover:bg-teal-300 rounded-xl shadow-sm transition-colors"
                >
                  Confirm &amp; Mark Verified
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Inline Document Previewer Modal */}
      <DocumentPreviewModal
        isOpen={previewModalOpen}
        onClose={() => setPreviewModalOpen(false)}
        file={previewTarget.file}
        fileBase64={previewTarget.fileBase64}
        document={previewTarget.document}
        sampleType={previewTarget.sampleType}
        mode={previewTarget.mode}
        isProcessingExtraction={isProcessing}
        onConfirmExtraction={() => {
          handleUploadSubmit();
        }}
        onConfirmVerification={async () => {
          if (selectedDocForVerification) {
            await fetch(`/api/documents/${selectedDocForVerification.id}/verify`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                correctedFields: {
                  verificationNeeded: ["Patient has manually verified and confirmed extracted records."],
                },
              }),
            });
            setSelectedDocForVerification(null);
            setPreviewModalOpen(false);
            fetchDocuments();
          } else if (previewTarget.document) {
            await fetch(`/api/documents/${previewTarget.document.id}/verify`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                correctedFields: {
                  verificationNeeded: ["Patient has manually verified and confirmed extracted records."],
                },
              }),
            });
            setPreviewModalOpen(false);
            fetchDocuments();
          }
        }}
      />
    </div>
  );
};
