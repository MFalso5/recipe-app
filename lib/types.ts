export interface Ingredient {
  qty: string
  name: string
  note?: string | null
  linked_recipe_id?: string | null
  linked_recipe_title?: string | null
}

export interface IngredientGroup {
  group_name: string | null
  ingredients: Ingredient[]
}

export interface Step {
  num: number
  time: string | null
  text: string
  note?: string | null
  photo_url?: string | null
}

export interface StepGroup {
  group_name: string | null
  steps: Step[]
}

export interface MadeItEntry {
  id: string
  date: string
  note: string | null
  rating: 'would-make-again' | 'make-with-changes' | 'wouldnt-make-again' | null
}

export interface Recipe {
  id: string
  title: string
  source: string
  source_url: string | null
  page_number: string | null
  description: string
  yield: string
  time_active: string | null
  temperature: string | null
  before_you_begin: string | null
  equipment: string | null
  ingredient_groups: IngredientGroup[]
  step_groups: StepGroup[]
  notes: string[] | null
  tips: string[] | null
  storage: string | null
  image_url: string | null
  gallery_urls: string[]
  made: boolean
  made_log: MadeItEntry[]
  tags: string[]
  dietary_tags: string[]
  collections: string[]
  source_type: 'cookbook' | 'website' | 'other'
  cookbook_author: string | null
  cookbook_cover_url: string | null
  share_token: string | null
  created_at: string
  updated_at: string
}

export interface MenuCourse {
  id: string
  name: string
  recipes: MenuRecipeEntry[]
}

export interface MenuRecipeEntry {
  id: string
  recipe_id: string | null
  recipe_title: string
  note: string | null
  is_free_text: boolean
}

export interface MakeAheadEntry {
  id: string
  task: string
  timeframe: string
  recipe_id: string | null
  recipe_title: string | null
  confirmed: boolean
}

export interface Menu {
  id: string
  name: string
  occasion: string | null
  date: string | null
  notes: string | null
  courses: MenuCourse[]
  make_ahead: MakeAheadEntry[]
  source_type: 'cookbook' | 'website' | 'other'
  cookbook_author: string | null
  cookbook_cover_url: string | null
  share_token: string | null
  created_at: string
  updated_at: string
}

export interface ShoppingListItem {
  id: string
  ingredient: string
  total_qty: string
  unit: string
  category: string
  checked: boolean
  breakdown: { recipe_title: string; qty: string }[]
  include_linked: boolean
}

export const DEFAULT_COURSES = [
  'Cold Bread',
  'Appetizer',
  'Hot Appetizer',
  'Soup',
  'Salad',
  'Main',
  'Side',
  'Dessert (Cookies)',
  'Dessert (Pie)',
  'Dessert (Cake)',
  'Drinks',
  'Alcoholic Beverages'
]

export const DIETARY_TAGS = [
  'Vegan', 'Vegetarian', 'Gluten Free', 'Dairy Free',
  'Keto', 'Paleo', 'Sugar Free', 'Nut Free', 'Low Carb', 'Whole30'
]

export const SHOPPING_CATEGORIES = [
  'Produce', 'Dairy & Eggs', 'Meat & Fish', 'Pantry',
  'Bakery', 'Spices & Herbs', 'Drinks', 'Frozen', 'Other'
]

export const MAKE_AHEAD_TIMEFRAMES = [
  '3 days before',
  '2 days before',
  '1 day before',
  'Morning of',
  '1 hour before',
  'Custom'
]

export interface PrepSession {
  id: string
  name: string
  recipes: MenuRecipeEntry[]
  notes: string | null
}

export interface MealPrep {
  id: string
  name: string
  date: string | null
  notes: string | null
  sessions: PrepSession[]
  created_at: string
  updated_at: string
}

export interface IdeaNote {
  id: string
  title: string
  content: string
  is_scratchpad: boolean
  created_at: string
  updated_at: string
}

export interface FoodForThoughtEntry {
  id: string
  url: string
  title: string
  description: string | null
  notes: string | null
  tags: string[]
  created_at: string
  updated_at: string
}

export interface Cookbook {
  id: string
  name: string
  author: string | null
  pub_year: string | null
  cover_url: string | null
  created_at: string
  updated_at: string
}
