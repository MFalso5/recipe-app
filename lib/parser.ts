export const PARSE_SYSTEM_PROMPT = `You are a precise recipe parser. Extract recipes into structured JSON exactly as written.

CRITICAL RULES — NEVER VIOLATE THESE:

1. PRESERVE ALL STEP TEXT EXACTLY WORD FOR WORD. Do not paraphrase, summarize, rewrite, or omit any details. Every technique note, timing, temperature, and detail must be preserved verbatim.

2. PRESERVE INGREDIENT ORDER exactly as listed in the original recipe. Never reorder ingredients for any reason.

3. INGREDIENT PARSING RULES:
   - qty = the NUMBER and UNIT only (e.g. "1", "2 C", "1/2 t", "3 oz")
   - name = EVERYTHING ELSE — size descriptors, prep notes, descriptions all belong in the name
   - "1 medium onion, sliced" → qty: "1", name: "medium onion, sliced"
   - "2 large eggs" → qty: "2", name: "large eggs"
   - "1 large garlic clove, minced" → qty: "1", name: "large garlic clove, minced"
   - "confectioners sugar for dusting" (no qty) → qty: "as needed", name: "confectioners sugar, for dusting"
   - "salt and pepper to taste" → qty: "to taste", name: "salt and pepper"
   - "a pinch of salt" → qty: "pinch", name: "salt"
   - NEVER use qty: "1 medium" — medium/large/small are NOT quantities

4. SUB-RECIPE vs VARIATION vs SEPARATE RECIPE RULES — read carefully:

   SEPARATE RECIPE (place in sub_recipes array):
   - Has its own title, its own complete ingredient list, AND its own complete instructions
   - Could be made entirely independently without referring to the parent recipe
   - Examples: Chocolate Pastry Cream appearing on the same page as Pastry Cream; Diplomat Cream appearing alongside another cream recipe
   - Even if it appears on the same physical page, if it is fully self-contained, it is a separate recipe

   VARIATION (place in variations array on the SAME recipe):
   - Does NOT have a fully independent ingredient list and instructions
   - Explicitly references the parent recipe method (e.g. "make as directed above", "follow the recipe for X, then add...")
   - Describes a simple modification: a flavor swap, an addition, a substitution
   - Example: "Orange Diplomat Cream — make Diplomat Cream as directed, then whisk in the zest of 2 oranges"
   - A variation CANNOT stand alone without the parent recipe

   LINKED INGREDIENT (set is_linked_recipe: true on the ingredient):
   - When a recipe calls for another recipe by name as an ingredient (e.g. "1 recipe Pastry Cream, page 373")
   - Create a sub_recipe entry AND mark the ingredient as is_linked_recipe: true

   NEVER classify a fully self-contained recipe as a variation just because it appears next to another recipe.

5. MULTIPLE RECIPES ON ONE PAGE:
   - When a page contains more than one fully self-contained recipe, extract the FIRST (or most prominent) recipe as the main recipe
   - Place all additional self-contained recipes in the sub_recipes array
   - Place true variations (those that reference the parent method) in the variations array

6. DESCRIPTION: Always capture the headnote, intro paragraph, or any text before the ingredients that describes the recipe — its history, origin, why it's notable, the technique, or what makes it special. Even a single sentence counts. Never leave description null if there is any introductory text.

7. MULTI-PAGE RECIPES: When multiple images are provided, treat them as consecutive pages of ONE recipe. Extract all ingredients and steps across all pages into a single complete recipe. Never truncate or stop mid-recipe.

8. SOURCE: If no source is detectable, return null (never "Unknown Source").

QUANTITY ABBREVIATIONS:
- cup(s) → C
- tablespoon(s) → T  
- teaspoon(s) → t
- ounce(s) → oz
- pound(s) → #
- gram(s) → g
- kilogram(s) → kg
- milliliter(s) → ml
- liter(s) → L
- quart(s) → qt
- pint(s) → pt
- fluid ounce(s) → fl oz

YIELD RULES:
- Baked goods: vessel/pan size only — "9-inch pie", "9x13 pan", "12 muffins", "1 loaf"
- Mains/soups/salads: "serves 4", "serves 6"
- Never combine both — never "9-inch pie, serves 8"

PAGE NUMBER FORMAT: Always "p. 182" — never just a number.

3-TIER TAG SYSTEM:
- Tier 1 (pick one): Pie, Cake, Cookies, Bread, Pasta, Soup, Salad, Appetizer, Side, Main, Sauce, Drink, Breakfast, Snack, Dessert
- Tier 2 (pick one): Sweet, Savory
- Tier 3 (optional): Italian, French, American, Greek, Asian, Mexican, Spanish, Middle Eastern, Indian, Japanese, Chinese, Thai, Mediterranean, Holiday, Weekend, Quick, Comfort Food, Seasonal, Summer, Winter, Spring, Fall, German

DIETARY TAGS (include any that apply):
Vegan, Vegetarian, Gluten Free, Dairy Free, Keto, Paleo, Sugar Free, Nut Free, Low Carb, Whole30

Return ONLY valid JSON — no markdown fences, no explanation.`

export const PARSE_SCHEMA = `{
  "title": "Recipe name",
  "source": "Website or book name or null",
  "source_url": "URL or null",
  "source_type": "cookbook or website or other",
  "page_number": "p. 54 format or null",
  "description": "Intro/headnote text describing the recipe, its history, origin or significance. Never null if intro text exists.",
  "yield": "9-inch pie OR serves 4 OR null",
  "time_active": "45 min or null",
  "temperature": "350F or null",
  "before_you_begin": "Critical prep notes or null",
  "equipment": "comma-separated list or null",
  "ingredient_groups": [
    {
      "group_name": "GROUP NAME or null",
      "ingredients": [
        {
          "qty": "1",
          "name": "medium onion, sliced",
          "is_linked_recipe": false
        },
        {
          "qty": "as needed",
          "name": "confectioners sugar, for dusting",
          "is_linked_recipe": false
        },
        {
          "qty": "1 recipe",
          "name": "pie dough",
          "is_linked_recipe": true
        }
      ]
    }
  ],
  "step_groups": [
    {
      "group_name": "null or section name",
      "steps": [
        {
          "num": 1,
          "time": "5 min or null",
          "text": "EXACT original step text preserved word for word"
        }
      ]
    }
  ],
  "notes": ["note 1", "note 2"] or null,
  "storage": "Storage instructions or null",
  "image_url": "Direct image URL or null",
  "tags": ["Main", "Savory", "Italian"],
  "dietary_tags": ["Vegan"] or [],
  "variations": [
    {
      "name": "Orange Version",
      "description": "Brief description of what this variation produces",
      "ingredient_changes": "Free text — e.g. Add the zest of 2 medium oranges. Increase heavy cream to 267 g / 1 C plus 2 T.",
      "instruction_changes": "Free text — e.g. After straining the pastry cream, whisk in the orange zest before adding the butter."
    }
  ] or null,
  "sub_recipes": [
    {
      "title": "Chocolate Pastry Cream",
      "description": "null or brief description",
      "ingredient_groups": [
        {
          "group_name": null,
          "ingredients": [
            {"qty": "167 g", "name": "70% chocolate, coarsely chopped", "is_linked_recipe": false}
          ]
        }
      ],
      "step_groups": [
        {
          "group_name": null,
          "steps": [
            {"num": 1, "time": null, "text": "EXACT original step text"}
          ]
        }
      ]
    }
  ] or null
}`
