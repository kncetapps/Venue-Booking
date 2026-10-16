// Shared PDF building blocks: letterhead, report export, booking confirmation copy.
import { COLLEGE } from './college'
import { STATUS, fmtDate, fmtDateLong, fmtRange } from './format'

let logoCache = null
async function logoDataUrl() {
  if (logoCache) return logoCache
  const blob = await fetch(COLLEGE.logo).then((r) => r.blob())
  logoCache = await new Promise((res) => {
    const fr = new FileReader()
    fr.onload = () => res(fr.result)
    fr.readAsDataURL(blob)
  })
  return logoCache
}

async function libs() {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  return { jsPDF, autoTable }
}

/** Draws the letterhead at the top of the current page; returns the y just below it. */
export async function drawLetterhead(doc, top = 28) {
  const W = doc.internal.pageSize.getWidth()
  const margin = 36
  const logo = await logoDataUrl()
  const logoH = 70
  const logoW = logoH * (184 / 328)
  doc.addImage(logo, 'PNG', margin + 6, top, logoW, logoH)

  const portrait = W < 700
  const cx = W / 2 + (portrait ? 22 : 10)
  let y = top + 12
  doc.setTextColor(17, 24, 39)
  doc.setFont('times', 'bold'); doc.setFontSize(portrait ? 13.2 : 14.5)
  doc.text(COLLEGE.name, cx, y, { align: 'center' })
  y += 15
  doc.setFontSize(11)
  doc.text(COLLEGE.status, cx, y, { align: 'center' })
  doc.setFont('times', 'normal'); doc.setFontSize(portrait ? 9.5 : 10)
  for (const line of COLLEGE.lines) { y += 12.5; doc.text(line, cx, y, { align: 'center' }) }
  y += 12.5
  doc.setFont('times', 'bold'); doc.setFontSize(portrait ? 9.5 : 10)
  doc.text(COLLEGE.address.replace('–', '-'), cx, y, { align: 'center' })

  y = Math.max(y, top + logoH) + 9
  doc.setDrawColor(30, 58, 138); doc.setLineWidth(1.4)
  doc.line(margin, y, W - margin, y)
  doc.setLineWidth(0.4)
  doc.line(margin, y + 2.5, W - margin, y + 2.5)
  doc.setTextColor(0, 0, 0)
  return y + 14
}

function footer(doc, left) {
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(100, 116, 139)
  doc.text(left, 36, H - 20)
  doc.text(`Page ${doc.getCurrentPageInfo().pageNumber}`, W - 36, H - 20, { align: 'right' })
  doc.setTextColor(0, 0, 0)
}

/** Report PDF: letterhead on every page, booking table, summary page. */
export async function exportReportPdf({ filterText, rows, totals, summaries, fileName }) {
  const { jsPDF, autoTable } = await libs()
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const generated = `Generated ${new Date().toLocaleString('en-IN')}`

  const titleBlock = (y) => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13)
    doc.text('VENUE BOOKING REPORT', W / 2, y + 4, { align: 'center' })
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
    doc.text(filterText, W / 2, y + 19, { align: 'center' })
    doc.text(totals, W / 2, y + 31, { align: 'center' })
    return y + 42
  }

  let y = await drawLetterhead(doc)
  y = titleBlock(y)
  const head = [['#', 'Date', 'Time', 'Hall', 'Dept', 'Event type', 'Title', 'In-charge', 'Entered by', 'Status', 'Ref no']]
  const pagesWithHeader = new Set([1])
  autoTable(doc, {
    startY: y,
    head,
    body: rows,
    margin: { top: 150, left: 36, right: 36, bottom: 36 },
    styles: { fontSize: 7.8, cellPadding: 3.5, valign: 'middle' },
    headStyles: { fillColor: [30, 58, 138], fontSize: 8 },
    alternateRowStyles: { fillColor: [241, 245, 249] },
    columnStyles: { 0: { cellWidth: 20 }, 6: { cellWidth: 140 } },
    didDrawPage: () => {
      const p = doc.getCurrentPageInfo().pageNumber
      if (!pagesWithHeader.has(p)) pagesWithHeader.add(p)
      footer(doc, generated)
    },
  })
  // Letterhead on continuation pages (drawn after the table so it sits in the reserved top margin)
  const tablePages = doc.getNumberOfPages()
  for (let p = 2; p <= tablePages; p++) {
    doc.setPage(p)
    await drawLetterhead(doc)
  }

  // Summary page
  doc.addPage()
  let sy = await drawLetterhead(doc)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12)
  doc.text('SUMMARY', W / 2, sy + 4, { align: 'center' })
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
  doc.text(filterText, W / 2, sy + 19, { align: 'center' })
  sy += 32
  const colW = (W - 72 - 40) / 3
  summaries.forEach((s, i) => {
    autoTable(doc, {
      startY: sy,
      head: [[s.title, 'Bookings', 'Hours']],
      body: s.items,
      styles: { fontSize: 8.5 },
      headStyles: { fillColor: [30, 58, 138] },
      tableWidth: colW,
      margin: { left: 36 + i * (colW + 20) },
    })
  })
  footer(doc, generated)
  doc.save(fileName)
}

/** Official confirmation copy for an approved booking. `b` is a booking_calendar row. */
export async function downloadConfirmation(b, settings) {
  const { jsPDF, autoTable } = await libs()
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  let y = await drawLetterhead(doc)

  doc.setFont('helvetica', 'bold'); doc.setFontSize(14)
  doc.text('VENUE BOOKING CONFIRMATION', W / 2, y + 10, { align: 'center' })
  y += 30

  doc.setFontSize(10)
  doc.text(`Ref. No: ${b.ref_no || '—'}`, 36, y)
  const issued = b.approved_at ? new Date(b.approved_at) : new Date()
  doc.setFont('helvetica', 'normal')
  doc.text(`Date: ${issued.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`, W - 36, y, { align: 'right' })
  y += 18

  const isApproved = b.status === 'approved'
  if (!isApproved) {
    doc.setTextColor(190, 18, 60); doc.setFont('helvetica', 'bold')
    doc.text(`STATUS: ${(STATUS[b.status]?.label || b.status).toUpperCase()} — not a valid confirmation`, W / 2, y, { align: 'center' })
    doc.setTextColor(0, 0, 0); doc.setFont('helvetica', 'normal')
    y += 16
  }

  doc.setFontSize(10)
  const intro = doc.splitTextToSize(
    `This is to confirm that the following venue has been booked for the event mentioned below. The booking has been approved by the administration.`,
    W - 72,
  )
  doc.text(intro, 36, y)
  y += intro.length * 13 + 6

  const venue = b.venue_location && b.venue_location !== b.venue_name ? `${b.venue_name} (${b.venue_location})` : b.venue_name
  const rows = [
    ['Venue', venue],
    ['Date', fmtDateLong(b.booking_date)],
    ['Time', fmtRange(b.start_time, b.end_time)],
    ['Department', b.department],
    ['Event type', b.event_type],
    ['Event title', b.title],
    b.details && ['Description', b.details],
    ['Faculty in-charge', b.faculty_name],
    ['Contact', `${b.faculty_phone}  ·  ${b.faculty_email}`],
    b.participants && ['Expected participants', String(b.participants)],
    b.requirements && ['Special requirements', b.requirements],
    ['Entered by', `${b.booked_by_name || '—'}${b.booked_by_dept ? ` (${b.booked_by_dept})` : ''}${b.booked_by_email ? ` — ${b.booked_by_email}` : ''}`],
    ['Requested on', new Date(b.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })],
    b.admin_remark && ['Admin remarks', b.admin_remark],
  ].filter(Boolean)

  autoTable(doc, {
    startY: y,
    body: rows,
    theme: 'grid',
    styles: { fontSize: 10, cellPadding: 6, lineColor: [203, 213, 225], lineWidth: 0.5, textColor: [15, 23, 42] },
    columnStyles: { 0: { cellWidth: 150, fontStyle: 'bold', fillColor: [241, 245, 249] } },
    margin: { left: 36, right: 36 },
  })
  y = doc.lastAutoTable.finalY + 26

  doc.setFontSize(9.5)
  const notes = doc.splitTextToSize(
    'Please keep the venue in good condition and vacate it on time. Any change or cancellation must be requested through the Venue Booking portal.',
    W - 72,
  )
  doc.text(notes, 36, y)
  y += notes.length * 12 + 40

  // Signature block
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10)
  doc.text(isApproved ? `Approved by: ${b.approved_by_name || 'Admin'}` : '', W - 36, y, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  if (b.approved_at) doc.text(new Date(b.approved_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }), W - 36, y + 13, { align: 'right' })
  doc.setFont('helvetica', 'bold')
  doc.text(settings?.signature_line || `Approved by Admin, ${COLLEGE.shortName}`, W - 36, y + 30, { align: 'right' })

  doc.setFont('helvetica', 'italic'); doc.setFontSize(8); doc.setTextColor(100, 116, 139)
  doc.text('This is a computer-generated confirmation from the KNCET Venue Booking portal.', W / 2, H - 28, { align: 'center' })

  doc.save(`Venue-Confirmation-${b.ref_no || b.id}.pdf`)
}

export const reportRow = (b, i) => [
  i + 1,
  fmtDate(b.booking_date),
  fmtRange(b.start_time, b.end_time),
  b.venue_name,
  b.department,
  b.event_type,
  b.title,
  b.faculty_name,
  b.booked_by_name || '',
  STATUS[b.status]?.label || b.status,
  b.ref_no || '',
]
