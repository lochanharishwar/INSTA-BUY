import { create } from 'zustand'

export type ScreenState = "input" | "progress" | "review" | "tracking"
export type CartCategory = "more_wanted" | "less_wanted" | "pantry" | "skipped"

export interface CartItem {
  ingredient_name: string
  ingredient_quantity_display: string
  product_name: string
  product_brand: string
  product_quantity_display: string
  product_price: number
  spin_id: string | null
  quantity: number
  confidence: string
  confidence_score: number
  selection_reasons: string[]
  waste_grams: number
  waste_pct: number
  pantry_likely: boolean
  pantry_match: any
  image_url: string | null
  alternatives: any[]
  user_category?: CartCategory
  // Pantry/History context
  pantry_info?: {
    matched_item: string
    similarity: number
    days_ago: number
    decay_ratio: number
  }
}

export interface UserHistoryItem {
  name: string
  last_ordered: string
  times_ordered: number
  status: "active" | "expired" | "recently_bought"
  decay_ratio: number
  days_since_purchase: number
  shelf_life_days: number
}

export interface AppState {
  session_id: string
  screen: ScreenState
  pipeline_events: any[]
  cart_proposal: any
  order_id: string | null
  session_type: "solo" | "group"
  contributors: any[]
  cart_items: CartItem[]
  user_history: UserHistoryItem[]
  current_dialogue: { text: string; movie: string; emoji: string } | null
  setSessionId: (id: string) => void
  setScreen: (screen: ScreenState) => void
  addEvent: (event: any) => void
  setCartProposal: (proposal: any) => void
  setOrderId: (id: string) => void
  setSessionType: (type: "solo" | "group") => void
  setContributors: (contributors: any[]) => void
  moveItemCategory: (index: number, category: CartCategory) => void
  setCartItems: (items: CartItem[]) => void
  setUserHistory: (history: UserHistoryItem[]) => void
  setCurrentDialogue: (d: { text: string; movie: string; emoji: string } | null) => void
  reset: () => void
}

export const useStore = create<AppState>((set) => ({
  session_id: "",
  screen: "input",
  pipeline_events: [],
  cart_proposal: null,
  order_id: null,
  session_type: "solo",
  contributors: [],
  cart_items: [],
  user_history: [],
  current_dialogue: null,

  setSessionId: (id) => set({ session_id: id }),
  setScreen: (screen) => set({ screen }),
  addEvent: (event) => set((state) => ({ pipeline_events: [...state.pipeline_events, event] })),

  setCartProposal: (proposal) => {
    const items: CartItem[] = (proposal?.cart_items || []).map((item: any) => {
      let category: CartCategory = "more_wanted"
      if (item.pantry_likely || item.confidence === "pantry") {
        category = "pantry"
      } else if (item.waste_pct > 50 || item.product_price < 20) {
        category = "less_wanted"
      }
      return { ...item, user_category: category }
    })
    set({ cart_proposal: proposal, cart_items: items })
  },

  setOrderId: (id) => set({ order_id: id }),
  setSessionType: (type) => set({ session_type: type }),
  setContributors: (contributors) => set({ contributors }),
  moveItemCategory: (index, category) => set((state) => {
    const newItems = [...state.cart_items]
    if (newItems[index]) newItems[index] = { ...newItems[index], user_category: category }
    return { cart_items: newItems }
  }),
  setCartItems: (items) => set({ cart_items: items }),
  setUserHistory: (history) => set({ user_history: history }),
  setCurrentDialogue: (d) => set({ current_dialogue: d }),
  reset: () => set({
    screen: "input",
    pipeline_events: [],
    cart_proposal: null,
    order_id: null,
    session_type: "solo",
    contributors: [],
    cart_items: [],
    user_history: [],
    current_dialogue: null
  }),
}))