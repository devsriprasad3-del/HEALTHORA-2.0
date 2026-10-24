import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  store,
  MedicalDocument,
  ExtractedLabResult,
  MedicationItem,
  TimelineEvent,
  SleepEntry,
  WaterEntry,
  MealEntry,
  ActivityEntry,
  MoodEntry,
  HealthJournalEntry,
  ReminderItem,
  AppointmentItem,
  AgentAction,
  WellnessRecommendation,
  HealthInsight,
  NotificationItem,
  FamilyMember,
} from "./server/store.js";
import { analyzeMedicalDocument, answerDocumentQuestion } from "./server/analyzer.js";
import { processHealthAssistantChat } from "./server/healthAssistant.js";
import {
  testSupabaseConnection,
  isSupabaseConfigured,
  getPublicSupabaseConfig,
  verifyAuthToken,
  logVisitorToSupabase,
  getRecentVisitsFromSupabase,
  getSupabaseWebsiteVisitors,
  syncMasterDataToSupabase,
  SUPABASE_PROJECT_ID,
} from "./server/supabase.js";
import { ai, GEMINI_MODEL } from "./server/gemini.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === "production";

// Middleware
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// User Isolation & Supabase Auth Verification Middleware
app.use(async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const customUserId = (req.headers["x-user-id"] as string) || (req.query.userId as string);
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7).trim();
      if (token) {
        const { user } = await verifyAuthToken(token);
        if (user && user.id) {
          (req as any).user = user;
          (req as any).userId = user.id;
          store.getOrCreateUserAccount(
            user.id,
            user.email,
            user.user_metadata?.full_name || user.email?.split("@")[0]
          );
          return next();
        }
      }
    }
    if (customUserId) {
      (req as any).userId = customUserId;
    }
  } catch (err) {
    // Continue gracefully
  }
  next();
});

// Helper functions for user-isolated data access
export function getReqUserId(req: express.Request): string | undefined {
  return (req as any).userId || (req.headers["x-user-id"] as string) || (req.query.userId as string) || undefined;
}

export function getReqState(req: express.Request) {
  return store.getCurrentState(getReqUserId(req));
}

// ---------------- API ROUTES ----------------

// Safe public Supabase configuration endpoint (NO privileged secrets exposed)
app.get("/api/config/public", (req, res) => {
  res.json(getPublicSupabaseConfig());
});

// ================= VISITOR TRACKING & SUPABASE STORAGE =================
app.post("/api/visitor/log", async (req, res) => {
  try {
    const {
      visitorId,
      sessionId,
      pagePath,
      pageTitle,
      referrer,
      userAgent,
      deviceType,
      browser,
      os,
      screenResolution,
      language,
      userId,
      userName,
      metadata,
    } = req.body;

    const clientIp = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "127.0.0.1";

    const visitPayload = {
      visitorId: String(visitorId || `anon_${Date.now()}`),
      sessionId: sessionId ? String(sessionId) : undefined,
      pagePath: String(pagePath || "/"),
      pageTitle: pageTitle ? String(pageTitle) : "Healthora",
      referrer: referrer ? String(referrer) : "",
      userAgent: userAgent ? String(userAgent) : req.headers["user-agent"] || "",
      deviceType: deviceType ? String(deviceType) : "Desktop",
      browser: browser ? String(browser) : "Browser",
      os: os ? String(os) : "OS",
      screenResolution: screenResolution ? String(screenResolution) : "",
      language: language ? String(language) : "en",
      ipAddress: clientIp,
      userId: userId ? String(userId) : undefined,
      userName: userName ? String(userName) : undefined,
      metadata: metadata || {},
      visitedAt: new Date().toISOString(),
    };

    // 1. Store in local resilient persistent store (.data/healthora_db.json)
    const localRecord = store.recordSiteVisit(visitPayload);

    // 2. Synchronize to Supabase PostgreSQL database
    const supabaseResult = await logVisitorToSupabase(visitPayload);

    if (supabaseResult.synced) {
      store.updateVisitSyncStatus(localRecord.id, true);
    }

    const stats = store.getVisitorStats();

    res.json({
      success: true,
      recordId: localRecord.id,
      syncedToSupabase: supabaseResult.synced,
      tableExistsInSupabase: supabaseResult.tableExists,
      supabaseError: supabaseResult.error,
      stats: {
        totalVisits: stats.totalVisits,
        uniqueVisitors: stats.uniqueVisitors,
        visitsToday: stats.visitsToday,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || "Failed to log visit" });
  }
});

app.get("/api/visitor/stats", async (req, res) => {
  try {
    const stats = store.getVisitorStats();
    const supabaseVisits = await getRecentVisitsFromSupabase(10);
    const supabaseStatus = await testSupabaseConnection();

    res.json({
      success: true,
      stats,
      supabase: {
        connected: supabaseStatus.connected,
        projectId: SUPABASE_PROJECT_ID,
        tableReady: supabaseVisits.tableReady,
        totalSupabaseVisits: supabaseVisits.totalCount,
        recentSupabaseVisits: supabaseVisits.visits,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

// Returns the full SQL migration script so the user can easily copy/paste into Supabase SQL Editor
app.get("/api/supabase/migration-sql", (req, res) => {
  try {
    const migrationPath = path.resolve(__dirname, "./supabase/migrations/20261024000000_visitor_tracking_and_healthora_setup.sql");
    if (fs.existsSync(migrationPath)) {
      const sqlContent = fs.readFileSync(migrationPath, "utf-8");
      return res.json({
        success: true,
        projectId: SUPABASE_PROJECT_ID,
        sqlEditorUrl: `https://supabase.com/dashboard/project/${SUPABASE_PROJECT_ID}/sql/new`,
        sql: sqlContent,
      });
    }
    res.status(404).json({ success: false, error: "Migration SQL file not found" });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

app.post("/api/supabase/verify-tables", async (req, res) => {
  try {
    const status = await testSupabaseConnection();
    res.json({ success: true, status });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

// ================= MASTER ADMIN PANEL ENDPOINTS =================
app.get("/api/admin/overview", async (req, res) => {
  try {
    const visitorId = (req.query.visitorId as string) || undefined;
    const sessionId = (req.query.sessionId as string) || undefined;
    const currentProfileKey =
      (req.query.currentProfileKey as string) || getReqUserId(req) || store.getActiveProfileKey();
    const prevRaw = (req.query.previousProfileKeys as string) || "";
    const previousProfileKeys = prevRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const scope =
      ((req.query.scope as string) as "current_and_previous" | "current_only" | "previous_only" | "all_app_data") ||
      "current_and_previous";

    const masterData = store.getAdminMasterData({
      visitorId,
      sessionId,
      currentProfileKey,
      previousProfileKeys,
      scope,
    });

    // Run Supabase status checks with a 1500ms timeout so Admin Panel always loads fast
    const withTimeout = <T,>(promise: Promise<T>, fallback: T, ms = 1500): Promise<T> =>
      Promise.race([
        promise.catch(() => fallback),
        new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
      ]);

    const [supabaseStatus, supabaseVisits, supabaseVisitors] = await Promise.all([
      withTimeout(testSupabaseConnection(), {
        configured: true,
        connected: false,
        projectId: SUPABASE_PROJECT_ID,
        hasAnonKey: true,
        hasServiceRoleKey: false,
        tablesStatus: { site_visits: false, profiles: false, daily_tracking_entries: false },
        sqlSetupNeeded: true,
        sqlEditorUrl: `https://supabase.com/dashboard/project/${SUPABASE_PROJECT_ID}/sql/new`,
        message: "Using local persistent vault (.data/healthora_db.json) + Supabase cloud sync.",
      }),
      withTimeout(getRecentVisitsFromSupabase(100), { visits: [], totalCount: 0, tableReady: false }),
      withTimeout(getSupabaseWebsiteVisitors(100), { visitors: [], tableReady: false }),
    ]);

    const allowedKeys = new Set([currentProfileKey, ...masterData.previousProfileKeys]);
    const userSupabaseVisits = (supabaseVisits.visits || []).filter((sv: any) => {
      if (scope === "all_app_data") return true;
      if (visitorId && sv.visitor_id === visitorId) return true;
      if (sv.user_id && allowedKeys.has(sv.user_id)) return true;
      return true;
    });

    const userSupabaseVisitors = (supabaseVisitors.visitors || []).filter((uv: any) => {
      if (scope === "all_app_data") return true;
      if (visitorId && uv.visitor_id === visitorId) return true;
      if (uv.user_id && allowedKeys.has(uv.user_id)) return true;
      return true;
    });

    res.json({
      success: true,
      masterData,
      supabase: {
        status: supabaseStatus,
        projectId: SUPABASE_PROJECT_ID,
        dashboardUrl: `https://supabase.com/dashboard/project/${SUPABASE_PROJECT_ID}`,
        sqlEditorUrl: `https://supabase.com/dashboard/project/${SUPABASE_PROJECT_ID}/sql/new`,
        siteVisitsTableReady: supabaseVisits.tableReady,
        totalSupabaseSiteVisits: userSupabaseVisits.length,
        supabaseSiteVisits: userSupabaseVisits,
        websiteVisitorsTableReady: supabaseVisitors.tableReady,
        supabaseUniqueVisitors: userSupabaseVisitors,
      },
    });
  } catch (err: any) {
    console.error("Admin overview error:", err);
    res.status(500).json({ success: false, error: err?.message || "Failed to load admin overview" });
  }
});

app.post("/api/admin/sync-supabase", async (req, res) => {
  try {
    const { visitorId, sessionId, currentProfileKey, previousProfileKeys } = req.body || {};
    const masterData = store.getAdminMasterData({
      visitorId,
      sessionId,
      currentProfileKey: currentProfileKey || getReqUserId(req) || store.getActiveProfileKey(),
      previousProfileKeys: Array.isArray(previousProfileKeys) ? previousProfileKeys : [],
      scope: "current_and_previous",
    });
    const syncRes = await syncMasterDataToSupabase(masterData.visitors.allVisits);
    for (const id of syncRes.syncedVisitIds) {
      store.updateVisitSyncStatus(id, true);
    }
    res.json({
      success: !syncRes.error,
      ...syncRes,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || "Sync failed" });
  }
});


// System Health & Truthful Service Connectivity
app.get("/api/health", async (req, res) => {
  const supabaseStatus = await testSupabaseConnection();
  res.json({
    status: "healthy",
    geminiConfigured: !!process.env.GEMINI_API_KEY,
    supabase: supabaseStatus,
    timestamp: new Date().toISOString(),
    activeProfile: store.getActiveProfileKey(),
  });
});

app.get("/api/backend-status", async (req, res) => {
  const supabaseStatus = await testSupabaseConnection();
  res.json({
    supabase: supabaseStatus,
    gemini: {
      configured: !!process.env.GEMINI_API_KEY,
      model: GEMINI_MODEL,
      multimodalFormats: ["application/pdf", "image/png", "image/jpeg", "image/webp"],
    },
    storage: {
      mode: isSupabaseConfigured()
        ? "Supabase Private S3-Compatible Bucket"
        : "Encrypted Persistent Store (.data/healthora_db.json)",
      bucket: "medical_records",
      isolation: "Row-Level Security (auth.uid() = user_id)",
    },
    activeProfile: store.getActiveProfileKey(),
  });
});

// Auth & Profiles
app.get("/api/auth/me", (req, res) => {
  const userId = getReqUserId(req);
  const state = getReqState(req);
  res.json({
    user: state.profile,
    settings: state.settings,
    activeProfileKey: userId || store.getActiveProfileKey(),
  });
});

app.post("/api/auth/login", (req, res) => {
  const { email, name } = req.body;
  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }
  const cleanEmail = String(email).trim().toLowerCase();
  let key: string;
  if (cleanEmail === "priya" || cleanEmail.includes("priya")) {
    key = "priya";
    store.setActiveProfileKey("priya");
  } else if (cleanEmail === "rajesh" || cleanEmail.includes("rajesh")) {
    key = "rajesh";
    store.setActiveProfileKey("rajesh");
  } else {
    key = `user-${cleanEmail.replace(/[^a-z0-9]/g, "-")}`;
    store.getOrCreateUserAccount(key, cleanEmail, name || cleanEmail.split("@")[0]);
    store.setActiveProfileKey(key);
  }
  const state = store.getCurrentState(key);
  res.json({
    success: true,
    user: state.profile,
    settings: state.settings,
    activeProfileKey: key,
  });
});

app.post("/api/auth/register", (req, res) => {
  const { name, email } = req.body;
  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }
  const cleanEmail = String(email).trim().toLowerCase();
  const key = `user-${cleanEmail.replace(/[^a-z0-9]/g, "-")}`;
  const newAccount = store.getOrCreateUserAccount(key, cleanEmail, name || "Personal Account");
  store.setActiveProfileKey(key);
  res.json({
    success: true,
    user: newAccount.profile,
    settings: newAccount.settings,
    activeProfileKey: key,
  });
});

app.post("/api/auth/demo-switch", (req, res) => {
  const { profileKey } = req.body;
  const switched = store.setActiveProfileKey(profileKey || "rajesh");
  const state = store.getCurrentState();
  res.json({
    success: switched,
    user: state.profile,
    settings: state.settings,
    activeProfileKey: store.getActiveProfileKey(),
  });
});

app.post("/api/auth/demo-reset", (req, res) => {
  store.resetDemo();
  const state = store.getCurrentState();
  res.json({ success: true, user: state.profile, settings: state.settings });
});

app.put("/api/auth/profile", (req, res) => {
  const userId = getReqUserId(req);
  const updated = store.updateProfile(req.body, userId);
  res.json({ success: true, user: updated });
});

// Settings & Preferences
app.get("/api/settings", (req, res) => {
  const state = getReqState(req);
  res.json({
    profile: state.profile,
    settings: state.settings,
  });
});

app.put("/api/settings", (req, res) => {
  const userId = getReqUserId(req);
  const state = getReqState(req);
  if (req.body.profile) {
    store.updateProfile(req.body.profile, userId);
  }
  if (req.body.settings) {
    store.updateSettings(req.body.settings, userId);
  }
  res.json({
    success: true,
    profile: state.profile,
    settings: state.settings,
  });
});

app.get("/api/settings/export", (req, res) => {
  const state = getReqState(req);
  res.json({
    exportedAt: new Date().toISOString(),
    version: "2.0",
    profile: state.profile,
    settings: state.settings,
    documentsCount: state.documents.length,
    documents: state.documents.map((d) => ({
      ...d,
      fileBase64: undefined, // Omit raw binary for lightweight JSON export
      rawData: undefined,
    })),
    labs: state.labs,
    medications: state.medications,
    timeline: state.timeline,
    sleepEntries: state.sleepEntries,
    waterEntries: state.waterEntries,
    mealEntries: state.mealEntries,
    activityEntries: state.activityEntries,
    moodEntries: state.moodEntries,
    journalEntries: state.journalEntries,
    reminders: state.reminders,
    conversationsCount: state.conversations.length,
  });
});

app.post("/api/settings/delete-category", (req, res) => {
  const { category } = req.body;
  const userId = getReqUserId(req);
  if (!["conversations", "journal", "documents", "tracking"].includes(category)) {
    return res.status(400).json({ error: "Invalid data category" });
  }
  store.deleteCategory(category, userId);
  res.json({ success: true, categoryDeleted: category });
});

// ==========================================
// 1. WELLNESS DASHBOARD & DAILY TRACKING
// ==========================================

// Helper to calculate sleep duration across midnight
function calculateSleepDuration(bedtime: string, wakeTime: string): number {
  const [bH, bM] = bedtime.split(":").map(Number);
  const [wH, wM] = wakeTime.split(":").map(Number);
  let bedTotal = bH * 60 + bM;
  let wakeTotal = wH * 60 + wM;
  if (wakeTotal < bedTotal) {
    wakeTotal += 24 * 60; // Crosses midnight
  }
  const diffMinutes = wakeTotal - bedTotal;
  return Math.round((diffMinutes / 60) * 100) / 100;
}

// Get daily overview metrics for a specific date
app.get("/api/tracking/daily", (req, res) => {
  const date = (req.query.date as string) || new Date().toISOString().split("T")[0];
  const state = getReqState(req);

  const sleep = state.sleepEntries.find((s) => s.date === date) || null;
  const water = state.waterEntries.find((w) => w.date === date) || null;
  const meals = state.mealEntries.filter((m) => m.date === date);
  const activity = state.activityEntries.filter((a) => a.date === date);
  const mood = state.moodEntries.find((m) => m.date === date) || null;

  // Exact calculations from actual data
  const totalWaterMl = water ? water.amountMl : 0;
  const waterTargetMl = (water && water.targetMl) || state.settings?.waterTargetMl || 2500;
  const totalCalories = meals.reduce((sum, m) => sum + (m.calories || 0), 0);
  const totalProtein = Math.round(meals.reduce((sum, m) => sum + (m.proteinG || 0), 0) * 10) / 10;
  const totalCarbs = Math.round(meals.reduce((sum, m) => sum + (m.carbsG || 0), 0) * 10) / 10;
  const totalFat = Math.round(meals.reduce((sum, m) => sum + (m.fatG || 0), 0) * 10) / 10;
  const totalActivityMinutes = activity.reduce((sum, a) => sum + a.durationMinutes, 0);
  const totalSteps = activity.reduce((sum, a) => sum + (a.steps || 0), 0);

  // Tracking completion percentage (5 categories: sleep, water, meal, activity, mood)
  let completedCategories = 0;
  if (sleep) completedCategories++;
  if (water && water.amountMl > 0) completedCategories++;
  if (meals.length > 0) completedCategories++;
  if (activity.length > 0) completedCategories++;
  if (mood) completedCategories++;
  const completionPercentage = Math.round((completedCategories / 5) * 100);

  res.json({
    date,
    sleep,
    water: water || { amountMl: 0, unit: "ml", targetMl: waterTargetMl },
    meals,
    activity,
    mood,
    summary: {
      sleepHours: sleep ? sleep.durationHours : null,
      waterLoggedMl: totalWaterMl,
      waterTargetMl,
      waterPercentage: Math.min(100, Math.round((totalWaterMl / waterTargetMl) * 100)),
      mealsLogged: meals.length,
      totalCalories,
      totalProtein,
      totalCarbs,
      totalFat,
      activityMinutes: totalActivityMinutes,
      totalSteps,
      mood: mood ? mood.mood : null,
      completionPercentage,
    },
  });
});

// Sleep Tracker
app.get("/api/tracking/sleep", (req, res) => {
  const state = getReqState(req);
  res.json({ sleepEntries: state.sleepEntries });
});

app.post("/api/tracking/sleep", (req, res) => {
  try {
    const { date, bedtime, wakeTime, quality, notes } = req.body;
    if (!date || !bedtime || !wakeTime) {
      return res.status(400).json({ error: "Date, bedtime, and wakeTime are required" });
    }

    const durationHours = calculateSleepDuration(bedtime, wakeTime);
    const userId = getReqUserId(req);
    const state = getReqState(req);

    const entry: SleepEntry = {
      id: `sleep-${Date.now()}`,
      userId: state.profile.id,
      date,
      bedtime,
      wakeTime,
      durationHours,
      quality: quality || "good",
      notes: notes || undefined,
      createdAt: new Date().toISOString(),
    };

    store.addSleepEntry(entry, userId);

    // Sync with existing wellness entry
    store.addWellnessEntry({
      id: `wel-${Date.now()}`,
      userId: state.profile.id,
      date,
      sleepHours: durationHours,
      steps: 0,
      waterGlasses: 0,
      notes: notes || undefined,
    }, userId);

    res.json({ success: true, entry });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to save sleep entry" });
  }
});

app.delete("/api/tracking/sleep/:id", (req, res) => {
  const { id } = req.params;
  const userId = getReqUserId(req);
  store.deleteSleepEntry(id, userId);
  res.json({ success: true });
});

// Water Tracker
app.get("/api/tracking/water", (req, res) => {
  const state = getReqState(req);
  res.json({ waterEntries: state.waterEntries });
});

app.post("/api/tracking/water", (req, res) => {
  try {
    const { date, amountMl, unit, targetMl, notes } = req.body;
    if (!date || amountMl === undefined) {
      return res.status(400).json({ error: "Date and amountMl are required" });
    }

    const userId = getReqUserId(req);
    const state = getReqState(req);
    const entry: WaterEntry = {
      id: `water-${Date.now()}`,
      userId: state.profile.id,
      date,
      amountMl: Math.max(0, Number(amountMl)),
      unit: unit || "ml",
      targetMl: targetMl || state.settings?.waterTargetMl || 2500,
      notes: notes || undefined,
      createdAt: new Date().toISOString(),
    };

    const saved = store.addWaterEntry(entry, userId);
    res.json({ success: true, entry: saved });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to save water entry" });
  }
});

// Meals & Nutrition Tracker
app.get("/api/tracking/meals", (req, res) => {
  const state = getReqState(req);
  const date = req.query.date as string;
  const meals = date ? state.mealEntries.filter((m) => m.date === date) : state.mealEntries;
  res.json({ mealEntries: meals });
});

app.post("/api/tracking/meals", (req, res) => {
  try {
    const { date, mealType, mealName, foods, calories, proteinG, carbsG, fatG, isAiEstimated, notes } = req.body;
    if (!date || !mealName || !foods) {
      return res.status(400).json({ error: "Date, mealName, and foods are required" });
    }

    const userId = getReqUserId(req);
    const state = getReqState(req);
    const entry: MealEntry = {
      id: `meal-${Date.now()}`,
      userId: state.profile.id,
      date,
      mealType: mealType || "breakfast",
      mealName,
      foods,
      calories: calories !== undefined ? Number(calories) : undefined,
      proteinG: proteinG !== undefined ? Number(proteinG) : undefined,
      carbsG: carbsG !== undefined ? Number(carbsG) : undefined,
      fatG: fatG !== undefined ? Number(fatG) : undefined,
      isAiEstimated: !!isAiEstimated,
      notes: notes || undefined,
      createdAt: new Date().toISOString(),
    };

    store.addMealEntry(entry, userId);
    res.json({ success: true, entry });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to save meal entry" });
  }
});

app.delete("/api/tracking/meals/:id", (req, res) => {
  const { id } = req.params;
  const userId = getReqUserId(req);
  store.deleteMealEntry(id, userId);
  res.json({ success: true });
});

// AI Nutrition Estimation
app.post("/api/tracking/ai-estimate-nutrition", async (req, res) => {
  try {
    const { foods, mealName } = req.body;
    if (!foods) {
      return res.status(400).json({ error: "Food description is required" });
    }

    const prompt = `
Estimate the nutritional values for the following food item or meal description:
Meal Name: "${mealName || "Meal"}"
Foods & Portions: "${foods}"

Return ONLY valid JSON matching this schema:
{
  "calories": number,
  "proteinG": number,
  "carbsG": number,
  "fatG": number,
  "notes": string
}
Keep numbers realistic and grounded.
`;

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const parsed = JSON.parse(response.text || "{}");
    res.json({
      success: true,
      calories: parsed.calories || 350,
      proteinG: parsed.proteinG || 12,
      carbsG: parsed.carbsG || 45,
      fatG: parsed.fatG || 10,
      notes: parsed.notes || "Estimated by Gemini AI. Not a laboratory measurement.",
      isAiEstimated: true,
    });
  } catch (err: any) {
    console.error("AI Nutrition Estimate error:", err);
    res.status(500).json({ error: "Failed to estimate nutrition values" });
  }
});

// Activity Tracker
app.get("/api/tracking/activity", (req, res) => {
  const state = getReqState(req);
  const date = req.query.date as string;
  const activities = date ? state.activityEntries.filter((a) => a.date === date) : state.activityEntries;
  res.json({ activityEntries: activities });
});

app.post("/api/tracking/activity", (req, res) => {
  try {
    const { date, activityType, durationMinutes, steps, distanceKm, intensity, caloriesBurned, notes } = req.body;
    if (!date || !activityType || durationMinutes === undefined) {
      return res.status(400).json({ error: "Date, activityType, and durationMinutes are required" });
    }

    const userId = getReqUserId(req);
    const state = getReqState(req);
    const entry: ActivityEntry = {
      id: `act-${Date.now()}`,
      userId: state.profile.id,
      date,
      activityType,
      durationMinutes: Number(durationMinutes),
      steps: steps ? Number(steps) : undefined,
      distanceKm: distanceKm ? Number(distanceKm) : undefined,
      intensity: intensity || "medium",
      caloriesBurned: caloriesBurned ? Number(caloriesBurned) : undefined,
      notes: notes || undefined,
      createdAt: new Date().toISOString(),
    };

    store.addActivityEntry(entry, userId);
    res.json({ success: true, entry });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to save activity entry" });
  }
});

app.delete("/api/tracking/activity/:id", (req, res) => {
  const { id } = req.params;
  const userId = getReqUserId(req);
  store.deleteActivityEntry(id, userId);
  res.json({ success: true });
});

// Mood Tracker
app.get("/api/tracking/mood", (req, res) => {
  const state = getReqState(req);
  res.json({ moodEntries: state.moodEntries });
});

app.post("/api/tracking/mood", (req, res) => {
  try {
    const { date, mood, notes } = req.body;
    if (!date || !mood) {
      return res.status(400).json({ error: "Date and mood category are required" });
    }

    const userId = getReqUserId(req);
    const state = getReqState(req);
    const entry: MoodEntry = {
      id: `mood-${Date.now()}`,
      userId: state.profile.id,
      date,
      mood,
      notes: notes || undefined,
      createdAt: new Date().toISOString(),
    };

    store.addMoodEntry(entry, userId);
    res.json({ success: true, entry });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to save mood entry" });
  }
});

app.delete("/api/tracking/mood/:id", (req, res) => {
  const { id } = req.params;
  const userId = getReqUserId(req);
  store.deleteMoodEntry(id, userId);
  res.json({ success: true });
});

// ==========================================
// 2. HEALTH JOURNAL
// ==========================================

app.get("/api/journal", (req, res) => {
  const state = getReqState(req);
  const search = ((req.query.search as string) || "").toLowerCase();
  const tag = req.query.tag as string;

  let entries = state.journalEntries;
  if (search) {
    entries = entries.filter(
      (j) =>
        j.title.toLowerCase().includes(search) ||
        j.content.toLowerCase().includes(search) ||
        j.tags.some((t) => t.toLowerCase().includes(search))
    );
  }
  if (tag) {
    entries = entries.filter((j) => j.tags.includes(tag));
  }

  res.json({ journalEntries: entries });
});

app.post("/api/journal", (req, res) => {
  try {
    const { date, title, content, tags, clinicianQuestions, attachedDocumentId, attachedDocumentTitle } = req.body;
    if (!date || !title || !content) {
      return res.status(400).json({ error: "Date, title, and content are required" });
    }

    const userId = getReqUserId(req);
    const state = getReqState(req);
    const entry: HealthJournalEntry = {
      id: `jour-${Date.now()}`,
      userId: state.profile.id,
      date,
      title,
      content,
      tags: Array.isArray(tags) ? tags : [],
      clinicianQuestions: Array.isArray(clinicianQuestions) ? clinicianQuestions : [],
      attachedDocumentId: attachedDocumentId || undefined,
      attachedDocumentTitle: attachedDocumentTitle || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    store.addJournalEntry(entry, userId);

    // Also add to timeline as journal event
    store.addTimelineEvent({
      id: `time-${Date.now()}`,
      userId: state.profile.id,
      date,
      type: "journal",
      title: `Journal: ${title}`,
      summary: content.slice(0, 160) + (content.length > 160 ? "..." : ""),
      documentId: attachedDocumentId,
    }, userId);

    res.json({ success: true, entry });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to create journal entry" });
  }
});

app.put("/api/journal/:id", (req, res) => {
  const { id } = req.params;
  const userId = getReqUserId(req);
  const updated = store.updateJournalEntry(id, req.body, userId);
  if (!updated) return res.status(404).json({ error: "Journal entry not found" });
  res.json({ success: true, entry: updated });
});

app.delete("/api/journal/:id", (req, res) => {
  const { id } = req.params;
  const userId = getReqUserId(req);
  store.deleteJournalEntry(id, userId);
  res.json({ success: true });
});

// AI Plain-Language Summary for Health Journal
app.post("/api/journal/:id/ai-summary", async (req, res) => {
  try {
    const { id } = req.params;
    const userId = getReqUserId(req);
    const state = getReqState(req);
    const entry = state.journalEntries.find((j) => j.id === id);

    if (!entry) return res.status(404).json({ error: "Journal entry not found" });

    const prompt = `
You are Healthora Clinical Informatics Copilot.
The patient recorded the following health journal entry in their own words:
Title: "${entry.title}"
Date: ${entry.date}
Content: "${entry.content}"
Reported Questions: ${JSON.stringify(entry.clinicianQuestions || [])}

TASK:
1. Provide an objective, plain-language summary in English that preserves the user's reported experience without inventing a diagnosis.
2. Provide a matching plain-language summary in Hindi (शुद्ध और स्पष्ट हिंदी).
3. Generate 2 to 3 concise, structured appointment preparation talking points for their doctor.

Return ONLY valid JSON:
{
  "aiSummaryEn": string,
  "aiSummaryHi": string,
  "appointmentPrepList": string[]
}
`;

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: { responseMimeType: "application/json" },
    });

    const parsed = JSON.parse(response.text || "{}");
    const updated = store.updateJournalEntry(id, {
      aiSummaryEn: parsed.aiSummaryEn,
      aiSummaryHi: parsed.aiSummaryHi,
      appointmentPrepList: parsed.appointmentPrepList || [],
    }, userId);

    res.json({ success: true, entry: updated });
  } catch (err: any) {
    console.error("Journal AI Summary error:", err);
    res.status(500).json({ error: "Failed to generate AI summary for journal" });
  }
});

// ==========================================
// 3. AI BOTS — CENTRAL GEMINI INTELLIGENCE
// ==========================================

app.get("/api/ai-bots/conversations", (req, res) => {
  const state = getReqState(req);
  res.json({ conversations: state.conversations });
});

app.post("/api/ai-bots/conversations", (req, res) => {
  const { title, pageContext } = req.body;
  const userId = getReqUserId(req);
  const conv = store.createConversation(title || "Health Consultation", pageContext || "overview", userId);
  res.json({ success: true, conversation: conv });
});

app.delete("/api/ai-bots/conversations/:id", (req, res) => {
  const { id } = req.params;
  const userId = getReqUserId(req);
  store.deleteConversation(id, userId);
  res.json({ success: true });
});

app.post("/api/ai-bots/conversations/:id/clear", (req, res) => {
  const { id } = req.params;
  const userId = getReqUserId(req);
  store.clearConversation(id, userId);
  res.json({ success: true });
});

app.get("/api/ai-bots/conversations/:id/messages", (req, res) => {
  const { id } = req.params;
  const state = getReqState(req);
  const messages = state.messages.filter((m) => m.conversationId === id);
  res.json({ messages });
});

// Central AI Health Assistant Chat (General Health AI + Personal Medical Records AI)
app.post("/api/ai-bots/chat", async (req, res) => {
  try {
    const { conversationId, message, pageContext, language } = req.body;
    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ error: "Message is required" });
    }

    const userId = getReqUserId(req);
    const result = await processHealthAssistantChat({
      conversationId,
      message: message.trim(),
      pageContext: pageContext || "auto",
      language: language === "te" ? "te" : language === "hi" ? "hi" : "en",
      userId,
    });

    res.json({
      success: true,
      conversationId: result.conversationId,
      message: result.message,
      isPersonalRecordUsed: result.isPersonalRecordUsed,
      mode: result.mode,
      sources: result.sources,
    });
  } catch (err: any) {
    console.error("AI Health Assistant chat error:", err);
    res.status(500).json({
      error:
        err?.message ||
        "Failed to process question with Healthora AI. Please check your connection or retry.",
    });
  }
});

// ==========================================
// 4. ANALYTICS & TRENDS
// ==========================================

app.get("/api/analytics/trends", (req, res) => {
  const range = (req.query.range as string) || "7d";
  const startDateQuery = req.query.startDate as string;
  const endDateQuery = req.query.endDate as string;
  const state = getReqState(req);

  const now = new Date();
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  const formatDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  let dateKeys: string[] = [];
  let prevDateKeys: string[] = [];

  if (range === "custom" && startDateQuery && endDateQuery) {
    const start = new Date(startDateQuery);
    const end = new Date(endDateQuery);
    const cur = new Date(start);
    while (cur <= end) {
      dateKeys.push(formatDate(cur));
      cur.setDate(cur.getDate() + 1);
    }
    const daysDiff = dateKeys.length;
    const prevEnd = new Date(start);
    prevEnd.setDate(prevEnd.getDate() - 1);
    const prevStart = new Date(prevEnd);
    prevStart.setDate(prevStart.getDate() - (daysDiff - 1));
    const pCur = new Date(prevStart);
    while (pCur <= prevEnd) {
      prevDateKeys.push(formatDate(pCur));
      pCur.setDate(pCur.getDate() + 1);
    }
  } else if (range === "today") {
    const todayStr = formatDate(now);
    dateKeys = [todayStr];
    const yest = new Date(now);
    yest.setDate(yest.getDate() - 1);
    prevDateKeys = [formatDate(yest)];
  } else if (range === "this_month") {
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const cur = new Date(startOfMonth);
    while (cur <= now) {
      dateKeys.push(formatDate(cur));
      cur.setDate(cur.getDate() + 1);
    }
    // Previous equivalent span
    const daysSpan = dateKeys.length;
    const prevEnd = new Date(startOfMonth);
    prevEnd.setDate(prevEnd.getDate() - 1);
    const prevStart = new Date(prevEnd);
    prevStart.setDate(prevStart.getDate() - (daysSpan - 1));
    const pCur = new Date(prevStart);
    while (pCur <= prevEnd) {
      prevDateKeys.push(formatDate(pCur));
      pCur.setDate(pCur.getDate() + 1);
    }
  } else if (range === "prev_month") {
    const firstDayPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastDayPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    const cur = new Date(firstDayPrevMonth);
    while (cur <= lastDayPrevMonth) {
      dateKeys.push(formatDate(cur));
      cur.setDate(cur.getDate() + 1);
    }
    // Month before that
    const firstDayTwoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    const lastDayTwoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 1, 0);
    const pCur = new Date(firstDayTwoMonthsAgo);
    while (pCur <= lastDayTwoMonthsAgo) {
      prevDateKeys.push(formatDate(pCur));
      pCur.setDate(pCur.getDate() + 1);
    }
  } else {
    // 7d, 30d, 90d
    const daysCount = range === "90d" ? 90 : range === "30d" ? 30 : 7;
    for (let i = daysCount - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      dateKeys.push(formatDate(d));
    }
    for (let i = daysCount * 2 - 1; i >= daysCount; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      prevDateKeys.push(formatDate(d));
    }
  }

  const dateSet = new Set(dateKeys);
  const prevDateSet = new Set(prevDateKeys);

  // Helper for median
  const calcMedian = (arr: number[]): number | null => {
    if (arr.length === 0) return null;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  };

  // Helper for % change
  const calcPercentChange = (current: number | null, prev: number | null): number | null => {
    if (current === null || prev === null || prev === 0) return null;
    return Math.round(((current - prev) / prev) * 100);
  };

  // 1. SLEEP TREND & METRICS
  const sleepMap = new Map(state.sleepEntries.map((s) => [s.date, s]));
  const sleepTrend = dateKeys.map((date) => {
    const entry = sleepMap.get(date);
    return {
      date,
      displayDate: date.slice(5),
      durationHours: entry ? entry.durationHours : null,
      targetHours: state.settings?.sleepTargetHours || 8.0,
      quality: entry ? entry.quality : null,
    };
  });

  const sleepDurationsCurrent = dateKeys
    .map((d) => sleepMap.get(d)?.durationHours)
    .filter((v): v is number => typeof v === "number");
  const sleepDurationsPrev = prevDateKeys
    .map((d) => sleepMap.get(d)?.durationHours)
    .filter((v): v is number => typeof v === "number");

  const sleepTotalCurrent = sleepDurationsCurrent.reduce((a, b) => a + b, 0);
  const sleepAvgCurrent = sleepDurationsCurrent.length > 0 ? Number((sleepTotalCurrent / sleepDurationsCurrent.length).toFixed(1)) : null;
  const sleepAvgPrev = sleepDurationsPrev.length > 0 ? Number((sleepDurationsPrev.reduce((a, b) => a + b, 0) / sleepDurationsPrev.length).toFixed(1)) : null;
  const sleepMin = sleepDurationsCurrent.length > 0 ? Math.min(...sleepDurationsCurrent) : null;
  const sleepMax = sleepDurationsCurrent.length > 0 ? Math.max(...sleepDurationsCurrent) : null;
  const sleepMedian = calcMedian(sleepDurationsCurrent);
  const sleepRecordedDays = sleepDurationsCurrent.length;
  const sleepMissingDays = dateKeys.length - sleepRecordedDays;
  const sleepLatest = state.sleepEntries.filter((s) => dateSet.has(s.date)).sort((a, b) => b.date.localeCompare(a.date))[0]?.date || null;

  // 2. WATER INTAKE & METRICS
  const waterMap = new Map(state.waterEntries.map((w) => [w.date, w]));
  const waterTrend = dateKeys.map((date) => {
    const entry = waterMap.get(date);
    return {
      date,
      displayDate: date.slice(5),
      amountMl: entry ? entry.amountMl : null,
      targetMl: entry ? entry.targetMl : state.settings?.waterTargetMl || 2500,
    };
  });

  const waterAmountsCurrent = dateKeys
    .map((d) => waterMap.get(d)?.amountMl)
    .filter((v): v is number => typeof v === "number");
  const waterAmountsPrev = prevDateKeys
    .map((d) => waterMap.get(d)?.amountMl)
    .filter((v): v is number => typeof v === "number");

  const waterTotalCurrent = waterAmountsCurrent.reduce((a, b) => a + b, 0);
  const waterTotalPrev = waterAmountsPrev.reduce((a, b) => a + b, 0);
  const waterAvgCurrent = waterAmountsCurrent.length > 0 ? Math.round(waterTotalCurrent / waterAmountsCurrent.length) : null;
  const waterAvgPrev = waterAmountsPrev.length > 0 ? Math.round(waterTotalPrev / waterAmountsPrev.length) : null;
  const waterMin = waterAmountsCurrent.length > 0 ? Math.min(...waterAmountsCurrent) : null;
  const waterMax = waterAmountsCurrent.length > 0 ? Math.max(...waterAmountsCurrent) : null;
  const waterMedian = calcMedian(waterAmountsCurrent);
  const waterRecordedDays = waterAmountsCurrent.length;
  const waterMissingDays = dateKeys.length - waterRecordedDays;
  const waterLatest = state.waterEntries.filter((w) => dateSet.has(w.date)).sort((a, b) => b.date.localeCompare(a.date))[0]?.date || null;

  // 3. ACTIVITY DURATION & METRICS
  const activityTrend = dateKeys.map((date) => {
    const acts = state.activityEntries.filter((a) => a.date === date);
    const totalMins = acts.reduce((sum, a) => sum + a.durationMinutes, 0);
    const totalSteps = acts.reduce((sum, a) => sum + (a.steps || 0), 0);
    const totalCals = acts.reduce((sum, a) => sum + (a.caloriesBurned || 0), 0);
    return {
      date,
      displayDate: date.slice(5),
      activeMinutes: acts.length > 0 ? totalMins : null,
      steps: acts.length > 0 && totalSteps > 0 ? totalSteps : null,
      caloriesBurned: acts.length > 0 && totalCals > 0 ? totalCals : null,
      targetMinutes: state.settings?.activityTargetMinutes || 45,
      sessionsCount: acts.length,
    };
  });

  const actMinsCurrent = dateKeys
    .map((d) => {
      const acts = state.activityEntries.filter((a) => a.date === d);
      return acts.length > 0 ? acts.reduce((sum, a) => sum + a.durationMinutes, 0) : null;
    })
    .filter((v): v is number => typeof v === "number");

  const actMinsPrev = prevDateKeys
    .map((d) => {
      const acts = state.activityEntries.filter((a) => a.date === d);
      return acts.length > 0 ? acts.reduce((sum, a) => sum + a.durationMinutes, 0) : null;
    })
    .filter((v): v is number => typeof v === "number");

  const actTotalCurrent = actMinsCurrent.reduce((a, b) => a + b, 0);
  const actTotalPrev = actMinsPrev.reduce((a, b) => a + b, 0);
  const actAvgCurrent = actMinsCurrent.length > 0 ? Math.round(actTotalCurrent / actMinsCurrent.length) : null;
  const actAvgPrev = actMinsPrev.length > 0 ? Math.round(actTotalPrev / actMinsPrev.length) : null;
  const actMin = actMinsCurrent.length > 0 ? Math.min(...actMinsCurrent) : null;
  const actMax = actMinsCurrent.length > 0 ? Math.max(...actMinsCurrent) : null;
  const actMedian = calcMedian(actMinsCurrent);
  const actRecordedDays = actMinsCurrent.length;
  const actMissingDays = dateKeys.length - actRecordedDays;
  const actLatest = state.activityEntries.filter((a) => dateSet.has(a.date)).sort((a, b) => b.date.localeCompare(a.date))[0]?.date || null;

  // 4. NUTRITION & MEALS
  const mealsInRange = state.mealEntries.filter((m) => dateSet.has(m.date));
  const mealsInPrevRange = state.mealEntries.filter((m) => prevDateSet.has(m.date));

  const nutritionTrend = dateKeys.map((date) => {
    const meals = state.mealEntries.filter((m) => m.date === date);
    if (meals.length === 0) {
      return { date, displayDate: date.slice(5), calories: null, protein: null, carbs: null, fat: null, mealCount: 0 };
    }
    return {
      date,
      displayDate: date.slice(5),
      calories: meals.reduce((sum, m) => sum + (m.calories || 0), 0),
      protein: Math.round(meals.reduce((sum, m) => sum + (m.proteinG || 0), 0)),
      carbs: Math.round(meals.reduce((sum, m) => sum + (m.carbsG || 0), 0)),
      fat: Math.round(meals.reduce((sum, m) => sum + (m.fatG || 0), 0)),
      mealCount: meals.length,
    };
  });

  const calsCurrent = nutritionTrend.map((n) => n.calories).filter((v): v is number => typeof v === "number");
  const calsPrev = prevDateKeys.map((d) => {
    const m = state.mealEntries.filter((x) => x.date === d);
    return m.length > 0 ? m.reduce((sum, x) => sum + (x.calories || 0), 0) : null;
  }).filter((v): v is number => typeof v === "number");

  const mealsTotalCurrent = mealsInRange.length;
  const mealsTotalPrev = mealsInPrevRange.length;
  const calsAvgCurrent = calsCurrent.length > 0 ? Math.round(calsCurrent.reduce((a, b) => a + b, 0) / calsCurrent.length) : null;
  const calsAvgPrev = calsPrev.length > 0 ? Math.round(calsPrev.reduce((a, b) => a + b, 0) / calsPrev.length) : null;
  const calsMin = calsCurrent.length > 0 ? Math.min(...calsCurrent) : null;
  const calsMax = calsCurrent.length > 0 ? Math.max(...calsCurrent) : null;
  const calsMedian = calcMedian(calsCurrent);
  const nutritionRecordedDays = calsCurrent.length;
  const nutritionMissingDays = dateKeys.length - nutritionRecordedDays;
  const nutritionLatest = mealsInRange.sort((a, b) => b.date.localeCompare(a.date))[0]?.date || null;

  // Macro Totals & Caloric Contributions (4 kcal/g protein, 4 kcal/g carbs, 9 kcal/g fat)
  const totalProteinG = Math.round(mealsInRange.reduce((sum, m) => sum + (m.proteinG || 0), 0));
  const totalCarbsG = Math.round(mealsInRange.reduce((sum, m) => sum + (m.carbsG || 0), 0));
  const totalFatG = Math.round(mealsInRange.reduce((sum, m) => sum + (m.fatG || 0), 0));
  const proteinKcal = totalProteinG * 4;
  const carbsKcal = totalCarbsG * 4;
  const fatKcal = totalFatG * 9;
  const totalMacroKcal = proteinKcal + carbsKcal + fatKcal;

  const mealComposition = totalMacroKcal > 0 ? [
    { name: "Protein", grams: totalProteinG, calories: proteinKcal, percent: Math.round((proteinKcal / totalMacroKcal) * 100), color: "#3B82F6" },
    { name: "Carbohydrates", grams: totalCarbsG, calories: carbsKcal, percent: Math.round((carbsKcal / totalMacroKcal) * 100), color: "#F59E0B" },
    { name: "Fat", grams: totalFatG, calories: fatKcal, percent: Math.round((fatKcal / totalMacroKcal) * 100), color: "#EF4444" },
  ] : [];

  // 5. TRACKING COMPLETION & ACTIVITY DISTRIBUTION
  let daysTracked = 0;
  const dailyCompletion = dateKeys.map((date) => {
    const hasSleep = sleepMap.has(date);
    const hasWater = waterMap.has(date);
    const hasMeal = state.mealEntries.some((m) => m.date === date);
    const hasActivity = state.activityEntries.some((a) => a.date === date);
    const hasMood = state.moodEntries.some((m) => m.date === date);

    const completedCategories: string[] = [];
    if (hasSleep) completedCategories.push("sleep");
    if (hasWater) completedCategories.push("water");
    if (hasMeal) completedCategories.push("meal");
    if (hasActivity) completedCategories.push("activity");
    if (hasMood) completedCategories.push("mood");

    if (completedCategories.length > 0) daysTracked++;

    return {
      date,
      displayDate: date.slice(5),
      completedCount: completedCategories.length,
      notRecordedCount: 5 - completedCategories.length,
      hasSleep,
      hasWater,
      hasMeal,
      hasActivity,
      hasMood,
      completedCategories,
      status: completedCategories.length >= 3 ? "completed" : completedCategories.length > 0 ? "partial" : "not_recorded",
    };
  });

  const consistencyRate = Math.round((daysTracked / dateKeys.length) * 100);

  // Previous consistency rate
  let prevDaysTracked = 0;
  prevDateKeys.forEach((date) => {
    const hasAny =
      sleepMap.has(date) ||
      waterMap.has(date) ||
      state.mealEntries.some((m) => m.date === date) ||
      state.activityEntries.some((a) => a.date === date) ||
      state.moodEntries.some((m) => m.date === date);
    if (hasAny) prevDaysTracked++;
  });
  const prevConsistencyRate = prevDateKeys.length > 0 ? Math.round((prevDaysTracked / prevDateKeys.length) * 100) : null;

  // Chart A: Tracking Activity Distribution
  const sleepLogsCount = state.sleepEntries.filter((s) => dateSet.has(s.date)).length;
  const waterLogsCount = state.waterEntries.filter((w) => dateSet.has(w.date)).length;
  const mealLogsCount = mealsInRange.length;
  const activityLogsCount = state.activityEntries.filter((a) => dateSet.has(a.date)).length;
  const moodLogsCount = state.moodEntries.filter((m) => dateSet.has(m.date)).length;
  const totalTrackingLogs = sleepLogsCount + waterLogsCount + mealLogsCount + activityLogsCount + moodLogsCount;

  const trackingDistribution = totalTrackingLogs > 0 ? [
    { name: "Sleep Logs", count: sleepLogsCount, percent: Math.round((sleepLogsCount / totalTrackingLogs) * 100), color: "#6366F1" },
    { name: "Water Logs", count: waterLogsCount, percent: Math.round((waterLogsCount / totalTrackingLogs) * 100), color: "#14B8A6" },
    { name: "Meal Logs", count: mealLogsCount, percent: Math.round((mealLogsCount / totalTrackingLogs) * 100), color: "#F97316" },
    { name: "Activity Logs", count: activityLogsCount, percent: Math.round((activityLogsCount / totalTrackingLogs) * 100), color: "#10B981" },
    { name: "Mood Entries", count: moodLogsCount, percent: Math.round((moodLogsCount / totalTrackingLogs) * 100), color: "#EAB308" },
  ] : [];

  // Chart C: Mood Entry Distribution
  const moodCounts: Record<string, number> = {
    great: 0,
    good: 0,
    neutral: 0,
    low: 0,
    stressed: 0,
    anxious: 0,
  };
  const moodEntriesInRange = state.moodEntries.filter((m) => dateSet.has(m.date));
  moodEntriesInRange.forEach((m) => {
    if (moodCounts[m.mood] !== undefined) {
      moodCounts[m.mood]++;
    }
  });

  const totalMoods = moodEntriesInRange.length;
  const moodDistribution = [
    { key: "great", label: "Great", count: moodCounts.great, percent: totalMoods > 0 ? Math.round((moodCounts.great / totalMoods) * 100) : 0, color: "#10B981", emoji: "😄" },
    { key: "good", label: "Good", count: moodCounts.good, percent: totalMoods > 0 ? Math.round((moodCounts.good / totalMoods) * 100) : 0, color: "#14B8A6", emoji: "🙂" },
    { key: "neutral", label: "Neutral", count: moodCounts.neutral, percent: totalMoods > 0 ? Math.round((moodCounts.neutral / totalMoods) * 100) : 0, color: "#94A3B8", emoji: "😐" },
    { key: "low", label: "Low", count: moodCounts.low, percent: totalMoods > 0 ? Math.round((moodCounts.low / totalMoods) * 100) : 0, color: "#3B82F6", emoji: "😔" },
    { key: "stressed", label: "Stressed", count: moodCounts.stressed, percent: totalMoods > 0 ? Math.round((moodCounts.stressed / totalMoods) * 100) : 0, color: "#F59E0B", emoji: "😰" },
    { key: "anxious", label: "Anxious", count: moodCounts.anxious, percent: totalMoods > 0 ? Math.round((moodCounts.anxious / totalMoods) * 100) : 0, color: "#EF4444", emoji: "😟" },
  ];

  // Chart D: Medical Document Categories
  const docCategoryMap: Record<string, number> = {
    "Laboratory Report": 0,
    "Prescription": 0,
    "Discharge Summary": 0,
    "Diagnostic Report": 0,
    "Radiology / Imaging": 0,
    "Other Medical Records": 0,
  };

  const normalizeDocCategory = (type: string): string => {
    const t = (type || "").toLowerCase();
    if (t.includes("lab") || t.includes("blood") || t.includes("test")) return "Laboratory Report";
    if (t.includes("prescript") || t.includes("rx") || t.includes("medicat")) return "Prescription";
    if (t.includes("discharg")) return "Discharge Summary";
    if (t.includes("diagno") || t.includes("pathol")) return "Diagnostic Report";
    if (t.includes("scan") || t.includes("x-ray") || t.includes("mri") || t.includes("ct") || t.includes("imag")) return "Radiology / Imaging";
    return "Other Medical Records";
  };

  state.documents.forEach((doc) => {
    const cat = normalizeDocCategory(doc.documentType || "");
    docCategoryMap[cat] = (docCategoryMap[cat] || 0) + 1;
  });

  const totalDocs = state.documents.length;
  const docColors: Record<string, string> = {
    "Laboratory Report": "#3B82F6",
    "Prescription": "#10B981",
    "Discharge Summary": "#8B5CF6",
    "Diagnostic Report": "#F59E0B",
    "Radiology / Imaging": "#06B6D4",
    "Other Medical Records": "#64748B",
  };

  const documentCategories = Object.entries(docCategoryMap)
    .filter(([_, count]) => count > 0 || totalDocs === 0)
    .map(([name, count]) => ({
      name,
      count,
      percent: totalDocs > 0 ? Math.round((count / totalDocs) * 100) : 0,
      color: docColors[name] || "#64748B",
    }));

  // Calendar Activity Heatmap (entries per day across all tracking categories)
  const activityHeatmap = dateKeys.map((date) => {
    let count = 0;
    if (sleepMap.has(date)) count++;
    if (waterMap.has(date)) count++;
    count += state.mealEntries.filter((m) => m.date === date).length;
    count += state.activityEntries.filter((a) => a.date === date).length;
    count += state.moodEntries.filter((m) => m.date === date).length;
    count += state.journalEntries.filter((j) => j.date === date).length;
    return {
      date,
      count,
      intensity: count === 0 ? 0 : count <= 2 ? 1 : count <= 4 ? 2 : count <= 6 ? 3 : 4,
    };
  });

  // Clinical Lab Results Grouping
  const groupedTests: Record<string, ExtractedLabResult[]> = {};
  state.labs.forEach((lab: ExtractedLabResult) => {
    if (typeof lab.valueNumeric === "number") {
      if (!groupedTests[lab.testName]) {
        groupedTests[lab.testName] = [];
      }
      groupedTests[lab.testName].push(lab);
    }
  });
  Object.keys(groupedTests).forEach((testName) => {
    groupedTests[testName].sort((a, b) => a.observedDate.localeCompare(b.observedDate));
  });

  // Truthful, Grounded Insights Panel (strict rule-based observations from real user data)
  const insights: Array<{ id: string; type: "positive" | "neutral" | "observation"; category: string; title: string; message: string }> = [];

  if (sleepRecordedDays > 0) {
    if (sleepAvgCurrent && sleepAvgCurrent >= 7 && sleepAvgCurrent <= 9) {
      insights.push({
        id: "sleep-opt",
        type: "positive",
        category: "Sleep",
        title: "Sleep Duration In Target Range",
        message: `Recorded sleep duration averaged ${sleepAvgCurrent} hours across ${sleepRecordedDays} logged night(s), aligning with standard 7–9 hour recommendations.`,
      });
    } else if (sleepAvgCurrent) {
      insights.push({
        id: "sleep-obs",
        type: "observation",
        category: "Sleep",
        title: "Sleep Duration Pattern",
        message: `Recorded sleep duration averaged ${sleepAvgCurrent} hours across ${sleepRecordedDays} logged night(s). Longest was ${sleepMax}h and shortest was ${sleepMin}h.`,
      });
    }
  }

  if (waterRecordedDays > 0) {
    const metGoalDays = dateKeys.filter((d) => (waterMap.get(d)?.amountMl || 0) >= (state.settings?.waterTargetMl || 2500)).length;
    insights.push({
      id: "water-obs",
      type: metGoalDays > 0 ? "positive" : "observation",
      category: "Hydration",
      title: "Daily Hydration Records",
      message: `Hydration was logged on ${waterRecordedDays} of ${dateKeys.length} days, meeting target volume on ${metGoalDays} day(s) with an average of ${waterAvgCurrent?.toLocaleString()} ml.`,
    });
  }

  if (actRecordedDays > 0) {
    insights.push({
      id: "act-obs",
      type: "positive",
      category: "Activity",
      title: "Physical Activity Logged",
      message: `Total recorded active duration reached ${actTotalCurrent} minutes across ${actRecordedDays} day(s), averaging ${actAvgCurrent} minutes per logged active day.`,
    });
  }

  if (consistencyRate > 0) {
    insights.push({
      id: "tracking-obs",
      type: "neutral",
      category: "Consistency",
      title: "Data Logging Coverage",
      message: `Health tracking was recorded on ${daysTracked} of ${dateKeys.length} days (${consistencyRate}% overall tracking consistency for the selected period).`,
    });
  }

  // Final structured response
  res.json({
    range,
    dateKeys,
    prevDateKeys,
    totalDays: dateKeys.length,
    daysTracked,
    consistencyRate,
    prevConsistencyRate,

    // 8 Primary Summary Cards Data
    summaryMetrics: {
      sleep: {
        currentValue: sleepAvgCurrent,
        unit: "hours",
        previousValue: sleepAvgPrev,
        percentChange: calcPercentChange(sleepAvgCurrent, sleepAvgPrev),
        trendDirection: sleepAvgCurrent && sleepAvgPrev ? (sleepAvgCurrent > sleepAvgPrev ? "up" : sleepAvgCurrent < sleepAvgPrev ? "down" : "flat") : null,
        sparkline: sleepTrend.map((s) => ({ date: s.displayDate, value: s.durationHours })),
        recordedDays: sleepRecordedDays,
        missingDays: sleepMissingDays,
        coveragePercent: Math.round((sleepRecordedDays / dateKeys.length) * 100),
        totalHours: Number(sleepTotalCurrent.toFixed(1)),
        minHours: sleepMin,
        maxHours: sleepMax,
        medianHours: sleepMedian,
        latestRecordDate: sleepLatest,
      },
      waterTotal: {
        currentValue: waterTotalCurrent > 0 ? waterTotalCurrent : null,
        unit: "ml",
        previousValue: waterTotalPrev > 0 ? waterTotalPrev : null,
        percentChange: calcPercentChange(waterTotalCurrent, waterTotalPrev),
        trendDirection: waterTotalCurrent && waterTotalPrev ? (waterTotalCurrent > waterTotalPrev ? "up" : waterTotalCurrent < waterTotalPrev ? "down" : "flat") : null,
        sparkline: waterTrend.map((w) => ({ date: w.displayDate, value: w.amountMl })),
        recordedDays: waterRecordedDays,
        missingDays: waterMissingDays,
        coveragePercent: Math.round((waterRecordedDays / dateKeys.length) * 100),
        avgMl: waterAvgCurrent,
        minMl: waterMin,
        maxMl: waterMax,
        medianMl: waterMedian,
        latestRecordDate: waterLatest,
      },
      waterAvg: {
        currentValue: waterAvgCurrent,
        unit: "ml/day",
        previousValue: waterAvgPrev,
        percentChange: calcPercentChange(waterAvgCurrent, waterAvgPrev),
        trendDirection: waterAvgCurrent && waterAvgPrev ? (waterAvgCurrent > waterAvgPrev ? "up" : waterAvgCurrent < waterAvgPrev ? "down" : "flat") : null,
        targetMl: state.settings?.waterTargetMl || 2500,
      },
      activityDuration: {
        currentValue: actTotalCurrent > 0 ? actTotalCurrent : null,
        unit: "mins",
        previousValue: actTotalPrev > 0 ? actTotalPrev : null,
        percentChange: calcPercentChange(actTotalCurrent, actTotalPrev),
        trendDirection: actTotalCurrent && actTotalPrev ? (actTotalCurrent > actTotalPrev ? "up" : actTotalCurrent < actTotalPrev ? "down" : "flat") : null,
        sparkline: activityTrend.map((a) => ({ date: a.displayDate, value: a.activeMinutes })),
        recordedDays: actRecordedDays,
        missingDays: actMissingDays,
        coveragePercent: Math.round((actRecordedDays / dateKeys.length) * 100),
        avgMinutes: actAvgCurrent,
        minMinutes: actMin,
        maxMinutes: actMax,
        medianMinutes: actMedian,
        latestRecordDate: actLatest,
      },
      mealsRecorded: {
        currentValue: mealsTotalCurrent > 0 ? mealsTotalCurrent : null,
        unit: "meals",
        previousValue: mealsTotalPrev > 0 ? mealsTotalPrev : null,
        percentChange: calcPercentChange(mealsTotalCurrent, mealsTotalPrev),
        trendDirection: mealsTotalCurrent && mealsTotalPrev ? (mealsTotalCurrent > mealsTotalPrev ? "up" : mealsTotalCurrent < mealsTotalPrev ? "down" : "flat") : null,
        recordedDays: nutritionRecordedDays,
        missingDays: nutritionMissingDays,
        coveragePercent: Math.round((nutritionRecordedDays / dateKeys.length) * 100),
        latestRecordDate: nutritionLatest,
      },
      calorieAverage: {
        currentValue: calsAvgCurrent,
        unit: "kcal/day",
        previousValue: calsAvgPrev,
        percentChange: calcPercentChange(calsAvgCurrent, calsAvgPrev),
        trendDirection: calsAvgCurrent && calsAvgPrev ? (calsAvgCurrent > calsAvgPrev ? "up" : calsAvgCurrent < calsAvgPrev ? "down" : "flat") : null,
        sparkline: nutritionTrend.map((n) => ({ date: n.displayDate, value: n.calories })),
        minKcal: calsMin,
        maxKcal: calsMax,
        medianKcal: calsMedian,
      },
      trackingCompletion: {
        currentValue: consistencyRate,
        unit: "%",
        previousValue: prevConsistencyRate,
        percentChange: prevConsistencyRate !== null ? consistencyRate - prevConsistencyRate : null,
        trendDirection: prevConsistencyRate !== null ? (consistencyRate > prevConsistencyRate ? "up" : consistencyRate < prevConsistencyRate ? "down" : "flat") : null,
        daysTracked,
        totalDays: dateKeys.length,
      },
      medicalDocuments: {
        currentValue: totalDocs,
        unit: "files",
        totalDocs,
        categoryCount: Object.keys(docCategoryMap).filter((k) => docCategoryMap[k] > 0).length,
        latestUploadDate: state.documents.sort((a, b) => b.documentDate.localeCompare(a.documentDate))[0]?.documentDate || null,
      },
    },

    // Detailed series
    sleepTrend,
    waterTrend,
    activityTrend,
    nutritionTrend,

    // Distributions
    trackingDistribution,
    mealComposition,
    moodDistribution,
    moodCounts,
    documentCategories,
    dailyCompletion,
    activityHeatmap,

    // Lab trends
    labTrends: groupedTests,
    documentsCount: totalDocs,

    // Insights
    insights,
  });
});

// ==========================================
// 5. REMINDERS & NOTIFICATIONS
// ==========================================

app.get("/api/reminders", (req, res) => {
  const state = getReqState(req);
  res.json({ reminders: state.reminders });
});

app.post("/api/reminders", (req, res) => {
  try {
    const { title, description, category, date, time, recurrence } = req.body;
    if (!title || !date || !time) {
      return res.status(400).json({ error: "Title, date, and time are required" });
    }

    const userId = getReqUserId(req);
    const state = getReqState(req);
    const reminder: ReminderItem = {
      id: `rem-${Date.now()}`,
      userId: state.profile.id,
      title,
      description: description || "",
      category: category || "custom",
      date,
      time,
      recurrence: recurrence || "once",
      enabled: true,
      completed: false,
      createdAt: new Date().toISOString(),
    };

    store.addReminder(reminder, userId);
    res.json({ success: true, reminder });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to create reminder" });
  }
});

app.put("/api/reminders/:id", (req, res) => {
  const { id } = req.params;
  const userId = getReqUserId(req);
  const updated = store.updateReminder(id, req.body, userId);
  if (!updated) return res.status(404).json({ error: "Reminder not found" });
  res.json({ success: true, reminder: updated });
});

app.delete("/api/reminders/:id", (req, res) => {
  const { id } = req.params;
  const userId = getReqUserId(req);
  store.deleteReminder(id, userId);
  res.json({ success: true });
});

app.post("/api/reminders/:id/toggle", (req, res) => {
  const { id } = req.params;
  const userId = getReqUserId(req);
  const state = getReqState(req);
  const rem = state.reminders.find((r) => r.id === id);
  if (!rem) return res.status(404).json({ error: "Reminder not found" });

  const updated = store.updateReminder(id, { enabled: !rem.enabled }, userId);
  res.json({ success: true, reminder: updated });
});

app.post("/api/reminders/:id/complete", (req, res) => {
  const { id } = req.params;
  const userId = getReqUserId(req);
  const state = getReqState(req);
  const rem = state.reminders.find((r) => r.id === id);
  if (!rem) return res.status(404).json({ error: "Reminder not found" });

  const updated = store.updateReminder(id, { completed: !rem.completed }, userId);
  res.json({ success: true, reminder: updated });
});

app.post("/api/reminders/:id/snooze", (req, res) => {
  const { id } = req.params;
  const userId = getReqUserId(req);
  const { minutes } = req.body; // e.g. 15, 60
  const snoozeMs = (minutes || 15) * 60 * 1000;
  const snoozedUntil = new Date(Date.now() + snoozeMs).toISOString();

  const updated = store.updateReminder(id, { snoozedUntil }, userId);
  res.json({ success: true, reminder: updated });
});

// ==========================================
// 6. MEDICAL DOCUMENTS & LABS (EXISTING HEALTHORA PIPELINE)
// ==========================================

app.get("/api/documents", (req, res) => {
  const state = getReqState(req);
  res.json({ documents: state.documents });
});

app.get("/api/documents/:id/file", (req, res) => {
  const { id } = req.params;
  const state = getReqState(req);
  const doc = state.documents.find((d: MedicalDocument) => d.id === id);
  if (!doc) {
    return res.status(404).json({ error: "Document not found" });
  }
  res.json({
    documentId: doc.id,
    title: doc.title,
    fileName: doc.fileName,
    fileSize: doc.fileSize,
    mimeType: doc.mimeType,
    documentType: doc.documentType,
    documentDate: doc.documentDate,
    facility: doc.facility,
    doctor: doc.doctor,
    fileBase64: doc.fileBase64 || doc.rawData || null,
    previewUrl: doc.previewUrl || null,
  });
});

app.get("/api/documents/:id/results", (req, res) => {
  const { id } = req.params;
  const state = getReqState(req);
  const doc = state.documents.find((d: MedicalDocument) => d.id === id);
  if (!doc) {
    return res.status(404).json({ error: "Document not found" });
  }
  const labs = state.labs.filter((l: ExtractedLabResult) => l.documentId === id);
  const medications = state.medications.filter((m: MedicationItem) => m.documentId === id);
  res.json({
    success: true,
    document: doc,
    labs,
    medications,
  });
});

app.post("/api/documents/upload", async (req, res) => {
  try {
    const startTime = Date.now();
    const { title, fileName, fileSize, mimeType, documentType, documentDate, facility, doctor, fileBase64, textSnippet, autoAnalyze, fastMode } = req.body;
    const userId = getReqUserId(req);
    const state = getReqState(req);
    const docId = `doc-${Date.now()}`;

    const newDoc: MedicalDocument = {
      id: docId,
      userId: state.profile.id,
      title: title || fileName || "Medical Record",
      fileName: fileName || "document.pdf",
      fileSize: fileSize || 1024000,
      mimeType: mimeType || "application/pdf",
      documentType: documentType || "Lab Report",
      documentDate: documentDate || new Date().toISOString().split("T")[0],
      facility: facility || "Clinical Diagnostic Facility",
      doctor: doctor || "Attending Clinician",
      uploadDate: new Date().toISOString(),
      status: autoAnalyze ? "processing" : "uploaded",
      fileBase64: fileBase64 || undefined,
      rawData: fileBase64 || undefined,
    };

    store.addDocument(newDoc, userId);

    const savedLabs: ExtractedLabResult[] = [];
    const savedMedications: MedicationItem[] = [];

    if (autoAnalyze !== false) {
      const analysis = await analyzeMedicalDocument({
        documentId: docId,
        documentTitle: newDoc.title,
        documentType: newDoc.documentType,
        documentDate: newDoc.documentDate,
        facility: newDoc.facility,
        doctor: newDoc.doctor,
        mimeType: newDoc.mimeType,
        fileBase64,
        textSnippet,
        language: state.profile.preferredLanguage,
        fastMode: Boolean(fastMode),
      });

      newDoc.extractedData = analysis.extractedData;
      newDoc.status = "analyzed";
      store.updateDocument(docId, newDoc, userId);

      analysis.labs.forEach((l) => {
        const labItem: ExtractedLabResult = {
          ...l,
          id: `lab-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        };
        store.addLabResult(labItem, userId);
        savedLabs.push(labItem);
      });

      analysis.medications.forEach((m) => {
        const medItem: MedicationItem = {
          ...m,
          id: `med-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          userId: state.profile.id,
        };
        store.addMedication(medItem, userId);
        savedMedications.push(medItem);
      });

      store.addTimelineEvent({
        id: `time-${Date.now()}`,
        userId: state.profile.id,
        date: newDoc.documentDate,
        type: newDoc.documentType === "Prescription" ? "medication" : "lab",
        title: `${newDoc.title} Uploaded & Analyzed`,
        summary: analysis.extractedData.plainSummaryEn,
        summaryHi: analysis.extractedData.plainSummaryHi,
        documentId: docId,
      }, userId);
    }

    const processingTimeMs = Date.now() - startTime;

    res.json({
      success: true,
      document: newDoc,
      extractedLabs: savedLabs,
      extractedMedications: savedMedications,
      processingTimeMs,
    });
  } catch (error: any) {
    console.error("Upload error:", error);
    res.status(500).json({ error: error?.message || "Failed to process document" });
  }
});

app.post("/api/documents/:id/analyze", async (req, res) => {
  try {
    const startTime = Date.now();
    const { id } = req.params;
    const userId = getReqUserId(req);
    const state = getReqState(req);
    const doc = state.documents.find((d: MedicalDocument) => d.id === id);

    if (!doc) {
      return res.status(404).json({ error: "Document not found" });
    }

    store.updateDocument(id, { status: "processing" }, userId);

    const analysis = await analyzeMedicalDocument({
      documentId: id,
      documentTitle: doc.title,
      documentType: doc.documentType,
      documentDate: doc.documentDate,
      facility: doc.facility,
      doctor: doc.doctor,
      mimeType: doc.mimeType,
      textSnippet: req.body.textSnippet || `${doc.title} at ${doc.facility} dated ${doc.documentDate}`,
      language: state.profile.preferredLanguage,
      fastMode: Boolean(req.body.fastMode),
    });

    const updatedDoc = store.updateDocument(id, {
      extractedData: analysis.extractedData,
      status: "analyzed",
    }, userId);

    const savedLabs: ExtractedLabResult[] = [];
    const savedMedications: MedicationItem[] = [];

    analysis.labs.forEach((l) => {
      const labItem: ExtractedLabResult = {
        ...l,
        id: `lab-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      };
      store.addLabResult(labItem, userId);
      savedLabs.push(labItem);
    });

    analysis.medications.forEach((m) => {
      const medItem: MedicationItem = {
        ...m,
        id: `med-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        userId: state.profile.id,
      };
      store.addMedication(medItem, userId);
      savedMedications.push(medItem);
    });

    res.json({
      success: true,
      document: updatedDoc,
      analysis,
      extractedLabs: savedLabs,
      extractedMedications: savedMedications,
      processingTimeMs: Date.now() - startTime,
    });
  } catch (err: any) {
    console.error("Analysis route error:", err);
    res.status(500).json({ error: err?.message || "Analysis failed" });
  }
});

app.put("/api/documents/:id/verify", (req, res) => {
  const { id } = req.params;
  const userId = getReqUserId(req);
  const { correctedFields } = req.body;
  const state = getReqState(req);
  const doc = state.documents.find((d: MedicalDocument) => d.id === id);
  if (!doc) return res.status(404).json({ error: "Document not found" });

  const updatedDoc = store.updateDocument(id, {
    status: "verified",
    extractedData: doc.extractedData
      ? {
          ...doc.extractedData,
          ...(correctedFields || {}),
        }
      : undefined,
  }, userId);

  res.json({ success: true, document: updatedDoc });
});

app.delete("/api/documents/:id", (req, res) => {
  const { id } = req.params;
  const userId = getReqUserId(req);
  store.deleteDocument(id, userId);
  res.json({ success: true });
});

app.post("/api/documents/:id/qa", async (req, res) => {
  try {
    const { id } = req.params;
    const { question, language } = req.body;
    const state = getReqState(req);
    const doc = state.documents.find((d: MedicalDocument) => d.id === id);

    if (!doc) {
      return res.status(404).json({ error: "Document not found" });
    }

    const docSummary = doc.extractedData
      ? `${doc.extractedData.plainSummaryEn}\nObservations: ${doc.extractedData.keyObservations.join("; ")}`
      : `${doc.title} recorded on ${doc.documentDate} from ${doc.facility}`;

    const qaResult = await answerDocumentQuestion(
      doc.title,
      docSummary,
      question || "What are the main findings in this report?",
      language || state.profile.preferredLanguage || "en"
    );

    res.json({ success: true, ...qaResult });
  } catch (err: any) {
    console.error("QA error:", err);
    res.status(500).json({ error: err?.message || "Failed to answer question" });
  }
});

// Lab Results
app.get("/api/labs", (req, res) => {
  const state = getReqState(req);
  res.json({ labs: state.labs });
});

app.put("/api/labs/:id", (req, res) => {
  const { id } = req.params;
  const userId = getReqUserId(req);
  const updates = req.body;
  const updated = store.updateLabResult(id, updates, userId);
  if (!updated) return res.status(404).json({ error: "Lab not found" });
  res.json({ success: true, lab: updated });
});

app.post("/api/labs", (req, res) => {
  const userId = getReqUserId(req);
  const newLab: ExtractedLabResult = {
    ...req.body,
    id: `lab-${Date.now()}`,
    verified: true,
  };
  store.addLabResult(newLab, userId);
  res.json({ success: true, lab: newLab });
});

// Medications
app.get("/api/medications", (req, res) => {
  const state = getReqState(req);
  res.json({ medications: state.medications });
});

app.post("/api/medications", (req, res) => {
  const userId = getReqUserId(req);
  const state = getReqState(req);
  const newMed: MedicationItem = {
    ...req.body,
    id: `med-${Date.now()}`,
    userId: state.profile.id,
    userConfirmed: true,
  };
  store.addMedication(newMed, userId);
  res.json({ success: true, medication: newMed });
});

app.put("/api/medications/:id", (req, res) => {
  const { id } = req.params;
  const userId = getReqUserId(req);
  const updated = store.updateMedication(id, req.body, userId);
  if (!updated) return res.status(404).json({ error: "Medication not found" });
  res.json({ success: true, medication: updated });
});

// Medication Dose Action (Taken / Skipped / Snoozed)
app.post("/api/medications/:id/dose", (req, res) => {
  const { id } = req.params;
  const { action, reminderId } = req.body;
  if (!action || !["taken", "skipped", "snoozed"].includes(action)) {
    return res.status(400).json({ error: "Valid action ('taken', 'skipped', 'snoozed') is required" });
  }
  const userId = getReqUserId(req);
  const med = store.recordMedicationDose(id, action, reminderId, userId);
  if (!med) return res.status(404).json({ error: "Medication not found" });
  res.json({ success: true, medication: med });
});

// ==========================================
// 7. APPOINTMENTS & CLINICAL FOLLOW-UPS
// ==========================================

app.get("/api/appointments", (req, res) => {
  const userId = getReqUserId(req);
  const appointments = store.getAppointments(userId);
  res.json({ appointments });
});

app.post("/api/appointments", (req, res) => {
  try {
    const { title, doctorName, facility, specialty, date, time, purpose, followUpInstructions, type, reminderConfig, notes } = req.body;
    if (!title || !doctorName || !date || !time) {
      return res.status(400).json({ error: "Title, doctorName, date, and time are required" });
    }
    const userId = getReqUserId(req);
    const state = getReqState(req);

    const apt: AppointmentItem = {
      id: `apt-${Date.now()}`,
      userId: state.profile.id,
      title,
      doctorName,
      facility: facility || "Clinic / Medical Center",
      specialty: specialty || "General Medicine",
      date,
      time,
      status: "scheduled",
      purpose: purpose || "Clinical Consultation",
      followUpInstructions: followUpInstructions || undefined,
      type: type || "appointment",
      reminderConfig: reminderConfig || { enabled: true, alertMinutesBefore: 60 },
      notes: notes || undefined,
      createdAt: new Date().toISOString(),
    };

    const saved = store.addAppointment(apt, userId);

    // Also register a reminder for the appointment
    store.addReminder({
      id: `rem-apt-${Date.now()}`,
      userId: state.profile.id,
      title: `Upcoming: ${title} with ${doctorName}`,
      description: `${purpose || "Appointment"} at ${facility || "Clinic"}`,
      category: "appointment",
      date,
      time,
      recurrence: "once",
      enabled: true,
      completed: false,
      createdAt: new Date().toISOString(),
    }, userId);

    res.json({ success: true, appointment: saved });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to schedule appointment" });
  }
});

app.put("/api/appointments/:id", (req, res) => {
  const { id } = req.params;
  const userId = getReqUserId(req);
  const updated = store.updateAppointment(id, req.body, userId);
  if (!updated) return res.status(404).json({ error: "Appointment not found" });
  res.json({ success: true, appointment: updated });
});

app.post("/api/appointments/:id/status", (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!status || !["scheduled", "completed", "cancelled", "rescheduled"].includes(status)) {
    return res.status(400).json({ error: "Valid status required" });
  }
  const userId = getReqUserId(req);
  const updated = store.updateAppointment(id, { status }, userId);
  if (!updated) return res.status(404).json({ error: "Appointment not found" });
  res.json({ success: true, appointment: updated });
});

app.delete("/api/appointments/:id", (req, res) => {
  const { id } = req.params;
  const userId = getReqUserId(req);
  store.deleteAppointment(id, userId);
  res.json({ success: true });
});

// ==========================================
// 8. AGENTIC AI WORKFLOWS (Proactive Actions Requiring Approval)
// ==========================================

app.get("/api/agent/actions", (req, res) => {
  const userId = getReqUserId(req);
  const actions = store.getAgentActions(userId);
  res.json({ actions });
});

app.post("/api/agent/actions/:id/approve", (req, res) => {
  const { id } = req.params;
  const userId = getReqUserId(req);
  const approved = store.approveAgentAction(id, userId);
  if (!approved) return res.status(404).json({ error: "Agent action not found" });
  res.json({ success: true, action: approved });
});

app.post("/api/agent/actions/:id/reject", (req, res) => {
  const { id } = req.params;
  const userId = getReqUserId(req);
  const rejected = store.rejectAgentAction(id, userId);
  if (!rejected) return res.status(404).json({ error: "Agent action not found" });
  res.json({ success: true, action: rejected });
});

app.post("/api/agent/actions/generate-proposals", (req, res) => {
  const userId = getReqUserId(req);
  const proposals = store.generateAgentProposals(userId);
  res.json({ success: true, actions: proposals });
});

// ==========================================
// 9. WELLNESS RECOMMENDATIONS & COACH
// ==========================================

app.get("/api/wellness/recommendations", (req, res) => {
  const userId = getReqUserId(req);
  const recommendations = store.getWellnessRecommendations(userId);
  res.json({ recommendations });
});

app.post("/api/wellness/recommendations/:id/feedback", (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!status || !["helpful", "dismissed"].includes(status)) {
    return res.status(400).json({ error: "Status must be 'helpful' or 'dismissed'" });
  }
  const userId = getReqUserId(req);
  const updated = store.updateWellnessFeedback(id, status, userId);
  if (!updated) return res.status(404).json({ error: "Recommendation not found" });
  res.json({ success: true, recommendation: updated });
});

// ==========================================
// 10. HEALTH INSIGHTS
// ==========================================

app.get("/api/insights", (req, res) => {
  const userId = getReqUserId(req);
  const insights = store.getHealthInsights(userId);
  res.json({ insights });
});

// ==========================================
// 11. NOTIFICATIONS
// ==========================================

app.get("/api/notifications", (req, res) => {
  const userId = getReqUserId(req);
  const notifications = store.getNotifications(userId);
  res.json({ notifications, unreadCount: notifications.filter((n) => !n.isRead).length });
});

app.post("/api/notifications/:id/read", (req, res) => {
  const { id } = req.params;
  const userId = getReqUserId(req);
  const updated = store.markNotificationRead(id, userId);
  if (!updated) return res.status(404).json({ error: "Notification not found" });
  res.json({ success: true, notification: updated });
});

app.post("/api/notifications/mark-all-read", (req, res) => {
  const userId = getReqUserId(req);
  store.markAllNotificationsRead(userId);
  res.json({ success: true });
});

// ==========================================
// 12. FAMILY HEALTH (Isolated Portfolios)
// ==========================================

app.get("/api/family", (req, res) => {
  const userId = getReqUserId(req);
  const members = store.getFamilyMembers(userId);
  res.json({ members });
});

app.post("/api/family", (req, res) => {
  try {
    const { name, relationship, age, gender, chronicConditions, bloodGroup, isGuardianAccess } = req.body;
    if (!name || !relationship) {
      return res.status(400).json({ error: "Name and relationship are required" });
    }
    const userId = getReqUserId(req);
    const profileKey = `fam-${name.toLowerCase().replace(/[^a-z0-9]/g, "")}-${Date.now().toString().slice(-4)}`;

    const member: FamilyMember = {
      id: `fam-${Date.now()}`,
      name,
      relationship,
      age: age ? Number(age) : undefined,
      gender: gender || undefined,
      profileKey,
      isGuardianAccess: !!isGuardianAccess,
      chronicConditions: Array.isArray(chronicConditions) ? chronicConditions : [],
      bloodGroup: bloodGroup || undefined,
    };

    const saved = store.addFamilyMember(member, userId);
    res.json({ success: true, member: saved });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Failed to add family member" });
  }
});

app.post("/api/family/switch", (req, res) => {
  const { profileKey } = req.body;
  if (!profileKey) return res.status(400).json({ error: "profileKey is required" });
  const switched = store.setActiveProfileKey(profileKey);
  if (!switched) return res.status(404).json({ error: "Family profile not found" });
  const state = store.getCurrentState(profileKey);
  res.json({ success: true, activeProfile: state.profile, activeProfileKey: profileKey });
});



// Health Timeline
app.get("/api/timeline", (req, res) => {
  const state = getReqState(req);
  res.json({ timeline: state.timeline });
});

app.post("/api/timeline", (req, res) => {
  const userId = getReqUserId(req);
  const state = getReqState(req);
  const newEvent: TimelineEvent = {
    ...req.body,
    id: `time-${Date.now()}`,
    userId: state.profile.id,
  };
  store.addTimelineEvent(newEvent, userId);
  res.json({ success: true, event: newEvent });
});

// Clinician Discussion Dossier Export
app.get("/api/reports/summary-export", (req, res) => {
  const state = getReqState(req);
  const abnormalLabs = state.labs.filter((l: ExtractedLabResult) => l.sourceInterpretation !== "Within Normal Range");
  const activeMeds = state.medications.filter((m: MedicationItem) => m.status === "Active");

  res.json({
    generatedAt: new Date().toISOString(),
    patient: state.profile,
    keyClinicalHighlights: {
      totalDocuments: state.documents.length,
      abnormalLabObservations: abnormalLabs,
      activeMedications: activeMeds,
      chronicConditions: state.profile.chronicConditions || [],
      knownAllergies: state.profile.allergies || [],
    },
    suggestedDiscussionTopics: [
      "Review response to current active pharmacotherapy and assess any side effects.",
      "Evaluate trend in out-of-range laboratory values relative to target thresholds.",
      "Discuss lifestyle, dietary, and exercise adherence for ongoing wellness.",
    ],
    safetyNotice:
      "This summary dossier was prepared by HEALTHORA for discussion with your treating medical doctor. It is not an automated medical diagnosis or prescription.",
  });
});

// FHIR / ABDM Aligned Bundle
app.get("/api/abdm/fhir-bundle", (req, res) => {
  const state = getReqState(req);
  const fhirBundle = {
    resourceType: "Bundle",
    type: "document",
    meta: {
      profile: ["https://nrces.in/ndhm/fhir/r4/StructureDefinition/HealthDocumentRecord"],
      lastUpdated: new Date().toISOString(),
    },
    entry: [
      {
        resource: {
          resourceType: "Patient",
          id: state.profile.id,
          identifier: [
            {
              system: "https://healthid.ndhm.gov.in",
              value: state.profile.abhaNumber || "91-4821-9032-4112",
              type: { text: "ABHA Health ID (Mock Demonstration)" },
            },
          ],
          name: [{ text: state.profile.name }],
          gender: state.profile.gender?.toLowerCase() || "unknown",
          birthDate: state.profile.dob || "1978-04-14",
        },
      },
      ...state.labs.slice(0, 5).map((lab: ExtractedLabResult) => ({
        resource: {
          resourceType: "Observation",
          id: lab.id,
          status: "final",
          code: { text: lab.testName },
          valueQuantity: lab.valueNumeric
            ? {
                value: lab.valueNumeric,
                unit: lab.unit,
              }
            : undefined,
          referenceRange: [
            {
              text: lab.referenceRangeText,
              low: lab.referenceLow ? { value: lab.referenceLow } : undefined,
              high: lab.referenceHigh ? { value: lab.referenceHigh } : undefined,
            },
          ],
          interpretation: [{ text: lab.sourceInterpretation }],
        },
      })),
      ...state.medications
        .filter((m: MedicationItem) => m.status === "Active")
        .map((med: MedicationItem) => ({
          resource: {
            resourceType: "MedicationStatement",
            id: med.id,
            status: "active",
            medicationCodeableConcept: { text: med.name },
            dosage: [{ text: `${med.dosage} - ${med.frequency}` }],
          },
        })),
    ],
  };

  res.json({
    abdmNote:
      "ABDM-inspired, FHIR R4-compliant mock data bundle. Healthora formats all clinical records with standard interoperability schemas.",
    bundle: fhirBundle,
  });
});

// ---------------- DEV / PRODUCTION STATIC HOSTING ----------------

async function startServer() {
  if (!isProduction) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.resolve(distPath, "index.html"));
    });
  }

  app.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`Healthora 2.0 server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
