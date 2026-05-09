export interface Variation {
  name: string
  description: string | null
  ingredient_changes: string | null
  instruction_changes: string | null
}

export interface Ingredient {
  qty: string
  name: string
  note: string | null
  is_linked_recipe: boolean
  linked_recipe_id?: string | null
  needs_review?: boolean
}

export interface Step {
  text: string
  time: string | null
  note: string | null
  photo_url: string | null
}

export interface IngredientGroup {
  name: string | null
  ingredients: Ingredient[]
}

export interface StepGroup {
  name: string | null
  steps: Step[]
}

export interface SubRecipe {
  name: string
  ingredient_groups: IngredientGroup[]
  step_groups: StepGroup[]
  source?: string | null
  source_url?: string | null
  source_type?: 'website' | 'cookbook' | 'image' | 'manual'
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
  source: string | null
  source_url: string | null
  source_type: 'website' | 'cookbook' | 'image' | 'manual'
  data_source?: 'jsonld' | 'claude'
  description: string | null
  yield: string | null
  time_active: string | null
  temperature: string | null
  before_you_begin: string | null
  equipment: string[] | null
  image_url: string | null
  ingredient_groups: IngredientGroup[]
  step_groups: StepGroup[]
  notes: string[] | null
  tips: string[] | null
  storage: string | null
  variations: Variation[] | null
  sub_recipes: SubRecipe[] | null
  made: boolean
  favorited: boolean
  made_log: MadeItEntry[] | null
  gallery_urls: string[] | null
  page_number: string | null
  share_token: string | null
  tags: string[]
  dietary_tags: string[]
  created_at: string
  updated_at: string
}

export interface Collection {
  name: string | null
  recipes: Recipe[]
  source_type: 'website' | 'cookbook' | 'other'
  author?: string | null
  cover_url?: string | null
  pub_year?: string | null
  recipe_count?: number
  made_count?: number
}

export interface Cookbook {
  id: string
  name: string
  author: string | null
  pub_year: string | null
  cover_url: string | null
  recipe_count?: number
  made_count?: number
  created_at: string
  updated_at: string
}

export interface FoodForThoughtEntry {
  id: string
  title: string
  url: string | null
  description: string | null
  notes: string | null
  tags: string[]
  created_at: string
  updated_at: string
}

export interface IdeaNote {
  id: string
  title: string
  content: string | null
  is_scratchpad?: boolean
  tags?: string[]
  created_at: string
  updated_at: string
}

export interface MakeAheadEntry {
  id: string
  task: string
  timeframe: string | null
  recipe_id: string | null
  recipe_title: string | null
  confirmed: boolean
}

export interface MenuRecipeEntry {
  id: string
  recipe_id: string | null
  recipe_title: string
  note: string | null
  is_free_text: boolean
}

export interface MenuCourse {
  id: string
  name: string
  recipes: MenuRecipeEntry[]
}

export interface Menu {
  id: string
  name: string
  date: string | null
  notes: string | null
  overview: string | null
  courses: MenuCourse[]
  make_ahead: MakeAheadEntry[]
  created_at: string
  updated_at: string
}

export interface PrepSession {
  id: string
  name: string
  recipes: MenuRecipeEntry[]
  notes: string | null
}

export interface MealPrep {
  id: string
  name: string
  week_start: string | null
  date: string | null
  sessions: PrepSession[]
  notes: string | null
  created_at: string
  updated_at: string
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
  'Alcoholic Beverages',
] as const

export const MAKE_AHEAD_TIMEFRAMES = [
  'Day of',
  'Day before',
  '2 days before',
  '3 days before',
  'Week before',
] as const

export const DIETARY_TAGS = [
  'Vegan',
  'Vegetarian',
  'Gluten Free',
  'Dairy Free',
  'Keto',
  'Paleo',
  'Sugar Free',
  'Nut Free',
  'Low Carb',
  'Whole30',
] as const
