import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { calculateLineTotal, calculateQuoteTotals, calculateSectionTotal } from './quoteCalculations.js'

const money = (value, currency) => `${currency === 'USD' ? 'USD' : 'GHS'} ${Number(value || 0).toFixed(2)}`
const text = (value, fallback = 'Not provided') =>
  typeof value === 'string' && value.trim() ? value.trim() : fallback

export const formatQuotationDate = (value) => {
  const date = value ? new Date(value) : new Date()
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleDateString('en-GB')
}

export const getQuotationValidityDate = (generatedAt, validity) => {
  const issueDate = generatedAt ? new Date(generatedAt) : new Date()
  if (Number.isNaN(issueDate.getTime())) return null
  const match = String(validity || '').match(/(\d+)\s*days?/i)
  if (!match) return null
  const validUntil = new Date(issueDate)
  validUntil.setDate(validUntil.getDate() + Number(match[1]))
  return validUntil
}

const itemEvidence = (item) => {
  const evidence = item.materialEvidence
  if (!evidence) {
    return item.priceConfirmation?.status === 'confirmed-by-contractor'
      ? `Rate independently confirmed ${formatQuotationDate(item.priceConfirmation.confirmedAt)}`
      : 'Contractor-entered rate; confirmation not recorded'
  }

  const details = [
    `Price evidence: ${evidence.priceStatus === 'confirmed-by-contractor' ? 'confirmed by contractor' : 'sourced listing, unverified'}`,
    `Product: ${text(evidence.productName)}`,
    `Brand: ${text(evidence.brand, 'Unavailable')}`,
    `Listed price: ${evidence.listedPrice
      ? `${money(evidence.listedPrice.amount, evidence.listedPrice.currency)} / ${evidence.listedPrice.packageQuantity || '?'} ${evidence.listedPrice.packageUnit || 'package'}`
      : 'Unavailable'}`,
    `Supplier: ${text(evidence.supplier, 'Unavailable')}`,
    `Retrieved: ${formatQuotationDate(evidence.retrievedAt)}`,
    `Availability: ${text(evidence.availability, 'Unavailable')}`,
  ]
  if (evidence.confirmedAt) details.push(`Contractor confirmation: ${formatQuotationDate(evidence.confirmedAt)}`)
  if (evidence.sourceUrl) details.push(`Source: ${evidence.sourceUrl}`)
  if (evidence.specifications?.length) details.push(`Specifications: ${evidence.specifications.join('; ')}`)
  if (evidence.limitations?.length) details.push(`Limitations: ${evidence.limitations.join('; ')}`)
  return details.join('\n')
}

const quotationRows = (quote) => {
  const rows = []
  for (const section of quote.sections || []) {
    rows.push({
      section: true,
      description: text(section?.name, 'Work section'),
      quantity: '',
      rate: '',
      labour: '',
      materials: '',
      total: '',
    })
    for (const item of section?.items || []) {
      rows.push({
        description: [
          text(item?.description, 'Unspecified work item'),
          item?.notes ? `Notes: ${item.notes}` : '',
          itemEvidence(item || {}),
        ].filter(Boolean).join('\n'),
        quantity: `${Number(item?.quantity) || 0} ${text(item?.unit, '')}`.trim(),
        rate: money(item?.unitPrice, quote.currency),
        labour: money(item?.labourCost, quote.currency),
        materials: money(item?.materialCost, quote.currency),
        total: money(calculateLineTotal(item), quote.currency),
      })
    }
    rows.push({
      subtotal: true,
      description: 'Section subtotal',
      quantity: '',
      rate: '',
      labour: '',
      materials: '',
      total: money(calculateSectionTotal(section), quote.currency),
    })
  }
  return rows
}

export const createQuotationPdf = (quote, generatedAt = new Date()) => {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const margin = 15
  const right = pageWidth - margin
  const currency = quote.currency === 'USD' ? 'USD' : 'GHS'
  const totals = calculateQuoteTotals(quote)
  const quoteId = text(quote.id, 'Draft')
  const generationDate = formatQuotationDate(generatedAt)
  const validUntil = getQuotationValidityDate(generatedAt, quote.validity)
  const optionLabel = text(quote.optionName, '')

  pdf.setProperties({
    title: `Quotation - ${text(quote.projectTitle, 'Untitled project')}`,
    subject: `BuildQuote quotation ${quoteId}`,
    author: text(quote.contractor, 'BuildQuote'),
    creator: 'BuildQuote',
  })

  pdf.setFillColor(37, 99, 235)
  pdf.rect(0, 0, pageWidth, 5, 'F')
  pdf.setTextColor(15, 23, 42)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(22)
  pdf.text('BUILDQUOTE', margin, 17)
  pdf.setFontSize(9)
  pdf.setTextColor(71, 85, 105)
  pdf.text('CONSTRUCTION QUOTATION', margin, 23)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(10)
  pdf.setTextColor(37, 99, 235)
  pdf.text(text(quote.status, 'Draft').toUpperCase(), right, 17, { align: 'right' })
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(71, 85, 105)
  pdf.text(
    optionLabel
      ? `Quote ${quoteId}  |  ${optionLabel} option  |  ${generationDate}`
      : `Quote ${quoteId}  |  ${generationDate}`,
    right,
    23,
    { align: 'right' },
  )
  pdf.setDrawColor(226, 232, 240)
  pdf.line(margin, 29, right, 29)

  const details = [
    ['Prepared by', text(quote.contractor)],
    ['Prepared for', text(quote.client)],
    ['Project', text(quote.projectTitle)],
    ['Location', text(quote.location)],
    ['Client contact', text(quote.contact, 'Not provided')],
    ['Issue date', generationDate],
    ['Valid for', text(quote.validity, 'Not specified')],
    ['Valid until', validUntil ? formatQuotationDate(validUntil) : 'Confirm with contractor'],
  ]
  const columnGap = 12
  const detailColumnWidth = (right - margin - columnGap) / 2
  let detailY = 36
  for (let index = 0; index < details.length; index += 2) {
    let rowHeight = 10
    for (let column = 0; column < 2 && index + column < details.length; column += 1) {
      const [label, value] = details[index + column]
      const x = margin + column * (detailColumnWidth + columnGap)
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(8)
      pdf.setTextColor(100, 116, 139)
      pdf.text(label.toUpperCase(), x, detailY)
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(9)
      pdf.setTextColor(15, 23, 42)
      const wrapped = pdf.splitTextToSize(value, detailColumnWidth)
      pdf.text(wrapped, x, detailY + 5)
      rowHeight = Math.max(rowHeight, 5 + wrapped.length * 4)
    }
    detailY += rowHeight + 4
  }

  if (quote.description?.trim()) {
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(9)
    pdf.setTextColor(15, 23, 42)
    pdf.text('PROJECT DESCRIPTION', margin, detailY)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)
    pdf.setTextColor(51, 65, 85)
    const descriptionLines = pdf.splitTextToSize(quote.description.trim(), right - margin)
    pdf.text(descriptionLines, margin, detailY + 5)
    detailY += 8 + descriptionLines.length * 4
  }

  const rows = quotationRows(quote)
  autoTable(pdf, {
    startY: detailY + 2,
    margin: { left: margin, right: margin, top: 14, bottom: 18 },
    head: [['Work description / price evidence', 'Qty / unit', 'Rate', 'Labour', 'Materials', 'Line total']],
    body: rows.map((row) => [
      row.description,
      row.quantity,
      row.rate,
      row.labour,
      row.materials,
      row.total,
    ]),
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 7,
      cellPadding: 2.2,
      overflow: 'linebreak',
      textColor: [51, 65, 85],
      lineColor: [226, 232, 240],
      lineWidth: 0.15,
      valign: 'top',
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7,
    },
    columnStyles: {
      0: { cellWidth: 72 },
      1: { cellWidth: 18 },
      2: { cellWidth: 22, halign: 'right' },
      3: { cellWidth: 20, halign: 'right' },
      4: { cellWidth: 20, halign: 'right' },
      5: { cellWidth: 25, halign: 'right' },
    },
    rowPageBreak: 'avoid',
    didParseCell(data) {
      const row = rows[data.row.index]
      if (data.section === 'body' && row?.section) {
        data.cell.styles.fillColor = [239, 246, 255]
        data.cell.styles.textColor = [30, 64, 175]
        data.cell.styles.fontStyle = 'bold'
      } else if (data.section === 'body' && row?.subtotal) {
        data.cell.styles.fillColor = [248, 250, 252]
        data.cell.styles.fontStyle = 'bold'
      }
    },
  })

  let summaryY = pdf.lastAutoTable.finalY + 10
  const pageHeight = pdf.internal.pageSize.getHeight()
  if (summaryY + 42 > pageHeight - 16) {
    pdf.addPage()
    summaryY = 20
  }
  const summaryWidth = 76
  const summaryX = right - summaryWidth
  pdf.setFillColor(248, 250, 252)
  pdf.setDrawColor(226, 232, 240)
  pdf.roundedRect(summaryX, summaryY, summaryWidth, 34, 2, 2, 'FD')
  const summaryRows = [
    ['Subtotal', money(totals.sectionTotal, currency)],
    [`Tax (${Number(quote.taxRate) || 0}%)`, money(totals.taxValue, currency)],
    ['TOTAL', money(totals.grandTotal, currency)],
  ]
  summaryRows.forEach(([label, value], index) => {
    const y = summaryY + 8 + index * 9
    pdf.setFont('helvetica', index === 2 ? 'bold' : 'normal')
    pdf.setFontSize(index === 2 ? 10 : 8)
    pdf.setTextColor(index === 2 ? 15 : 71, index === 2 ? 23 : 85, index === 2 ? 42 : 105)
    pdf.text(label, summaryX + 4, y)
    pdf.text(value, right - 4, y, { align: 'right' })
  })

  let notesY = summaryY + 42
  const noteSections = [
    ['PAYMENT TERMS', quote.paymentTerms],
    ['NOTES, EXCLUSIONS & ASSUMPTIONS', quote.notes],
  ].filter(([, value]) => typeof value === 'string' && value.trim())
  for (const [heading, content] of noteSections) {
    const lines = pdf.splitTextToSize(content.trim(), right - margin)
    const blockHeight = 9 + lines.length * 4
    if (notesY + blockHeight > pageHeight - 15) {
      pdf.addPage()
      notesY = 20
    }
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(8)
    pdf.setTextColor(15, 23, 42)
    pdf.text(heading, margin, notesY)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(8)
    pdf.setTextColor(51, 65, 85)
    pdf.text(lines, margin, notesY + 5)
    notesY += blockHeight
  }

  const acceptHeight = 58
  if (notesY + acceptHeight > pageHeight - 16) {
    pdf.addPage()
    notesY = 20
  }
  pdf.setDrawColor(226, 232, 240)
  pdf.setFillColor(248, 250, 252)
  pdf.roundedRect(margin, notesY, right - margin, 52, 2, 2, 'FD')
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(9)
  pdf.setTextColor(15, 23, 42)
  pdf.text('ACCEPTANCE AND SIGNATURES', margin + 4, notesY + 7)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(7.5)
  pdf.setTextColor(51, 65, 85)
  pdf.text(
    pdf.splitTextToSize(
      'By signing, the client accepts this quotation as presented, including the itemised work, stated terms, exclusions and assumptions. Totals were calculated from quotation line items, not from AI-generated figures. Verify applicable tax rules for this project before relying on the tax amount.',
      right - margin - 8,
    ),
    margin + 4,
    notesY + 13,
  )
  const signatureY = notesY + 30
  const signatureWidth = (right - margin - 12) / 2
  const signatureColumns = [
    ['Client acceptance', text(quote.client, 'Client name')],
    ['Contractor confirmation', text(quote.contractor, 'Contractor name')],
  ]
  signatureColumns.forEach(([heading, name], index) => {
    const x = margin + 4 + index * (signatureWidth + 8)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(8)
    pdf.setTextColor(15, 23, 42)
    pdf.text(heading, x, signatureY)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(8)
    pdf.setTextColor(71, 85, 105)
    pdf.text(`Name: ${name}`, x, signatureY + 6)
    pdf.text('Signature: ________________________', x, signatureY + 13)
    pdf.text('Date: ____________________________', x, signatureY + 20)
  })

  const pageCount = pdf.internal.getNumberOfPages()
  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    pdf.setPage(pageNumber)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(8)
    pdf.setTextColor(100, 116, 139)
    pdf.text(`BuildQuote  |  ${quoteId}`, margin, pageHeight - 8)
    pdf.text(`Page ${pageNumber} of ${pageCount}`, right, pageHeight - 8, { align: 'right' })
  }

  return pdf
}

export const getQuotationPdfFilename = (quote) => {
  const slug = text(quote.projectTitle, 'quotation')
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'quotation'
  return `BuildQuote-${slug}-${text(quote.id, 'draft').replace(/[^\w.-]+/g, '-')}.pdf`
}
