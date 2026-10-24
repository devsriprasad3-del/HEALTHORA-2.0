import { createClient, SupabaseClient, User, Session } from "@supabase/supabase-js";

export const DEFAULT_SUPABASE_PROJECT_ID = "eltheprswohoxxhxxtdl";
export const DEFAULT_SUPABASE_URL = "https://eltheprswohoxxhxxtdl.supabase.co";
export const DEFAULT_SUPABASE_ANON_KEY = "sb_publishable_Avnfpe_Z_PLGf497ATLuyw_zjF7aLXA";

// Safe public client configuration
let clientInstance: SupabaseClient | null = null;
let clientInitialized = false;

const buildTimeUrl = (import.meta as any).env?.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const buildTimeAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

if (buildTimeUrl && buildTimeAnonKey) {
  try {
    clientInstance = createClient(buildTimeUrl, buildTimeAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: typeof window !== "undefined" ? window.localStorage : undefined,
      },
    });
    clientInitialized = true;
  } catch (e) {
    console.warn("Failed to init Supabase client:", e);
  }
}

/**
 * Ensures the Supabase client is initialized.
 */
export async function getSupabaseClient(): Promise<SupabaseClient | null> {
  if (clientInstance) return clientInstance;

  try {
    const res = await fetch("/api/config/public");
    if (res.ok) {
      const config = await res.json();
      const url = config.supabaseUrl || DEFAULT_SUPABASE_URL;
      const key = config.supabaseAnonKey || DEFAULT_SUPABASE_ANON_KEY;
      clientInstance = createClient(url, key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storage: typeof window !== "undefined" ? window.localStorage : undefined,
        },
      });
      clientInitialized = true;
      return clientInstance;
    }
  } catch (err) {
    console.warn("Could not fetch public Supabase config:", err);
  }

  // Fallback to defaults
  clientInstance = createClient(DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_ANON_KEY);
  clientInitialized = true;
  return clientInstance;
}

export function getSyncSupabaseClient(): SupabaseClient | null {
  return clientInstance;
}

export async function isSupabaseReady(): Promise<boolean> {
  const client = await getSupabaseClient();
  return !!client;
}

export async function getCurrentSession(): Promise<Session | null> {
  const client = await getSupabaseClient();
  if (!client) return null;
  try {
    const { data } = await client.auth.getSession();
    return data.session;
  } catch (e) {
    return null;
  }
}

export async function getAuthHeaders(userId?: string): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};
  if (userId) {
    headers["x-user-id"] = userId;
  }
  const session = await getCurrentSession();
  if (session?.access_token) {
    headers["Authorization"] = `Bearer ${session.access_token}`;
  }
  return headers;
}

// ==============================================================================
// VISITOR LOGGING & TRACKING TO SUPABASE
// ==============================================================================

export function getOrCreateVisitorId(): string {
  if (typeof window === "undefined") return "server-visitor";
  let vid = localStorage.getItem("healthora_visitor_id");
  if (!vid) {
    vid = "vis_" + Math.random().toString(36).substring(2, 11) + "_" + Date.now().toString(36);
    localStorage.setItem("healthora_visitor_id", vid);
  }
  return vid;
}

export function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return "server-sess";
  let sid = sessionStorage.getItem("healthora_session_id");
  if (!sid) {
    sid = "sess_" + Math.random().toString(36).substring(2, 9) + "_" + Date.now().toString(36);
    sessionStorage.setItem("healthora_session_id", sid);
  }
  return sid;
}

export interface UsedProfileEntry {
  profileKey: string;
  userName?: string;
  firstUsedAt: string;
  lastUsedAt: string;
}

/**
 * Records a profile key used by this browser user so we can distinguish Current vs. Previous profiles
 */
export function recordUsedProfile(profileKey: string, userName?: string) {
  if (typeof window === "undefined" || !profileKey) return;
  try {
    const raw = localStorage.getItem("healthora_used_profiles");
    const list: UsedProfileEntry[] = raw ? JSON.parse(raw) : [];
    const now = new Date().toISOString();
    const existing = list.find((p) => p.profileKey === profileKey);
    if (existing) {
      existing.lastUsedAt = now;
      if (userName) existing.userName = userName;
    } else {
      list.unshift({
        profileKey,
        userName: userName || profileKey,
        firstUsedAt: now,
        lastUsedAt: now,
      });
    }
    localStorage.setItem("healthora_used_profiles", JSON.stringify(list));
    if (userName) {
      localStorage.setItem("healthora_active_user_name", userName);
    }
  } catch {
    // ignore storage errors
  }
}

export function getUsedProfilesHistory(): {
  currentProfileKey: string;
  previousProfileKeys: string[];
  entries: UsedProfileEntry[];
} {
  if (typeof window === "undefined") {
    return { currentProfileKey: "rajesh", previousProfileKeys: [], entries: [] };
  }
  const currentProfileKey = localStorage.getItem("healthora_active_profile") || "rajesh";
  let entries: UsedProfileEntry[] = [];
  try {
    const raw = localStorage.getItem("healthora_used_profiles");
    entries = raw ? JSON.parse(raw) : [];
  } catch {
    entries = [];
  }
  if (!entries.some((e) => e.profileKey === currentProfileKey)) {
    const now = new Date().toISOString();
    entries.unshift({
      profileKey: currentProfileKey,
      userName: localStorage.getItem("healthora_active_user_name") || currentProfileKey,
      firstUsedAt: now,
      lastUsedAt: now,
    });
  }
  const previousProfileKeys = entries
    .map((e) => e.profileKey)
    .filter((k) => k && k !== currentProfileKey);

  return {
    currentProfileKey,
    previousProfileKeys,
    entries,
  };
}

function detectDevice(): string {
  if (typeof window === "undefined") return "Unknown";
  const ua = navigator.userAgent;
  if (/mobile/i.test(ua)) return "Mobile";
  if (/tablet|ipad/i.test(ua)) return "Tablet";
  return "Desktop";
}

function detectBrowser(): string {
  if (typeof window === "undefined") return "Unknown";
  const ua = navigator.userAgent;
  if (ua.includes("Chrome") && !ua.includes("Edg")) return "Chrome";
  if (ua.includes("Safari") && !ua.includes("Chrome")) return "Safari";
  if (ua.includes("Firefox")) return "Firefox";
  if (ua.includes("Edg")) return "Edge";
  return "Browser";
}

function detectOS(): string {
  if (typeof window === "undefined") return "Unknown";
  const ua = navigator.userAgent;
  if (ua.includes("Win")) return "Windows";
  if (ua.includes("Mac")) return "macOS";
  if (ua.includes("Linux")) return "Linux";
  if (ua.includes("Android")) return "Android";
  if (ua.includes("iPhone") || ua.includes("iPad")) return "iOS";
  return "OS";
}

/**
 * Tracks a visitor's presence and stores their visit details in Supabase
 */
export async function trackWebsiteVisitor(
  pagePath = window.location.pathname || "/",
  metadata: Record<string, any> = {}
) {
  if (typeof window === "undefined") return;

  const visitorId = getOrCreateVisitorId();
  const sessionId = getOrCreateSessionId();
  const activeUser = localStorage.getItem("healthora_active_profile") || "rajesh";
  const activeUserName =
    localStorage.getItem("healthora_active_user_name") ||
    (activeUser === "rajesh"
      ? "Rajesh Sharma"
      : activeUser === "priya"
      ? "Priya Patel"
      : activeUser);

  recordUsedProfile(activeUser, activeUserName);

  const payload = {
    visitorId,
    sessionId,
    pagePath,
    pageTitle: document.title || "Healthora — AI Health Copilot",
    referrer: document.referrer || "direct",
    userAgent: navigator.userAgent,
    deviceType: detectDevice(),
    browser: detectBrowser(),
    os: detectOS(),
    screenResolution: `${window.innerWidth}x${window.innerHeight}`,
    language: navigator.language || "en",
    userId: activeUser,
    userName: activeUserName,
    metadata,
    visitedAt: new Date().toISOString(),
  };

  // 1. Direct send to backend which syncs with Supabase and stores locally
  try {
    fetch("/api/visitor/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => {});
  } catch (e) {
    // Graceful background send
  }

  // 2. Direct attempt from browser using Supabase client
  try {
    const client = await getSupabaseClient();
    if (client) {
      client
        .from("site_visits")
        .insert([
          {
            visitor_id: payload.visitorId,
            session_id: payload.sessionId,
            page_path: payload.pagePath,
            page_title: payload.pageTitle,
            referrer: payload.referrer,
            user_agent: payload.userAgent,
            device_type: payload.deviceType,
            browser: payload.browser,
            os: payload.os,
            screen_resolution: payload.screenResolution,
            language: payload.language,
            user_id: payload.userId,
            user_name: payload.userName,
            metadata: payload.metadata,
            visited_at: payload.visitedAt,
          },
        ])
        .then(() => {})
        .catch(() => {});

      client
        .from("website_visitors")
        .upsert(
          [
            {
              visitor_id: payload.visitorId,
              user_id: payload.userId,
              user_name: payload.userName,
              last_page_path: payload.pagePath,
              device_type: payload.deviceType,
              browser: payload.browser,
              os: payload.os,
              screen_resolution: payload.screenResolution,
              language: payload.language,
              last_seen_at: payload.visitedAt,
            },
          ],
          { onConflict: "visitor_id" }
        )
        .then(() => {})
        .catch(() => {});
    }
  } catch (err) {
    // Handled gracefully
  }
}
