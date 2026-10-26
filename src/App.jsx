import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  buildProductEvidenceSnapshot,
  calculateLineTotal,
  calculateQuoteTotals,
  calculateSectionTotal,
  getEvidenceStatusLabel,
  getUnitPriceFromListing,
  validateProposedChange,
  validateQuotation,
} from './quoteCalculations.js'
import {
  createQuotationPdf,
  getQuotationPdfFilename,
} from './quotationPdf.js'
import './App.css'

const navigation = [
  { label: 'Home', href: '#home' },
  { label: 'Features', href: '#features' },
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'Login', href: '#login' },
  { label: 'Get Started', href: '#start' },
]

const featureCards = [
  {
    title: 'AI Quotation Drafting',
    text: 'Turn project notes into structured quotation sections with price-aware, reviewable drafts.',
  },
  {
    title: 'Material Research',
    text: 'Search trusted construction materials and compare suppliers, specs and pricing from SerpApi results.',
  },
  {
    title: 'Professional PDF Output',
    text: 'Export client-ready quotations complete with terms, notes, totals and acceptance fields.',
  },
]

const workflowSteps = [
  'Describe your scope and project details',
  'Review sections, line items and assumptions',
  'Refine with AI after proposal creation',
  'Export or send a polished PDF',
]

const createQuoteId = () =>
  globalThis.crypto?.randomUUID?.() || `BQ-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

const createEmptyQuote = () => ({
  id: createQuoteId(),
  client: '',
  contact: '',
  projectTitle: '',
  location: '',
  description: '',
  contractor: '',
  currency: 'GHS',
  taxRate: 0,
  paymentTerms: '',
  validity: '30 days',
  notes: '',
  status: 'Draft',
  sections: [],
})

const chatSeed = []

const mockResearchResults = [
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


const sidebarItems = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'new-quotation', label: 'New Quotation' },
  { id: 'quotations', label: 'My Quotations' },
  { id: 'research', label: 'Material Research' },
  { id: 'assistant', label: 'AI Assistant' },
  { id: 'settings', label: 'Business Settings' },
  { id: 'help', label: 'Help' },
]

const toCurrency = (value, currency) => {
  const safeValue = Number(value) || 0
  const normalizedCurrency = currency || 'GHS'

  if (normalizedCurrency === 'USD') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(safeValue)
  }

  return new Intl.NumberFormat('en-GH', {
    style: 'currency',
    currency: 'GHS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safeValue)
}

const readLocalState = (key, fallback) => {
  try {
    const storedValue = window.localStorage.getItem(key)
    return storedValue ? JSON.parse(storedValue) : fallback
  } catch (error) {
    console.error(`Could not read local BuildQuote data for "${key}".`, error)
    return fallback
  }
}

const saveLocalState = (key, value) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch (error) {
    console.error(`Could not save local BuildQuote data for "${key}".`, error)
    return false
  }
}

const cloneQuote = (value) => JSON.parse(JSON.stringify(value))

const loadQuoteDraft = () => {
  const draft = readLocalState('buildquote.quote', null)
  if (draft && typeof draft === 'object' && typeof draft.id === 'string' && Array.isArray(draft.sections)) return draft
  return createEmptyQuote()
}

const formatRevisionValue = (value) => {
  if (value === undefined) return 'Not set'
  if (value && typeof value === 'object') {
    return value.productName || JSON.stringify(value)
  }
  return String(value)
}

function App() {
  const [view, setView] = useState('landing')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const sidebarRef = useRef(null)
  const sidebarToggleRef = useRef(null)

  useEffect(() => {
    if (!sidebarOpen) return
    const toggleButton = sidebarToggleRef.current
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    sidebarRef.current?.querySelector('button')?.focus()
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setSidebarOpen(false)
      if (event.key !== 'Tab') return
      const buttons = sidebarRef.current?.querySelectorAll('button')
      if (!buttons?.length) return
      const first = buttons[0]
      const last = buttons[buttons.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
      toggleButton?.focus()
    }
  }, [sidebarOpen])
  const [activeSidebar, setActiveSidebar] = useState('dashboard')
  const [quoteTab, setQuoteTab] = useState('details')
  const [quote, setQuote] = useState(loadQuoteDraft)
  const [savedQuotes, setSavedQuotes] = useState(() => {
    const storedQuotes = readLocalState('buildquote.savedQuotes', [])
    return Array.isArray(storedQuotes) ? storedQuotes : []
  })
  const [chatMessages, setChatMessages] = useState(() => readLocalState('buildquote.chat', chatSeed))
  const [pendingChange, setPendingChange] = useState(null)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [researchResults, setResearchResults] = useState([])
  const [researchLoading, setResearchLoading] = useState(false)
  const [researchError, setResearchError] = useState('')
  const [researchSource, setResearchSource] = useState('')
  const [revisionHistory, setRevisionHistory] = useState(() => readLocalState('buildquote.revisions', []))
  const [quoteOptions, setQuoteOptions] = useState(() => readLocalState('buildquote.options', []))
  const [selectedOptionId, setSelectedOptionId] = useState(null)
  const [selectedProductIds, setSelectedProductIds] = useState([])
  const [chatInput, setChatInput] = useState('')
const [aiPrompt, setAiPrompt] = useState('')
const [aiFeedback, setAiFeedback] = useState('')
  const [proposalError, setProposalError] = useState('')
  const [quoteErrors, setQuoteErrors] = useState([])
  const [saveFeedback, setSaveFeedback] = useState('')

  useEffect(() => {
    saveLocalState('buildquote.quote', quote)
    saveLocalState('buildquote.chat', chatMessages)
    saveLocalState('buildquote.revisions', revisionHistory)
    saveLocalState('buildquote.options', quoteOptions)
  }, [quote, chatMessages, revisionHistory, quoteOptions])

  const commitQuote = (nextQuote) => {
    setQuote(nextQuote)
    setQuoteErrors([])
    setSaveFeedback('')
    if (selectedOptionId) {
      const paintItem = nextQuote.sections
        .find((section) => section.name.toLowerCase().includes('paint'))
        ?.items[0]
      setQuoteOptions((current) =>
        current.map((option) =>
          option.id === selectedOptionId
            ? {
                ...option,
                quote: cloneQuote(nextQuote),
                materialChoice: paintItem?.materialEvidence?.productName || paintItem?.description || 'No material selected',
                sourceUrl: paintItem?.materialEvidence?.sourceUrl || null,
                confirmationNeeded: paintItem?.materialEvidence
                  ? 'Confirm suitability, coverage, availability, and total quantity with the supplier.'
                  : 'Confirm the contractor-entered material rate and selection.',
              }
            : option,
        ),
      )
    }
  }

  const totals = useMemo(() => calculateQuoteTotals(quote), [quote])

  const openApp = (sidebar = 'dashboard') => {
    setView('app')
    setActiveSidebar(sidebar)
  }

  const startNewQuote = () => {
    if (hasUnsavedQuoteChanges() && !window.confirm('Discard the unsaved changes in this quotation and start a new one?')) {
      return
    }
    const nextQuote = createEmptyQuote()
    setSelectedOptionId(null)
    setQuoteErrors([])
    setSaveFeedback('')
    setQuote(nextQuote)
    setQuoteTab('details')
    setActiveSidebar('new-quotation')
  }

const generateQuoteFromPrompt = () => {
    const prompt = aiPrompt.trim()
    if (!prompt) {
      setAiFeedback('Enter a project description before generating a quotation.')
      return
    }

    const normalized = prompt.toLowerCase()
    const sectionTemplates = []

    const addTemplate = (name, items) => {
      sectionTemplates.push({
        id: `section-${createQuoteId()}`,
        name,
        items: items.map((item) => ({
          id: `item-${createQuoteId()}`,
          notes: 'AI-generated draft. Confirm quantities, rates and suitability before sending.',
          ...item,
        })),
      })
    }

    if (normalized.includes('paint')) {
      addTemplate('Painting', [
        { description: 'Surface preparation and priming', quantity: 1, unit: 'm²', unitPrice: 12, labourCost: 0, materialCost: 0 },
        { description: 'Emulsion paint application', quantity: 1, unit: 'm²', unitPrice: 18, labourCost: 0, materialCost: 0 },
      ])
    }
    if (normalized.includes('tile') || normalized.includes('tiling')) {
      addTemplate('Tiling', [
        { description: 'Tile supply and installation', quantity: 1, unit: 'm²', unitPrice: 85, labourCost: 0, materialCost: 0 },
      ])
    }
    if (normalized.includes('roof')) {
      addTemplate('Roofing', [
        { description: 'Roof sheeting and waterproofing', quantity: 1, unit: 'm²', unitPrice: 120, labourCost: 0, materialCost: 0 },
      ])
    }
    if (normalized.includes('electrical') || normalized.includes('wiring')) {
      addTemplate('Electrical', [
        { description: 'Wiring, sockets and switches', quantity: 1, unit: 'point', unitPrice: 45, labourCost: 0, materialCost: 0 },
      ])
    }
    if (normalized.includes('plumb')) {
      addTemplate('Plumbing', [
        { description: 'Pipe installation and fittings', quantity: 1, unit: 'point', unitPrice: 60, labourCost: 0, materialCost: 0 },
      ])
    }
    if (normalized.includes('door') || normalized.includes('fitting')) {
      addTemplate('Doors and Fittings', [
        { description: 'Door supply and installation', quantity: 1, unit: 'item', unitPrice: 450, labourCost: 0, materialCost: 0 },
      ])
    }
    if (normalized.includes('kitchen')) {
      addTemplate('Kitchen', [
        { description: 'Kitchen cabinet and countertop work', quantity: 1, unit: 'item', unitPrice: 1500, labourCost: 0, materialCost: 0 },
      ])
    }
    if (!sectionTemplates.length) {
      addTemplate('General Works', [
        { description: prompt.slice(0, 120), quantity: 1, unit: 'item', unitPrice: 0, labourCost: 0, materialCost: 0 },
      ])
    }

    const nextQuote = createEmptyQuote()
    nextQuote.projectTitle = prompt.slice(0, 80)
    nextQuote.description = prompt
    nextQuote.sections = sectionTemplates
    nextQuote.notes = 'AI-generated draft. Review all quantities, prices, tax and terms before sharing with the client.'

    setSelectedOptionId(null)
    setQuoteErrors([])
    setSaveFeedback('')
    setQuote(nextQuote)
    setAiFeedback('Quotation generated from the prompt. Review and edit it in the quotation editor.')
  }

  const saveDraft = () => {
    const errors = validateQuotation(quote)
    const savedAt = new Date().toISOString()
    const draft = { ...quote, status: 'Draft', updatedAt: savedAt }
    const nextSavedQuotes = [
      draft,
      ...savedQuotes.filter((savedQuote) => savedQuote.id !== quote.id),
    ]
    if (!saveLocalState('buildquote.savedQuotes', nextSavedQuotes)) {
      setSaveFeedback('Could not save this draft in this browser. Check browser storage availability and try again.')
      return
    }

    setSavedQuotes(nextSavedQuotes)
    setQuote(draft)
    setQuoteErrors(errors)
    setSaveFeedback(
      errors.length
        ? `Draft saved locally with ${errors.length} item(s) to review. Complete these before treating it as ready.`
        : 'Draft saved locally. This browser-only draft is not synced to an account.',
    )
  }

  const exportQuotationPdf = () => {
    const errors = validateQuotation(quote)
    setQuoteErrors(errors)
    if (errors.length) {
      setSaveFeedback('Could not generate the PDF. Complete the required quotation details and line items first.')
      return
    }

    const generatedAt = new Date().toISOString()
    const savedQuote = { ...quote, status: quote.status || 'Draft', updatedAt: generatedAt }
    const nextSavedQuotes = [
      savedQuote,
      ...savedQuotes.filter((entry) => entry.id !== savedQuote.id),
    ]
    if (!saveLocalState('buildquote.savedQuotes', nextSavedQuotes)) {
      setSaveFeedback('Could not generate the PDF because this quotation could not be saved in browser storage.')
      return
    }

    setSavedQuotes(nextSavedQuotes)
    setQuote(savedQuote)
    setQuoteErrors([])
    try {
      createQuotationPdf(savedQuote, generatedAt).save(getQuotationPdfFilename(savedQuote))
      setSaveFeedback('Quotation saved locally and PDF download started.')
    } catch (error) {
      console.error('Could not generate the BuildQuote quotation PDF.', error)
      setSaveFeedback('The quotation was saved, but PDF generation failed. Try again or contact support if the issue continues.')
    }
  }

  const openSavedQuote = (savedQuote) => {
    if (hasUnsavedQuoteChanges() && !window.confirm('Discard the unsaved changes in the current quotation and open this saved draft?')) {
      return
    }
    setSelectedOptionId(null)
    setQuote(cloneQuote(savedQuote))
    setQuoteErrors([])
    setSaveFeedback('')
    setQuoteTab('details')
    setActiveSidebar('new-quotation')
  }

  const hasUnsavedQuoteChanges = () => {
    const savedQuote = savedQuotes.find((saved) => saved.id === quote.id)
    if (savedQuote) return JSON.stringify(savedQuote) !== JSON.stringify(quote)
    return Boolean(
      quote.client ||
      quote.contact ||
      quote.projectTitle ||
      quote.location ||
      quote.description ||
      quote.contractor ||
      quote.paymentTerms ||
      quote.notes ||
      quote.sections.length,
    )
  }

  const duplicateSavedQuote = (savedQuote) => {
    const duplicate = cloneQuote(savedQuote)
    duplicate.id = createQuoteId()
    duplicate.projectTitle = `${savedQuote.projectTitle || 'Untitled project'} (copy)`
    duplicate.status = 'Draft'
    duplicate.createdAt = new Date().toISOString()
    duplicate.updatedAt = new Date().toISOString()
    const nextSavedQuotes = [duplicate, ...savedQuotes]
    if (!saveLocalState('buildquote.savedQuotes', nextSavedQuotes)) {
      setSaveFeedback('Could not duplicate this quotation in local browser storage.')
      return
    }
    setSavedQuotes(nextSavedQuotes)
    setSaveFeedback('Quotation duplicated as a new local draft.')
  }

  const deleteSavedQuote = (quoteId) => {
    const nextSavedQuotes = savedQuotes.filter((savedQuote) => savedQuote.id !== quoteId)
    if (!saveLocalState('buildquote.savedQuotes', nextSavedQuotes)) {
      setSaveFeedback('Could not delete this quotation from local browser storage.')
      return
    }
    setSavedQuotes(nextSavedQuotes)
    if (quote.id === quoteId) {
      const emptyQuote = createEmptyQuote()
      const activeDraftCleared = saveLocalState('buildquote.quote', emptyQuote)
      setQuote(emptyQuote)
      setQuoteErrors([])
      setSelectedOptionId(null)
      setQuoteTab('details')
      setSaveFeedback(
        activeDraftCleared
          ? 'Local draft deleted.'
          : 'Could not clear the active local draft after deleting the saved quotation.',
      )
      return
    }
    setSaveFeedback('Local draft deleted.')
  }

  const updateQuoteField = (field, value) => {
    setSaveFeedback('')
    commitQuote({ ...quote, [field]: value })
  }

  const updateSection = (sectionId, updates) => {
    commitQuote({
      ...quote,
      sections: quote.sections.map((section) =>
        section.id === sectionId ? { ...section, ...updates } : section,
      ),
    })
  }

  const updateLineItem = (sectionId, itemId, field, value) => {
    commitQuote({
      ...quote,
      sections: quote.sections.map((section) =>
        section.id !== sectionId
          ? section
          : {
              ...section,
              items: section.items.map((item) =>
                item.id === itemId
                  ? {
                      ...item,
                      [field]: value,
                      ...(['unitPrice', 'materialCost', 'unit'].includes(field)
                        ? { priceBasis: 'contractor-entered', priceConfirmation: null }
                        : {}),
                    }
                  : item,
              ),
            },
      ),
    })
  }

  const addSection = () => {
    const newSection = {
      id: `section-${createQuoteId()}`,
      name: 'New Work Section',
      items: [
        {
          id: `item-${createQuoteId()}`,
          description: '',
          quantity: 1,
          unit: 'm²',
          unitPrice: 0,
          labourCost: 0,
          materialCost: 0,
          notes: '',
        },
      ],
    }

    commitQuote({ ...quote, sections: [...quote.sections, newSection] })
  }

  const addLineItem = (sectionId) => {
    const newItem = {
      id: `item-${createQuoteId()}`,
      description: '',
      quantity: 1,
      unit: 'm²',
      unitPrice: 0,
      labourCost: 0,
      materialCost: 0,
      notes: '',
    }

    commitQuote({
      ...quote,
      sections: quote.sections.map((section) =>
        section.id === sectionId
          ? { ...section, items: [...section.items, newItem] }
          : section,
      ),
    })
  }

  const duplicateSection = (sectionId) => {
    const sourceIndex = quote.sections.findIndex((section) => section.id === sectionId)
    if (sourceIndex < 0) return
    const source = quote.sections[sourceIndex]
    const duplicate = {
      ...cloneQuote(source),
      id: `section-${createQuoteId()}`,
      name: `${source.name} (copy)`,
      items: source.items.map((item) => ({ ...item, id: `item-${createQuoteId()}` })),
    }
    const sections = [...quote.sections]
    sections.splice(sourceIndex + 1, 0, duplicate)
    commitQuote({ ...quote, sections })
  }

  const moveSection = (sectionId, direction) => {
    const sectionIndex = quote.sections.findIndex((section) => section.id === sectionId)
    const targetIndex = sectionIndex + direction
    if (sectionIndex < 0 || targetIndex < 0 || targetIndex >= quote.sections.length) return
    const sections = [...quote.sections]
    const section = sections[sectionIndex]
    sections[sectionIndex] = sections[targetIndex]
    sections[targetIndex] = section
    commitQuote({ ...quote, sections })
  }

  const removeSection = (sectionId) => {
    commitQuote({
      ...quote,
      sections: quote.sections.filter((section) => section.id !== sectionId),
    })
  }

  const removeLineItem = (sectionId, itemId) => {
    commitQuote({
      ...quote,
      sections: quote.sections.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              items: section.items.filter((item) => item.id !== itemId),
            }
          : section,
      ),
    })
  }

  const handleDraftWithGemma = () => {
    const request = chatInput.trim() || 'Replace the paint with a lower-cost alternative and leave labour unchanged.'
    if (pendingChange) {
      setProposalError('Apply or reject the current proposal before creating another one.')
      return
    }
    const section = quote.sections.find((entry) => entry.name.toLowerCase().includes('paint'))
    const item = section?.items[0]
    const product = researchResults.find((entry) => entry.id === 2) || mockResearchResults.find((entry) => entry.id === 2)

    setChatInput('')
    setProposalError('')
    if (!section || !item || !product) {
      setChatMessages((current) => [
        ...current,
        { role: 'user', text: request },
        { role: 'assistant', text: 'No matching painting line item or material sample is available to propose a structured change.' },
      ])
      return
    }
    if (!/paint|emulsion/i.test(request) || !/replace|switch|alternative|cheaper|lower.cost/i.test(request)) {
      setChatMessages((current) => [
        ...current,
        { role: 'user', text: request },
        { role: 'assistant', text: 'This local example only previews a painting-material replacement. Other change types require the Gemma/Ollama backend, which is not configured.' },
      ])
      return
    }

    const snapshot = buildProductEvidenceSnapshot(product)
    const nextDescription = `${product.product}${item.description.toLowerCase().includes('2 coats') ? ' — 2 coats' : ''}`
    const proposedQuote = cloneQuote(quote)
    const proposedItem = proposedQuote.sections
      .find((entry) => entry.id === section.id)
      .items.find((entry) => entry.id === item.id)
    proposedItem.description = nextDescription
    proposedItem.materialEvidence = snapshot
    const beforeTotals = calculateQuoteTotals(quote)
    const afterTotals = calculateQuoteTotals(proposedQuote)
    const change = {
      id: `proposal-${Date.now()}`,
      quoteId: quote.id,
      sectionId: section.id,
      itemId: item.id,
      request,
      reason: 'The sample listing is priced per 5 L, but the quotation quantity and coverage are not normalized to that package. The listed price is preserved as evidence; the existing contractor-entered material allowance and all labour costs remain unchanged until coverage is confirmed.',
      changes: [
        { field: 'description', previousValue: item.description, proposedValue: nextDescription },
        { field: 'materialEvidence', previousValue: item.materialEvidence, proposedValue: snapshot },
      ],
      beforeTotals,
      afterTotals,
      estimatedImpact: afterTotals.grandTotal - beforeTotals.grandTotal,
      createdAt: new Date().toISOString(),
      status: 'pending',
    }

    setChatMessages((current) => [
      ...current,
      { role: 'user', text: request },
      {
        role: 'assistant',
        text: 'A structured material replacement preview is ready. This is a local development example, not a live Gemma or SerpApi response.',
        proposalId: change.id,
        status: 'pending',
      },
    ])
    setPendingChange(change)
  }

  const applyPendingChange = () => {
    if (!pendingChange) return
    const validationError = validateProposedChange(pendingChange, quote)
    if (validationError) {
      setProposalError(validationError)
      return
    }

    const beforeQuote = cloneQuote(quote)
    const changedQuote = cloneQuote(quote)
    const targetItem = changedQuote.sections
      .find((section) => section.id === pendingChange.sectionId)
      .items.find((item) => item.id === pendingChange.itemId)
    for (const change of pendingChange.changes) {
      targetItem[change.field] = change.proposedValue
    }
    const afterTotals = calculateQuoteTotals(changedQuote)
    const revision = {
      id: `revision-${Date.now()}`,
      quoteId: quote.id,
      request: pendingChange.request,
      timestamp: new Date().toISOString(),
      sectionId: pendingChange.sectionId,
      sectionName: quote.sections.find((section) => section.id === pendingChange.sectionId)?.name || 'Work section',
      itemId: pendingChange.itemId,
      changedFields: pendingChange.changes.map((change) => ({
        field: change.field,
        previousValue: change.previousValue,
        newValue: change.proposedValue,
      })),
      totalsBefore: calculateQuoteTotals(beforeQuote),
      totalsAfter: afterTotals,
      quoteBefore: beforeQuote,
      quoteAfter: cloneQuote(changedQuote),
      event: 'applied',
    }

    commitQuote(changedQuote)
    setRevisionHistory((current) => [revision, ...current])
    setChatMessages((current) => [
      ...current.map((message) =>
        message.proposalId === pendingChange.id ? { ...message, status: 'applied' } : message,
      ),
      { role: 'assistant', text: `Approved change applied to ${revision.sectionName}. All totals were recalculated from the quotation data.` },
    ])
    setPendingChange(null)
    setProposalError('')
  }

  const rejectPendingChange = () => {
    if (!pendingChange) return
    setChatMessages((current) => [
      ...current.map((message) =>
        message.proposalId === pendingChange.id ? { ...message, status: 'rejected' } : message,
      ),
      { role: 'assistant', text: 'Proposal rejected. The quotation and its totals were not changed.' },
    ])
    setPendingChange(null)
    setProposalError('')
  }

  const restoreRevision = (revision) => {
    const section = quote.sections.find((entry) => entry.id === revision.sectionId)
    const item = section?.items.find((entry) => entry.id === revision.itemId)
    if (!item) {
      setProposalError('This line item no longer exists, so its revision cannot be restored.')
      return
    }

    const before = cloneQuote(quote)
    const restored = cloneQuote(quote)
    const target = restored.sections
      .find((entry) => entry.id === revision.sectionId)
      .items.find((entry) => entry.id === revision.itemId)
    const changedFields = revision.changedFields.map((change) => ({
      field: change.field,
      previousValue: target[change.field],
      newValue: change.previousValue,
    }))
    for (const change of revision.changedFields) {
      if (change.previousValue === undefined) delete target[change.field]
      else target[change.field] = change.previousValue
    }
    const restoreRecord = {
      id: `revision-${revisionHistory.length + 1}-${new Date().toISOString()}`,
      quoteId: quote.id,
      request: `Restore previous values from ${revision.timestamp}`,
      timestamp: new Date().toISOString(),
      sectionId: revision.sectionId,
      sectionName: revision.sectionName,
      itemId: revision.itemId,
      changedFields,
      totalsBefore: calculateQuoteTotals(before),
      totalsAfter: calculateQuoteTotals(restored),
      quoteBefore: before,
      quoteAfter: cloneQuote(restored),
      event: 'restored',
    }
    commitQuote(restored)
    setRevisionHistory((current) => [restoreRecord, ...current])
    setChatMessages((current) => [
      ...current,
      { role: 'assistant', text: `Previous values restored for ${revision.sectionName}. Unrelated quotation fields were preserved.` },
    ])
    setProposalError('')
  }

  const addProductToQuote = (product) => {
    const snapshot = buildProductEvidenceSnapshot(product)
    const sectionId = `research-${product.category.toLowerCase().replace(/\W+/g, '-')}`
    const existingSection = quote.sections.find((section) => section.id === sectionId)
    const lineItem = {
      id: `research-item-${Date.now()}`,
      description: product.product,
      quantity: 1,
      unit: 'pack',
      unitPrice: product.listedPrice?.amount ?? 0,
      labourCost: 0,
      materialCost: 0,
      notes: product.listedPrice
        ? 'Sourced listing price is per package; confirm supplier price, availability, and required quantity before sending.'
        : 'No source price was available; enter and confirm a quotation rate before sending.',
      rateSource: 'sourced-listing',
      priceBasis: product.listedPrice ? 'sourced-listing' : 'unavailable',
      materialEvidence: snapshot,
    }
    if (existingSection) {
      commitQuote({
        ...quote,
        sections: quote.sections.map((section) =>
          section.id === sectionId ? { ...section, items: [...section.items, lineItem] } : section,
        ),
      })
    } else {
      commitQuote({
        ...quote,
        sections: [...quote.sections, { id: sectionId, name: `${product.category} Research`, items: [lineItem] }],
      })
    }
    setQuoteTab('items')
    setActiveSidebar('new-quotation')
  }

  const confirmProductPrice = (sectionId, itemId) => {
    const confirmedAt = new Date().toISOString()
    commitQuote({
      ...quote,
      sections: quote.sections.map((section) =>
        section.id !== sectionId
          ? section
          : {
              ...section,
              items: section.items.map((item) =>
                item.id !== itemId
                  ? item
                  : item.materialEvidence && item.priceBasis === 'sourced-listing'
                    ? {
                      ...item,
                      materialEvidence: {
                        ...item.materialEvidence,
                        priceStatus: 'confirmed-by-contractor',
                        confirmedAt,
                      },
                    }
                    : {
                      ...item,
                      priceConfirmation: {
                        source: 'contractor-entered',
                        status: 'confirmed-by-contractor',
                        confirmedAt,
                      },
                    },
              ),
            },
      ),
    })
  }

  const toggleProductComparison = (productId) => {
    setSelectedProductIds((current) =>
      current.includes(productId)
        ? current.filter((id) => id !== productId)
        : current.length < 3
          ? [...current, productId]
          : current,
    )
  }

  const createThreeOptions = () => {
    const paintOptions = researchResults
      .filter((product) =>
        product.category === 'Paint' &&
        product.listedPrice &&
        Number(product.listedPrice.packageQuantity) > 0 &&
        product.listedPrice.packageUnit,
      )
      .sort((left, right) =>
        left.listedPrice.amount / left.listedPrice.packageQuantity -
        right.listedPrice.amount / right.listedPrice.packageQuantity,
      )

    const paintSection = quote.sections.find((section) => section.name.toLowerCase().includes('paint'))
    const paintItem = paintSection?.items[0]
    const baseProductName = paintItem?.materialEvidence?.productName || paintItem?.description || 'Current material'

    const makeOptionQuote = (productChoice) => {
      const optionQuote = cloneQuote(quote)
      if (!paintSection || !paintItem) return optionQuote

      const targetSection = optionQuote.sections.find((section) => section.id === paintSection.id)
      const targetItem = targetSection?.items.find((item) => item.id === paintItem.id)
      if (!targetSection || !targetItem) return optionQuote

      if (productChoice) {
        const productName = productChoice.product
        targetItem.description = `${productName}${paintItem.description.toLowerCase().includes('2 coats') ? ' — 2 coats' : ''}`
        targetItem.priceBasis = 'sourced-listing'
        targetItem.rateSource = 'sourced-listing'
        targetItem.materialEvidence = buildProductEvidenceSnapshot(productChoice)
        targetItem.notes = 'Sourced package price retained as evidence only; coverage, quantity and supplier confirmation still required before approval.'
      } else {
        targetItem.description = paintItem.description
        targetItem.materialEvidence = paintItem.materialEvidence || null
        targetItem.notes = 'Current quote material retained; no suitable alternative has been verified from the sample source list.'
      }

      return optionQuote
    }

    const budgetProduct = paintOptions[0] || null
    const standardProduct = null
    const premiumProduct = paintOptions.length > 1 ? paintOptions[paintOptions.length - 1] : null

    const options = [
      {
        id: 'budget',
        name: 'Budget',
        description: budgetProduct
          ? 'Prioritises lower-cost material alternatives while retaining the same essential project scope and labour assumptions.'
          : 'No suitable lower-cost alternative is supported by available evidence; keep the current material until a supplier-backed price is available.',
        product: budgetProduct,
      },
      {
        id: 'standard',
        name: 'Standard',
        description: 'Retains the contractor-entered material choice, current scope and normal labour assumptions for a balanced proposal.',
        product: standardProduct,
      },
      {
        id: 'premium',
        name: 'Premium',
        description: premiumProduct
          ? 'Presents the higher-cost alternative from available source evidence, without claiming it is a guaranteed quality improvement.'
          : 'No suitable premium alternative is available from the sample listings; the current option remains the basis until a confirmed higher-specification product is added.',
        product: premiumProduct,
      },
    ].map((option) => {
      const optionQuote = makeOptionQuote(option.product)
      const optionTotals = calculateQuoteTotals(optionQuote)

      return {
        ...option,
        quote: optionQuote,
        materialChoice: option.product?.product || baseProductName,
        sourceUrl: option.product?.link || null,
        confirmationNeeded: option.product
          ? 'Confirm suitability, coverage, availability, quantity and price with the supplier before client approval.'
          : 'No suitable sourced alternative is available; the contractor-entered material remains in place until confirmation is recorded.',
        scopeSummary: `${quote.sections.length} work sections with current labour assumptions retained`,
        totals: optionTotals,
      }
    })

    setQuoteOptions(options)
    setSelectedOptionId(null)
    setQuoteTab('options')
  }

  const chooseOptionForEditing = (option) => {
    setSelectedOptionId(option.id)
    setQuote(cloneQuote(option.quote))
    setQuoteTab('items')
    setProposalError('')
  }

  const normalizeResearchProduct = useCallback((product, index = 0) => ({
    id: product?.id ?? index + 1,
    product: product?.product || product?.title || 'Unnamed product',
    brand: product?.brand || '',
    category: product?.category || 'Materials',
    listedPrice: product?.listedPrice || null,
    supplier: product?.supplier || product?.source || 'Source unavailable',
    image: product?.image || product?.thumbnail || '',
    specs: Array.isArray(product?.specs)
      ? product.specs
      : Array.isArray(product?.extensions)
        ? product.extensions
        : product?.snippet
          ? [product.snippet]
          : [],
    link: product?.link || product?.product_link || '#',
    retrievedAt: product?.retrievedAt || new Date().toISOString(),
    evidenceType: product?.evidenceType || 'sourced-listing',
    priceStatus: product?.priceStatus || 'unverified',
    priceBasis: product?.priceBasis || 'sourced-listing',
    availability: product?.availability || 'Availability not verified.',
    limitations: Array.isArray(product?.limitations) ? product.limitations : [],
  }), [])

  const searchMaterials = useCallback(async () => {
    setResearchLoading(true)
    setResearchError('')
    try {
      const params = new URLSearchParams()
      if (search.trim()) params.set('q', search.trim())
      if (category !== 'All') params.set('category', category)
      const response = await fetch(`/api/materials/search?${params.toString()}`)
      if (!response.ok) {
        throw new Error(`Material search failed with status ${response.status}.`)
      }
      const data = await response.json()
      const results = Array.isArray(data?.results) ? data.results : []
      setResearchResults(results.map((product, index) => normalizeResearchProduct(product, index)))
      setResearchSource(data?.source || 'server')
      setResearchError(data?.source === 'serpapi' ? '' : data?.message || '')
    } catch (error) {
      if (import.meta.env.DEV) {
        const filtered = mockResearchResults.filter((product) => {
          const matchesCategory = category === 'All' || product.category === category
          const haystack = `${product.product} ${product.brand} ${product.specs.join(' ')}`.toLowerCase()
          return matchesCategory && (!search.trim() || haystack.includes(search.trim().toLowerCase()))
        })
        setResearchResults(filtered.map((product, index) => normalizeResearchProduct(product, index)))
        setResearchSource('development-fixtures')
        setResearchError('Live SerpApi search is unavailable; showing clearly labelled development fixtures.')
      } else {
        setResearchResults([])
        setResearchSource('unavailable')
        setResearchError(error.message || 'Material search is unavailable.')
      }
    } finally {
      setResearchLoading(false)
    }
  }, [search, category, normalizeResearchProduct])

  useEffect(() => {
    const timer = setTimeout(() => {
      searchMaterials()
    }, 250)
    return () => clearTimeout(timer)
  }, [searchMaterials])

  const filteredProducts = researchResults.filter((product) => {
    const matchesCategory = category === 'All' || product.category === category
    const haystack = `${product?.product || ''} ${product?.brand || ''} ${(product?.specs || []).join(' ')}`.toLowerCase()
    return matchesCategory && haystack.includes((search || '').toLowerCase())
  })
  const comparedProducts = researchResults.filter((product) => selectedProductIds.includes(product.id))

  const savedQuoteValues = savedQuotes.reduce(
    (values, savedQuote) => {
      const currency = savedQuote.currency === 'USD' ? 'USD' : 'GHS'
      values[currency] += calculateQuoteTotals(savedQuote).grandTotal
      return values
    },
    { GHS: 0, USD: 0 },
  )
  const formattedSavedValues = ['GHS', 'USD']
    .filter((currency) => savedQuoteValues[currency] > 0)
    .map((currency) => toCurrency(savedQuoteValues[currency], currency))
    .join(' + ') || toCurrency(0, 'GHS')
  const dashboardStats = [
    { label: 'Total quotations', value: String(savedQuotes.length), helper: 'Saved in this browser' },
    { label: 'Quotation value', value: formattedSavedValues, helper: 'Saved totals, grouped by currency' },
    {
      label: 'Pending client responses',
      value: String(savedQuotes.filter((savedQuote) => ['Ready for Review', 'Sent'].includes(savedQuote.status)).length),
      helper: 'Ready for review or sent',
    },
    {
      label: 'Completed quotations',
      value: String(savedQuotes.filter((savedQuote) => savedQuote.status === 'Accepted').length),
      helper: 'Marked accepted',
    },
  ]

  const recentQuotations = [...savedQuotes]
    .sort((left, right) => new Date(right.updatedAt || 0) - new Date(left.updatedAt || 0))
    .slice(0, 5)

  return (
    <>
      {view === 'landing' ? (
        <div className="landing-page">
          <header className="topbar">
            <div className="brand-wrap">
              <div className="brand-mark">BQ</div>
              <div>
                <div className="brand-name">BuildQuote</div>
                <div className="brand-tag">Better Quotes. Bigger Projects.</div>
              </div>
            </div>

            <nav className="main-nav" aria-label="Main navigation">
              {navigation.map((item) => (
                <a key={item.label} href={item.href}>
                  {item.label}
                </a>
              ))}
            </nav>

            <button type="button" className="primary-btn" onClick={openApp}>
              Login
            </button>
          </header>

          <main>
            <section className="hero-section" id="home">
              <div className="hero-copy">
                <span className="eyebrow">Construction quotation intelligence</span>
                <h1>Fast, accurate quotes for building work across Ghana.</h1>
                <p>
                  Create professional quotations, research materials, refine proposals with AI,
                  and export polished PDF pricing for clients without the spreadsheet burden.
                </p>
                <div className="cta-row">
                  <button type="button" className="primary-btn" onClick={openApp}>
                    Get Started
                  </button>
                  <button type="button" className="secondary-btn" onClick={() => setActiveSidebar('research')}>
                    Explore Research
                  </button>
                </div>
                <div className="hero-metrics">
                  <div>
                    <strong>2.4x</strong>
                    <span>Faster quote prep</span>
                  </div>
                  <div>
                    <strong>4.9/5</strong>
                    <span>Contractor satisfaction</span>
                  </div>
                  <div>
                    <strong>GH₵ 1.2M</strong>
                    <span>Pipeline tracked</span>
                  </div>
                </div>
              </div>

              <div className="hero-panel">
                <div className="panel-card card-large">
                  <div className="card-head">
                    <span className="status-dot success"></span>
                    Active quotation
                  </div>
                  <h3>Residential Renovation</h3>
                  <div className="quote-row">
                    <span>Client</span>
                    <strong>Atlas Construction Ltd.</strong>
                  </div>
                  <div className="quote-row">
                    <span>Project</span>
                    <strong>3-bedroom refurbishment</strong>
                  </div>
                  <div className="quote-row">
                    <span>Total</span>
                    <strong>{toCurrency(132450, quote.currency)}</strong>
                  </div>
                  <div className="mini-chart">
                    <span style={{ width: '78%' }}></span>
                    <span style={{ width: '56%' }}></span>
                    <span style={{ width: '89%' }}></span>
                  </div>
                </div>
              </div>
            </section>

            <section className="features-section" id="features">
              <div className="section-heading">
                <span className="eyebrow">Everything you need</span>
                <h2>Built for field teams and quote-driven businesses.</h2>
              </div>
              <div className="feature-grid">
                {featureCards.map((feature) => (
                  <article key={feature.title} className="feature-card">
                    <div className="feature-icon">✦</div>
                    <h3>{feature.title}</h3>
                    <p>{feature.text}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="workflow-section" id="how-it-works">
              <div className="section-heading narrow">
                <span className="eyebrow">How it works</span>
                <h2>A simple workflow from scope to client-ready proposal.</h2>
              </div>
              <div className="workflow-grid">
                {workflowSteps.map((step, index) => (
                  <div key={step} className="workflow-step">
                    <span>0{index + 1}</span>
                    <p>{step}</p>
                  </div>
                ))}
              </div>
            </section>

          </main>

          <footer className="site-footer">
            <div>
              <div className="brand-name">BuildQuote</div>
              <p>Construction quotation intelligence for local businesses.</p>
            </div>
            <div className="footer-links">
              <a href="#">Contact</a>
              <a href="#">Terms</a>
              <a href="#">Privacy</a>
            </div>
          </footer>
        </div>
      ) : (
        <div className="app-shell">
          {sidebarOpen && (
            <>
              <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} aria-hidden="true" />
              <aside className="sidebar" id="workspace-sidebar" ref={sidebarRef} role="dialog" aria-modal="true" aria-label="Workspace navigation">
            <div className="sidebar-top">
            <button type="button" className="nav-item sidebar-close" onClick={() => setSidebarOpen(false)}>
              Hide sidebar
            </button>
            <div className="sidebar-brand">
              <div className="brand-mark">BQ</div>
              <div>
                <div className="brand-name white">BuildQuote</div>
                <div className="brand-tag light">Contractor workspace</div>
              </div>
            </div>

            <nav className="sidebar-nav" aria-label="Application navigation">
              {sidebarItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={activeSidebar === item.id ? 'nav-item active' : 'nav-item'}
                  onClick={() => {
                    setSidebarOpen(false)
                    if (item.id === 'new-quotation') startNewQuote()
                    else setActiveSidebar(item.id)
                  }}
                >
                  {item.label}
                </button>
              ))}
            </nav>
            </div>

            <div className="sidebar-profile">
              <div className="avatar">KS</div>
              <div>
                <strong>Kofi Sarpong</strong>
                <span>Pro plan</span>
              </div>
            </div>
              </aside>
            </>
          )}

          <main className="workspace" inert={sidebarOpen}>
            <button
              ref={sidebarToggleRef}
              type="button"
              className="ghost-btn sidebar-toggle"
              aria-expanded={sidebarOpen}
              aria-controls="workspace-sidebar"
              onClick={() => setSidebarOpen((open) => !open)}
            >
              Show sidebar
            </button>
            <header className="workspace-header">
              <div>
                <span className="eyebrow tight">Workspace</span>
                <h2>
                  {activeSidebar === 'dashboard' && 'Dashboard'}
                  {activeSidebar === 'new-quotation' && 'Quotation editor'}
                  {activeSidebar === 'quotations' && 'Saved quotations'}
                  {activeSidebar === 'research' && 'Material research'}
                  {activeSidebar === 'assistant' && 'AI assistant'}
                  {activeSidebar === 'settings' && 'Business settings'}
                  {activeSidebar === 'help' && 'Help centre'}
                </h2>
              </div>
              <div className="header-actions">
                <button type="button" className="ghost-btn">
                  Notifications
                </button>
                <button type="button" className="primary-btn" onClick={startNewQuote}>
                  Create New Quotation
                </button>
              </div>
            </header>

            {activeSidebar === 'dashboard' && (
              <div className="dashboard-layout">
                <section className="stats-grid">
                  {dashboardStats.map((card) => (
                    <article key={card.label} className="stat-card">
                      <span>{card.label}</span>
                      <strong>{card.value}</strong>
                      <small>{card.helper}</small>
                    </article>
                  ))}
                </section>

                <section className="content-grid">
                  <article className="panel">
                    <div className="panel-header">
                      <h3>Recent quotations</h3>
                      <button type="button" className="link-btn" onClick={() => setActiveSidebar('quotations')}>
                        View all
                      </button>
                    </div>
                    <div className="quote-list">
                      {recentQuotations.length === 0 ? (
                        <div className="empty-state">
                          <h3>No saved quotations yet</h3>
                          <p>Create a draft and save it to see real quote totals and activity here.</p>
                          <button type="button" className="primary-btn" onClick={startNewQuote}>Create your first quotation</button>
                        </div>
                      ) : recentQuotations.map((item) => (
                        <button key={item.id} type="button" className="quote-row-item quote-open" onClick={() => openSavedQuote(item)}>
                          <div>
                            <strong>{item.projectTitle || 'Untitled project'} · {item.client || 'Client not set'}</strong>
                            <small>{item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : 'Not saved yet'}</small>
                          </div>
                          <div className="quote-meta">
                            <span className="status-pill pending">{item.status}</span>
                            <strong>{toCurrency(calculateQuoteTotals(item).grandTotal, item.currency)}</strong>
                          </div>
                        </button>
                      ))}
                    </div>
                  </article>

                  <article className="panel">
                    <div className="panel-header">
                      <h3>Quick actions</h3>
                    </div>
                    <div className="quick-actions">
                      <button type="button" className="primary-btn wide" onClick={startNewQuote}>
                        Create a quotation
                      </button>
                      <button type="button" className="secondary-btn wide" onClick={() => setActiveSidebar('research')}>
                        Research materials
                      </button>
                      <button type="button" className="secondary-btn wide" onClick={() => setActiveSidebar('quotations')}>
                        View saved quotations
                      </button>
                    </div>
                  </article>
                </section>
              </div>
            )}

            {activeSidebar === 'new-quotation' && (
              <div className="quotation-editor">
                <div className="editor-header">
                  <div>
                    <span className="status-pill draft">{quote.status}</span>
                    <strong>{quote.projectTitle || 'Untitled quotation'}</strong>
                  </div>
                  <div className="editor-actions">
                    <button type="button" className="ghost-btn" onClick={() => setQuoteTab('preview')}>
                      Preview
                    </button>
                    <button type="button" className="ghost-btn" onClick={exportQuotationPdf}>
                      Export PDF
                    </button>
                    <button type="button" className="primary-btn" onClick={saveDraft}>
                      Save Draft
                    </button>
                  </div>
                </div>
                <div className="editor-total-strip" aria-label="Current quotation totals">
                  <div><span>Subtotal</span><strong>{toCurrency(totals.sectionTotal, quote.currency)}</strong></div>
                  <div><span>Tax</span><strong>{toCurrency(totals.taxValue, quote.currency)}</strong></div>
                  <div><span>Grand total</span><strong>{toCurrency(totals.grandTotal, quote.currency)}</strong></div>
                </div>
                {saveFeedback && (
                  <p className={saveFeedback.startsWith('Could not') ? 'error-message' : 'inline-success'} role="status">
                    {saveFeedback}
                  </p>
                )}
                {quoteErrors.length > 0 && (
                  <div className="validation-summary" role="alert">
                    <strong>Review these items before treating the quote as ready or exporting it:</strong>
                    <ul>{quoteErrors.map((error) => <li key={error}>{error}</li>)}</ul>
                  </div>
                )}

                <div className="editor-tabs">
                  {['details', 'items', 'ai', 'notes', 'preview', 'options'].map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      className={quoteTab === tab ? 'tab-button active' : 'tab-button'}
                      onClick={() => setQuoteTab(tab)}
                    >
                      {tab === 'details' && 'Details'}
                      {tab === 'items' && 'Items'}
                      {tab === 'ai' && 'AI Assistant'}
                      {tab === 'notes' && 'Notes'}
                      {tab === 'preview' && 'Preview'}
                      {tab === 'options' && 'Options'}
                    </button>
                  ))}
                </div>

                {quoteTab === 'details' && (
                  <div className="form-grid two-col">
                    <label>
                      Client or company name
                      <input required value={quote.client} onChange={(event) => updateQuoteField('client', event.target.value)} />
                    </label>
                    <label>
                      Client contact
                      <input value={quote.contact} onChange={(event) => updateQuoteField('contact', event.target.value)} />
                    </label>
                    <label>
                      Project title
                      <input required value={quote.projectTitle} onChange={(event) => updateQuoteField('projectTitle', event.target.value)} />
                    </label>
                    <label>
                      Project location
                      <input required value={quote.location} onChange={(event) => updateQuoteField('location', event.target.value)} />
                    </label>
                    <label className="full-width">
                      Project description
                      <textarea value={quote.description} onChange={(event) => updateQuoteField('description', event.target.value)} rows="4" />
                    </label>
                    <label>
                      Contractor business info
                      <input required value={quote.contractor} onChange={(event) => updateQuoteField('contractor', event.target.value)} />
                    </label>
                    <label>
                      Currency
                      <select value={quote.currency} onChange={(event) => updateQuoteField('currency', event.target.value)}>
                        <option value="GHS">GHS</option>
                        <option value="USD">USD</option>
                      </select>
                    </label>
                    <label>
                      Applicable tax rate (%)
                      <input type="number" min="0" max="100" step="0.01" value={quote.taxRate} onChange={(event) => updateQuoteField('taxRate', event.target.value)} />
                    </label>
                    <label>
                      Payment terms
                      <input value={quote.paymentTerms} onChange={(event) => updateQuoteField('paymentTerms', event.target.value)} />
                    </label>
                    <label>
                      Quotation validity period
                      <input value={quote.validity} onChange={(event) => updateQuoteField('validity', event.target.value)} />
                    </label>
                  </div>
                )}

                {quoteTab === 'items' && (
                  <div className="sections-panel">
                    {quote.sections.map((section, sectionIndex) => (
                      <div key={section.id} className="section-card">
                        <div className="section-header">
                          <input
                            className="section-name-input"
                            aria-label={`Section ${sectionIndex + 1} name`}
                            value={section.name}
                            onChange={(event) => updateSection(section.id, { name: event.target.value })}
                          />
                          <div className="section-actions">
                            <button type="button" className="ghost-btn small" onClick={() => moveSection(section.id, -1)} disabled={sectionIndex === 0}>
                              Move up
                            </button>
                            <button type="button" className="ghost-btn small" onClick={() => moveSection(section.id, 1)} disabled={sectionIndex === quote.sections.length - 1}>
                              Move down
                            </button>
                            <button type="button" className="ghost-btn small" onClick={() => duplicateSection(section.id)}>
                              Duplicate
                            </button>
                            <button type="button" className="ghost-btn small" onClick={() => addLineItem(section.id)}>
                              + Item
                            </button>
                            <button type="button" className="ghost-btn small" onClick={() => removeSection(section.id)}>
                              Remove
                            </button>
                          </div>
                        </div>

                        {section.items.map((item) => (
                          <div key={item.id} className="line-item-grid">
                            <label>
                              Description
                              <input required value={item.description} onChange={(event) => updateLineItem(section.id, item.id, 'description', event.target.value)} />
                            </label>
                            <label>
                              Qty
                              <input type="number" min="0" step="any" value={item.quantity} onChange={(event) => updateLineItem(section.id, item.id, 'quantity', event.target.value === '' ? '' : Number(event.target.value))} />
                            </label>
                            <label>
                              Unit
                              <select value={item.unit} onChange={(event) => updateLineItem(section.id, item.id, 'unit', event.target.value)}>
                                <option value="m²">m²</option>
                                <option value="m">m</option>
                                <option value="pieces">pieces</option>
                                <option value="pack">pack</option>
                                <option value="bags">bags</option>
                                <option value="litres">litres</option>
                                <option value="hours">hours</option>
                                <option value="lump sum">lump sum</option>
                              </select>
                            </label>
                            <label>
                              Unit price
                              <input type="number" min="0" step="any" value={item.unitPrice} onChange={(event) => updateLineItem(section.id, item.id, 'unitPrice', event.target.value === '' ? '' : Number(event.target.value))} />
                            </label>
                            <label>
                              Labour
                              <input type="number" min="0" step="any" value={item.labourCost} onChange={(event) => updateLineItem(section.id, item.id, 'labourCost', event.target.value === '' ? '' : Number(event.target.value))} />
                            </label>
                            <label>
                              Materials
                              <input type="number" min="0" step="any" value={item.materialCost} onChange={(event) => updateLineItem(section.id, item.id, 'materialCost', event.target.value === '' ? '' : Number(event.target.value))} />
                            </label>
                            <label>
                              Line total
                              <input value={toCurrency(calculateLineTotal(item), quote.currency)} readOnly />
                            </label>
                            <div className="notes-field">
                              <label>
                                Notes
                                <textarea value={item.notes} onChange={(event) => updateLineItem(section.id, item.id, 'notes', event.target.value)} rows="2" />
                              </label>
                              <button type="button" className="link-btn danger" onClick={() => removeLineItem(section.id, item.id)}>
                                Remove item
                              </button>
                            </div>
                            {item.materialEvidence && (
                              <div className="line-evidence">
                                <strong>Quotation rate basis: {item.priceBasis === 'sourced-listing' ? 'Sourced listing' : 'Contractor-entered'}</strong>
                                <strong>Source evidence: {item.materialEvidence.priceStatus === 'confirmed-by-contractor' ? 'Independently confirmed by contractor' : 'Sourced listing — unverified'}</strong>
                                <span>
                                  {item.materialEvidence.listedPrice
                                    ? `${toCurrency(item.materialEvidence.listedPrice.amount, item.materialEvidence.listedPrice.currency)} / ${item.materialEvidence.listedPrice.packageQuantity} ${item.materialEvidence.listedPrice.packageUnit}`
                                    : 'Listed price unavailable'}
                                  {' · '}
                                  {item.materialEvidence.supplier || 'Supplier unavailable'}
                                </span>
                                <span>Retrieved: {item.materialEvidence.retrievedAt ? new Date(item.materialEvidence.retrievedAt).toLocaleString() : 'unavailable'}</span>
                                <span>Specifications: {item.materialEvidence.specifications?.join(', ') || 'unavailable'}</span>
                                <span>Availability: {item.materialEvidence.availability || 'unavailable'}</span>
                                {item.materialEvidence.limitations?.map((limitation) => <span key={limitation}>Limitation: {limitation}</span>)}
                                {item.priceBasis === 'sourced-listing' && item.materialEvidence.confirmedAt ? (
                                  <span>Contractor confirmation recorded {new Date(item.materialEvidence.confirmedAt).toLocaleString()}</span>
                                ) : item.priceBasis === 'sourced-listing' ? (
                                  <button type="button" className="link-btn" onClick={() => confirmProductPrice(section.id, item.id)}>
                                    Mark price independently confirmed
                                  </button>
                                ) : (
                                  <>
                                    <span>
                                      {item.priceConfirmation?.status === 'confirmed-by-contractor'
                                        ? `Entered rate confirmed ${new Date(item.priceConfirmation.confirmedAt).toLocaleString()}`
                                        : 'Entered rate not independently confirmed'}
                                    </span>
                                    {item.priceConfirmation?.status !== 'confirmed-by-contractor' && (
                                      <button type="button" className="link-btn" onClick={() => confirmProductPrice(section.id, item.id)}>
                                        Mark entered rate independently confirmed
                                      </button>
                                    )}
                                  </>
                                )}
                                {item.materialEvidence.sourceUrl && (
                                  <a href={item.materialEvidence.sourceUrl} target="_blank" rel="noreferrer">Open saved source</a>
                                )}
                              </div>
                            )}
                            {!item.materialEvidence && (
                              <div className="line-evidence">
                                <strong>Price basis: Contractor-entered</strong>
                                <span>
                                  {item.priceConfirmation?.status === 'confirmed-by-contractor'
                                    ? `Independently confirmed ${new Date(item.priceConfirmation.confirmedAt).toLocaleString()}`
                                    : 'Not independently confirmed'}
                                </span>
                                {item.priceConfirmation?.status !== 'confirmed-by-contractor' && (
                                  <button type="button" className="link-btn" onClick={() => confirmProductPrice(section.id, item.id)}>
                                    Mark entered rate independently confirmed
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                        <div className="section-subtotal">
                          <span>Section subtotal</span>
                          <strong>{toCurrency(calculateSectionTotal(section), quote.currency)}</strong>
                        </div>
                      </div>
                    ))}
                    <button type="button" className="secondary-btn" onClick={addSection}>
                      + Add Work Section
                    </button>
                  </div>
                )}

                {quoteTab === 'ai' && (
                  <div className="assistant-layout">
                    <div className="chat-panel">
                      <div className="demo-notice">
                        Local prototype: no Gemma/Ollama or authenticated server is connected. Proposals below are structured examples and are validated in this browser only.
                      </div>
                      {chatMessages.map((message, index) => (
                        <div key={`${message.role}-${index}`} className={message.role === 'user' ? 'chat-bubble user' : 'chat-bubble assistant'}>
                          <div className="bubble-role">{message.role === 'user' ? 'You' : 'AI Assistant'}</div>
                          <p>{message.text}</p>
                          {message.status && <span className={`revision-status ${message.status}`}>Proposal {message.status}</span>}
                        </div>
                      ))}
                      <form className="chat-composer" onSubmit={(event) => { event.preventDefault(); handleDraftWithGemma() }}>
                        <label htmlFor="revision-request">Describe a change to preview</label>
                        <textarea
                          id="revision-request"
                          value={chatInput}
                          onChange={(event) => setChatInput(event.target.value)}
                          placeholder="e.g. Replace the paint with a lower-cost option, but leave labour unchanged."
                          rows="3"
                        />
                        <button type="submit" className="primary-btn" disabled={Boolean(pendingChange) || (!chatInput.trim() && !quote.sections.some((section) => section.name.toLowerCase().includes('paint')))}>
                          Preview structured change
                        </button>
                      </form>
                    </div>

                    <div className="assistant-sidepanel">
                      {pendingChange && (
                        <div className="proposal-box">
                          <span className="status-pill pending">Awaiting approval</span>
                          <h4>Proposed change · {quote.sections.find((section) => section.id === pendingChange.sectionId)?.name}</h4>
                          <p>{pendingChange.reason}</p>
                          {pendingChange.changes.filter((change) => change.field !== 'materialEvidence').map((change) => (
                            <div key={change.field} className="change-preview">
                              <span>{change.field}</span>
                              <div><strong>Before</strong><span>{String(change.previousValue ?? 'Not set')}</span></div>
                              <div><strong>Proposed</strong><span>{String(change.proposedValue)}</span></div>
                            </div>
                          ))}
                          <div className="proposal-row">
                            <span>Estimated total impact</span>
                            <strong>{toCurrency(pendingChange.estimatedImpact, quote.currency)}</strong>
                          </div>
                          <div className="proposal-row">
                            <span>New quotation total</span>
                            <strong>{toCurrency(pendingChange.afterTotals.grandTotal, quote.currency)}</strong>
                          </div>
                          {pendingChange.changes.find((change) => change.field === 'materialEvidence')?.proposedValue && (
                            <div className="evidence-caveat">
                              {(() => {
                                const evidence = pendingChange.changes.find((change) => change.field === 'materialEvidence').proposedValue
                                return (
                                  <>
                                    <p>
                                      Listing price: {evidence.listedPrice
                                        ? `${toCurrency(evidence.listedPrice.amount, evidence.listedPrice.currency)} / ${evidence.listedPrice.packageQuantity} ${evidence.listedPrice.packageUnit}`
                                        : 'unavailable'} · {evidence.supplier || 'supplier unavailable'} · Retrieval: {evidence.retrievedAt ? new Date(evidence.retrievedAt).toLocaleString() : 'unavailable'}.
                                    </p>
                                    {evidence.sourceUrl && <a href={evidence.sourceUrl} target="_blank" rel="noreferrer">Open saved source</a>}
                                  </>
                                )
                              })()}
                              <p>Package coverage is not known, so the contractor-entered allowance and labour are unchanged.</p>
                            </div>
                          )}
                          <div className="proposal-actions">
                            <button type="button" className="primary-btn small-btn" onClick={applyPendingChange}>
                              Apply Changes
                            </button>
                            <button type="button" className="ghost-btn small-btn" onClick={rejectPendingChange}>
                              Reject Changes
                            </button>
                          </div>
                        </div>
                      )}
                      {proposalError && <p className="error-message" role="alert">{proposalError}</p>}
                      <div className="revision-history">
                        <h4>Revision history</h4>
                        {!revisionHistory.length && <p>No approved quotation changes yet.</p>}
                        {revisionHistory.map((revision) => (
                          <article key={revision.id} className="revision-card">
                            <strong>{revision.event === 'restored' ? 'Values restored' : 'Change applied'} · {revision.sectionName}</strong>
                            <span>{new Date(revision.timestamp).toLocaleString()}</span>
                            <p>{revision.request}</p>
                            {revision.changedFields.map((change) => (
                              <span key={`${revision.id}-${change.field}`}>
                                {change.field}: {formatRevisionValue(change.previousValue)} → {formatRevisionValue(change.newValue)}
                              </span>
                            ))}
                            <span>Total: {toCurrency(revision.totalsBefore.grandTotal, quote.currency)} → {toCurrency(revision.totalsAfter.grandTotal, quote.currency)}</span>
                            <button type="button" className="link-btn" onClick={() => restoreRevision(revision)}>
                              Restore previous values
                            </button>
                          </article>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {quoteTab === 'notes' && (
                  <div className="notes-editor">
                    <label>
                      Client notes and assumptions
                      <textarea value={quote.notes} onChange={(event) => updateQuoteField('notes', event.target.value)} rows="10" />
                    </label>
                  </div>
                )}

                {quoteTab === 'preview' && (
                  <div className="preview-panel">
                    <div className="options-intro">
                      <div>
                        <h3>Need alternatives for the client?</h3>
                        <p>Create editable Budget, Standard, and Premium material options without changing essential scope or labour.</p>
                      </div>
                      <div className="editor-actions">
                        <button type="button" className="secondary-btn" onClick={exportQuotationPdf}>Export PDF</button>
                        <button type="button" className="primary-btn" onClick={createThreeOptions}>Create Three Options</button>
                      </div>
                    </div>
                    <div className="preview-summary">
                      <div>
                        <span>Subtotal</span>
                        <strong>{toCurrency(totals.sectionTotal, quote.currency)}</strong>
                      </div>
                      <div>
                        <span>Tax</span>
                        <strong>{toCurrency(totals.taxValue, quote.currency)}</strong>
                      </div>
                      <div>
                        <span>Grand total</span>
                        <strong>{toCurrency(totals.grandTotal, quote.currency)}</strong>
                      </div>
                    </div>

                    {quote.sections.map((section) => (
                      <div key={section.id} className="preview-section">
                        <h4>{section.name}</h4>
                        <div className="preview-grid">
                          {section.items.map((item) => (
                            <div key={item.id} className="preview-item">
                              <span>{item.description}</span>
                              <strong>{toCurrency(calculateLineTotal(item), quote.currency)}</strong>
                            </div>
                          ))}
                        </div>
                        <div className="section-total-row">
                          <span>Section subtotal</span>
                          <strong>{toCurrency(calculateSectionTotal(section), quote.currency)}</strong>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {quoteTab === 'options' && (
                  <div className="options-panel">
                    <div className="demo-notice">
                      These are editable alternatives, not quality guarantees. Sourced package prices are preserved as evidence only; no total changes are estimated without reliable coverage and quantity data.
                    </div>
                    {quoteOptions.length === 0 ? (
                      <div className="empty-options">
                        <h3>No alternatives generated yet</h3>
                        <p>Generate options from the current quote. If comparable products or package data are unavailable, the missing information will be called out instead of fabricated.</p>
                        <button type="button" className="primary-btn" onClick={createThreeOptions}>Create Three Options</button>
                      </div>
                    ) : (
                      <>
                        <div className="option-comparison-table">
                          <div className="comparison-header-row">
                            <span>Option</span>
                            <span>Total value</span>
                            <span>Material</span>
                            <span>Scope / labour</span>
                            <span>Key differences</span>
                          </div>
                          {quoteOptions.map((option) => {
                            const optionTotals = option.totals || calculateQuoteTotals(option.quote)
                            return (
                              <div key={option.id} className="comparison-row">
                                <strong>{option.name}</strong>
                                <span>{toCurrency(optionTotals.grandTotal, option.quote.currency)}</span>
                                <span>{option.materialChoice}</span>
                                <span>{option.scopeSummary}</span>
                                <span>{option.description}</span>
                              </div>
                            )
                          })}
                        </div>
                        <div className="options-grid">
                          {quoteOptions.map((option) => {
                            const optionTotals = option.totals || calculateQuoteTotals(option.quote)
                            return (
                              <article key={option.id} className={`option-card ${selectedOptionId === option.id ? 'selected' : ''}`}>
                                <span className="tag">{option.name} option</span>
                                <h3>{toCurrency(optionTotals.grandTotal, option.quote.currency)}</h3>
                                <p>{option.description}</p>
                                <dl>
                                  <div><dt>Material selection</dt><dd>{option.materialChoice}</dd></div>
                                  <div>
                                    <dt>Scope of work</dt>
                                    <dd>
                                      {option.quote.sections.map((section) =>
                                        `${section.name}: ${section.items.map((item) => `${item.description} (${item.quantity} ${item.unit})`).join('; ')}`,
                                      ).join(' | ') || 'No work sections'}
                                    </dd>
                                  </div>
                                  <div><dt>Labour</dt><dd>{option.scopeSummary}</dd></div>
                                  <div><dt>Price basis</dt><dd>{option.product ? 'Package listing retained as evidence; quantity and coverage still require confirmation' : 'Contractor-entered'}</dd></div>
                                  <div><dt>Important differences</dt><dd>{option.description}</dd></div>
                                  <div><dt>Exclusions / assumptions</dt><dd>{option.quote.notes || 'None recorded'}</dd></div>
                                  <div><dt>Confirm</dt><dd>{option.confirmationNeeded}</dd></div>
                                </dl>
                                {option.sourceUrl && <a href={option.sourceUrl} target="_blank" rel="noreferrer">View source</a>}
                                <button type="button" className="primary-btn wide" onClick={() => chooseOptionForEditing(option)}>
                                  Select and edit option
                                </button>
                              </article>
                            )
                          })}
                        </div>
                      </>
                    )}
                    {selectedOptionId && <p className="inline-success">Editing the selected option. Make changes in Items, then review and export as usual.</p>}
                    {proposalError && <p className="error-message" role="alert">{proposalError}</p>}
                  </div>
                )}
              </div>
            )}

            {activeSidebar === 'research' && (
              <div className="research-layout">
                <div className="demo-notice">
                  Development-only sample catalog. This project has no SerpApi server integration yet; prices, specifications, supplier names, and links shown here are not live or independently verified.
                </div>
                <div className="research-toolbar">
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search materials, suppliers or brands"
                  />
                  <select value={category} onChange={(event) => setCategory(event.target.value)}>
                    <option value="All">All categories</option>
                    <option value="Paint">Paint</option>
                    <option value="Roofing">Roofing</option>
                  </select>
                </div>

                {comparedProducts.length > 0 && (
                  <section className="compare-panel">
                    <h3>Product comparison</h3>
                    <div className="compare-grid">
                      {comparedProducts.map((product) => {
                        const unitPrice = getUnitPriceFromListing(product.listedPrice)
                        return (
                          <article key={product.id}>
                            <strong>{product.product}</strong>
                            <span>{product.brand || 'Brand unavailable'}</span>
                            <span>Evidence: {getEvidenceStatusLabel(product.priceStatus || 'unverified')}</span>
                            <span>
                              {product.listedPrice
                                ? `${toCurrency(product.listedPrice.amount, product.listedPrice.currency)} / ${product.listedPrice.packageQuantity} ${product.listedPrice.packageUnit}`
                                : 'Price unavailable'}
                            </span>
                            <span>
                              {unitPrice
                                ? `${toCurrency(unitPrice.amount, product.listedPrice.currency)} / ${unitPrice.unit} (normalized)`
                                : 'Unit price unavailable'}
                            </span>
                            <span>Source: {product.supplier || 'Supplier unavailable'}</span>
                            <span>Retrieved: {product.retrievedAt ? new Date(product.retrievedAt).toLocaleString() : 'Not available'}</span>
                            <span>Availability: {product.availability || 'Unavailable'}</span>
                            <span>{product.specs?.length ? `Spec: ${product.specs.join(' • ')}` : 'Specifications unavailable'}</span>
                            <span>{product.limitations?.length ? `Limitations: ${product.limitations.join(' • ')}` : 'Limitations unavailable'}</span>
                            <a href={product.link} target="_blank" rel="noreferrer">Open source</a>
                          </article>
                        )
                      })}
                    </div>
                  </section>
                )}
                <div className="research-grid">
                  {filteredProducts.map((product) => {
                    const unitPrice = getUnitPriceFromListing(product.listedPrice)
                    return (
                      <article key={product.id} className="research-card">
                        <img src={product.image} alt={product.product} />
                        <div className="research-body">
                          <span className="tag">{product.category}</span>
                          <h3>{product.product}</h3>
                          <p className="brand-line">{product.brand || 'Brand unavailable'} • {product.supplier || 'Supplier unavailable'}</p>
                          <div className="price-line">
                            {product.listedPrice
                              ? `${toCurrency(product.listedPrice.amount, product.listedPrice.currency)} / ${product.listedPrice.packageQuantity} ${product.listedPrice.packageUnit}`
                              : 'Listed price unavailable'}
                          </div>
                          <div className="source-line">Evidence status: {getEvidenceStatusLabel(product.priceStatus || 'unverified')}</div>
                          <div className="source-line">
                            {unitPrice
                              ? `Unit price: ${toCurrency(unitPrice.amount, product.listedPrice.currency)} / ${unitPrice.unit}`
                              : 'Price per unit unavailable'}
                          </div>
                          <div className="source-line">
                            {product.retrievedAt ? `Retrieved ${new Date(product.retrievedAt).toLocaleString()}` : 'Retrieval timestamp unavailable'}
                          </div>
                          <ul>
                            {product.specs.map((spec) => (
                              <li key={spec}>{spec}</li>
                            ))}
                          </ul>
                          <p className="evidence-caveat">Source: {product.supplier || 'supplier unavailable'} · Availability: {product.availability || 'unavailable'}.</p>
                          {product.limitations.map((limitation) => <p key={limitation} className="evidence-caveat">{limitation}</p>)}
                          <div className="research-actions">
                            <a href={product.link} target="_blank" rel="noreferrer">View source</a>
                            <label className="compare-check">
                              <input
                                type="checkbox"
                                checked={selectedProductIds.includes(product.id)}
                                onChange={() => toggleProductComparison(product.id)}
                              />
                              Compare
                            </label>
                            <button type="button" className="primary-btn small-btn" onClick={() => addProductToQuote(product)}>
                              Add to quote
                            </button>
                          </div>
                        </div>
                      </article>
                    )
                  })}
                </div>
                {!filteredProducts.length && (
                  <div className="empty-options">
                    <h3>No sample products match this search</h3>
                    <p>Try another product or category. Live SerpApi search is not configured in this frontend prototype.</p>
                  </div>
                )}
              </div>
            )}

            {activeSidebar === 'quotations' && (
              <div className="panel">
                <div className="panel-header">
                  <h3>Saved quotations</h3>
                  <button type="button" className="primary-btn" onClick={startNewQuote}>
                    New quotation
                  </button>
                </div>
                {saveFeedback && <p className={saveFeedback.startsWith('Could not') ? 'error-message' : 'inline-success'} role="status">{saveFeedback}</p>}
                {savedQuotes.length === 0 ? (
                  <div className="empty-state">
                    <h3>No saved quotations</h3>
                    <p>Save a draft from the quotation editor and it will appear here on this device.</p>
                    <button type="button" className="primary-btn" onClick={startNewQuote}>Create a quotation</button>
                  </div>
                ) : (
                  <div className="quote-list compact">
                    {recentQuotations.concat(
                      savedQuotes.filter((savedQuote) => !recentQuotations.some((recentQuote) => recentQuote.id === savedQuote.id)),
                    ).map((savedQuote) => (
                      <article key={savedQuote.id} className="saved-quote-card">
                        <button type="button" className="saved-quote-open" onClick={() => openSavedQuote(savedQuote)}>
                          <span>
                            <strong>{savedQuote.projectTitle || 'Untitled project'} · {savedQuote.client || 'Client not set'}</strong>
                            <small>{savedQuote.updatedAt ? new Date(savedQuote.updatedAt).toLocaleString() : 'Saved locally'}</small>
                          </span>
                          <span className="quote-meta">
                            <span className="status-pill draft">{savedQuote.status || 'Draft'}</span>
                            <strong>{toCurrency(calculateQuoteTotals(savedQuote).grandTotal, savedQuote.currency)}</strong>
                          </span>
                        </button>
                        <div className="saved-quote-actions">
                          <button type="button" className="link-btn" onClick={() => duplicateSavedQuote(savedQuote)}>Duplicate</button>
                          <button
                            type="button"
                            className="link-btn danger"
                            onClick={() => {
                              if (window.confirm('Delete this local quotation draft? This cannot be undone.')) {
                                deleteSavedQuote(savedQuote.id)
                              }
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            )}

{activeSidebar === 'assistant' && (
              <div className="panel">
                <div className="panel-header">
                  <h3>AI Assistant</h3>
                </div>
                <div className="demo-notice">
                  Local prototype: no Gemma/Ollama or authenticated server is connected. Quotations generated here are draft starting points and must be reviewed before use.
                </div>
                <form className="chat-composer" onSubmit={(event) => { event.preventDefault(); generateQuoteFromPrompt() }}>
                  <label htmlFor="ai-quote-prompt">Describe the contractor's project</label>
                  <textarea
                    id="ai-quote-prompt"
                    value={aiPrompt}
                    onChange={(event) => setAiPrompt(event.target.value)}
                    placeholder="e.g. Paint and tile a 3-bedroom house in Accra, including roofing repairs and electrical work."
                    rows="5"
                  />
                  <button type="submit" className="primary-btn" disabled={!aiPrompt.trim()}>
                    Generate quotation
                  </button>
                </form>
                {aiFeedback && <p className="inline-success" role="status">{aiFeedback}</p>}
                {quote.sections.length > 0 && (
                  <div className="proposal-box">
                    <h4>Generated quotation</h4>
                    <p>{quote.projectTitle || 'Untitled project'}</p>
                    <p>{quote.sections.length} section(s) · {toCurrency(calculateQuoteTotals(quote).grandTotal, quote.currency)}</p>
                    <button type="button" className="primary-btn small-btn" onClick={() => { setQuoteTab('items'); setActiveSidebar('new-quotation') }}>
                      Open in quotation editor
                    </button>
                  </div>
                )}
              </div>
            )}

            {(activeSidebar === 'settings' || activeSidebar === 'help') && (
              <div className="panel empty-panel">
                <h3>Feature-ready workspace</h3>
                <p>
                  This BuildQuote MVP includes the core quotation workflow, material research, AI review
                  panel and export flow. The remaining modules can be extended with live billing,
                  business settings and help desk integrations.
                </p>
              </div>
            )}
          </main>
        </div>
      )}
    </>
  )
}

export default App
