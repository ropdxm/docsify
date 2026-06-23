# Project: Docsify (Working Title)

## What This Is
A B2B SaaS platform for small Kazakhstani businesses (sole proprietors / ТОО with 2–15 employees) 
that need to get paid faster. Not an "EDO system" - a "get paid" tool.

Core loop: create document → send to client → client signs → track payment status.

Target time: 2 minutes from "work done" to "invoice sent".

## The Problem We Solve
Small businesses in Kazakhstan lose 7–14 days per invoice cycle because:
- They manually type client details into Word every time
- They send PDFs via WhatsApp and lose track
- They don't know if the client has seen, signed, or is about to pay
- Chasing payment requires manual follow-up calls/messages

### Explicitly Out of Scope for Month 1
- E-signature (NCA Layer, eGov Mobile) - Month 2
- Automated payment reminders (SMS/email) - Month 2
- Integrations (1C, Kaspi, bank APIs) - Month 3+
- Multi-user / team accounts - Month 3+

## Key Pages / Routes
## BIN Auto-fill Logic
When user types a 12-digit BIN into any BIN field:
1. Call KGD taxpayer search API
2. If found: auto-fill name, director, address fields (non-editable, shown as verified)
3. If not found: show error "Company not found in KGD registry"
4. Show a small "✓ Verified" badge next to auto-filled company name

## PDF Generation
- Use a Next.js API route: GET /api/documents/[id]/pdf
- Render an HTML template server-side with the document data
- Use Puppeteer (via puppeteer-core) or a lightweight HTML-to-PDF service
- Store generated PDF in Firebase Storage
- Return a signed download URL
- PDF layout must match official Казахстан Минфин форм layouts

## Document Numbering
Auto-generate document numbers:
- Invoice: СФ-{YYYY}-{NNN} (e.g. СФ-2025-001)
- AVR: АВР-{YYYY}-{NNN}
- Increment per company, not globally

## Public Share Link
- Route: /p/[shareToken]
- No authentication required
- Shows: document details, company info, line items, total, status
- Has a "Download PDF" button
- Has a placeholder "Sign document" button (disabled in Month 1, active in Month 2)
- shareToken is a random 16-char alphanumeric string, generated on document creation

## Dashboard Logic
The dashboard is the most important screen. It must answer:
"How much money do I have outstanding right now?"

Show three summary cards at the top:
1. Awaiting payment - sum of all documents in status 'sent' or 'signed'
2. Overdue - sum of documents in 'sent' status older than 14 days
3. Paid this month - sum of documents marked 'paid' in current calendar month

Below: document list sorted by updatedAt desc, with:
- Client name
- Document type + number
- Amount in ₸
- Status badge (color-coded)
- "..." actions menu (mark as paid, copy link, download PDF)

## UX Principles (enforce throughout)
- No EDO jargon anywhere in the UI. Use plain language:
  - ❌ "Создать ЮЗЭДО маршрут"  → ✅ "Отправить счёт"
  - ❌ "Статус легитимации"      → ✅ "Ожидает оплаты"
  - ❌ "Контрагент"              → ✅ "Клиент"
- Every action must be completable in under 3 clicks from the dashboard
- Russian-language UI (Kazakhstan market)
- All monetary amounts in тенге (₸), formatted with spaces: 1 250 000 ₸
- Dates in DD.MM.YYYY format

## What Success Looks Like at End of Month 1
- A real business owner can go from zero to "invoice sent to client" in under 5 minutes
- The dashboard clearly shows how much money is outstanding
- PDF output looks professional enough that a client won't question it
- 5 real businesses (not friends, not test accounts) have sent at least one document