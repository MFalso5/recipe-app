import { neon } from '@neondatabase/serverless'
import { Recipe, Menu } from './types'

const sql = neon(process.env.DATABASE_URL!)

export async function initDb() {
  await sql`
    CREATE TABLE IF NOT EXISTS recipes (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS menus (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `
}

function migrateRecipe(data: unknown): Recipe {
  const r = data as Record<string, unknown>
  return {
    ...r,
    dietary_tags: (r.dietary_tags as string[]) || [],
    gallery_urls: (r.gallery_urls as string[]) || [],
    made_log: (r.made_log as unknown[]) || [],
    page_number: (r.page_number as string) || null,
    collections: (r.collections as string[]) || [],
    source_type: (r.source_type as string) || (r.page_number ? 'cookbook' : r.source_url ? 'website' : 'other'),
    share_token: (r.share_token as string) || null,
    cookbook_author: (r.cookbook_author as string) || null,
    cookbook_cover_url: (r.cookbook_cover_url as string) || null,
    tags: (r.tags as string[]) || [],
    ingredient_groups: ((r.ingredient_groups as unknown[]) || []).map((g: unknown) => {
      const group = g as Record<string, unknown>
      return {
        ...group,
        ingredients: ((group.ingredients as unknown[]) || []).map((i: unknown) => {
          const ing = i as Record<string, unknown>
          return {
            ...ing,
            note: ing.note || null,
            linked_recipe_id: ing.linked_recipe_id || null,
            linked_recipe_title: ing.linked_recipe_title || null
          }
        })
      }
    }),
    step_groups: ((r.step_groups as unknown[]) || []).map((g: unknown) => {
      const group = g as Record<string, unknown>
      return {
        ...group,
        steps: ((group.steps as unknown[]) || []).map((s: unknown) => {
          const step = s as Record<string, unknown>
          return {
            ...step,
            note: step.note || null,
            photo_url: step.photo_url || null
          }
        })
      }
    })
  } as Recipe
}

export async function dbGetRecipes(): Promise<Recipe[]> {
  await initDb()
  const rows = await sql`SELECT data FROM recipes ORDER BY created_at DESC`
  return rows.map((r: Record<string, unknown>) => migrateRecipe(r.data))
}

export async function dbGetRecipe(id: string): Promise<Recipe | null> {
  await initDb()
  const rows = await sql`SELECT data FROM recipes WHERE id = ${id}`
  if (!rows[0]?.data) return null
  return migrateRecipe(rows[0].data)
}

export async function dbSaveRecipe(recipe: Recipe): Promise<Recipe> {
  await initDb()
  await sql`
    INSERT INTO recipes (id, data, updated_at)
    VALUES (${recipe.id}, ${JSON.stringify(recipe)}, NOW())
    ON CONFLICT (id) DO UPDATE
    SET data = ${JSON.stringify(recipe)}, updated_at = NOW()
  `
  return recipe
}

export async function dbDeleteRecipe(id: string): Promise<void> {
  await initDb()
  await sql`DELETE FROM recipes WHERE id = ${id}`
}

export async function dbGetMenus(): Promise<Menu[]> {
  await initDb()
  const rows = await sql`SELECT data FROM menus ORDER BY created_at DESC`
  return rows.map((r: Record<string, unknown>) => r.data as Menu)
}

export async function dbGetMenu(id: string): Promise<Menu | null> {
  await initDb()
  const rows = await sql`SELECT data FROM menus WHERE id = ${id}`
  return (rows[0]?.data as Menu) || null
}

export async function dbSaveMenu(menu: Menu): Promise<Menu> {
  await initDb()
  await sql`
    INSERT INTO menus (id, data, updated_at)
    VALUES (${menu.id}, ${JSON.stringify(menu)}, NOW())
    ON CONFLICT (id) DO UPDATE
    SET data = ${JSON.stringify(menu)}, updated_at = NOW()
  `
  return menu
}

export async function dbDeleteMenu(id: string): Promise<void> {
  await initDb()
  await sql`DELETE FROM menus WHERE id = ${id}`
}

// ── MEAL PREP ──
export async function initMealPrepTable() {
  await sql`CREATE TABLE IF NOT EXISTS meal_preps (id TEXT PRIMARY KEY, data JSONB NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`
}

export async function dbGetMealPreps() {
  await initMealPrepTable()
  const rows = await sql`SELECT data FROM meal_preps ORDER BY created_at DESC`
  return rows.map((r: Record<string, unknown>) => r.data)
}

export async function dbGetMealPrep(id: string) {
  await initMealPrepTable()
  const rows = await sql`SELECT data FROM meal_preps WHERE id = ${id}`
  return rows[0]?.data || null
}

export async function dbSaveMealPrep(prep: unknown) {
  await initMealPrepTable()
  const p = prep as { id: string }
  await sql`INSERT INTO meal_preps (id, data, updated_at) VALUES (${p.id}, ${JSON.stringify(prep)}, NOW()) ON CONFLICT (id) DO UPDATE SET data = ${JSON.stringify(prep)}, updated_at = NOW()`
  return prep
}

export async function dbDeleteMealPrep(id: string) {
  await initMealPrepTable()
  await sql`DELETE FROM meal_preps WHERE id = ${id}`
}

// ── IDEAS ──
export async function initIdeasTable() {
  await sql`CREATE TABLE IF NOT EXISTS ideas (id TEXT PRIMARY KEY, data JSONB NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`
}

export async function dbGetIdeas() {
  await initIdeasTable()
  const rows = await sql`SELECT data FROM ideas ORDER BY updated_at DESC`
  return rows.map((r: Record<string, unknown>) => r.data)
}

export async function dbGetIdea(id: string) {
  await initIdeasTable()
  const rows = await sql`SELECT data FROM ideas WHERE id = ${id}`
  return rows[0]?.data || null
}

export async function dbSaveIdea(idea: unknown) {
  await initIdeasTable()
  const i = idea as { id: string }
  await sql`INSERT INTO ideas (id, data, updated_at) VALUES (${i.id}, ${JSON.stringify(idea)}, NOW()) ON CONFLICT (id) DO UPDATE SET data = ${JSON.stringify(idea)}, updated_at = NOW()`
  return idea
}

export async function dbDeleteIdea(id: string) {
  await initIdeasTable()
  await sql`DELETE FROM ideas WHERE id = ${id}`
}

// ── FOOD FOR THOUGHT ──
export async function initFoodForThoughtTable() {
  await sql`CREATE TABLE IF NOT EXISTS food_for_thought (id TEXT PRIMARY KEY, data JSONB NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`
}

export async function dbGetFoodForThought() {
  await initFoodForThoughtTable()
  const rows = await sql`SELECT data FROM food_for_thought ORDER BY created_at DESC`
  return rows.map((r: Record<string, unknown>) => r.data)
}

export async function dbSaveFoodForThought(entry: unknown) {
  await initFoodForThoughtTable()
  const e = entry as { id: string }
  await sql`INSERT INTO food_for_thought (id, data, updated_at) VALUES (${e.id}, ${JSON.stringify(entry)}, NOW()) ON CONFLICT (id) DO UPDATE SET data = ${JSON.stringify(entry)}, updated_at = NOW()`
  return entry
}

export async function dbDeleteFoodForThought(id: string) {
  await initFoodForThoughtTable()
  await sql`DELETE FROM food_for_thought WHERE id = ${id}`
}

// ── COOKBOOKS ──
export async function initCookbooksTable() {
  await sql`CREATE TABLE IF NOT EXISTS cookbooks (id TEXT PRIMARY KEY, data JSONB NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`
}

export async function dbGetCookbooks() {
  await initCookbooksTable()
  const rows = await sql`SELECT data FROM cookbooks`
  return rows.map((r: Record<string, unknown>) => r.data)
}

export async function dbSaveCookbook(cookbook: unknown) {
  await initCookbooksTable()
  const c = cookbook as { id: string }
  await sql`INSERT INTO cookbooks (id, data, updated_at) VALUES (${c.id}, ${JSON.stringify(cookbook)}, NOW()) ON CONFLICT (id) DO UPDATE SET data = ${JSON.stringify(cookbook)}, updated_at = NOW()`
  return cookbook
}
