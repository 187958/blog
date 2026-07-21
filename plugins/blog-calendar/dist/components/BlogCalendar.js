import { h } from "preact"

const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"]

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

export function collectPostDates(allFiles) {
  const set = new Set()
  for (const file of allFiles ?? []) {
    const slug = file.slug
    if (!slug || slug === "index" || slug.endsWith("/index")) continue
    if (file.unlisted === true) continue
    const dt = getPostDate(file)
    if (dt) set.add(isoDate(dt))
  }
  return [...set].sort()
}

/* ---------- server-side render ---------- */

function renderMonthGrid(year, month, dateSet) {
  const first = new Date(Date.UTC(year, month, 1))
  const offset = (first.getUTCDay() + 6) % 7 // Monday-first
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()

  const cells = []
  for (let i = 0; i < offset; i++) {
    cells.push(h("span", { class: "cal-cell cal-empty" }))
  }
  for (let d = 1; d <= days; d++) {
    const iso = year + "-" + pad2(month + 1) + "-" + pad2(d)
    if (dateSet.has(iso)) {
      cells.push(
        h(
          "button",
          { class: "cal-cell cal-day has-post", type: "button", "data-date": iso },
          String(d),
        ),
      )
    } else {
      cells.push(h("span", { class: "cal-cell cal-plain" }, String(d)))
    }
  }
  return cells
}

const BlogCalendar = () => {
  const Component = ({ allFiles }) => {
    const dates = collectPostDates(allFiles)
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth()
    const dateSet = new Set(dates)
    const json = JSON.stringify(dates).replace(/</g, "\\u003c")

    return h(
      "div",
      { class: "blog-calendar" },
      h("h3", null, "日历"),
      h(
        "div",
        { class: "cal-header" },
        h(
          "button",
          { class: "cal-nav cal-prev", type: "button", "aria-label": "上个月" },
          "‹",
        ),
        h("span", { class: "cal-title" }, year + "年" + (month + 1) + "月"),
        h(
          "button",
          { class: "cal-nav cal-next", type: "button", "aria-label": "下个月" },
          "›",
        ),
      ),
      h(
        "div",
        { class: "cal-weekdays" },
        WEEKDAYS.map((w) => h("span", { class: "cal-weekday" }, w)),
      ),
      h("div", { class: "cal-grid" }, renderMonthGrid(year, month, dateSet)),
      h("script", {
        type: "application/json",
        class: "cal-data",
        dangerouslySetInnerHTML: { __html: json },
      }),
    )
  }

  Component.css = css
  Component.afterDOMLoaded = inlineScript
  return Component
}

export default BlogCalendar

/* ---------- styles ---------- */

const css = `
.blog-calendar h3 {
  margin: 0 0 0.4rem;
  font-size: 1rem;
}
.cal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.3rem;
}
.cal-nav {
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 1.05rem;
  line-height: 1;
  color: var(--gray);
  padding: 0.15rem 0.5rem;
  border-radius: 5px;
  font-family: inherit;
}
.cal-nav:hover {
  color: var(--secondary);
  background: var(--highlight);
}
.cal-title {
  font-weight: 600;
  font-size: 0.88rem;
  color: var(--darkgray);
}
.cal-weekdays,
.cal-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
  text-align: center;
}
.cal-weekday {
  font-size: 0.68rem;
  color: var(--gray);
  padding: 0.15rem 0;
}
.cal-cell {
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.74rem;
  border-radius: 5px;
  border: none;
  background: transparent;
  color: var(--darkgray);
  font-family: inherit;
  padding: 0;
}
.cal-plain {
  color: var(--gray);
  opacity: 0.65;
}
.cal-day.has-post {
  background: var(--highlight);
  color: var(--secondary);
  font-weight: 700;
  cursor: pointer;
}
.cal-day.has-post:hover {
  background: var(--secondary);
  color: var(--light);
}
.cal-day.selected,
.cal-day.selected:hover {
  background: var(--secondary);
  color: var(--light);
}
`

/* ---------- client-side month navigation & date selection (SPA-aware) ---------- */

const inlineScript = `
;(function () {
  function pad2(n) {
    return n < 10 ? "0" + n : String(n)
  }

  function iso(y, m, d) {
    return y + "-" + pad2(m + 1) + "-" + pad2(d)
  }

  function setupRoot(root) {
    if (root.getAttribute("data-blog-cal-init") === "1") return
    root.setAttribute("data-blog-cal-init", "1")

    var dataEl = root.querySelector(".cal-data")
    var gridEl = root.querySelector(".cal-grid")
    var titleEl = root.querySelector(".cal-title")
    if (!dataEl || !gridEl || !titleEl) return

    var dates = []
    try {
      dates = JSON.parse(dataEl.textContent || "[]")
    } catch (e) {
      return
    }
    var dateSet = {}
    dates.forEach(function (d) {
      dateSet[d] = true
    })

    var now = new Date()
    var state = { year: now.getFullYear(), month: now.getMonth(), selected: null }
    try {
      var qd = new URLSearchParams(window.location.search).get("date")
      if (qd && /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(qd)) state.selected = qd
    } catch (e) {}

    function render() {
      titleEl.textContent = state.year + "年" + (state.month + 1) + "月"
      var first = new Date(state.year, state.month, 1)
      var offset = (first.getDay() + 6) % 7
      var days = new Date(state.year, state.month + 1, 0).getDate()
      var html = ""
      for (var i = 0; i < offset; i++) {
        html += '<span class="cal-cell cal-empty"></span>'
      }
      for (var d = 1; d <= days; d++) {
        var dt = iso(state.year, state.month, d)
        if (dateSet[dt]) {
          var cls = "cal-cell cal-day has-post" + (state.selected === dt ? " selected" : "")
          html += '<button type="button" class="' + cls + '" data-date="' + dt + '">' + d + "</button>"
        } else {
          html += '<span class="cal-cell cal-plain">' + d + "</span>"
        }
      }
      gridEl.innerHTML = html
    }

    root.addEventListener("click", function (e) {
      var t = e.target
      if (t && t.nodeType !== 1) t = t.parentElement
      if (!t) return

      var nav = t.closest(".cal-nav")
      if (nav) {
        if (nav.classList.contains("cal-prev")) {
          state.month--
          if (state.month < 0) {
            state.month = 11
            state.year--
          }
        } else {
          state.month++
          if (state.month > 11) {
            state.month = 0
            state.year++
          }
        }
        render()
        return
      }

      var day = t.closest(".cal-day[data-date]")
      if (day) {
        var date = day.getAttribute("data-date")
        state.selected = date
        render()
        if (document.querySelector(".article-list")) {
          document.dispatchEvent(
            new CustomEvent("blog-calendar-select", { detail: { date: date } }),
          )
        } else {
          window.location.href = "/?date=" + date
        }
      }
    })

    function onFilterChanged(e) {
      state.selected = e.detail && e.detail.date ? e.detail.date : null
      render()
    }
    document.addEventListener("blog-list-filter-changed", onFilterChanged)
    window.addCleanup(function () {
      document.removeEventListener("blog-list-filter-changed", onFilterChanged)
    })

    render()
  }

  function setup() {
    document.querySelectorAll(".blog-calendar").forEach(setupRoot)
  }

  document.addEventListener("nav", setup)
  setup()
})()
`
