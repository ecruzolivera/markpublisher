export function generatePageChrome() {
  return `:root {
  --preview-col-gap: 20px;
  --preview-row-gap: 20px;
  --preview-page-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
  --toolbar-height: 40px;
  --toc-indent-step: 1.5em;
}

@media screen {
  body {
    background: #e8e8e8;
    margin: 0;
  }

  #pages-container {
    padding: 20px 0;
  }

  #pages-zoom-layer {
    display: grid;
    justify-content: center;
    gap: var(--preview-row-gap) var(--preview-col-gap);
  }

  #pages-zoom-layer.spread-single {
    grid-template-columns: auto;
  }

  #pages-zoom-layer.spread-facing {
    grid-template-columns: auto auto;
  }

  .page-shell {
    width: fit-content;
    justify-self: center;
    box-shadow: var(--preview-page-shadow);
  }

  .page-shell.spacer {
    visibility: hidden;
  }
}

@media print {

  .page-shell.spacer {
    visibility: hidden;
  }
}

/* --- renderer fallback TOC layout --- */
.toc-entry {
  margin-bottom: 0.25em;
  margin-left: calc(var(--toc-indent-step, 1.5em) * var(--toc-indent, 0));
  break-inside: avoid;
  page-break-inside: avoid;
}
.toc-link {
  display: flex;
  align-items: baseline;
  width: 100%;
  min-width: 0;
  color: inherit;
  text-decoration: none;
}
.toc-text {
  min-width: 0;
  white-space: normal;
  overflow-wrap: anywhere;
  flex-shrink: 1;
}
.toc-leader {
  flex: 1;
  min-width: 1.5em;
  margin: 0 0.4em;
  border-bottom: 1px dotted currentColor;
  transform: translateY(-0.15em);
}
.toc-page-num {
  white-space: nowrap;
  flex-shrink: 0;
}

@media print {
  :root {
    --preview-page-shadow: none;
  }

  body {
    background: transparent;
    margin: 0;
  }

  #pages-container {
    padding: 0;
  }

  #pages-zoom-layer {
    display: block;
  }

  .page-shell {
    box-shadow: none;
    width: auto !important;
    height: auto !important;
    break-inside: avoid;
    page-break-after: always;
  }

  .page {
    transform: none !important;
    transform-origin: initial !important;
  }

  .page-shell:last-child {
    page-break-after: auto;
  }

  .page-shell.spacer {
    display: none;
  }

  #pagination-toolbar {
    display: none !important;
  }
}
`;
}
