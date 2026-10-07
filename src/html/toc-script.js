// TOC injection
(function () {
  var placeholders = document.querySelectorAll(".toc-placeholder");
  if (!placeholders.length) return;

  function readTocConfig(items) {
    var levelsAttr = items[0].getAttribute("data-toc-levels");
    var orderedLevels = [];

    if (levelsAttr) {
      var parts = levelsAttr.split(",");
      for (var li = 0; li < parts.length; li++) {
        var level = parseInt(parts[li], 10);
        if (!isNaN(level)) {
          orderedLevels.push(level);
        }
      }
    }

    if (!orderedLevels.length) {
      orderedLevels.push(1, 2, 3);
    }

    orderedLevels.sort(function (a, b) {
      return a - b;
    });

    var allowedLevels = {};
    for (var i = 0; i < orderedLevels.length; i++) {
      allowedLevels[orderedLevels[i]] = true;
    }

    return {
      allowedLevels: allowedLevels,
      firstIncludedLevel: orderedLevels[0],
    };
  }

  var config = readTocConfig(placeholders);
  var allowedLevels = config.allowedLevels;
  var firstIncludedLevel = config.firstIncludedLevel;

  var excludeDepth = 0;

  function collectHeadings(root) {
    var walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_COMMENT | NodeFilter.SHOW_ELEMENT,
      null,
      false,
    );

    var headings = [];
    var node = walker.nextNode();

    while (node) {
      if (node.nodeType === Node.COMMENT_NODE) {
        if (node.textContent.trim() === "TOC_EXCLUDE_START") {
          excludeDepth++;
        } else if (node.textContent.trim() === "TOC_EXCLUDE_END") {
          excludeDepth = Math.max(0, excludeDepth - 1);
        }
      } else if (excludeDepth === 0) {
        var tag = node.tagName;
        var level = parseInt(tag.charAt(1));
        if (allowedLevels[level]) {
          var page = node.closest(".page");
          if (page && !page.classList.contains("toc")) {
            var pageNumEl = page.querySelector(".page-number");
            var pageNum = pageNumEl ? pageNumEl.dataset.pageNumber || "" : "";
            headings.push({
              level: level,
              text: node.textContent.trim(),
              pageNumber: pageNum,
              id: node.id || "",
            });
          }
        }
      }
      node = walker.nextNode();
    }

    return headings;
  }

  function buildHeadingTree(headings) {
    var stack = [{ level: 0, children: [] }];

    for (var hi = 0; hi < headings.length; hi++) {
      var h = headings[hi];
      var item = {
        level: h.level,
        text: h.text,
        pageNumber: h.pageNumber,
        id: h.id,
        children: [],
      };

      while (stack.length > 0 && stack[stack.length - 1].level >= h.level) {
        stack.pop();
      }

      if (stack.length > 0) {
        stack[stack.length - 1].children.push(item);
      }

      stack.push(item);
    }

    return stack[0].children;
  }

  function flattenTree(items) {
    var flat = [];
    for (var i = 0; i < items.length; i++) {
      flat.push({ item: items[i], level: items[i].level });
      if (items[i].children && items[i].children.length > 0) {
        var children = flattenTree(items[i].children);
        flat = flat.concat(children);
      }
    }
    return flat;
  }

  function createEntryLine(item, level) {
    var lvl = level || 1;
    var li = document.createElement("li");
    li.className = "toc-entry toc-level-" + lvl;

    var link = document.createElement("a");
    link.className = "toc-link";
    link.href = "#" + encodeURIComponent(item.id);

    var text = document.createElement("span");
    text.className = "toc-text";
    text.textContent = item.text;
    link.appendChild(text);

    var leader = document.createElement("span");
    leader.className = "toc-leader";
    leader.setAttribute("aria-hidden", "true");
    link.appendChild(leader);

    if (item.pageNumber) {
      var pageNum = document.createElement("span");
      pageNum.className = "toc-page-num";
      pageNum.textContent = item.pageNumber;
      link.appendChild(pageNum);
    }

    li.appendChild(link);
    return li;
  }

  function createEntry(flatEntry) {
    var li = createEntryLine(flatEntry.item, flatEntry.level);
    li.style.setProperty("--toc-indent", String(flatEntry.level - firstIncludedLevel));
    return li;
  }

  function contentBounds(page) {
    var cs = getComputedStyle(page);
    var rect = page.getBoundingClientRect();
    var scaleX = page.offsetWidth ? rect.width / page.offsetWidth : 1;
    var scaleY = page.offsetHeight ? rect.height / page.offsetHeight : 1;
    return {
      left: rect.left + (parseFloat(cs.paddingLeft) || 0) * scaleX,
      right: rect.right - (parseFloat(cs.paddingRight) || 0) * scaleX,
      bottom: rect.bottom - (parseFloat(cs.paddingBottom) || 0) * scaleY,
    };
  }

  function availableBounds(placeholder) {
    var page = placeholder.closest(".page");
    if (!page) return null;

    var bounds = contentBounds(page);

    var pageNumber = page.querySelector(".page-number");
    if (pageNumber) {
      var style = getComputedStyle(pageNumber);
      if (style.display !== "none" && style.visibility !== "hidden") {
        bounds.bottom = Math.min(pageNumber.getBoundingClientRect().top, bounds.bottom);
      }
    }

    return bounds;
  }

  function entryFits(bounds, entry) {
    var rect = entry.getBoundingClientRect();
    var verticalSafetyGap = 2;
    var measurementEpsilon = 0.5;
    return rect.left >= bounds.left - measurementEpsilon
      && rect.right <= bounds.right + measurementEpsilon
      && rect.bottom + verticalSafetyGap <= bounds.bottom;
  }

  function createList(placeholder) {
    placeholder.innerHTML = "";
    var list = document.createElement("ul");
    list.className = "toc-list";
    placeholder.appendChild(list);
    return list;
  }

  function ensureEmptyLists(items) {
    for (var emptyIndex = 0; emptyIndex < items.length; emptyIndex++) {
      if (!items[emptyIndex].querySelector(".toc-list")) {
        createList(items[emptyIndex]);
      }
    }
  }

  function paginate(entries, items) {
    var entryIdx = 0;
    var pageIdx = 0;

    while (entryIdx < entries.length && pageIdx < items.length) {
      var placeholder = items[pageIdx];
      var list = createList(placeholder);

      if (!availableBounds(placeholder)) {
        pageIdx++;
        continue;
      }

      while (entryIdx < entries.length) {
        var entry = entries[entryIdx];
        var li = createEntry(entry);
        list.appendChild(li);

        // Adding columns can reposition a page in the preview grid.
        var bounds = availableBounds(placeholder);
        if (!entryFits(bounds, li)) {
          list.removeChild(li);
          pageIdx++;
          break;
        }

        entryIdx++;
      }
    }

    return entryIdx;
  }

  function renderOverflowWarning(items) {
    if (!items.length) return;

    var last = items[items.length - 1];
    var warning = document.createElement("p");
    warning.className = "toc-overflow-warning";
    warning.textContent = "[TOC overflow: increase toc:pages=N]";
    last.appendChild(warning);
    console.warn("MarkPublisher: TOC overflow - not all entries fit. Increase toc:pages=N in your source.");
  }

  function renderToc() {
    var headings = collectHeadings(document.body);
    if (headings.length === 0) {
      ensureEmptyLists(placeholders);
      return;
    }

    var rootItems = buildHeadingTree(headings);
    var entries = flattenTree(rootItems);
    var renderedEntries = paginate(entries, placeholders);

    ensureEmptyLists(placeholders);

    if (renderedEntries < entries.length) {
      renderOverflowWarning(placeholders);
    }
  }

  var fontsReady = document.fonts && document.fonts.ready
    ? document.fonts.ready
    : Promise.resolve();
  window.__tocReady = fontsReady.then(renderToc);
})();
