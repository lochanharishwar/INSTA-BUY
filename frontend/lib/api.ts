const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const api = {
  checkAuth: async (sessionId: string) => {
    const res = await fetch(`${API_URL}/auth/status?session_id=${sessionId}`);
    return res.json();
  },
  getLoginUrl: async (sessionId: string) => {
    const res = await fetch(`${API_URL}/auth/login?session_id=${sessionId}`);
    return res.json();
  },
  processRecipe: async (sessionId: string, urlOrText: string, sessionType: "solo" | "group" = "solo", contributors?: any[]) => {
    const res = await fetch(`${API_URL}/api/process`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: sessionId,
        url_or_text: urlOrText,
        session_type: sessionType,
        contributors: contributors
      })
    });
    return res.json();
  },
  approveContributor: async (sessionId: string, userId: string, approved: boolean) => {
    const res = await fetch(`${API_URL}/api/cart/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: sessionId,
        user_id: userId,
        approval_status: approved
      })
    });
    return res.json();
  },
  confirmCart: async (sessionId: string, cartItems: any[]) => {
    const res = await fetch(`${API_URL}/api/cart/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId, cart_items: cartItems })
    });
    return res.json();
  },
  trackOrder: async (sessionId: string) => {
    const res = await fetch(`${API_URL}/api/track?session_id=${sessionId}`);
    return res.json();
  }
};
