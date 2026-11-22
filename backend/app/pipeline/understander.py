import json
import hashlib
import re
import uuid
import structlog
from openai import AsyncOpenAI
from redis import Redis
from app.config import settings
from pydantic import BaseModel, Field
from typing import List, Optional

logger = structlog.get_logger()

redis_client = Redis.from_url(settings.REDIS_URL, decode_responses=True)

RECIPE_CACHE_TTL = 86400  # 24 hours


class Ingredient(BaseModel):
    id: str
    raw_name: str
    canonical_name: str
    quantity: float
    unit: str
    preparation_note: Optional[str] = None
    is_optional: bool = False
    category: str



class RecipeSchema(BaseModel):
    recipe_name: str
    cuisine_type: str
    serving_size: int
    prep_time_minutes: int
    cook_time_minutes: int
    equipment_needed: List[str]
    dietary_tags: List[str]
    confidence_score: float
    ingredients: List[Ingredient]


SYSTEM_PROMPT = (
    "You are a precise recipe extraction engine. "
    "Extract structured recipe data from the provided content. "
    "Rules:\n"
    "1. Separate preparation from ingredient (e.g., 'finely chopped onions' → canonical_name: 'onion', preparation_note: 'finely chopped').\n"
    "2. Use standard units: gram, ml, teaspoon, tablespoon, cup, piece, pinch.\n"
    "3. For vague quantities ('some', 'to taste'), use practical defaults (1 pinch, 0.5 teaspoon).\n"
    "4. Use canonical English names in canonical_name field.\n"
    "5. Categories: Spices, Produce, Dairy, Protein, Pantry, Oil, Grain, Herbs.\n"
    "6. Generate a UUID-style string for each ingredient id.\n"
    "7. IMPORTANT — Indian Language Translation: Always translate Indian/regional ingredient names "
    "to their standard English/Instamart-catalog equivalents:\n"
    "   dhaniya/धनिया → coriander, haldi/हल्दी → turmeric, jeera/जीरा → cumin, "
    "   rai/राई → mustard seeds, methi/मेथी → fenugreek, ajwain/अजवाइन → carom seeds, "
    "   dalchini/दालचीनी → cinnamon, laung/लौंग → cloves, elaichi/इलायची → cardamom, "
    "   besan/बेसन → gram flour, atta/आटा → wheat flour, maida/मैदा → all-purpose flour, "
    "   ghee/घी → ghee, dahi/दही → curd/yogurt, paneer/पनीर → paneer, "
    "   palak/पालक → spinach, aloo/आलू → potato, gobhi/गोभी → cauliflower, "
    "   tamatar/टमाटर → tomato, pyaaz/प्याज़ → onion, adrak/अदरक → ginger, "
    "   lehsun/लहसुन → garlic, pudina/पुदीना → mint, kadi patta/करी पत्ता → curry leaves, "
    "   til/तिल → sesame seeds, saunf/सौंफ → fennel seeds, amchur/अमचूर → dry mango powder, "
    "   imli/इमली → tamarind, gur/गुड़ → jaggery, chana dal/चना दाल → bengal gram, "
    "   urad dal/उड़द दाल → black gram, toor dal/तूर दाल → pigeon pea, "
    "   moong dal/मूंग दाल → green gram, rajma/राजमा → kidney beans, "
    "   chana/चना → chickpeas, poha/पोहा → flattened rice, suji/सूजी → semolina.\n"
    "   Apply this to Tamil, Telugu, Kannada, Marathi, Bengali names as well.\n"
    "You MUST return a valid JSON object matching the schema below. No markdown formatting, just raw JSON."
)

SCHEMA_TEMPLATE = """{
  "recipe_name": "string",
  "cuisine_type": "string",
  "serving_size": 4,
  "prep_time_minutes": 0,
  "cook_time_minutes": 0,
  "equipment_needed": ["string"],
  "dietary_tags": ["string"],
  "confidence_score": 0.85,
  "ingredients": [
    {
      "id": "ing-1",
      "raw_name": "string",
      "canonical_name": "string",
      "quantity": 0.0,
      "unit": "string",
      "preparation_note": "string or null",
      "is_optional": false,
      "category": "string"
    }
  ]
}"""


async def understand_recipe(content: str) -> RecipeSchema:
    """
    Parse raw recipe content into structured RecipeSchema using LLM.
    Uses NVIDIA NIM as primary, Gemini as fallback.
    Results are cached in Redis to avoid re-processing identical content.
    """
    cache_key = f"recipe_v2:{hashlib.sha256(content.encode()).hexdigest()}"
    cached = None
    try:
        cached = redis_client.get(cache_key)
    except Exception as e:
        logger.warning("understander.redis_offline", error=str(e)[:100])
        
    if cached:
        logger.info("understander.cache_hit")
        data = json.loads(cached)
        return RecipeSchema(**data)

    # Keep text-based recipes usable in local/demo mode when no hosted LLM
    # credentials are configured. This deliberately supports ingredient-list
    # formats only; it does not pretend to understand arbitrary prose.
    if not settings.NVIDIA_API_KEY and not settings.GEMINI_API_KEY:
        recipe = _parse_recipe_without_llm(content)
        try:
            redis_client.setex(cache_key, RECIPE_CACHE_TTL, json.dumps(recipe.model_dump()))
        except Exception as e:
            logger.warning("understander.redis_cache_failed", error=str(e)[:100])
        return recipe

    user_prompt = f"Schema:\n{SCHEMA_TEMPLATE}\n\nContent:\n{content[:4000]}"
    errors = []

    # ── Primary: NVIDIA NIM (Llama 3.1 8B) ─────────────────
    if settings.NVIDIA_API_KEY:
        try:
            result = await _call_nvidia(user_prompt)
            try:
                redis_client.setex(cache_key, RECIPE_CACHE_TTL, json.dumps(result.model_dump()))
            except Exception as ree:
                logger.warning("understander.redis_cache_failed", error=str(ree)[:100])
            return result
        except Exception as e:
            errors.append(f"nvidia: {str(e)[:100]}")
            logger.warning("understander.nvidia_failed", error=str(e)[:100])

    # ── Fallback: Gemini ────────────────────────────────────
    if settings.GEMINI_API_KEY:
        try:
            result = await _call_gemini(user_prompt)
            try:
                redis_client.setex(cache_key, RECIPE_CACHE_TTL, json.dumps(result.model_dump()))
            except Exception as ree:
                logger.warning("understander.redis_cache_failed", error=str(ree)[:100])
            return result
        except Exception as e:
            errors.append(f"gemini: {str(e)[:100]}")
            logger.warning("understander.gemini_failed", error=str(e)[:100])

    # ── All providers failed ────────────────────────────────
    raise Exception(
        f"All LLM providers failed. Errors: {'; '.join(errors)}. "
        f"Ensure NVIDIA_API_KEY or GEMINI_API_KEY is set."
    )


def _parse_recipe_without_llm(content: str) -> RecipeSchema:
    """Parse common quantity-first ingredient-list lines without an API key."""
    unit_pattern = (
        r"g|gm|gms|gram|grams|kg|ml|l|litre|liter|litres|liters|"
        r"tsp|teaspoon|teaspoons|tbsp|tablespoon|tablespoons|"
        r"cup|cups|piece|pieces|pcs|clove|cloves|pinch|pinches|bunch|bunches"
    )
    line_pattern = re.compile(
        rf"^\s*(?:[-*•]\s*)?(?P<quantity>\d+(?:\s*/\s*\d+|\.\d+)?|½|¼|¾)\s*"
        rf"(?P<unit>{unit_pattern})?\s*(?:of\s+)?(?P<name>[\w][\w\s()'’-]*?)\s*$",
        re.IGNORECASE,
    )
    fraction_values = {"½": 0.5, "¼": 0.25, "¾": 0.75}
    ingredients: list[Ingredient] = []
    title = "Recipe"
    serving_size = 4
    in_ingredients = False

    for raw_line in content.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        if title == "Recipe" and len(line) < 100 and not re.match(r"^[-*•\d]", line):
            title = re.sub(r"^#+\s*", "", line).strip(" :#") or title
        serving = re.search(r"(?:serves?|servings?)\s*[:=-]?\s*(\d+)", line, re.IGNORECASE)
        if serving:
            serving_size = max(1, min(int(serving.group(1)), 50))
        if re.match(r"^(?:ingredients?|what you(?:'|’)ll need)\s*:?\s*$", line, re.IGNORECASE):
            in_ingredients = True
            continue
        if in_ingredients and re.match(r"^(?:instructions?|method|directions?|steps?)\s*:?\s*$", line, re.IGNORECASE):
            in_ingredients = False
            continue
        if not in_ingredients and not re.match(r"^[-*•]\s*", line):
            continue

        match = line_pattern.match(line)
        if not match:
            continue
        quantity_text = match.group("quantity").replace(" ", "")
        if quantity_text in fraction_values:
            quantity = fraction_values[quantity_text]
        elif "/" in quantity_text:
            numerator, denominator = quantity_text.split("/", 1)
            quantity = float(numerator) / max(float(denominator), 1)
        else:
            quantity = float(quantity_text)
        unit = (match.group("unit") or "piece").lower()
        name = re.sub(r"\s+(?:to taste|as needed)$", "", match.group("name").strip(), flags=re.IGNORECASE)
        name = re.sub(r"\s*,?\s*(?:finely|roughly|thinly)?\s*(?:chopped|diced|minced|grated|sliced)$", "", name, flags=re.IGNORECASE)
        name = name.strip(" ,.-")
        if len(name) < 2:
            continue
        canonical = name.lower()
        category = "Spices" if any(word in canonical for word in ("powder", "spice", "salt", "pepper", "masala", "cumin", "turmeric")) else "Pantry"
        if any(word in canonical for word in ("tomato", "onion", "potato", "chilli", "spinach", "ginger", "garlic", "coriander")):
            category = "Produce"
        elif any(word in canonical for word in ("milk", "cream", "cheese", "paneer", "curd", "yogurt", "butter")):
            category = "Dairy"
        elif any(word in canonical for word in ("chicken", "mutton", "fish", "egg", "tofu")):
            category = "Protein"
        ingredients.append(Ingredient(
            id=str(uuid.uuid4()), raw_name=name, canonical_name=canonical,
            quantity=quantity, unit=unit, category=category,
        ))

    if len(ingredients) < 2:
        raise ValueError(
            "No AI key is configured. Paste a recipe with an Ingredients section and at least two quantity-first lines, "
            "for example: '2 tomatoes' and '1 tsp salt'."
        )

    return RecipeSchema(
        recipe_name=title[:100], cuisine_type="Unknown", serving_size=serving_size,
        prep_time_minutes=0, cook_time_minutes=0, equipment_needed=[], dietary_tags=[],
        confidence_score=0.65, ingredients=ingredients,
    )


async def _call_nvidia(user_prompt: str) -> RecipeSchema:
    """Call NVIDIA NIM (Llama 3.1 8B) via OpenAI-compatible API."""
    client = AsyncOpenAI(
        base_url="https://integrate.api.nvidia.com/v1",
        api_key=settings.NVIDIA_API_KEY
    )

    logger.info("understander.nvidia.generating", content_length=len(user_prompt))

    completion = await client.chat.completions.create(
        model="meta/llama-3.1-8b-instruct",
        messages=[
            {"role": "user", "content": f"{SYSTEM_PROMPT}\n\n{user_prompt}"}
        ],
        temperature=0.1,
        max_tokens=4096,
        stream=True
    )

    response_text = ""
    async for chunk in completion:
        if not chunk.choices:
            continue
        if chunk.choices[0].delta.content is not None:
            response_text += chunk.choices[0].delta.content

    return _parse_llm_response(response_text, "nvidia")


async def _call_gemini(user_prompt: str) -> RecipeSchema:
    """Call the Gemini generateContent API and require a JSON response."""
    import httpx

    logger.info("understander.gemini.generating", content_length=len(user_prompt))

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{settings.GEMINI_MODEL}:generateContent"
    payload = {
        "systemInstruction": {"parts": [{"text": SYSTEM_PROMPT}]},
        "contents": [{"role": "user", "parts": [{"text": user_prompt}]}],
        "generationConfig": {
            "temperature": 0.1,
            "maxOutputTokens": 4096,
            "responseMimeType": "application/json",
        },
    }

    async with httpx.AsyncClient(timeout=60) as client:
        response = await client.post(
            url,
            headers={"x-goog-api-key": settings.GEMINI_API_KEY},
            json=payload,
        )
        response.raise_for_status()
        data = response.json()
        try:
            response_text = data["candidates"][0]["content"]["parts"][0]["text"]
        except (KeyError, IndexError, TypeError) as exc:
            raise ValueError("Gemini returned no recipe JSON") from exc

    return _parse_llm_response(response_text, "gemini")


def _parse_llm_response(response_text: str, provider: str) -> RecipeSchema:
    """Parse LLM response text into RecipeSchema."""
    # Extract JSON block
    match = re.search(r'```(?:json)?\s*(.*?)```', response_text, re.DOTALL)
    if match:
        response_text = match.group(1).strip()
    else:
        start = response_text.find('{')
        end = response_text.rfind('}')
        if start >= 0 and end >= 0:
            response_text = response_text[start:end+1]

    data = json.loads(response_text)
    result = RecipeSchema(**data)

    logger.info(f"understander.{provider}.complete",
                 recipe=result.recipe_name,
                 ingredients=len(result.ingredients),
                 confidence=result.confidence_score)

    if result.confidence_score < 0.5:
        raise Exception("RECIPE_CONFIDENCE_LOW")

    return result
