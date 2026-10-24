const toCents = (value) => {
  const amount = Number(value)
  return Number.isFinite(amount) ? Math.round((amount + Number.EPSILON) * 100) : 0
}

export const calculateLineTotal = (item = {}) => {
  const quantity = Number(item?.quantity)
  const unitPrice = Number(item?.unitPrice)
  const safeQuantity = Number.isFinite(quantity) ? quantity : 0
  const safeUnitPrice = Number.isFinite(unitPrice) ? unitPrice : 0
  return (
    toCents(safeQuantity * safeUnitPrice) +
    toCents(item?.labourCost) +
    toCents(item?.materialCost)
  ) / 100
}

export const calculateSectionTotal = (section) =>
  (Array.isArray(section?.items)
    ? section.items.reduce((sum, item) => sum + toCents(calculateLineTotal(item)), 0)
    : 0) / 100

export const calculateQuoteTotals = (quote = {}) => {
  const subtotalCents = (Array.isArray(quote?.sections) ? quote.sections : []).reduce(
    (sum, section) => sum + Math.round(calculateSectionTotal(section) * 100),
    0,
  )
  const taxRateValue = Number(quote?.taxRate)
  const taxRate = Number.isFinite(taxRateValue) ? taxRateValue : 0
  const taxCents = Math.round(subtotalCents * (taxRate / 100))

  return {
    sectionTotal: subtotalCents / 100,
    taxValue: taxCents / 100,
    grandTotal: (subtotalCents + taxCents) / 100,
  }
}

export const validateQuotation = (quote = {}) => {
  const errors = []
  const requiredFields = [
    ['client', 'Client or company name'],
    ['projectTitle', 'Project title'],
    ['location', 'Project location'],
    ['contractor', 'Contractor business information'],
  ]

  for (const [field, label] of requiredFields) {
    if (typeof quote?.[field] !== 'string' || !quote[field].trim()) {
      errors.push(`${label} is required.`)
    }
  }

  const taxRate = Number(quote?.taxRate)
  if (quote?.taxRate === '' || !Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) {
    errors.push('Tax rate must be a number between 0 and 100%.')
  }

  if (!Array.isArray(quote?.sections) || quote.sections.length === 0) {
    errors.push('Add at least one work section.')
    return errors
  }

  for (const section of quote.sections) {
    const sectionName = typeof section?.name === 'string' ? section.name.trim() : ''
    const sectionLabel = sectionName || 'A work section'
    if (!sectionName) errors.push('Every work section needs a name.')
    if (!Array.isArray(section?.items) || !section.items.length) {
      errors.push(`${sectionLabel} needs at least one line item.`)
      continue
    }

    for (const item of section.items) {
      const description = typeof item?.description === 'string' ? item.description.trim() : ''
      if (!description) {
        errors.push(`${sectionLabel} has a line item without a description.`)
      }
      for (const [field, label] of [
        ['quantity', 'Quantity'],
        ['unitPrice', 'Unit price'],
        ['labourCost', 'Labour cost'],
        ['materialCost', 'Material cost'],
      ]) {
        const value = item?.[field]
        if (value === '' || (typeof value === 'string' && !value.trim()) || value === null || value === undefined || !Number.isFinite(Number(value)) || Number(value) < 0) {
          errors.push(`${label} for "${description || 'an item'}" must be a non-negative number.`)
        }
      }
    }
  }

  return [...new Set(errors)]
}

export const getEvidenceStatusLabel = (status = 'unverified') => {
  const normalized = String(status || 'unverified').trim().toLowerCase()
  if (normalized === 'confirmed-by-contractor') return 'Confirmed by contractor'
  if (normalized === 'contractor-entered') return 'Contractor-entered rate'
  if (normalized === 'estimated') return 'Estimated'
  if (normalized === 'sourced-listing') return 'Sourced listing'
  return 'Unverified'
}

export const getUnitPriceFromListing = (listedPrice) => {
  const amount = Number(listedPrice?.amount)
  const packageQuantity = Number(listedPrice?.packageQuantity)
  const unit = listedPrice?.packageUnit ? String(listedPrice.packageUnit).trim() : ''

  if (!Number.isFinite(amount) || !Number.isFinite(packageQuantity) || packageQuantity <= 0 || !unit) {
    return null
  }

  return {
    amount: amount / packageQuantity,
    unit,
  }
}

const quoteValuesEqual = (left, right) => JSON.stringify(left ?? null) === JSON.stringify(right ?? null)

export const validateProposedChange = (change, currentQuote) => {
  if (!change || !currentQuote || change.quoteId !== currentQuote.id || !Array.isArray(change.changes) || !change.changes.length) {
    return 'This proposal is invalid or belongs to a different quotation.'
  }

  const allowedFields = new Set([
    'description',
    'quantity',
    'unit',
    'unitPrice',
    'labourCost',
    'materialCost',
    'notes',
    'materialEvidence',
  ])

  for (const fieldChange of change.changes) {
    if (!allowedFields.has(fieldChange.field)) return 'The proposal contains an unsupported field.'
    if (fieldChange.field === 'materialEvidence') {
      if (!fieldChange.proposedValue || typeof fieldChange.proposedValue !== 'object') {
        return 'The proposed price evidence is invalid.'
      }
    } else if (['quantity', 'unitPrice', 'labourCost', 'materialCost'].includes(fieldChange.field)) {
      if (!Number.isFinite(fieldChange.proposedValue) || fieldChange.proposedValue < 0) {
        return 'Proposed quantity and prices must be valid non-negative numbers.'
      }
    } else if (typeof fieldChange.proposedValue !== 'string') {
      return 'The proposed text value is invalid.'
    }

    const section = Array.isArray(currentQuote.sections)
      ? currentQuote.sections.find((entry) => entry.id === change.sectionId)
      : null
    const item = section?.items?.find((entry) => entry.id === change.itemId)
    if (!item || !quoteValuesEqual(item[fieldChange.field], fieldChange.previousValue)) {
      return 'The quotation changed after this proposal was created. Review a fresh proposal before applying it.'
    }
  }

  return null
}

export const buildProductEvidenceSnapshot = (product = {}) => {
  const listedPrice = product?.listedPrice || null
  const packageSize = listedPrice
    ? {
        quantity: Number(listedPrice.packageQuantity) || null,
        unit: listedPrice.packageUnit || null,
      }
    : null

  return {
    productName: product.product || null,
    brand: product.brand || null,
    listedPrice,
    unitPrice: getUnitPriceFromListing(listedPrice),
    packageSize,
    supplier: product.supplier || null,
    sourceUrl: product.link || null,
    retrievedAt: product.retrievedAt || null,
    specifications: Array.isArray(product.specs) ? product.specs : [],
    availability: product.availability || null,
    limitations: Array.isArray(product.limitations) ? product.limitations : [],
    evidenceType: product.evidenceType || 'sourced-listing',
    priceStatus: product.priceStatus || 'unverified',
    priceBasis: product.priceBasis || 'sourced-listing',
    confirmedAt: product.confirmedAt || null,
    sourceName: product.sourceName || product.supplier || 'Source unavailable',
  }
}
