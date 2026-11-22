"use client"

import { useEffect, useRef, useState } from 'react'

type Ingredient = { ingredient: string; amount: string; pack: string; prices: number[] }

const sampleRecipe: Ingredient[] = [
  { ingredient: 'Paneer', amount: '200 g', pack: 'Fresh paneer · 200 g', prices: [95, 99, 92] },
  { ingredient: 'Tomato', amount: '3 medium', pack: 'Tomatoes · 500 g', prices: [34, 29, 32] },
  { ingredient: 'Butter', amount: '2 tbsp', pack: 'Salted butter · 100 g', prices: [62, 65, 64] },
  { ingredient: 'Cream', amount: '¼ cup', pack: 'Fresh cream · 200 ml', prices: [75, 79, 72] },
  { ingredient: 'Garam masala', amount: '1 tsp', pack: 'Garam masala · 50 g', prices: [48, 44, 49] },
]

type Recognition = {
  lang: string
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start: () => void
  abort: () => void
}

const stores = ['Instamart', 'Blinkit', 'Zepto']
const tracking = ['Demo order confirmed', 'Groceries packed', 'Out for delivery', 'Delivered']

export default function DemoExperience() {
  const [query, setQuery] = useState('')
  const [recipe, setRecipe] = useState(sampleRecipe)
  const [title, setTitle] = useState('Paneer butter masala')
  const [onlineRecipe, setOnlineRecipe] = useState<{ id: string; video?: string; instructions?: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [listening, setListening] = useState(false)
  const [message, setMessage] = useState('')
  const recognition = useRef<Recognition | null>(null)
  useEffect(() => () => recognition.current?.abort(), [])

  function listen() {
    const browser = window as Window & {
      SpeechRecognition?: new () => Recognition
      webkitSpeechRecognition?: new () => Recognition
    }
    const SpeechRecognition = browser.SpeechRecognition ?? browser.webkitSpeechRecognition
    if (!SpeechRecognition) {
      setMessage('Speech input is unavailable in this browser. Type the dish name instead.')
      return
    }
    const speech = new SpeechRecognition()
    recognition.current = speech
    speech.lang = 'en-IN'
    speech.onresult = event => setQuery(event.results[0][0].transcript)
    speech.onerror = () => setMessage('Could not capture speech. Check microphone permissions or type the dish name.')
    speech.onend = () => { recognition.current = null; setListening(false) }
    setMessage('')
    try {
      speech.start()
      setListening(true)
    } catch {
      recognition.current = null
      setMessage('Could not start the microphone. You can type the dish name.')
    }
  }

  async function findRecipe(event: React.FormEvent) {
    event.preventDefault()
    const dish = query.trim().replace(/^(?:i(?:['’]m| am) (?:going to )?(?:cook(?:ing)?|mak(?:e|ing))|i want to (?:cook|make))\s+/i, '').replace(/[.!?]+$/, '')
    if (!dish || busy) return
    setMessage('')
    setBusy(true)
    try {
      if (/^(paneer butter masala|butter paneer)$/i.test(dish)) {
        setTitle('Paneer butter masala')
        setRecipe(sampleRecipe)
        setSelected(sampleRecipe.map(() => true))
        setOnlineRecipe(null)
        return
      }
      const response = await fetch('https://www.themealdb.com/api/json/v1/1/search.php?s=' + encodeURIComponent(dish))
      if (!response.ok) throw new Error('Recipe lookup failed')
      const data: { meals: Record<string, string | null>[] | null } = await response.json()
      const meal = data.meals?.[0]
      if (!meal?.idMeal || !meal.strMeal) {
        setMessage('No recipe found. Try a shorter dish name, like chicken curry.')
        return
      }
      const ingredients = Array.from({ length: 20 }, (_, index) => ({
        ingredient: meal['strIngredient' + (index + 1)]?.trim() || '',
        amount: meal['strMeasure' + (index + 1)]?.trim() || '',
        pack: '',
        prices: [],
      })).filter(item => item.ingredient)
      setTitle(meal.strMeal)
      setOnlineRecipe({ id: meal.idMeal, instructions: meal.strInstructions?.trim(), video: meal.strYoutube?.startsWith('https://www.youtube.com/') ? meal.strYoutube : undefined })
      setRecipe(ingredients)
      setSelected(ingredients.map(() => true))
    } catch {
      setMessage('Online lookup is unavailable right now. Try the bundled paneer butter masala demo.')
    } finally {
      setBusy(false)
    }
  }

  const [screen, setScreen] = useState<'recipe' | 'cart' | 'tracking'>('recipe')
  const [store, setStore] = useState(0)
  const [selected, setSelected] = useState(recipe.map(() => true))
  const [delivery, setDelivery] = useState(0)

  useEffect(() => {
    if (screen !== 'tracking' || delivery === tracking.length - 1) return
    const timer = window.setTimeout(() => setDelivery(delivery + 1), 2200)
    return () => window.clearTimeout(timer)
  }, [delivery, screen])

  const totals = stores.map((_, index) => recipe.reduce((sum, item, row) => sum + (selected[row] ? item.prices[index] ?? 0 : 0), 0))
  const total = totals[store]
  const lowestTotal = Math.min(...totals)
  const reset = () => {
    setScreen('recipe')
    setStore(0)
    setSelected(recipe.map(() => true))
    setDelivery(0)
  }

  return (
    <section className="mx-auto max-w-4xl space-y-6">
      <div>
        <p className="mb-2 text-sm font-semibold text-orange-800">Interactive demo · Sample products and prices</p>
        <h1 className="text-4xl font-black tracking-tight sm:text-5xl">{title}</h1>
        <p className="mt-2 text-stone-600">Watch the recipe, compare grocery baskets, and try a simulated order.</p>
      </div>

      {screen === 'recipe' && (
        <form onSubmit={findRecipe} className="card space-y-3 p-4">
          <label htmlFor="dish-name" className="block font-semibold">What are you cooking?</label>
          <div className="flex flex-wrap gap-2">
            <input id="dish-name" value={query} onChange={event => setQuery(event.target.value)}
              placeholder="Say or type a dish name" className="min-w-48 flex-1 rounded-xl border border-stone-300 px-4 py-2" />
            <button type="button" className="btn-ghost" disabled={listening || busy} onClick={listen}>{listening ? 'Listening…' : 'Use microphone'}</button>
            <button className="btn-primary" disabled={busy || listening || !query.trim()}>{busy ? 'Searching…' : 'Find recipe'}</button>
          </div>
          {message && <p role="status" className="text-sm text-stone-700">{message}</p>}
        </form>
      )}

      {screen === 'recipe' && (
        <div className="grid gap-4 md:grid-cols-2">
          {onlineRecipe ? (
            <div className="card space-y-3 p-6">
              <h2 className="text-xl font-bold">Recipe source</h2>
              <a className="block text-orange-800 underline" href={'https://www.themealdb.com/meal/' + encodeURIComponent(onlineRecipe.id)} target="_blank" rel="noreferrer">Read the full recipe on TheMealDB</a>
              {onlineRecipe.video && <a className="block text-orange-800 underline" href={onlineRecipe.video} target="_blank" rel="noreferrer">Watch the recipe video</a>}
              {onlineRecipe.instructions && <details><summary className="cursor-pointer font-semibold">Cooking instructions</summary><p className="mt-2 whitespace-pre-line text-sm text-stone-700">{onlineRecipe.instructions}</p></details>}
            </div>
          ) : <figure className="self-start overflow-hidden rounded-3xl bg-orange-950 text-orange-50">
            <video controls playsInline preload="metadata" className="aspect-video w-full" aria-label="Animated paneer butter masala recipe">
              <source src="/paneer-demo.webm" type="video/webm" />
            </video>
            <figcaption className="px-5 py-3 text-sm">12-second animated recipe · 3 steps</figcaption>
            <details className="px-5 pb-4 text-sm">
              <summary className="cursor-pointer">Read cooking steps</summary>
              <ol className="mt-2 list-decimal space-y-1 pl-5">
                <li>Simmer chopped tomatoes in butter until soft.</li>
                <li>Blend until smooth, then add garam masala and cream.</li>
                <li>Fold in paneer cubes and simmer for 3 minutes.</li>
              </ol>
            </details>
          </figure>}
          <div className="card p-6">
            <h2 className="text-xl font-bold">{onlineRecipe ? 'Recipe ingredients' : 'Ingredients for 2'}</h2>
            <ul className="my-4 divide-y divide-stone-100">
              {recipe.map(item => <li key={item.ingredient} className="flex justify-between gap-4 py-3"><span>{item.ingredient}</span><span className="text-stone-600">{item.amount}</span></li>)}
            </ul>
            <button type="button" className="btn-primary w-full" disabled={busy} onClick={() => setScreen('cart')}>{onlineRecipe ? 'Find ingredients in stores' : 'Compare grocery baskets'}</button>
          </div>
        </div>
      )}

      {screen === 'cart' && onlineRecipe && (
        <div className="card space-y-4 p-6">
          <h2 className="text-2xl font-bold">Find ingredients by store</h2>
          <p className="text-stone-600">Open a store search to check current prices and stock for your delivery address.</p>
          {recipe.map((item, index) => {
            const query = encodeURIComponent(item.ingredient)
            return <div key={item.ingredient + index} className="border-t border-stone-200 pt-3">
              <p className="font-semibold">{item.ingredient} · {item.amount}</p>
              <div className="mt-1 flex flex-wrap gap-4 text-sm text-orange-800">
                <a className="underline" target="_blank" rel="noreferrer" href={'https://www.swiggy.com/instamart/search?query=' + query}>Instamart</a>
                <a className="underline" target="_blank" rel="noreferrer" href={'https://blinkit.com/s/?q=' + query}>Blinkit</a>
                <a className="underline" target="_blank" rel="noreferrer" href={'https://www.zepto.com/search?query=' + query}>Zepto</a>
              </div>
            </div>
          })}
          <button className="btn-ghost" onClick={() => setScreen('recipe')}>Back to recipe</button>
        </div>
      )}

      {screen === 'cart' && !onlineRecipe && (
        <div className="card space-y-5 p-5 sm:p-7">
          <h2 className="text-2xl font-bold">Review your basket</h2>
          <div className="grid gap-2 sm:grid-cols-3" aria-label="Choose a demo store">
            {stores.map((name, index) => {
              const storeTotal = totals[index]
              return <button key={name} type="button" aria-pressed={store === index} onClick={() => setStore(index)}
                className={`rounded-xl border p-3 text-left ${store === index ? 'border-orange-600 bg-orange-50' : 'border-stone-200'}`}><span className="block font-semibold">{name}</span>₹{storeTotal}{storeTotal > 0 && storeTotal === lowestTotal && <span className="ml-2 text-xs font-semibold text-green-800">Cheapest basket</span>}</button>
            })}
          </div>
          <ul className="divide-y divide-stone-100">
            {recipe.map((item, index) => (
              <li key={item.ingredient}>
                <label className="flex cursor-pointer items-center gap-3 py-3">
                  <input type="checkbox" checked={selected[index]} onChange={event => {
                    const checked = event.target.checked
                    setSelected(items => items.map((include, itemIndex) => itemIndex === index ? checked : include))
                  }} />
                  <span className="flex-1">{item.pack}<span className="block text-xs text-stone-600">Lowest sample price ₹{Math.min(...item.prices)} at {stores.filter((_, storeIndex) => item.prices[storeIndex] === Math.min(...item.prices)).join(', ')}</span></span>
                  <span className="font-semibold">₹{item.prices[store]}</span>
                </label>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button type="button" className="btn-ghost" onClick={() => setScreen('recipe')}>Back to recipe</button>
            <button type="button" className="btn-primary" disabled={total === 0} onClick={() => setScreen('tracking')}>Place demo order · ₹{total}</button>
          </div>
        </div>
      )}

      {screen === 'tracking' && (
        <div className="card space-y-5 p-6">
          <h2 className="text-2xl font-bold">Demo order tracking</h2>
          <p className="text-stone-600">{stores[store]} · ₹{total} simulated total. No payment collected.</p>
          <ol className="space-y-3" aria-label="Delivery progress">
            {tracking.map((status, index) => <li key={status} aria-current={index === delivery ? 'step' : undefined}
              className={`rounded-xl p-3 ${index <= delivery ? 'bg-green-50 text-green-900' : 'bg-stone-100 text-stone-600'}`}>{index + 1}. {status}</li>)}
          </ol>
          <p className="sr-only" role="status">{tracking[delivery]}</p>
          <button type="button" className="btn-ghost" onClick={reset}>Restart demo</button>
        </div>
      )}
    </section>
  )
}
