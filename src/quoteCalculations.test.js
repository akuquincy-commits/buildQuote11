import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildProductEvidenceSnapshot,
  calculateLineTotal,
  calculateQuoteTotals,
  calculateSectionTotal,
  getEvidenceStatusLabel,
  getUnitPriceFromListing,
  validateQuotation,
} from './quoteCalculations.js'

const validQuote = {
  client: 'Client Ltd.',
  projectTitle: 'Bathroom renovation',
  location: 'Accra',
  contractor: 'Builder Ltd.',
  taxRate: 5,
  sections: [
    {
      name: 'Tiling',
      items: [
        {
          description: 'Floor tiles',
          quantity: 2.5,
          unitPrice: 10.1,
          labourCost: 1.25,
          materialCost: 3.5,
        },
      ],
    },
  ],
}

test('calculates line totals using quantity rate plus labour and material costs', () => {
  assert.equal(calculateLineTotal(validQuote.sections[0].items[0]), 30)
})

test('rounds tax to cents on the subtotal and returns consistent totals', () => {
  const quote = {
    ...validQuote,
    sections: [{ name: 'Work', items: [{ description: 'One', quantity: 1, unitPrice: 0.1, labourCost: 0, materialCost: 0 }] }],
    taxRate: 7.5,
  }
  assert.equal(calculateSectionTotal(quote.sections[0]), 0.1)
  assert.deepEqual(calculateQuoteTotals(quote), {
    sectionTotal: 0.1,
    taxValue: 0.01,
    grandTotal: 0.11,
  })
})

test('validates required details and non-negative numeric values', () => {
  assert.deepEqual(validateQuotation(validQuote), [])
  const invalidQuote = {
    ...validQuote,
    client: ' ',
    taxRate: 101,
    sections: [{ name: '', items: [{ description: '', quantity: -1, unitPrice: 'bad', labourCost: 0, materialCost: 0 }] }],
  }
  const errors = validateQuotation(invalidQuote)
  assert.ok(errors.some((error) => error.includes('Client or company name is required')))
  assert.ok(errors.some((error) => error.includes('Tax rate')))
  assert.ok(errors.some((error) => error.includes('Quantity')))
  assert.ok(errors.some((error) => error.includes('Unit price')))
})

test('requires at least one work section', () => {
  assert.ok(validateQuotation({ ...validQuote, sections: [] }).includes('Add at least one work section.'))
})

test('calculates each line at cent precision without mutating quotation values', () => {
  const item = { description: 'Paint', quantity: 3, unitPrice: 0.1, labourCost: 0.2, materialCost: 0.3 }
  const original = { ...item }
  assert.equal(calculateLineTotal(item), 0.8)
  assert.deepEqual(item, original)
})

test('handles malformed stored quotation data without crashing calculations or validation', () => {
  const malformedQuote = {
    taxRate: 'invalid',
    sections: [null, { name: '', items: [null, { description: 'Incomplete', quantity: '', unitPrice: -2 }] }],
  }

  assert.deepEqual(calculateQuoteTotals(malformedQuote), {
    sectionTotal: 0,
    taxValue: 0,
    grandTotal: 0,
  })
  const errors = validateQuotation(malformedQuote)
  assert.ok(errors.some((error) => error.includes('Tax rate')))
  assert.ok(errors.some((error) => error.includes('Every work section needs a name')))
  assert.ok(errors.some((error) => error.includes('Quantity')))
  assert.ok(errors.some((error) => error.includes('Unit price')))
})

test('normalizes evidence labels and per-unit values for product comparisons', () => {
  assert.equal(getEvidenceStatusLabel('confirmed-by-contractor'), 'Confirmed by contractor')
  assert.deepEqual(getUnitPriceFromListing({ amount: 400, packageQuantity: 5, packageUnit: 'L' }), {
    amount: 80,
    unit: 'L',
  })
  assert.equal(getUnitPriceFromListing({ amount: 400, packageQuantity: 0, packageUnit: 'L' }), null)
})

test('builds a product evidence snapshot with source metadata and price status', () => {
  const snapshot = buildProductEvidenceSnapshot({
    product: 'Midas Premium Emulsion',
    brand: 'Midas',
    supplier: 'Midas Paints',
    link: 'https://example.com',
    listedPrice: { amount: 390, currency: 'GHS', packageQuantity: 5, packageUnit: 'L' },
    specs: ['Interior use', 'Washable finish'],
    availability: 'Stock status not verified',
    limitations: ['Development sample only'],
    retrievedAt: '2026-10-12T10:00:00.000Z',
    priceStatus: 'unverified',
  })

  assert.equal(snapshot.productName, 'Midas Premium Emulsion')
  assert.equal(snapshot.sourceName, 'Midas Paints')
  assert.equal(snapshot.priceStatus, 'unverified')
  assert.deepEqual(snapshot.unitPrice, { amount: 78, unit: 'L' })
  assert.deepEqual(snapshot.specifications, ['Interior use', 'Washable finish'])
})

test('handles an absent quotation as invalid instead of throwing', () => {
  assert.deepEqual(calculateQuoteTotals(null), {
    sectionTotal: 0,
    taxValue: 0,
    grandTotal: 0,
  })
  assert.ok(validateQuotation(null).includes('Add at least one work section.'))
})
