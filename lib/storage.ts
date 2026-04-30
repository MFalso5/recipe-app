import { Recipe } from './types'
import fs from 'fs'
import path from 'path'

const DATA_FILE = path.join(process.cwd(), 'data', 'recipes.json')

function ensureDataFile() {
  const dir = path.dirname(DATA_FILE)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '[]')
}

export function getRecipes(): Recipe[] {
  try {
    ensureDataFile()
    const raw = fs.readFileSync(DATA_FILE, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return []
  }
}

export function getRecipe(id: string): Recipe | null {
  const recipes = getRecipes()
  return recipes.find(r => r.id === id) || null
}

export function saveRecipe(recipe: Recipe): Recipe {
  const recipes = getRecipes()
  const idx = recipes.findIndex(r => r.id === recipe.id)
  if (idx >= 0) {
    recipes[idx] = { ...recipe, updated_at: new Date().toISOString() }
  } else {
    recipes.unshift({ ...recipe, created_at: new Date().toISOString(), updated_at: new Date().toISOString() })
  }
  ensureDataFile()
  fs.writeFileSync(DATA_FILE, JSON.stringify(recipes, null, 2))
  return recipe
}

export function deleteRecipe(id: string): void {
  const recipes = getRecipes().filter(r => r.id !== id)
  ensureDataFile()
  fs.writeFileSync(DATA_FILE, JSON.stringify(recipes, null, 2))
}

export function toggleMade(id: string): Recipe | null {
  const recipes = getRecipes()
  const idx = recipes.findIndex(r => r.id === id)
  if (idx < 0) return null
  recipes[idx].made = !recipes[idx].made
  recipes[idx].updated_at = new Date().toISOString()
  fs.writeFileSync(DATA_FILE, JSON.stringify(recipes, null, 2))
  return recipes[idx]
}
