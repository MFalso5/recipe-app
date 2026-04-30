# Recipe Collector

A personal recipe library app. Import recipes from URLs, photos, or pasted text. Review, edit, and save to your collection. Print or export as PDF, text, or JSON.

## Setup

### 1. Add your Anthropic API key
In Vercel, go to your project → Settings → Environment Variables and add:
```
ANTHROPIC_API_KEY = your_key_here
```

### 2. That's it
Vercel handles everything else automatically on every deploy.

## Features
- Import from URL, photo (including multi-page cookbook photos), or pasted text
- AI parses recipe into structured format with your abbreviation system
- Review and edit all fields before saving
- Full recipe card with ingredients left, steps right
- Made it checkbox
- Edit recipes after saving (always saves as final version, no changelog)
- Print / PDF export
- Plain text export
- JSON backup export
- Search, filter by tag, sort library

## Abbreviation system
- cup → C
- tablespoon → T
- teaspoon → t
- ounce → oz
- pound → #
- gram → g
- quart → qt
- pint → pt
- gallon → gallon(s)
