# ep_pdf_export_print

**One-click, high-quality PDF export for [Etherpad](https://etherpad.org) — no
server setup required.**

Etherpad's built-in PDF export uses a hand-rolled `pdfkit` renderer that
overlaps text, drops text colours and ignores images that aren't inline base64.

This plugin sidesteps the server completely. It adds a **“PDF (print)”** entry
to the **Import/Export** menu that loads the pad's clean **HTML export** into a
hidden iframe and triggers your **own browser's** print engine. You then pick
**“Save as PDF”**. Because a real browser does the rendering, images, colours
and alignment all come out correct.

## Why you probably want this one

| | ep_pdf_export_print (this) | [ep_pdf_export_chromium](https://www.npmjs.com/package/ep_pdf_export_chromium) |
|---|---|---|
| Install from admin panel | ✅ just works | ❌ also needs Chromium in the image |
| Server dependencies | **none** | a system Chromium (~300 MB) |
| Rendering engine | the user's own browser | headless Chromium on the server |
| Output | browser "Save as PDF" dialog | direct file download / automatable |

If you can't (or don't want to) modify your Docker image, **this is the plugin
to use.** Choose `ep_pdf_export_chromium` only when you need fully automated,
server-side PDF generation and you control the image.

## Install

From the Etherpad admin panel: **Plugins → search `ep_pdf_export_print` →
Install**. That's it. A **PDF (print)** entry appears in the Import/Export menu.

Or from the command line:

```
pnpm run plugins i ep_pdf_export_print
```

## Requirements & dependencies

- **Etherpad** (peer dependency `ep_etherpad-lite`). **No other plugin is
  required** — it reuses Etherpad's built-in HTML export, which is always
  present.
- **No server-side dependencies.** Nothing to install in your Docker image, no
  Chromium, no LibreOffice. Pure client-side.
- A **modern browser** (uses `fetch`, an iframe `srcdoc`, and the print API —
  every current browser qualifies).
- Works **with or without** a menu-bar plugin: it auto-detects
  `ep_file_menu_toolbar` / `ep_aa_file_menu_toolbar` and otherwise falls back to
  the stock **Import/Export** popup. Neither is required.

### Companion plugins for images & tables — install these, or your PDFs will look broken

The PDF is built from Etherpad's **HTML export**. Core Etherpad cannot export
images or rich tables on its own, so **if your pads contain images or tables and
these plugins are not installed, those elements will be missing or mangled in
the PDF.** This is not optional polish — without them the output looks broken.
If your pads use images or tables, you should install:

- **Images** → **[ep_images_extended_v2](https://www.npmjs.com/package/ep_images_extended_v2)**
  — use this one. It's the fork with the HTML/DOCX export bugs fixed; the
  original `ep_images_extended` has broken export and will leave images out of
  the PDF.
- **Tables** → **[ep_data_tables](https://www.npmjs.com/package/ep_data_tables)**
  for the table feature **plus**
  **[ep_table_export](https://www.npmjs.com/package/ep_table_export)** — without
  `ep_table_export` your tables will not render in the export **at all**.

The plugin still runs without them, but anyone exporting a pad that has images
or tables will get a broken-looking PDF — so install them.

## How it works

1. Reuses the URL of Etherpad's built-in **Export as HTML** link (so read-only
   ids and base paths are handled for free).
2. **Fetches** that HTML (the export route serves it as a download, so it is
   fetched and re-rendered rather than navigated to) and writes it into an
   off-screen iframe via `srcdoc`, with a `<base href>` so relative images
   resolve and a clean `<title>` so the saved file is named after the pad.
3. Calls `iframe.contentWindow.print()` so only the pad content prints, not the
   Etherpad UI.

No data leaves the user's browser beyond the normal same-origin HTML export
request.

## License

Apache-2.0 © Ivan Forkaliuk
