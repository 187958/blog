import { h } from "preact"

const POSTS_PER_PAGE = 10

/* ---------- data helpers (build-time) ---------- */

function getPostDate(file) {
  const d = file.dates && (file.dates.published ?? file.dates.created ?? file.dates.modified)
  if (!d) return null
  const dt = new Date(d)
  return Number.isNaN(dt.getTime()) ? null : dt
}

function pad2(n) {
  return n < 10 ? "0" + n : String(n)
}

function isoDate(dt) {
  return dt.getFullYear() + "-" + pad2(dt.getMonth() + 1) + "-" + pad2(dt.getDate())
}

function zhDate(dt) {
  return dt.getFullYear() + "年" + (dt.getMonth() + 1) + "月" + dt.getDate() + "日"
}

function cleanDescription(raw) {
  if (!raw) return ""
  let s = String(raw).replace(/\s+/g, " ").trim()
  if (s.length > 140) s = s.slice(0, 140).trimEnd() + "……"
  return s
}

export function collectPosts(allFiles) {
  const posts = []
  for (const file of allFiles ?? []) {
    const slug = file.slug
    if (!slug || slug === "index" || slug.endsWith("/index")) continue
    if (file.unlisted === true) continue
    const title = file.frontmatter?.title
    if (!title) continue
    const dt = getPostDate(file)
    if (!dt) continue
    const tags = Array.isArray(file.frontmatter?.tags) ? file.frontmatter.tags : []
    posts.push({
      slug,
      title: String(title),
      date: isoDate(dt),
      dateText: zhDate(dt),
      tags: tags.map(String),
      description: cleanDescription(file.description),
      _ts: dt.getTime(),
    })
  }
  posts.sort((a, b) => (b._ts - a._ts) || a.title.localeCompare(b.title, "zh-CN"))
  return posts.map(({ _ts, ...p }) => p)
}

/* ---------- pagination model ---------- */

export function pageList(current, total) {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }
  const pages = [1]
  const lo = Math.max(2, current - 1)
  const hi = Math.min(total - 1, current + 1)
  if (lo > 2) pages.push("…")
  for (let i = lo; i <= hi; i++) pages.push(i)
  if (hi < total - 1) pages.push("…")
  pages.push(total)
  return pages
}

/* ---------- server-side render ---------- */

function renderCard(post) {
  return h(
    "article",
    { class: "article-card", "data-date": post.date },
    h(
      "h2",
      { class: "article-card-title" },
      h("a", { class: "internal", href: "./" + post.slug }, post.title),
    ),
    h(
      "div",
      { class: "article-card-meta" },
      h("time", { datetime: post.date }, post.dateText),
      post.tags.length > 0 &&
        h(
          "ul",
          { class: "tags" },
          post.tags.map((tag) =>
            h(
              "li",
              null,
              h("a", { class: "internal tag-link", href: "./tags/" + tag }, tag),
            ),
          ),
        ),
    ),
    post.description && h("p", { class: "article-card-desc" }, post.description),
  )
}

function renderPager(current, totalPages) {
  if (totalPages <= 1) return h("nav", { class: "article-pager", "aria-label": "文章分页" })
  return h(
    "nav",
    { class: "article-pager", "aria-label": "文章分页" },
    h(
      "button",
      {
        class: "pager-btn pager-prev",
        type: "button",
        "data-page": current - 1,
        disabled: current <= 1,
        "aria-label": "上一页",
      },
      "‹",
    ),
    pageList(current, totalPages).map((p) =>
      p === "…"
        ? h("span", { class: "pager-ellipsis" }, "…")
        : h(
            "button",
            {
              class: "pager-btn pager-num" + (p === current ? " active" : ""),
              type: "button",
              "data-page": p,
            },
            String(p),
          ),
    ),
    h(
      "button",
      {
        class: "pager-btn pager-next",
        type: "button",
        "data-page": current + 1,
        disabled: current >= totalPages,
        "aria-label": "下一页",
      },
      "›",
    ),
  )
}

const ArticleList = () => {
  const Component = ({ allFiles, fileData }) => {
    if (fileData?.slug !== "index") return null

    const posts = collectPosts(allFiles)
    const totalPages = Math.max(1, Math.ceil(posts.length / POSTS_PER_PAGE))
    const json = JSON.stringify(posts).replace(/</g, "\\u003c")

    return h(
      "div",
      { class: "article-list", "data-per-page": String(POSTS_PER_PAGE) },
      h(
        "div",
        { class: "article-list-toolbar" },
        h("span", { class: "article-list-count" }, "共 " + posts.length + " 篇"),
        h(
          "span",
          { class: "article-list-filter", style: "display:none" },
          "📅 ",
          h("b", { class: "filter-date-value" }),
          " ",
          h("button", { class: "clear-filter", type: "button" }, "清除筛选 ✕"),
        ),
      ),
      h(
        "div",
        { class: "article-cards" },
        posts.slice(0, POSTS_PER_PAGE).map(renderCard),
      ),
      renderPager(1, totalPages),
      h("script", {
        type: "application/json",
        class: "article-list-data",
        dangerouslySetInnerHTML: { __html: json },
      }),
    )
  }

  Component.css = css
  Component.afterDOMLoaded = inlineScript
  return Component
}

export default ArticleList

/* ---------- styles ---------- */

const css = `
.article-list {
  margin-top: 0.5rem;
}
.article-list-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.9rem;
  font-size: 0.9rem;
  color: var(--gray);
}
.article-list-filter b {
  color: var(--secondary);
}
.clear-filter {
  border: 1px solid var(--lightgray);
  background: var(--light);
  color: var(--darkgray);
  border-radius: 6px;
  padding: 0.1rem 0.55rem;
  margin-left: 0.4rem;
  font-size: 0.8rem;
  cursor: pointer;
  font-family: inherit;
}
.clear-filter:hover {
  border-color: var(--secondary);
  color: var(--secondary);
}
.article-cards {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.article-card {
  border: 1px solid var(--lightgray);
  border-radius: 10px;
  padding: 1rem 1.25rem;
  background: var(--light);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.article-card:hover {
  border-color: var(--secondary);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.06);
}
.article-card-title {
  margin: 0 0 0.35rem;
  font-size: 1.3rem;
  line-height: 1.4;
}
.article-card-title a {
  background-color: transparent;
}
.article-card-meta {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
  color: var(--gray);
  font-size: 0.85rem;
}
.article-card .tags {
  display: flex;
  gap: 0.3rem;
  list-style: none;
  padding: 0;
  margin: 0;
}
.article-card .tags a.tag-link {
  background: var(--highlight);
  border-radius: 5px;
  padding: 0.1rem 0.5rem;
  font-size: 0.78rem;
  color: var(--secondary);
}
.article-card-desc {
  margin: 0.55rem 0 0;
  color: var(--darkgray);
  font-size: 0.95rem;
  line-height: 1.65;
}
.article-list-empty {
  color: var(--gray);
  padding: 1rem 0;
}
.article-pager {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.35rem;
  margin-top: 1.4rem;
}
.article-pager:empty {
  display: none;
}
.pager-btn {
  min-width: 2rem;
  height: 2rem;
  border: 1px solid var(--lightgray);
  background: var(--light);
  border-radius: 6px;
  cursor: pointer;
  color: var(--dark);
  font-size: 0.9rem;
  padding: 0 0.55rem;
  font-family: inherit;
}
.pager-btn:hover:not(:disabled):not(.active) {
  border-color: var(--secondary);
  color: var(--secondary);
}
.pager-btn.active {
  background: var(--secondary);
  border-color: var(--secondary);
  color: var(--light);
  cursor: default;
}
.pager-btn:disabled {
  opacity: 0.4;
  cursor: default;
}
.pager-ellipsis {
  align-self: center;
  color: var(--gray);
  padding: 0 0.2rem;
}
`

/* ---------- client-side pagination & date filtering (SPA-aware) ---------- */

const inlineScript = `
;(function () {
  var PER_PAGE = 10

  function pageList(current, total) {
    if (total <= 7) {
      var all = []
      for (var i = 1; i <= total; i++) all.push(i)
      return all
    }
    var pages = [1]
    var lo = Math.max(2, current - 1)
    var hi = Math.min(total - 1, current + 1)
    if (lo > 2) pages.push("…")
    for (var i = lo; i <= hi; i++) pages.push(i)
    if (hi < total - 1) pages.push("…")
    pages.push(total)
    return pages
  }

  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
  }

  function cardHTML(p) {
    var tags = (p.tags || [])
      .map(function (t) {
        return '<li><a class="internal tag-link" href="./tags/' + encodeURIComponent(t) + '">' + esc(t) + "</a></li>"
      })
      .join("")
    return (
      '<article class="article-card" data-date="' + p.date + '">' +
      '<h2 class="article-card-title"><a class="internal" href="./' + encodeURI(p.slug) + '">' + esc(p.title) + "</a></h2>" +
      '<div class="article-card-meta"><time datetime="' + p.date + '">' + esc(p.dateText) + "</time>" +
      (tags ? '<ul class="tags">' + tags + "</ul>" : "") +
      "</div>" +
      (p.description ? '<p class="article-card-desc">' + esc(p.description) + "</p>" : "") +
      "</article>"
    )
  }

  function pagerHTML(current, totalPages) {
    if (totalPages <= 1) return ""
    var html =
      '<button class="pager-btn pager-prev" type="button" data-page="' + (current - 1) + '"' +
      (current <= 1 ? " disabled" : "") + ' aria-label="上一页">‹</button>'
    pageList(current, totalPages).forEach(function (p) {
      if (p === "…") {
        html += '<span class="pager-ellipsis">…</span>'
      } else {
        html +=
          '<button class="pager-btn pager-num' + (p === current ? " active" : "") +
          '" type="button" data-page="' + p + '">' + p + "</button>"
      }
    })
    html +=
      '<button class="pager-btn pager-next" type="button" data-page="' + (current + 1) + '"' +
      (current >= totalPages ? " disabled" : "") + ' aria-label="下一页">›</button>'
    return html
  }

  function setupRoot(root) {
    if (root.getAttribute("data-blog-list-init") === "1") return
    root.setAttribute("data-blog-list-init", "1")

    var dataEl = root.querySelector(".article-list-data")
    var cardsEl = root.querySelector(".article-cards")
    var pagerEl = root.querySelector(".article-pager")
    var filterEl = root.querySelector(".article-list-filter")
    var filterDateEl = root.querySelector(".filter-date-value")
    var countEl = root.querySelector(".article-list-count")
    if (!dataEl || !cardsEl || !pagerEl) return

    var posts = []
    try {
      posts = JSON.parse(dataEl.textContent || "[]")
    } catch (e) {
      return
    }

    var state = { page: 1, date: null }
    try {
      var qd = new URLSearchParams(window.location.search).get("date")
      if (qd && /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(qd)) state.date = qd
    } catch (e) {}

    function filteredPosts() {
      if (!state.date) return posts
      return posts.filter(function (p) {
        return p.date === state.date
      })
    }

    function render() {
      var list = filteredPosts()
      var totalPages = Math.max(1, Math.ceil(list.length / PER_PAGE))
      if (state.page > totalPages) state.page = totalPages
      var start = (state.page - 1) * PER_PAGE
      var items = list.slice(start, start + PER_PAGE)

      cardsEl.innerHTML = items.length
        ? items.map(cardHTML).join("")
        : '<p class="article-list-empty">这一天没有发表文章。</p>'
      pagerEl.innerHTML = pagerHTML(state.page, totalPages)

      if (state.date) {
        if (filterEl) filterEl.style.display = ""
        if (filterDateEl) filterDateEl.textContent = state.date
        if (countEl) countEl.textContent = "当天文章 " + list.length + " 篇"
      } else {
        if (filterEl) filterEl.style.display = "none"
        if (countEl) countEl.textContent = "共 " + posts.length + " 篇"
      }

      document.dispatchEvent(
        new CustomEvent("blog-list-filter-changed", { detail: { date: state.date } }),
      )
    }

    root.addEventListener("click", function (e) {
      var t = e.target
      if (t && t.nodeType !== 1) t = t.parentElement
      if (!t) return
      var clearBtn = t.closest(".clear-filter")
      if (clearBtn) {
        state.date = null
        state.page = 1
        try {
          window.history.replaceState(null, "", window.location.pathname)
        } catch (err) {}
        render()
        return
      }
      var btn = t.closest("[data-page]")
      if (btn && !btn.disabled) {
        var p = parseInt(btn.getAttribute("data-page"), 10)
        if (!Number.isNaN(p) && p >= 1) {
          state.page = p
          render()
        }
      }
    })

    function onCalendarSelect(e) {
      state.date = e.detail && e.detail.date ? e.detail.date : null
      state.page = 1
      render()
    }
    document.addEventListener("blog-calendar-select", onCalendarSelect)
    window.addCleanup(function () {
      document.removeEventListener("blog-calendar-select", onCalendarSelect)
    })

    if (state.date) render()
  }

  function setup() {
    document.querySelectorAll(".article-list").forEach(setupRoot)
  }

  document.addEventListener("nav", setup)
  setup()
})()
`
