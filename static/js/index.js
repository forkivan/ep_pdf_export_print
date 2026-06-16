'use strict';

// ep_pdf_export_print  (client-side — zero server dependencies)
// -------------------------------------------------------------
// Etherpad's built-in PDF export (pdfkit) overlaps text, drops colours and
// ignores non-base64 images. This plugin sidesteps the server entirely: it
// adds a "PDF (print)" entry to the export menu that loads the pad's clean
// HTML export into a hidden iframe and calls the USER's own browser print
// engine. The user then chooses "Save as PDF". Because a real browser does the
// rendering, images / colours / alignment come out correct.
//
// Two menu UIs are supported:
//   * the stock Import/Export popup  -> inject into #exportColumn
//   * ep_file_menu_toolbar's File menu -> inject into #file_menu_exports
//     .submenu (which that plugin builds by copying #exportColumn's links, but
//     only their href+text — so our JS-driven entry must be added there
//     directly, with its own click handler, and re-added if the menu rebuilds).

const PRINT_ATTR = 'data-ep-pdf-print';

// Build the HTML-export URL for the current pad. Prefer the href Etherpad has
// already wired onto the built-in "Export as HTML" link (it correctly handles
// read-only ids and any base path); fall back to deriving it from the URL.
const htmlExportUrl = () => {
  const a = document.getElementById('exporthtmla');
  const href = a && a.getAttribute('href');
  if (href) return href;
  // Pad URL is "/p/<id>"; the export lives at "/p/<id>/export/html".
  return `${window.location.pathname.replace(/\/+$/, '')}/export/html`;
};

// The browser's "Save as PDF" suggests a filename from the printed document's
// <title>. A srcdoc iframe has no URL, so without a clean title the browser
// falls back to junk ("about:srcdoc", the parent page title, etc). Use the pad
// name so the saved file is just "<padName>.pdf".
const padName = () => {
  try {
    if (window.clientVars && window.clientVars.padId) return window.clientVars.padId;
  } catch (err) { /* ignore */ }
  const seg = window.location.pathname.split('/').filter(Boolean).pop();
  return seg ? decodeURIComponent(seg) : 'pad';
};

// Render the export in an off-screen iframe and print just that document, so
// the Etherpad UI around it is never part of the output.
//
// NB: the /export/html route sends the document as a download
// (Content-Disposition: attachment), so we CANNOT point an iframe at the URL —
// the browser would just save the .html file. Instead we fetch the markup and
// inject it via srcdoc, which renders (and prints) it in place.
const printExport = async (url) => {
  const existing = document.getElementById('ep_pdf_export_print_frame');
  if (existing) existing.remove();

  let html;
  try {
    const resp = await fetch(url, {credentials: 'same-origin'});
    html = await resp.text();
  } catch (err) {
    // Couldn't fetch (offline / blocked): fall back to opening the export.
    window.open(url, '_blank', 'noopener');
    return;
  }

  // Resolve any relative image/asset URLs against this Etherpad origin, and
  // force a clean <title> so the "Save as PDF" filename is "<padName>.pdf".
  const safeTitle = padName().replace(/[<>&]/g, '');
  const baseTag = `<base href="${window.location.origin}/"><title>${safeTitle}</title>`;
  html = /<title[^>]*>[\s\S]*?<\/title>/i.test(html)
    ? html.replace(/<title[^>]*>[\s\S]*?<\/title>/i, '')
    : html;
  html = /<head[^>]*>/i.test(html)
    ? html.replace(/<head[^>]*>/i, (m) => `${m}${baseTag}`)
    : baseTag + html;

  const frame = document.createElement('iframe');
  frame.id = 'ep_pdf_export_print_frame';
  frame.setAttribute('aria-hidden', 'true');
  Object.assign(frame.style, {
    position: 'fixed', right: '0', bottom: '0',
    width: '0', height: '0', border: '0', visibility: 'hidden',
  });

  frame.addEventListener('load', () => {
    // Give the browser a tick to lay out images/fonts before printing.
    setTimeout(() => {
      try {
        try { frame.contentDocument.title = safeTitle; } catch (e) { /* ignore */ }
        const win = frame.contentWindow;
        win.focus();
        win.print();
      } catch (err) {
        window.open(url, '_blank', 'noopener');
      }
    }, 300);
  });

  frame.srcdoc = html;
  document.body.appendChild(frame);
};

const makeLink = (forSubmenu) => {
  const a = document.createElement('a');
  a.className = 'exportlink';
  a.href = '#';
  a.title = 'Export as PDF (print via your browser)';
  a.setAttribute(PRINT_ATTR, '1');
  // The File-menu submenu uses plain text rows; the stock popup uses an icon
  // span. Match whichever we're injecting into so it doesn't look out of place.
  a.innerHTML = forSubmenu
    ? "<div class='exporttype'>PDF (print)</div>"
    : "<span class='exporttype buttonicon buttonicon-file-pdf' aria-hidden='true'></span> PDF (print)";
  a.addEventListener('click', (e) => {
    e.preventDefault();
    printExport(htmlExportUrl());
  });
  return a;
};

// Make sure our entry is present in whichever export menu exists. Idempotent.
const ensure = () => {
  // ep_file_menu_toolbar present: inject into its submenu, but only once it has
  // actually been populated (so we land after its copy pass, not before it
  // clears the list). If it isn't there yet, the observer will call us again.
  const fileMenu = document.getElementById('file_menu_exports');
  if (fileMenu) {
    const submenu = fileMenu.querySelector('.submenu');
    if (submenu && submenu.children.length && !submenu.querySelector(`[${PRINT_ATTR}]`)) {
      submenu.appendChild(makeLink(true));
    }
    // When the File-menu UI is active we deliberately do NOT touch
    // #exportColumn: that plugin would copy our handler-less anchor into the
    // submenu as a dead duplicate.
    return;
  }

  // Stock Import/Export popup.
  const col = document.getElementById('exportColumn');
  if (col && !col.querySelector(`[${PRINT_ATTR}]`)) {
    col.appendChild(makeLink(false));
  }
};

exports.postAceInit = (hookName, context) => {
  ensure();

  // Menus are often (re)built asynchronously — on init and/or each time they
  // open. Watch the document and keep our entry in place, debounced.
  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    setTimeout(() => { scheduled = false; ensure(); }, 100);
  });
  observer.observe(document.body, {childList: true, subtree: true});

  // Belt-and-braces: a few early passes in case everything is already in place.
  let n = 0;
  const poll = setInterval(() => { ensure(); if (++n > 10) clearInterval(poll); }, 300);
};
