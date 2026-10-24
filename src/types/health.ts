export interface UserProfile {
  id: string;
  name: string;
  email: string;
  dob?: string;
  gender?: string;
  bloodGroup?: string;
  preferredLanguage: "en" | "te" | "hi";
  abhaNumber?: string;
  allergies?: string[];
  chronicConditions?: string[];
  avatarUrl?: string;
}

export interface UserSettings {
  waterTargetMl: number;
  sleepTargetHours: number;
  activityTargetMinutes: number;
  timeZone: string;
  aiPreferredLanguage: "en" | "te" | "hi";
  aiResponseDetail: "concise" | "balanced" | "detailed";
  enableBrowserNotifications: boolean;
}

export interface ExtractedLabResult {
  id: string;
  documentId: string;
  testName: string;
  category: "Lipid Panel" | "Metabolic / Glucose" | "Hematology" | "Renal / Kidney" | "Thyroid" | "Liver" | "Vitamins" | "Other";
  valueNumeric?: number;
  valueText: string;
  unit: string;
  referenceLow?: number;
  referenceHigh?: number;
  referenceRangeText: string;
  sourceInterpretation: "Within Normal Range" | "Above Reference Range" | "Below Reference Range" | "Requires Review";
  observedDate: string;
  verified: boolean;
  userCorrection?: {
    correctedValue: string;
    correctedBy: string;
    correctedAt: string;
    correctionReason?: string;
  };
  clinicalExplanationEn: string;
  clinicalExplanationHi: string;
  confidenceScore: number;
}

export interface ExtractedClinicalData {
  documentId: string;
  patientName?: string;
  documentType: string;
  documentDate: string;
  facility?: string;
  doctorName?: string;
  diagnoses: string[];
  plainSummaryEn: string;
  plainSummaryHi: string;
  keyObservations: string[];
  verificationNeeded: string[];
  questionsForClinician: string[];
  uncertaintyDisclaimers: string[];
  labsCount: number;
  medsCount: number;
}

export interface MedicalDocument {
  id: string;
  userId: string;
  title: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  documentType: "Lab Report" | "Prescription" | "Discharge Summary" | "Imaging Report" | "Other";
  documentDate: string;
  facility?: string;
  doctor?: string;
  uploadDate: string;
  status: "uploaded" | "processing" | "analyzed" | "verified";
  previewUrl?: string;
  thumbnailUrl?: string;
  fileBase64?: string;
  rawData?: string;
  extractedData?: ExtractedClinicalData;
}

export interface MedicationReminder {
  id: string;
  time: string;
  days: string[];
  enabled: boolean;
  lastAction?: {
    action: "taken" | "skipped" | "snoozed";
    timestamp: string;
  };
}

export interface MedicationItem {
  id: string;
  userId: string;
  documentId?: string;
  name: string;
  genericName?: string;
  strength: string;
  dosage: string;
  route: string;
  frequency: string;
  instructions: string;
  instructionsHi?: string;
  startDate: string;
  endDate?: string;
  status: "Active" | "Extracted" | "Discontinued" | "Completed";
  userConfirmed: boolean;
  prescribingDoctor?: string;
  reminders?: MedicationReminder[];
}

export interface TimelineEvent {
  id: string;
  userId: string;
  date: string;
  type: "document" | "lab" | "medication" | "wellness" | "clinical_note" | "journal";
  title: string;
  summary: string;
  summaryHi?: string;
  documentId?: string;
  meta?: Record<string, any>;
}

export interface WellnessEntry {
  id: string;
  userId: string;
  date: string;
  sleepHours: number;
  steps: number;
  waterGlasses: number;
  restingHeartRate?: number;
  bloodPressureSystolic?: number;
  bloodPressureDiastolic?: number;
  notes?: string;
}

// HEALTHORA 2.0 TRACKING TYPES
export interface SleepEntry {
  id: string;
  userId: string;
  date: string;
  bedtime: string;
  wakeTime: string;
  durationHours: number;
  quality: "poor" | "fair" | "good" | "excellent";
  notes?: string;
  createdAt: string;
}

export interface WaterEntry {
  id: string;
  userId: string;
  date: string;
  amountMl: number;
  unit: "ml" | "l";
  targetMl: number;
  notes?: string;
  createdAt: string;
}

export interface MealEntry {
  id: string;
  userId: string;
  date: string;
  mealType: "breakfast" | "lunch" | "dinner" | "snack";
  mealName: string;
  foods: string;
  calories?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  isAiEstimated: boolean;
  notes?: string;
  createdAt: string;
}

export interface ActivityEntry {
  id: string;
  userId: string;
  date: string;
  activityType: string;
  durationMinutes: number;
  steps?: number;
  distanceKm?: number;
  intensity?: "low" | "medium" | "high";
  caloriesBurned?: number;
  notes?: string;
  createdAt: string;
}

export interface MoodEntry {
  id: string;
  userId: string;
  date: string;
  mood: "great" | "good" | "neutral" | "low" | "stressed" | "anxious";
  notes?: string;
  createdAt: string;
}

export interface DailySummary {
  sleepHours: number | null;
  waterLoggedMl: number;
  waterTargetMl: number;
  waterPercentage: number;
  mealsLogged: number;
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  activityMinutes: number;
  totalSteps: number;
  mood: string | null;
  completionPercentage: number;
}

export interface HealthJournalEntry {
  id: string;
  userId: string;
  date: string;
  title: string;
  content: string;
  tags: string[];
  clinicianQuestions: string[];
  attachedDocumentId?: string;
  attachedDocumentTitle?: string;
  aiSummaryEn?: string;
  aiSummaryHi?: string;
  appointmentPrepList?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AIMessageSource {
  type: "lab" | "document" | "tracking" | "medication" | "journal" | "medical_reference" | "general_knowledge";
  label: string;
  detail?: string;
  url?: string;
}

export interface AIMessage {
  id: string;
  conversationId: string;
  role: "user" | "model";
  content: string;
  timestamp: string;
  pageContext?: string;
  sources?: AIMessageSource[];
  isPersonalRecordUsed?: boolean;
  mode?: "general" | "personal" | "hybrid";
}

export interface AIConversation {
  id: string;
  userId: string;
  title: string;
  pageContext?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReminderItem {
  id: string;
  userId: string;
  title: string;
  description: string;
  category: "water" | "sleep" | "activity" | "meal" | "journal" | "appointment" | "medication" | "custom";
  date: string;
  time: string;
  recurrence: "once" | "daily" | "weekly" | "weekdays";
  enabled: boolean;
  completed: boolean;
  snoozedUntil?: string;
  createdAt: string;
}

export interface FamilyMember {
  id: string;
  name: string;
  relationship: "Self" | "Spouse" | "Parent" | "Child" | "Other";
  age?: number;
  gender?: string;
  profileKey: string;
  avatarUrl?: string;
  isGuardianAccess?: boolean;
  chronicConditions?: string[];
  bloodGroup?: string;
}

export interface AppointmentItem {
  id: string;
  userId: string;
  title: string;
  doctorName: string;
  facility: string;
  specialty: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  status: "scheduled" | "completed" | "cancelled" | "rescheduled";
  purpose: string;
  relatedDocumentId?: string;
  followUpInstructions?: string;
  isOverdue?: boolean;
  dueDate?: string;
  type: "appointment" | "follow_up_task" | "repeat_test_task";
  reminderConfig?: { enabled: boolean; alertMinutesBefore: number };
  notes?: string;
  createdAt: string;
}

export interface AgentAction {
  id: string;
  userId: string;
  workflowType: "new_prescription" | "overdue_followup" | "repeat_test" | "doctor_visit_prep";
  detectedEvent: string;
  sourceRecordId?: string;
  sourceRecordTitle?: string;
  proposedAction: string;
  reason: string;
  status: "pending_approval" | "approved" | "rejected" | "completed";
  payload?: Record<string, any>;
  userDecision?: "approved" | "rejected" | "edited";
  createdAt: string;
  updatedAt?: string;
}

export interface WellnessRecommendation {
  id: string;
  userId: string;
  category: "nutrition" | "activity" | "sleep" | "habits" | "preventive";
  title: string;
  titleHi?: string;
  titleTe?: string;
  suggestion: string;
  suggestionHi?: string;
  suggestionTe?: string;
  whyRelevant: string;
  supportingEvidence: string;
  practicalNextStep: string;
  precaution: string;
  status: "active" | "helpful" | "dismissed";
  createdAt: string;
}

export interface HealthInsight {
  id: string;
  userId: string;
  type: "trend_alert" | "abnormal_observation" | "followup_due" | "preventive_discussion";
  title: string;
  observation: string;
  supportingRecords: string[];
  relevantValues: string;
  dates: string;
  whyAttentionNeeded: string;
  recommendedNextStep: string;
  severity: "routine" | "moderate" | "urgent_review";
  createdAt: string;
}

export interface NotificationItem {
  id: string;
  userId: string;
  title: string;
  message: string;
  category: "medication" | "appointment" | "insight" | "agent_action" | "wellness";
  severity: "info" | "warning" | "urgent";
  isRead: boolean;
  actionUrl?: string;
  timestamp: string;
}

export type ViewTab =
  | "overview"
  | "ai_bots"
  | "records"
  | "medications"
  | "appointments"
  | "insights"
  | "wellness"
  | "family"
  | "notifications"
  | "settings"
  | "tracking"
  | "journal"
  | "analytics"
  | "reminders"
  | "labs"
  | "timeline"
  | "summary"
  | "export"
  | "privacy"
  | "admin";
