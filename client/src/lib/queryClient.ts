import { QueryClient, QueryFunction } from "@tanstack/react-query";

// Use VITE_API_URL in production (Vercel → Render). Empty string = same-origin (dev).
export const API_URL: string = import.meta.env.VITE_API_URL || "";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

function adminAuthHeader(): Record<string, string> {
  const token = typeof localStorage !== "undefined" ? localStorage.getItem("adminToken") : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function teacherAuthHeader(): Record<string, string> {
  const token = typeof localStorage !== "undefined" ? localStorage.getItem("teacherToken") : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Route-based auth header selection.
 * CRITICAL: Never mix admin + teacher tokens in the same header object —
 * the last spread wins and overrides the first, causing 401 on the wrong role.
 */
function authHeadersForPath(path: string): Record<string, string> {
  const isAdminPath =
    path.startsWith("/api/admin") || path.startsWith("/api/auth/admin");
  const isTeacherPath =
    path.startsWith("/api/teacher") ||
    path.startsWith("/api/auth/teacher") ||
    path.startsWith("/api/student") ||
    path.startsWith("/api/orchestra") ||
    path.startsWith("/api/leaderboard");

  if (isAdminPath) return adminAuthHeader();
  if (isTeacherPath) return teacherAuthHeader();
  // Fallback: admin first (teacher login page sits at /api/auth/teacher/*)
  const admin = adminAuthHeader();
  if (Object.keys(admin).length) return admin;
  return teacherAuthHeader();
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(`${API_URL}${url}`, {
    method,
    headers: {
      ...(data ? { "Content-Type": "application/json" } : {}),
      ...authHeadersForPath(url),
    },
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const path = queryKey[0] as string;
    const rest = (queryKey as string[]).slice(1);
    const fullPath = rest.length ? `${path}/${rest.join("/")}` : path;
    const url = API_URL ? `${API_URL}${fullPath}` : fullPath;

    const res = await fetch(url, {
      credentials: "include",
      headers: authHeadersForPath(fullPath),
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
