export interface Variation {
  name: string
  description: string | null
  ingredient_changes: string | null  // free-text: additions, substitutions, omissions
  instruction_changes: string | null // free-text: method differences
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
  storage: string | null
  variations: Variation[] | null
  sub_recipes: SubRecipe[] | null
  tags: string[]
  dietary_tags: string[]
}
