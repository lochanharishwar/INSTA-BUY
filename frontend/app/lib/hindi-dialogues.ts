// Hindi movie dialogues for fun desi UI flavor
// Each has a context trigger and emoji

export interface HindiDialogue {
  key: string;
  text: string;
  movie: string;
  emoji: string;
  context: string;
}

export const HINDI_DIALOGUES: HindiDialogue[] = [
  { key: "input", text: "Bhai, kya paka rahe ho aaj?", movie: "Andaz Apna Apna (1994)", emoji: "👨‍🍳", context: "input" },
  { key: "empty_cart", text: "Thali mein kuch bhi nahi hai bhai!", movie: "Dabangg (2010)", emoji: "🍽️", context: "empty_cart" },
  { key: "high_waste", text: "Itna sara bachega? Poore mohalle ko khilao!", movie: "Welcome (2007)", emoji: "🗑️", context: "high_waste" },
  { key: "success", text: "Ab toh bas khaane ka intezaar hai!", movie: "DDLJ (1995)", emoji: "🎉", context: "success" },
  { key: "delivery_near", text: "Aa raha hoon main!", movie: "Sholay (1975)", emoji: "🏃", context: "tracking" },
  { key: "pantry_skip", text: "Ye toh ghar pe hai na! Kya baat hai!", movie: "Guide (1965)", emoji: "🏠", context: "pantry" },
  { key: "group_split", text: "Bhai, sabka hisaab barabar!", movie: "Hera Pheri (2000)", emoji: "👥", context: "group" },
  { key: "less_wanted", text: "Thoda thoda chahiye? Thoda hi daalenge!", movie: "3 Idiots (2009)", emoji: "🥄", context: "less_wanted" },
  { key: "loading", text: "Banne de, recipe banne ke liye rakhi hai!", movie: "Deewar (1975)", emoji: "⏳", context: "loading" },
  { key: "great_match", text: "Yeh item toh first-class hai!", movie: "GolMaal (1979)", emoji: "⭐", context: "great_match" },
  { key: "substitute", text: "Bhai, yeh nahi mila toh kya hua?", movie: "Chupke Chupke (1975)", emoji: "🔄", context: "substitute" },
  { key: "recently_bought", text: "Bhai, yeh toh kal hi mangaaya tha!", movie: "Don (1978)", emoji: "💰", context: "recently_bought" },
  { key: "more_wanted", text: "Dil toh paagal hai, le liya!", movie: "Dil To Pagal Hai (1997)", emoji: "🤩", context: "more_wanted" },
  { key: "add_success", text: "Mogambo khush hua!", movie: "Mr. India (1987)", emoji: "😄", context: "add_success" },
  { key: "error", text: "Picture abhi baaki hai mere dost!", movie: "Om Shanti Om (2007)", emoji: "🎬", context: "error" },
]

export function getDialogue(context?: string): HindiDialogue {
  if (context) {
    const match = HINDI_DIALOGUES.find(d => d.context === context)
    if (match) return match
  }
  return HINDI_DIALOGUES[Math.floor(Math.random() * HINDI_DIALOGUES.length)]
}