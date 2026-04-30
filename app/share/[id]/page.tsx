import { dbGetRecipes } from '@/lib/db'
import { Recipe } from '@/lib/types'
import { notFound } from 'next/navigation'
import RecipeCard from '@/components/RecipeCard'

export const dynamic = 'force-dynamic'

export default async function SharePage({ params }: { params: { id: string } }) {
  // Look up by share token, not recipe ID
  const recipes = await dbGetRecipes() as Recipe[]
  const recipe = recipes.find(r => r.share_token === params.id)
  if (!recipe) notFound()

  // Strip personal data
  const cleanRecipe: Recipe = {
    ...recipe,
    made: false,
    made_log: [],
    ingredient_groups: recipe.ingredient_groups.map(g => ({
      ...g,
      ingredients: g.ingredients.map(ing => ({ ...ing, note: null }))
    })),
    step_groups: recipe.step_groups.map(g => ({
      ...g,
      steps: g.steps.map(s => ({ ...s, note: null, photo_url: null }))
    }))
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)' }}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px 80px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <p style={{ fontSize: 13, color: 'var(--muted)', fontStyle: 'italic' }}>Shared recipe</p>
          <button onClick={() => window.print()} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', color: 'var(--muted)' }}>🖨 Print</button>
        </div>
        <RecipeCard recipe={cleanRecipe} printMode={true} />
        <div style={{ marginTop: 32, textAlign: 'center', padding: '20px', borderTop: '1px solid var(--border)' }}>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>Shared from Recipe Collector</p>
        </div>
      </div>
    </div>
  )
}
