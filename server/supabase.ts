import { createClient, SupabaseClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

// User-provided Project Credentials with robust fallbacks
export const SUPABASE_PROJECT_ID = process.env.VITE_SUPABASE_PROJECT_ID || process.env.SUPABASE_PROJECT_ID || "eltheprswohoxxhxxtdl";
const supabaseUrl = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL)?.trim() || `https://${SUPABASE_PROJECT_ID}.supabase.co`;
const supabaseAnonKey = (process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY)?.trim() || "sb_publishable_Avnfpe_Z_PLGf497ATLuyw_zjF7aLXA";
const supabaseServiceKey = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey)?.trim();

let client: SupabaseClient | null = null;
let connectionError: string | null = null;

if (supabaseUrl && supabaseAnonKey) {
  try {
    client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  } catch (err: any) {
    connectionError = err?.message || "Failed to initialize Supabase client";
    console.warn("Supabase server client init error:", connectionError);
  }
}

export function getPublicSupabaseConfig() {
  return {
    supabaseUrl: supabaseUrl || "",
    supabaseAnonKey: supabaseAnonKey || "",
    projectId: SUPABASE_PROJECT_ID,
    isConfigured: !!(supabaseUrl && supabaseAnonKey),
    dashboardUrl: `https://supabase.com/dashboard/project/${SUPABASE_PROJECT_ID}`,
    sqlEditorUrl: `https://supabase.com/dashboard/project/${SUPABASE_PROJECT_ID}/sql/new`,
  };
}

export interface SiteVisitPayload {
  visitorId: string;
  sessionId?: string;
  pagePath: string;
  pageTitle?: string;
  referrer?: string;
  userAgent?: string;
  deviceType?: string;
  browser?: string;
  os?: string;
  screenResolution?: string;
  language?: string;
  ipAddress?: string;
  userId?: string;
  userName?: string;
  metadata?: Record<string, any>;
  visitedAt?: string;
}

/**
 * Logs a visitor's arrival and page interaction into Supabase PostgreSQL (public.site_visits & public.website_visitors)
 */
export async function logVisitorToSupabase(visit: SiteVisitPayload): Promise<{
  synced: boolean;
  tableExists: boolean;
  error?: string;
  record?: any;
}> {
  if (!client) {
    return { synced: false, tableExists: false, error: "Supabase client not initialized" };
  }

  try {
    const visitedAt = visit.visitedAt || new Date().toISOString();
    const payload = {
      visitor_id: visit.visitorId,
      session_id: visit.sessionId || `sess-${Date.now()}`,
      page_path: visit.pagePath || "/",
      page_title: visit.pageTitle || "Healthora — AI Health Copilot",
      referrer: visit.referrer || "",
      user_agent: visit.userAgent || "Unknown Browser",
      device_type: visit.deviceType || "Desktop",
      browser: visit.browser || "Unknown",
      os: visit.os || "Unknown",
      screen_resolution: visit.screenResolution || "",
      language: visit.language || "en",
      ip_address: visit.ipAddress || "client-direct",
      user_id: visit.userId || null,
      user_name: visit.userName || null,
      metadata: visit.metadata || {},
      visited_at: visitedAt,
    };

    const { data, error } = await client
      .from("site_visits")
      .insert([payload])
      .select("id, visited_at")
      .single();

    // Also upsert into website_visitors directory table if it exists
    try {
      await client
        .from("website_visitors")
        .upsert(
          [
            {
              visitor_id: visit.visitorId,
              user_id: visit.userId || null,
              user_name: visit.userName || "Website Visitor",
              last_page_path: visit.pagePath || "/",
              device_type: visit.deviceType || "Desktop",
              browser: visit.browser || "Unknown",
              os: visit.os || "Unknown",
              screen_resolution: visit.screenResolution || "",
              language: visit.language || "en",
              ip_address: visit.ipAddress || "client-direct",
              last_seen_at: visitedAt,
            },
          ],
          { onConflict: "visitor_id" }
        );
    } catch {
      // Optional directory table
    }

    if (error) {
      const isMissingTable = error.message?.includes("does not exist") || error.code === "PGRST205";
      return {
        synced: false,
        tableExists: !isMissingTable,
        error: error.message,
      };
    }

    return {
      synced: true,
      tableExists: true,
      record: data,
    };
  } catch (err: any) {
    return {
      synced: false,
      tableExists: false,
      error: err?.message || "Failed to log visit to Supabase",
    };
  }
}

/**
 * Fetches recent visitor logs from Supabase
 */
export async function getRecentVisitsFromSupabase(limit = 20): Promise<{
  visits: any[];
  totalCount: number;
  tableReady: boolean;
  error?: string;
}> {
  if (!client) {
    return { visits: [], totalCount: 0, tableReady: false, error: "Supabase client uninitialized" };
  }

  try {
    const { data, count, error } = await client
      .from("site_visits")
      .select("*", { count: "exact" })
      .order("visited_at", { ascending: false })
      .limit(limit);

    if (error) {
      return {
        visits: [],
        totalCount: 0,
        tableReady: false,
        error: error.message,
      };
    }

    return {
      visits: data || [],
      totalCount: count || (data ? data.length : 0),
      tableReady: true,
    };
  } catch (err: any) {
    return {
      visits: [],
      totalCount: 0,
      tableReady: false,
      error: err?.message || "Query failed",
    };
  }
}

export async function testSupabaseConnection(): Promise<{
  configured: boolean;
  connected: boolean;
  projectId: string;
  url?: string;
  hasAnonKey: boolean;
  hasServiceRoleKey: boolean;
  tablesStatus: {
    site_visits: boolean;
    profiles: boolean;
    daily_tracking_entries: boolean;
  };
  sqlSetupNeeded: boolean;
  sqlEditorUrl: string;
  message: string;
}> {
  const hasUrl = !!supabaseUrl;
  const hasAnonKey = !!supabaseAnonKey;
  const hasServiceKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  const sqlEditorUrl = `https://supabase.com/dashboard/project/${SUPABASE_PROJECT_ID}/sql/new`;

  if (!hasUrl || !supabaseAnonKey) {
    return {
      configured: false,
      connected: false,
      projectId: SUPABASE_PROJECT_ID,
      hasAnonKey,
      hasServiceRoleKey: hasServiceKey,
      tablesStatus: { site_visits: false, profiles: false, daily_tracking_entries: false },
      sqlSetupNeeded: true,
      sqlEditorUrl,
      message: "Supabase credentials are not configured.",
    };
  }

  if (!client) {
    return {
      configured: true,
      connected: false,
      projectId: SUPABASE_PROJECT_ID,
      url: supabaseUrl,
      hasAnonKey,
      hasServiceRoleKey: hasServiceKey,
      tablesStatus: { site_visits: false, profiles: false, daily_tracking_entries: false },
      sqlSetupNeeded: true,
      sqlEditorUrl,
      message: connectionError || "Client failed to initialize with provided credentials.",
    };
  }

  try {
    // 1. Verify GoTrue Auth Connectivity
    const authHealthRes = await fetch(`${supabaseUrl}/auth/v1/health`, {
      headers: { apikey: supabaseAnonKey },
    });
    const authIsUp = authHealthRes.ok;

    // 2. Check site_visits table
    const { error: visitErr } = await client.from("site_visits").select("id").limit(1);
    const siteVisitsReady = !visitErr;

    // 3. Check profiles table
    const { error: profileErr } = await client.from("profiles").select("id").limit(1);
    const profilesReady = !profileErr;

    // 4. Check daily_tracking_entries table
    const { error: trackingErr } = await client.from("daily_tracking_entries").select("id").limit(1);
    const trackingReady = !trackingErr;

    const sqlSetupNeeded = !siteVisitsReady || !profilesReady;

    let message = "Connected securely to remote Supabase database with Row Level Security.";
    if (sqlSetupNeeded) {
      message = "Connected to Supabase endpoint! Run the database schema SQL migration script in your Supabase SQL Editor to initialize all tables.";
    }

    return {
      configured: true,
      connected: authIsUp,
      projectId: SUPABASE_PROJECT_ID,
      url: supabaseUrl,
      hasAnonKey,
      hasServiceRoleKey: hasServiceKey,
      tablesStatus: {
        site_visits: siteVisitsReady,
        profiles: profilesReady,
        daily_tracking_entries: trackingReady,
      },
      sqlSetupNeeded,
      sqlEditorUrl,
      message,
    };
  } catch (err: any) {
    return {
      configured: true,
      connected: false,
      projectId: SUPABASE_PROJECT_ID,
      url: supabaseUrl,
      hasAnonKey,
      hasServiceRoleKey: hasServiceKey,
      tablesStatus: { site_visits: false, profiles: false, daily_tracking_entries: false },
      sqlSetupNeeded: true,
      sqlEditorUrl,
      message: `Connection test failed: ${err?.message || "Network error"}`,
    };
  }
}

export async function verifyAuthToken(token: string): Promise<{ user: any | null; error: string | null }> {
  if (!client || !token) return { user: null, error: "Supabase not configured or no token" };
  try {
    const { data, error } = await client.auth.getUser(token);
    if (error || !data.user) {
      return { user: null, error: error?.message || "Invalid token" };
    }
    return { user: data.user, error: null };
  } catch (e: any) {
    return { user: null, error: e?.message || "Auth verification failed" };
  }
}

export function getSupabaseClient(): SupabaseClient | null {
  return client;
}

export function isSupabaseConfigured(): boolean {
  return !!(supabaseUrl && supabaseAnonKey);
}

/**
 * Fetches unique website visitors from public.website_visitors in Supabase
 */
export async function getSupabaseWebsiteVisitors(limit = 50): Promise<{
  visitors: any[];
  tableReady: boolean;
  error?: string;
}> {
  if (!client) {
    return { visitors: [], tableReady: false, error: "Supabase client uninitialized" };
  }
  try {
    const { data, error } = await client
      .from("website_visitors")
      .select("*")
      .order("last_seen_at", { ascending: false })
      .limit(limit);
    if (error) {
      return { visitors: [], tableReady: false, error: error.message };
    }
    return { visitors: data || [], tableReady: true };
  } catch (err: any) {
    return { visitors: [], tableReady: false, error: err?.message || "Query failed" };
  }
}

/**
 * Synchronizes unsynced local visitor logs and unique visitor directory into Supabase
 */
export async function syncMasterDataToSupabase(visits: any[]): Promise<{
  syncedVisitsCount: number;
  syncedVisitorsCount: number;
  syncedVisitIds: string[];
  error?: string;
}> {
  if (!client) {
    return {
      syncedVisitsCount: 0,
      syncedVisitorsCount: 0,
      syncedVisitIds: [],
      error: "Supabase client not initialized",
    };
  }

  const syncedVisitIds: string[] = [];
  let syncedVisitorsCount = 0;

  try {
    const unsynced = visits.filter((v) => !v.syncedToSupabase).slice(0, 100);
    for (const v of unsynced) {
      const res = await logVisitorToSupabase({
        visitorId: v.visitorId,
        sessionId: v.sessionId,
        pagePath: v.pagePath,
        pageTitle: v.pageTitle,
        referrer: v.referrer,
        userAgent: v.userAgent,
        deviceType: v.deviceType,
        browser: v.browser,
        os: v.os,
        screenResolution: v.screenResolution,
        language: v.language,
        ipAddress: v.ipAddress,
        userId: v.userId,
        userName: v.userName,
        metadata: v.metadata,
        visitedAt: v.visitedAt,
      });
      if (res.synced) {
        syncedVisitIds.push(v.id);
      } else if (!res.tableExists) {
        return {
          syncedVisitsCount: 0,
          syncedVisitorsCount: 0,
          syncedVisitIds: [],
          error: res.error || "Supabase tables not created yet. Run the SQL migration script first.",
        };
      }
    }

    // Also upsert unique visitors
    const uniqueMap = new Map<string, any>();
    for (const v of visits) {
      if (!uniqueMap.has(v.visitorId)) {
        uniqueMap.set(v.visitorId, v);
      }
    }
    for (const v of uniqueMap.values()) {
      try {
        const { error } = await client.from("website_visitors").upsert(
          [
            {
              visitor_id: v.visitorId,
              user_id: v.userId || null,
              user_name: v.userName || "Website Visitor",
              last_page_path: v.pagePath || "/",
              device_type: v.deviceType || "Desktop",
              browser: v.browser || "Unknown",
              os: v.os || "Unknown",
              screen_resolution: v.screenResolution || "",
              language: v.language || "en",
              ip_address: v.ipAddress || "client-direct",
              last_seen_at: v.visitedAt || new Date().toISOString(),
            },
          ],
          { onConflict: "visitor_id" }
        );
        if (!error) syncedVisitorsCount++;
      } catch {
        // ignore if optional table not created
      }
    }

    return {
      syncedVisitsCount: syncedVisitIds.length,
      syncedVisitorsCount,
      syncedVisitIds,
    };
  } catch (err: any) {
    return {
      syncedVisitsCount: syncedVisitIds.length,
      syncedVisitorsCount,
      syncedVisitIds,
      error: err?.message || "Sync failed",
    };
  }
}

