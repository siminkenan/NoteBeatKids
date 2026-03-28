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

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(`${API_URL}${url}`, {
    method,
    headers: {
      ...(data ? { "Content-Type": "application/json" } : {}),
      ...adminAuthHeader(),
      ...teacherAuthHeader(),
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
    const path = queryKey.join("/"); // e.g. "/api/teacher/classes/123"
    const url = API_URL ? `${API_URL}${path}` : path;
    const res = await fetch(url, {
      credentials: "include",
      headers: { ...adminAuthHeader(), ...teacherAuthHeader() },
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