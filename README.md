# Docsify

Docsify is a document workspace for Kazakhstan businesses. It helps users create, send, sign, and track common business documents without assembling them manually in Word or Excel.

## What It Does

- Creates invoices, acts of completed work, накладные, and договоры.
- Exports documents to XLSX and PDF using prepared templates.
- Generates public client links for viewing and downloading documents.
- Tracks document statuses: draft, sent, signed, and paid.
- Supports incoming договоры that need the user's signature.
- Signs договоры through NCALayer / ЭЦП workflows.
- Stores company requisites, bank requisites, and multiple bank profiles with one primary profile.
- Looks up counterparties by БИН/ИИН through KGD integration when configured.
- Imports Goszakupki contracts into AVR and nakladnaja drafts when configured.
- Saves counterparties and reused document data for faster repeat work.
- Supports email/password and Google login through Supabase Auth.
- Includes Stripe subscription plumbing and Amplitude analytics hooks.

## Main Flows

1. A user signs in.
2. They create a document from the dashboard.
3. If company or bank requisites are missing, the app asks for them on the document creation page.
4. The user fills client data, document items, and bank profile.
5. The document can be saved as a draft, sent by link, downloaded as XLSX/PDF, signed, or marked as paid.

## Tech Stack

- Next.js 16
- React 19
- Supabase Auth and database
- ExcelJS for XLSX generation
- React PDF for PDF generation
- NCALayer integration for ЭЦП signing
- Stripe for subscriptions
- Amplitude for analytics
- Tailwind CSS

## Local Setup

Install dependencies:

```bash
npm install
```

Create `.env.local` and add the values needed for your environment:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

KGD_API_X_TOKEN=
GOSZAKUPKI_API_TOKEN=
NCANODE_URL=

STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

NEXT_PUBLIC_AMPLITUDE_API_KEY=
```

Start the app:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Useful Commands

```bash
npm run dev      # local development
npm run build    # production build
npm run start    # run production build
npm run lint     # lint the codebase
```

## Notes

The app depends on Supabase tables and migrations in `supabase/migrations`. XLSX templates live in `public/` and are part of the document generation logic, so keep them in sync with the code when changing document layouts.
