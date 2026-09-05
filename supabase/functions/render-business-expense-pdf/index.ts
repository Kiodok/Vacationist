import { createClient } from 'jsr:@supabase/supabase-js@2';
import { PDFDocument, StandardFonts, rgb, PDFName, PDFArray, PDFString } from 'https://esm.sh/pdf-lib@1.17.1';

// Renders the "Business Summary" for expenses as a PDF, so the feature can hand the user both a
// .md file (built client-side in packages/utils/settlementText.ts) and a matching PDF on every
// platform without a native module or a web PDF library. The client (apps/mobile/app/trip/
// [id]/expenses.tsx handleBusinessSummary) sends the already-assembled rows — it just rendered
// the identical data into Markdown and already holds read permission for all of it.
//
// Auth: verify_jwt is left at the platform default (true) and the caller is re-derived via
// auth.getUser(jwt) — same pattern as attribution-capi. This keeps it from being an open
// PDF-rendering endpoint; the PDF is the caller's own download, so trusting the row data they
// pass is acceptable.

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')!)['default'],
  { auth: { persistSession: false } },
);

const ALLOWED_ORIGINS = new Set([
  'https://web.vacationist.app',
  'http://localhost:8081', // expo start --web
]);

function corsHeaders(origin: string | null): HeadersInit {
  const allowed = origin && ALLOWED_ORIGINS.has(origin) ? origin : '';
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
    Vary: 'Origin',
  };
}

interface DocRef { fileName: string; url: string }
interface Row { date: string; title: string; amount: string; paidBy: string; documents: DocRef[] }
interface Body { tripTitle: string; currency: string; rows: Row[]; total: string; count: number }

const PAGE_W = 595.28; // A4 pt
const PAGE_H = 841.89;
const MARGIN = 48;
const CONTENT_W = PAGE_W - MARGIN * 2;

// pdf-lib's standard Helvetica can only encode WinAnsi. Normalise the common typographic
// characters that show up in titles / names / filenames, then drop anything still outside the
// range so drawText() never throws (which would fail the whole render for one glyph).
const SMART_SINGLE = /[‘’‚‛]/g;
const SMART_DOUBLE = /[“”„‟]/g;
const DASHES = /[–—―]/g;
const NBSP_ISH = /[    ]/g;
// WinAnsi is NOT the same as pure Latin-1/ISO-8859-1, despite the name — it's Windows-1252, which
// replaces Latin-1's C1 control-character block (U+0080-U+009F) with real printable glyphs,
// including the Euro sign (€, U+20AC) at 0x80. The range below (ASCII + pure Latin-1 Supplement)
// modeled WinAnsi as if it were exactly Latin-1, with no case for anything in that extra block —
// so € was silently stripped from every EUR-formatted amount, the actual cause of a business
// summary PDF showing bare numbers with no currency symbol whenever the report currency was EUR.
// Explicitly allow it (pdf-lib draws € correctly with standard Helvetica under WinAnsiEncoding)
// rather than re-deriving the rest of that block, since it's the only character from it this
// app's currency symbols (CURRENCY_SYMBOLS in packages/utils/src/format.ts — EUR/CHF/USD/GBP,
// everything else falls back to its plain ASCII ISO code) or general report text actually needs.
const NON_WINANSI = /[^\t\n\r\x20-\x7E¡-ÿ€]/g;

function str(v: unknown, max = 300): string {
  const s = typeof v === 'string' ? v : '';
  return s
    .replace(SMART_SINGLE, "'")
    .replace(SMART_DOUBLE, '"')
    .replace(DASHES, '-')
    .replace(/…/g, '...')
    .replace(NBSP_ISH, ' ')
    .replace(NON_WINANSI, '')
    .slice(0, max);
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('Origin');
  const cors = corsHeaders(origin);

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: cors });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response('Unauthorized', { status: 401, headers: cors });
  }
  const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.slice(7));
  if (authError || !user) {
    return new Response('Unauthorized', { status: 401, headers: cors });
  }

  let body: Body;
  try {
    body = await req.json() as Body;
  } catch {
    return new Response('Bad Request', { status: 400, headers: cors });
  }
  if (!Array.isArray(body.rows)) {
    return new Response('Bad Request', { status: 400, headers: cors });
  }

  try {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

    let page = pdf.addPage([PAGE_W, PAGE_H]);
    let y = PAGE_H - MARGIN;

    const linkColor = rgb(0.35, 0.33, 1);
    const muted = rgb(0.4, 0.4, 0.4);

    const newPageIfNeeded = (needed: number) => {
      if (y - needed < MARGIN) {
        page = pdf.addPage([PAGE_W, PAGE_H]);
        y = PAGE_H - MARGIN;
      }
    };

    // Wrap `text` to `width` at `size` in `f`, return the lines.
    const wrap = (text: string, f: typeof font, size: number, width: number): string[] => {
      const words = text.split(/\s+/);
      const lines: string[] = [];
      let line = '';
      for (const w of words) {
        const trial = line ? `${line} ${w}` : w;
        if (f.widthOfTextAtSize(trial, size) > width && line) {
          lines.push(line);
          line = w;
        } else {
          line = trial;
        }
      }
      if (line) lines.push(line);
      return lines.length ? lines : [''];
    };

    const drawLink = (text: string, x: number, ly: number, url: string, size: number) => {
      page.drawText(text, { x, y: ly, size, font, color: linkColor });
      const w = font.widthOfTextAtSize(text, size);
      // pdf-lib's context.obj() turns bare strings into PDF *names*, which is what every value
      // here needs to be EXCEPT the URI itself — that must be a PDF string literal.
      const annot = pdf.context.obj({
        Type: 'Annot',
        Subtype: 'Link',
        Rect: [x, ly - 2, x + w, ly + size],
        Border: [0, 0, 0],
        A: { Type: 'Action', S: 'URI', URI: PDFString.of(url) },
      });
      const ref = pdf.context.register(annot);
      let annots = page.node.lookup(PDFName.of('Annots')) as PDFArray | undefined;
      if (!annots) {
        annots = pdf.context.obj([]) as PDFArray;
        page.node.set(PDFName.of('Annots'), annots);
      }
      annots.push(ref);
    };

    // Title
    page.drawText(`Business Expenses - ${str(body.tripTitle, 120)}`, {
      x: MARGIN, y: y - 18, size: 18, font: bold, color: rgb(0.07, 0.07, 0.07),
    });
    y -= 40;

    if (body.rows.length === 0) {
      page.drawText('No business expenses recorded.', { x: MARGIN, y, size: 11, font, color: muted });
    } else {
      for (const row of body.rows) {
        const titleLines = wrap(str(row.title, 200), bold, 12, CONTENT_W);
        const docs = Array.isArray(row.documents) ? row.documents : [];
        const blockHeight = titleLines.length * 15 + 16 + docs.length * 13 + 14;
        newPageIfNeeded(blockHeight);

        for (const tl of titleLines) {
          page.drawText(tl, { x: MARGIN, y, size: 12, font: bold, color: rgb(0.1, 0.1, 0.1) });
          y -= 15;
        }
        page.drawText(
          `${str(row.date, 40)}   ${str(row.amount, 40)}   ${str(row.paidBy, 80)}`,
          { x: MARGIN, y, size: 10, font, color: muted },
        );
        y -= 16;

        for (const d of docs) {
          const label = str(d.fileName, 120);
          const url = str(d.url, 2000);
          if (/^https?:\/\//.test(url)) {
            drawLink(label, MARGIN + 12, y, url, 9);
          } else {
            page.drawText(label, { x: MARGIN + 12, y, size: 9, font, color: muted });
          }
          y -= 13;
        }
        y -= 14;
      }

      newPageIfNeeded(30);
      page.drawLine({
        start: { x: MARGIN, y: y + 4 }, end: { x: PAGE_W - MARGIN, y: y + 4 },
        thickness: 0.5, color: rgb(0.8, 0.8, 0.8),
      });
      y -= 8;
      page.drawText(
        `Total (${body.count} ${body.count === 1 ? 'expense' : 'expenses'}): ${str(body.total, 40)}`,
        { x: MARGIN, y, size: 12, font: bold, color: rgb(0.07, 0.07, 0.07) },
      );
    }

    const pdfBase64 = await pdf.saveAsBase64({ dataUri: false });
    return new Response(JSON.stringify({ pdfBase64 }), {
      status: 200,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[render-business-expense-pdf] render failed:', err);
    return new Response('Internal Error', { status: 500, headers: cors });
  }
});
