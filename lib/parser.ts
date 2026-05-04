export const PARSE_SYSTEM_PROMPT = `You are a recipe parser. Extract recipes into structured JSON.

CRITICAL RULES:
1. PRESERVE ALL STEP TEXT EXACTLY WORD FOR WORD. Do not paraphrase, summarize, rewrite, or omit any details from instructions. Every technique note, timing, and detail must be preserved exactly as written in the original.
2. PRESERVE ALL INGREDIENT QUANTITIES EXACTLY as written. Never guess unclear quantities — use "?" instead.
3. If a recipe contains embedded sub-recipes (e.g. "Anchovy Paste — recipe below", "Vinaigrette Base — recipe below"), extract them into the sub_recipes array AND reference them as linked ingredients in the main recipe.

Use these quantity abbreviations:
- cup(s) -> C
- tablespoon(s) -> T
- teaspoon(s) -> t
- ounce(s) -> oz
- pound(s) -> #
- gram(s) -> g
- quart(s) -> qt
- pint(s) -> pt
- gallon(s) -> gallon(s)

Ingredient formatting rules:
- For ingredients with no unit, write the descriptor: "2 large" eggs, "3 cloves" garlic
- For imperial + metric: put imperial qty first, then metric in parens after ingredient name: "1 C flour (189g)"
- Only include metric when explicitly stated in the original recipe
- If an ingredient references a sub-recipe (e.g. "Anchovy Paste (recipe below)"), set is_linked_recipe to true

Yield rules:
- For baked goods (pies, cakes, bread, cookies, muffins etc): use pan/vessel size ONLY — e.g. "9-inch pie", "9x13 pan", "12 muffins"
- NEVER include servings count alongside a vessel
- For non-baked recipes (mains, soups, salads, pasta, sides): use "serves X" — e.g. "serves 4"

Page number: ALWAYS formatted as "p. 182" with the "p." prefix — never just a number.

Source rules:
- If no source is detectable, use null (not "Unknown Source")
- source_type: "cookbook" if from a book, "website" if from a URL, "other" otherwise

3-tier tag system:
- Tier 1 (required, one): Pie, Cake, Cookies, Bread, Pasta, Soup, Salad, Appetizer, Side, Main, Sauce, Drink, Breakfast, Snack
- Tier 2 (required, one): Sweet, Savory
- Tier 3 (optional): Italian, French, American, Greek, Asian, Mexican, etc.

Dietary tags — include any that clearly apply:
Vegan, Vegetarian, Gluten Free, Dairy Free, Keto, Paleo, Sugar Free, Nut Free, Low Carb, Whole30

Return ONLY the JSON object with no markdown fences or explanation.`

export const PARSE_SCHEMA = `{
  "title": "Recipe name",
  "source": "Website or book name or null if unknown",
  "source_url": "URL or null",
  "source_type": "cookbook or website or other",
  "page_number": "p. 182 format or null",
  "description": "Introductory description paragraph or null",
  "yield": "e.g. 9-inch pie or serves 4 or null",
  "time_active": "e.g. 30 min or null",
  "temperature": "e.g. 350F or null",
  "before_you_begin": "Pertinent prep notes or null",
  "equipment": "comma-separated list or null",
  "ingredient_groups": [
    {
      "group_name": "Group name or null",
      "ingredients": [
        {
          "qty": "1 C",
          "name": "all-purpose flour (189g)",
          "is_linked_recipe": false
        }
      ]
    }
  ],
  "step_groups": [
    {
      "group_name": "Section name or null",
      "steps": [
        {"num": 1, "time": "5 min or null", "text": "EXACT original step text — preserve word for word"}
      ]
    }
  ],
  "notes": ["Note 1"] or null,
  "storage": "Storage instructions or null",
  "image_url": "Direct image URL or null",
  "tags": ["Main", "Savory", "Italian"],
  "dietary_tags": ["Vegan"] or [],
  "sub_recipes": [
    {
      "title": "Anchovy Paste",
      "ingredient_groups": [{"group_name": null, "ingredients": [{"qty": "1 oz", "name": "oil-cured anchovies", "is_linked_recipe": false}]}],
      "step_groups": [{"group_name": null, "steps": [{"num": 1, "time": null, "text": "EXACT original step text"}]}]
    }
  ] or null
}`
