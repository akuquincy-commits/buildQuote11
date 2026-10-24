import 'dotenv/config'
import express from 'express'
import cors from 'cors'

const app = express()
app.use(cors())
app.use(express.json())

const PORT = Number(process.env.PORT || 3001)
const SERPAPI_API_KEY = process.env.SERPAPI_API_KEY || ''

const developmentFixtures = [
  {
    id: 1,
    product: 'Dulux WeatherShield Exterior Emulsion',
    brand: 'Dulux',
    category: 'Paint',
    listedPrice: { amount: 420, currency: 'GHS', packageQuantity: 5, packageUnit: 'L' },
    supplier: 'B&Q Ghana',
    image: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=900&q=80',
    specs: ['Water-based', 'Washable finish', 'Low VOC'],
    link: 'https://www.dulux.com.gh',
    retrievedAt: '2026-10-12T09:15:00.000Z',
    evidenceType: 'sourced-listing',
    priceStatus: 'unverified',
    priceBasis: 'sourced-listing',
    availability: 'Stock status not verified; check supplier before purchase.',
    limitations: ['Development sample only; this is not a live supplier listing.', 'Package price shown without confirmed coverage or quantity allowance.'],
  },
  {
    id: 2,
    product: 'Midas Premium Interior Emulsion',
    brand: 'Midas',
    category: 'Paint',
    listedPrice: { amount: 390, currency: 'GHS', packageQuantity: 5, packageUnit: 'L' },
    supplier: 'Midas Paints',
    image: 'https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=900&q=80',
    specs: ['Smooth finish', 'Economy range', 'Interior use'],
    link: 'https://www.midaspaint.com',
    retrievedAt: '2026-10-12T08:40:00.000Z',
    evidenceType: 'sourced-listing',
    priceStatus: 'unverified',
    priceBasis: 'sourced-listing',
    availability: 'Availability not verified from the source result.',
    limitations: ['Development sample only; no live supplier listing was retrieved.', 'Price shown is a package retail price and not a confirmed trade quote.'],
  },
  {
    id: 3,
    product: 'MasterMix Roof Coating',
    brand: 'MasterMix',
    category: 'Roofing',
    listedPrice: { amount: 1250, currency: 'GHS', packageQuantity: 20, packageUnit: 'L' },
    supplier: 'MasterMix Ltd.',
    image: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=900&q=80',
    specs: ['Weatherproof', 'UV resistant', 'Sealer coat'],
    link: 'https://www.mastermix.com.gh',
    retrievedAt: '2026-10-11T17:25:00.000Z',
    evidenceType: 'sourced-listing',
    priceStatus: 'unverified',
    priceBasis: 'sourced-listing',
    availability: 'Stock and coating coverage require confirmation.',
    limitations: ['Development sample only; the listing could not be verified as current stock.', 'Coverage assumptions must be checked before use in a quotation.'],
  },
]

const isDevelopment = process.env.NODE_ENV !== 'production'

const normalizeSerpApiResult = (result, index, category) => {
  const extractedPrice = Number(result.extracted_price ?? String(result.price || '').replace(/[^0-9.]/g, ''))
  const hasPrice = Number.isFinite(extractedPrice) && extractedPrice > 0
  const currency = result.currency || 'USD'

  return {
    id: result.product_id || result.position || index + 1,
    product: result.title || result.product || 'Unnamed product',
    brand: result.brand || result.source || '',
    category: category && category !== 'All' ? category : 'Materials',
    listedPrice: hasPrice
      ? { amount: extractedPrice, currency, packageQuantity: 1, packageUnit: 'item' }
      : null,
    supplier: result.source || result.seller || 'Source unavailable',
    image: result.thumbnail || result.image || '',
    specs: Array.isArray(result.extensions)
      ? result.extensions
      : result.snippet
        ? [result.snippet]
        : [],
    link: result.link || result.product_link || '#',
    retrievedAt: new Date().toISOString(),
    evidenceType: 'sourced-listing',
    priceStatus: 'unverified',
    priceBasis: 'sourced-listing',
    availability: 'Availability not verified; confirm with supplier before purchase.',
    limitations: [
      'Live SerpApi shopping result; price, availability, coverage, and suitability must be confirmed before use in a quotation.',
      'Package size and unit normalization are inferred from the listing and may require adjustment.',
    ],
  }
}

app.get('/api/health', (_request, response) => {
  response.json({ ok: true, serpApiConfigured: Boolean(SERPAPI_API_KEY) })
})

app.get('/api/materials/search', async (request, response) => {
  const query = String(request.query.q || request.query.query || '').trim()
  const category = String(request.query.category || 'All').trim()

  const filteredFixtures = developmentFixtures.filter((product) => {
    const matchesCategory = category === 'All' || product.category === category
    const haystack = `${product.product} ${product.brand} ${product.specs.join(' ')}`.toLowerCase()
    return matchesCategory && (!query || haystack.includes(query.toLowerCase()))
  })

  if (!SERPAPI_API_KEY) {
    if (isDevelopment) {
      return response.json({
        results: filteredFixtures,
        source: 'development-fixtures',
        live: false,
        message: 'SerpApi is not configured. Showing clearly labelled development fixtures only.',
      })
    }

    return response.status(503).json({
      results: [],
      source: 'unavailable',
      live: false,
      message: 'SerpApi is not configured on the server.',
    })
  }

  try {
    const params = new URLSearchParams({
      engine: 'google_shopping',
      q: query || 'construction materials',
      api_key: SERPAPI_API_KEY,
    })

    const serpResponse = await fetch(`https://serpapi.com/search.json?${params.toString()}`)
    if (!serpResponse.ok) {
      throw new Error(`SerpApi request failed with status ${serpResponse.status}.`)
    }

    const data = await serpResponse.json()
    const rawResults = Array.isArray(data.shopping_results) ? data.shopping_results : []
    const results = rawResults
      .slice(0, 24)
      .map((result, index) => normalizeSerpApiResult(result, index, category))
      .filter((product) => category === 'All' || product.category === category)

    return response.json({
      results,
      source: 'serpapi',
      live: true,
      message: results.length
        ? 'Live SerpApi shopping results. Verify every price before use.'
        : 'No SerpApi results matched this search.',
    })
  } catch (error) {
    if (isDevelopment) {
      return response.json({
        results: filteredFixtures,
        source: 'development-fixtures',
        live: false,
        message: `Live SerpApi search failed (${error.message}). Showing clearly labelled development fixtures only.`,
      })
    }

    return response.status(502).json({
      results: [],
      source: 'unavailable',
      live: false,
      message: `Live SerpApi search failed: ${error.message}`,
    })
  }
})

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`BuildQuote API listening on http://localhost:${PORT}`)
  })
}

export default app
export { developmentFixtures, normalizeSerpApiResult }
