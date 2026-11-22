export const API_URL = process.env.NEXT_PUBLIC_API_URL
  ? process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, "")
  : "/_backend";

async function request(path: string, init?: RequestInit) {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, init);
  } catch {
    throw new Error(`Backend is not reachable at ${API_URL}. Start the FastAPI backend and refresh this page.`);
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = payload?.detail || payload?.message || `Request failed (${response.status})`;
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }
  return payload;
}

const sessionQuery = (sessionId: string) => `session_id=${encodeURIComponent(sessionId)}`;

export const api = {
  checkAuth: async (sessionId: string) => {
    return request(`/auth/status?${sessionQuery(sessionId)}`);
  },
  getLoginUrl: async (sessionId: string) => {
    return request(`/auth/login?${sessionQuery(sessionId)}`);
  },
  processRecipe: async (sessionId: string, urlOrText: string, sessionType: "solo" | "group" = "solo", contributors?: any[]) => {
    return request(`/api/process`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: sessionId,
        url_or_text: urlOrText,
        session_type: sessionType,
        contributors: contributors
      })
    });
  },
  approveContributor: async (sessionId: string, userId: string, approved: boolean) => {
    return request(`/api/cart/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: sessionId,
        user_id: userId,
        approval_status: approved
      })
    });
  },
  confirmCart: async (sessionId: string, cartItems: any[]) => {
    return request(`/api/cart/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId, cart_items: cartItems })
    });
  },
  trackOrder: async (sessionId: string) => {
    return request(`/api/track?${sessionQuery(sessionId)}`);
  },
  getSession: async (sessionId: string) => {
    return request(`/api/session?${sessionQuery(sessionId)}`);
  },
  generateVoice: async (text: string) => {
    const response = await fetch(`${API_URL}/api/voice`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    }).catch(() => {
      throw new Error(`Backend is not reachable at ${API_URL}.`);
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload?.detail || `Voice request failed (${response.status})`);
    }
    return response.blob();
  },
  compareOnlinePrices: async (ingredients: string[], location = "") => {
    return request(`/api/compare-prices`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ingredients, location }),
    });
  }
};
