"""
New (Next.js) Microsoft Rewards dashboard — Daily Set handler.

Microsoft's redesigned dashboard is a React/Next.js app: the legacy
`mee-rewards-*` DOM is gone and its Tailwind class names are obfuscated. But the
daily-set data is streamed into the page as an RSC payload (`window.__next_f`)
that contains, for each activity, its `destination` (the Bing search URL the
card links to), `isCompleted`, `points`, `title` and `date`.

Rather than scrape fragile markup, we read that JSON and then visit each
incomplete activity's `destination` — the exact URL a real click would open,
which is what credits the daily-set offer server-side. Completion tracking
(status.json) is handled by the caller (`DailySet`), so this handler only
returns whether it's reasonable to mark today as done.
"""

import random
import re
import time

from selenium.common.exceptions import TimeoutException
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait

from .interactive import complete_if_interactive
from .rewards_api import (
    fetch_userinfo,
    merge_live,
    parse_userinfo,
    skip_offer,
)
from ..utils import wait_or_stop

DASHBOARD_URL = "https://rewards.bing.com/dashboard"
EARN_URL = "https://rewards.bing.com/earn"
FLYOUT_URL = "https://www.bing.com/rewards/panelflyout?style=chrome"

# Always visit these punchcards even if the earn-page card looks complete.
KNOWN_PUNCHCARD_URLS = (
    "https://rewards.bing.com/earn/quest/ENWW_pcparent_FY27_BingMonthlyPC_Sep_punchcard",
)

# Concatenate every streamed RSC chunk (`window.__next_f` is a list of
# `[1, "<chunk>"]` entries) and pull out each `dailySetItems` array, returning
# the parsed items to Python. A balanced-bracket scan that respects string
# literals extracts each array so JSON.parse gets a well-formed slice. The
# payload may repeat the array across chunks; the Python side dedupes by offerId.
_EXTRACT_DAILY_SET_JS = r"""
try {
  var raw = window.__next_f || [];
  var parts = [];
  for (var n = 0; n < raw.length; n++) {
    var e = raw[n];
    if (Array.isArray(e)) { if (typeof e[1] === 'string') parts.push(e[1]); }
    else if (typeof e === 'string') { parts.push(e); }
  }
  var blob = parts.join('');
  var out = [];
  var key = '"dailySetItems"';
  var idx = 0;
  while ((idx = blob.indexOf(key, idx)) !== -1) {
    var i = blob.indexOf('[', idx + key.length);
    if (i === -1) break;
    var depth = 0, inStr = false, esc = false, start = i;
    for (; i < blob.length; i++) {
      var c = blob[i];
      if (inStr) {
        if (esc) esc = false;
        else if (c === '\\') esc = true;
        else if (c === '"') inStr = false;
      } else {
        if (c === '"') inStr = true;
        else if (c === '[') depth++;
        else if (c === ']') { depth--; if (depth === 0) { i++; break; } }
      }
    }
    try {
      var arr = JSON.parse(blob.slice(start, i));
      if (Array.isArray(arr)) { for (var j = 0; j < arr.length; j++) out.push(arr[j]); }
    } catch (err) { /* skip malformed slice */ }
    idx = i;
  }
  return out;
} catch (e) { return []; }
"""

# DOM fallback: read today's daily-set activities straight from the rendered
# `#dailyset` section when the RSC JSON isn't available. The section holds only
# today's cards, each an <a> pointing at the Bing search that credits it.
# Completion is read from the green "success" badge (a design-system class),
# which is language-independent.
_DOM_DAILY_SET_JS = r"""
try {
  var out = [];
  var root = document.getElementById('dailyset');
  if (!root) return out;
  var links = root.querySelectorAll('a[href]');
  for (var i = 0; i < links.length; i++) {
    var a = links[i];
    var href = a.href || a.getAttribute('href') || '';
    // Only real daily-set activities point at a Bing search (this also excludes
    // the section header's "earn more" link, whose absolute href has bing.com).
    if (href.indexOf('bing.com/earn') > 0) continue;
    // Title only: the card's bold title node, not the whole card text.
    var tEl = a.querySelector('.text-globalBody2Strong') || a.querySelector('p');
    var title = tEl ? (tEl.textContent || '').replace(/\s+/g, ' ').trim() : '';
    // Completed cards carry a green "success" badge (language-independent).
    var done = !!a.querySelector('[class*="statusSuccess"]');
    out.push({ destination: href, title: title.slice(0, 80), isCompleted: done, date: null });
  }
  return out;
} catch (e) { return []; }
"""

# The /earn "more activities" (#moreactivities) section: point-earning search
# cards. An earnable, not-yet-done card shows a "+N" points badge; completed ones
# show a green "success" badge instead, and promos (referral, redeem, extension)
# have no "+N" badge — the "+N" gate keeps only the ones worth clicking.
_MORE_ACTIVITIES_JS = r"""
try {
  var out = [];
  var root = document.getElementById('moreactivities');
  if (!root) return out;
  var links = root.querySelectorAll('a[href]');
  for (var i = 0; i < links.length; i++) {
    var a = links[i];
    var href = a.href || a.getAttribute('href') || '';
    if (href.indexOf('bing.com') < 0) continue;
    if (href.indexOf('/redeem') >= 0) continue;
    if (href.indexOf('xbox.com') >= 0) continue;
    // Quests are multi-task punchcards handled separately (see _run_quests);
    // their entry card links to /earn/quest/<id>, not a Bing search.
    if (href.indexOf('/earn/quest/') >= 0) continue;
    // Skip completed cards via their green "success" badge (language-independent).
    if (a.querySelector('[class*="statusSuccess"]')) continue;
    var txt = (a.textContent || '').replace(/\s+/g, ' ').trim();
    var m = txt.match(/\+\s*(\d+)/);
    if (!m) continue;
    var tEl = a.querySelector('.text-globalBody2Strong') || a.querySelector('p');
    var title = tEl ? (tEl.textContent || '').replace(/\s+/g, ' ').trim() : '';
    out.push({ destination: href, title: title.slice(0, 80), points: parseInt(m[1], 10) });
  }
  return out;
} catch (e) { return []; }
"""

# Discover /earn "quest" punchcards. Each is an <a> linking to its own
# /earn/quest/<id> page (not a Bing search), with a "+N" points badge and an
# "N/M" progress counter. Both markers are numeric / design-token based, so this
# stays language-independent. The progress lets the caller skip finished quests.
_QUESTS_JS = r"""
try {
  var out = [];
  var seen = {};
  var links = document.querySelectorAll('a[href*="/earn/quest/"]');
  for (var i = 0; i < links.length; i++) {
    var a = links[i];
    var href = a.href || a.getAttribute('href') || '';
    if (!href) continue;
    var key = href.split('?')[0].split('#')[0];
    if (seen[key]) continue;
    seen[key] = 1;
    // Read points and progress from their own elements — NOT the card's
    // concatenated textContent, where adjacent nodes like "+50" and "1/4" merge
    // into "+501/4" and get misparsed. The informative-tint badge shows points
    // to earn; the success badge shows points already earned on a done quest.
    var pts = 0;
    var badge = a.querySelector('[class*="statusInformativeTintFg"]')
             || a.querySelector('[class*="statusSuccess"]');
    if (badge) {
      var bm = (badge.textContent || '').match(/(\d+)/);
      if (bm) pts = parseInt(bm[1], 10);
    }
    // Progress "N/M": the leaf node whose own text IS a fraction (never merged
    // with the neighbouring points badge).
    var done = null, total = null;
    var nodes = a.querySelectorAll('*');
    for (var k = 0; k < nodes.length; k++) {
      if (nodes[k].children.length) continue;
      var pm = (nodes[k].textContent || '').match(/(\d+)\s*\/\s*(\d+)/);
      if (pm) { done = parseInt(pm[1], 10); total = parseInt(pm[2], 10); break; }
    }
    var tEl = a.querySelector('.text-globalBody2Strong') || a.querySelector('p');
    var title = tEl ? (tEl.textContent || '').replace(/\s+/g, ' ').trim() : '';
    out.push({ url: key, title: title.slice(0, 80), points: pts, done: done, total: total });
  }
  return out;
} catch (e) { return []; }
"""

# Leftover earn-page offers the bot cannot finish (Game Pass, default Bing,
# wallpaper, partner). Skip green completed cards.
_FOR_YOU_EXTRA_JS = r"""
try {
  var out = [];
  var seen = {};
  var links = document.querySelectorAll('a[href]');
  for (var i = 0; i < links.length; i++) {
    var a = links[i];
    if (a.querySelector && a.querySelector('[class*="statusSuccess"]')) continue;
    var href = a.href || '';
    var text = (a.innerText || a.textContent || '').replace(/\s+/g, ' ').trim();
    if (!text || text.length < 8) continue;
    var low = text.toLowerCase();
    var kind = null;
    if (/game pass/.test(low)) kind = 'purchase';
    else if (/default search/.test(low)) kind = 'system';
    else if (/wallpaper/.test(low)) kind = 'optional';
    else if (/refer/.test(low)) kind = 'social';
    if (!kind) continue;
    if (seen[href + kind]) continue;
    seen[href + kind] = 1;
    var title = text.split('. ')[0].slice(0, 90);
    out.push({ title: title, url: href || location.href, detail: text.slice(0, 140), kind: kind });
  }
  return out;
} catch (e) { return []; }
"""

# Read the actionable tasks on a quest page. Tasks live in the design-token
# "rewardsTableAltBg" list; each is a Bing-search link that must be really
# clicked to credit. A task is actionable only if its link is NOT disabled:
# punchcard tasks unlock one per ~24h and carry aria-disabled / data-disabled
# until then, and completed tasks have no link at all.
_QUEST_TASKS_JS = r"""
try {
  var out = [];
  var scope = document.querySelector('[class*="rewardsTableAltBg"]') || document;
  var links = scope.querySelectorAll(
    '[href*="bing.com"], [href*="microsoft.com/edge"], [href*="rewards.bing.com"], [role="link"][href]'
  );
  for (var i = 0; i < links.length; i++) {
    var el = links[i];
    if ((el.getAttribute('aria-disabled') || '') === 'true') continue;
    if ((el.getAttribute('data-disabled') || '') === 'true') continue;
    if (el.hasAttribute('disabled')) continue;
    // For an <a> el.href is the resolved absolute URL, matching Selenium's
    // get_attribute('href') used to relocate it; a <span role="link"> has no
    // .href property so we keep its raw attribute (also what Selenium returns).
    var href = el.href || el.getAttribute('href') || '';
    if (!href) continue;
    var row = el.closest('div');
    var tEl = row ? row.querySelector('h3, .text-globalBody2Strong') : null;
    var title = tEl ? (tEl.textContent || '').replace(/\s+/g, ' ').trim() : '';
    // The heading ends with a call-to-action sentence (e.g. "... Click to
    // complete."); keep only the first sentence. Language-independent.
    title = title.split('. ')[0].trim();
    out.push({ destination: href, title: title.slice(0, 80) });
  }
  return out;
} catch (e) { return []; }
"""

# Diagnostic snapshot logged when no activities are found, so a failure can be
# understood from the logs (did the RSC chunk stream in? is the section there?).
_DIAG_JS = r"""
try {
  var chunks = window.__next_f || [];
  var parts = [];
  for (var n = 0; n < chunks.length; n++) {
    var e = chunks[n];
    if (Array.isArray(e)) { if (typeof e[1] === 'string') parts.push(e[1]); }
    else if (typeof e === 'string') { parts.push(e); }
  }
  var blob = parts.join('');
  return {
    chunks: chunks.length,
    blobLen: blob.length,
    hasKey: blob.indexOf('"dailySetItems"') >= 0,
    hasDailyset: !!document.getElementById('dailyset'),
    url: location.href,
    title: document.title
  };
} catch (e) { return { error: String(e).slice(0, 120) }; }
"""


# Find the "visual search streak" mission's own entry URL. Rewards credits the
# streak only for a search started from that link (the Bing homepage carrying
# the mission's promo code, e.g. /?features=vsstreak,vstooltip&form=ML2XES), so
# a search from a bare bing.com runs but never ticks the mission. The URL lives
# in the streamed RSC payload; a rendered <a> is preferred when the mission
# flyout happens to be open. Matched on the "vsstreak" feature flag, so it stays
# language- and market-independent.
_FIND_VS_STREAK_URL_JS = r"""
try {
  var a = document.querySelector('a[href*="vsstreak"]');
  if (a && a.href) return a.href;
  var raw = window.__next_f || [];
  var parts = [];
  for (var n = 0; n < raw.length; n++) {
    var e = raw[n];
    if (Array.isArray(e)) { if (typeof e[1] === 'string') parts.push(e[1]); }
    else if (typeof e === 'string') { parts.push(e); }
  }
  var blob = parts.join('');
  var idx = blob.indexOf('vsstreak');
  if (idx < 0) return null;
  var start = blob.lastIndexOf('http', idx);
  if (start < 0) return null;
  // Stop at a quote or whitespace only: the URL itself contains a comma
  // (features=vsstreak,vstooltip) and backslash-escaped slashes.
  var stop = '"\'`\n\r\t <>';
  var end = idx;
  while (end < blob.length && stop.indexOf(blob[end]) < 0) end++;
  var url = blob.slice(start, end)
    .replace(/\\u0026/g, '&')
    .replace(/\\\//g, '/');
  return url.indexOf('bing.com') >= 0 ? url : null;
} catch (e) { return null; }
"""

# Read the progress of the "visual search streak" mission ("Activité : 0/1").
# The card is identified by its own artwork (OMR.VisualSearch.VNext…, or the
# search_visual.svg mission icon) rather than its localized title, and progress
# comes from the react-aria progressbar when present, else from the card's
# "<done>/<total>" counter. This is what says whether Rewards actually counted
# the search we just made.
_VS_STREAK_PROGRESS_JS = r"""
try {
  var imgs = document.querySelectorAll(
    'img[src*="VisualSearch"], img[src*="search_visual"]'
  );
  for (var i = 0; i < imgs.length; i++) {
    var card = imgs[i].parentElement;
    for (var up = 0; card && up < 8; up++) {
      var text = (card.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 90);
      var bar = card.querySelector('[role="progressbar"][aria-valuemax]');
      if (bar) {
        var now = parseInt(bar.getAttribute('aria-valuenow'), 10);
        var max = parseInt(bar.getAttribute('aria-valuemax'), 10);
        if (!isNaN(now) && !isNaN(max) && max > 0) {
          return {done: now, total: max, source: 'progressbar',
                  card: text || bar.getAttribute('aria-label') || ''};
        }
      }
      var m = (card.textContent || '').replace(/\s+/g, ' ').match(/(\d+)\s*\/\s*(\d+)/);
      if (m) {
        return {done: parseInt(m[1], 10), total: parseInt(m[2], 10),
                source: 'counter', card: text};
      }
      card = card.parentElement;
    }
  }
  return null;
} catch (e) { return null; }
"""

# Locate the primary control of the claim panel, language-independently.
# The panel used to be a flyout ([class*="bg-flyout"]) holding a
# <button class="...bgCtrlBrandRest...">; the dashboard now renders a react-aria
# pressable card whose brand styling sits on an inner <div>. So match the brand
# design token, then walk up to whatever is actually pressable. A brand control
# wrapping the coins icon wins over any other brand CTA on the page.
_FIND_CLAIM_CONTROL_JS = r"""
try {
  var scoped = document.querySelectorAll('[class*="bg-flyout"], [role="dialog"]');
  var roots = Array.prototype.slice.call(scoped);
  var isScoped = roots.length > 0;
  if (!isScoped) roots = [document.body];
  var fallback = null;
  for (var r = 0; r < roots.length; r++) {
    var brands = roots[r].querySelectorAll('[class*="bgCtrlBrand"]');
    for (var i = 0; i < brands.length; i++) {
      var el = brands[i];
      if (!el.getClientRects().length) continue;
      var press = el.closest(
        'button, [role="button"], [data-react-aria-pressable]'
      ) || el;
      if (press.disabled) continue;
      if (press.getAttribute('slot')) continue;
      if ((press.getAttribute('aria-disabled') || '') === 'true') continue;
      if (press.hasAttribute('data-disabled')) continue;
      if (press.querySelector('img[src*="CoinsTransparent"]')) return press;
      // Inside a flyout/dialog the only brand control is the claim CTA, so it
      // is a safe fallback. On the bare page it could be any other dashboard
      // CTA (redeem, promo banner), and clicking that would be worse than
      // giving up — so don't guess there.
      if (isScoped && !fallback) fallback = press;
    }
  }
  return fallback;
} catch (e) { return null; }
"""

# Live "Your activity" counters on the new dashboard / earn page. Used to
# decide skip vs run from the page itself, not from status.json.
_LIVE_PROGRESS_JS = r"""
try {
  var text = (document.body.innerText || '').replace(/\u00a0/g, ' ');
  var out = {};
  var m;
  m = text.match(/(?:Ready to claim|Listo(?:s)? para reclamar)\s+(\d{1,6})/i);
  if (m) out.claim = parseInt(m[1], 10);
  m = text.match(/(?:Activity|Actividad):\s*(\d+)\s*\/\s*(\d+)/i);
  if (m) out.daily = [parseInt(m[1], 10), parseInt(m[2], 10)];
  m = text.match(/(?:Minutes|Minutos):\s*(\d+)\s*\/\s*(\d+)/i);
  if (m) out.edge = [parseInt(m[1], 10), parseInt(m[2], 10)];
  m = text.match(/(?:Check-in|Check in|Registro):\s*(\d+)\s*\/\s*(\d+)/i);
  if (m) out.checkin = [parseInt(m[1], 10), parseInt(m[2], 10)];
  m = text.match(/\b(?:Search|B[uú]squeda):\s*(\d+)\s*\/\s*(\d+)/i);
  if (m) out.search = [parseInt(m[1], 10), parseInt(m[2], 10)];
  m = text.match(/(?:Reinicios dentro de|Resets? in)\s+(\d+)\s*h/i);
  if (m) out.resetHours = parseInt(m[1], 10);
  out.hasNews = /read to earn|news articles|read article/i.test(text);
  out.hasVisual = /visual search/i.test(text);
  return out;
} catch (e) { return {}; }
"""

_FIND_CLAIM_CTA_JS = r"""
try {
  var nodes = document.querySelectorAll(
    'button, [role="button"], [data-react-aria-pressable], .cursor-pointer'
  );
  var claimBtn = null;
  var tile = null;
  for (var i = 0; i < nodes.length; i++) {
    var el = nodes[i];
    if (!el.getClientRects().length) continue;
    var t = (el.innerText || '').replace(/\s+/g, ' ').trim();
    if (!t) continue;
    if (/ready to claim|listo(?:s)? para reclamar/i.test(t)) tile = el;
    var exact = t.toLowerCase();
    if (/redeem|canjear|donat/i.test(t)) continue;
    if (
      exact === 'claim' || exact === 'reclamar' || exact === 'reclama' ||
      /^claim\b/.test(exact) || /^reclamar\b/.test(exact)
    ) {
      claimBtn = el;
    }
  }
  return claimBtn || tile;
} catch (e) { return null; }
"""


class NewDashboardDailySet:
    """Daily Set handler for the new Next.js Microsoft Rewards dashboard."""

    def __init__(self, logger=None):
        """
        Args:
            logger (callable, optional): A function to log messages.
        """
        self.logger = logger
        # Aggregated counts from the most recent `perform` call, mirroring
        # DailySet.last_totals so the stats layer can record new-dashboard
        # runs the same way it records legacy ones. `newly` counts verified
        # daily-set completions only; `earn` and `quests` count the /earn cards
        # and quest tasks opened this run (clicked, not re-verified).
        self.last_totals = {
            "already": 0,
            "newly": 0,
            "final": 0,
            "total": 0,
            "attempted": 0,
            "earn": 0,
            "quests": 0,
        }
        # Entry URL of the "visual search streak" mission, read off the
        # dashboard during `perform` so the visual search can start from the
        # link that credits it. None when the mission isn't offered.
        self.visual_search_url = None
        # Its progress as (done, total) before this run touched anything, or
        # None when the mission isn't offered / couldn't be read.
        self.visual_search_progress = None
        # Set when a quest task is the Edge 30-minute browsing streak.
        self.needs_edge_browse = False
        self.live_progress = {}
        self.edge_minutes_remaining = 0
        self.for_you_tasks = []

    def _log(self, message):
        if self.logger:
            self.logger(message)

    @staticmethod
    def _close_tab(driver):
        """Close the current tab without waiting 20s on a hung page."""
        try:
            driver.set_page_load_timeout(4)
        except Exception:
            pass
        try:
            driver.execute_script("window.stop();")
        except Exception:
            pass
        try:
            driver.close()
        except Exception:
            try:
                driver.execute_script("window.close();")
            except Exception:
                pass

    def _already_on(self, driver, url):
        try:
            cur = (driver.current_url or "").split("?")[0].rstrip("/").lower()
            want = (url or "").split("?")[0].rstrip("/").lower()
            return bool(want) and cur.startswith(want)
        except Exception:
            return False

    def _safe_get(self, driver, url, timeout=16):
        """Navigate without hanging the run if Edge never fires load."""
        self._log(f"Opening {url} ...")
        try:
            driver.set_page_load_timeout(timeout)
        except Exception:
            pass
        if self._already_on(driver, url):
            self._log("Already on that page — not reloading.")
            return True
        try:
            driver.get(url)
            self._log("Page loaded.")
            return True
        except TimeoutException:
            try:
                driver.execute_script("window.stop();")
            except Exception:
                pass
            self._log(
                "[WARNING] Page load timed out — continuing with whatever rendered."
            )
            return True
        except Exception as e:
            from ..emulator.driver import is_browser_closed_error

            if is_browser_closed_error(e):
                stop_ev = getattr(self, "_active_stop_event", None)
                if stop_ev is not None:
                    stop_ev.set()
                self._log("Browser window closed — stopping tasks.")
                return False
            self._log(f"[WARNING] Navigation failed: {str(e).splitlines()[0][:160]}")
            return False

    def read_live_progress(self, driver, navigate=False):
        """Read Daily/Claim/Edge/Check-in counters from the current Rewards page."""
        try:
            if navigate:
                self._safe_get(driver, DASHBOARD_URL)
                self._wait_ready(driver, timeout=8)
                time.sleep(0.8)
            data = driver.execute_script(_LIVE_PROGRESS_JS) or {}
        except Exception:
            data = {}
        if not isinstance(data, dict):
            data = {}
        try:
            api_live = parse_userinfo(fetch_userinfo(driver))
            data = merge_live(data, api_live)
        except Exception:
            pass
        prev = dict(self.live_progress or {})
        for key, value in data.items():
            if value in (None, "", [], {}):
                continue
            prev[key] = value
        self.live_progress = prev
        return prev

    # -- Data extraction -------------------------------------------------------

    def _read_items(self, driver):
        """Read and dedupe the daily-set items embedded in the current page."""
        try:
            raw = driver.execute_script(_EXTRACT_DAILY_SET_JS)
        except Exception as e:
            self._log(f"[WARNING] Could not read new-dashboard data: {e}")
            return []

        if not isinstance(raw, list):
            return []

        # Dedupe by offerId; prefer the record that reports completion so a
        # stale "incomplete" copy in another chunk can't re-trigger a visit.
        by_id = {}
        for item in raw:
            if not isinstance(item, dict):
                continue
            key = item.get("offerId") or item.get("hash") or item.get("destination")
            if key is None:
                continue
            prev = by_id.get(key)
            if prev is None or (
                item.get("isCompleted") and not prev.get("isCompleted")
            ):
                by_id[key] = item
        return list(by_id.values())

    def _read_items_polling(self, driver, attempts=4, delay=0.8):
        """
        Poll `_read_items` until the item set stabilizes. The dashboard streams
        the daily-set RSC chunks progressively, so an early read can catch a
        partial payload (e.g. 2 of 3 cards streamed in at that instant);
        returning on the first non-empty read would silently drop the cards
        still in flight. Done when the count stops changing between two
        consecutive reads, or when the payload drains post-hydration (a
        non-empty snapshot followed by an empty read — nothing more will
        stream). Always returns the largest snapshot seen.
        """
        best = []
        prev_count = None
        for _ in range(max(1, attempts)):
            items = self._read_items(driver)
            if len(items) > len(best):
                best = items
            if best and (not items or len(items) == prev_count):
                return best
            prev_count = len(items)
            time.sleep(delay)
        return best

    @staticmethod
    def _choose_today(json_today, dom_today):
        """
        Pick the trustworthy "today" card set between the two sources.

        The rendered #dailyset section is ground truth for WHICH cards are
        today's (it only ever shows today); the RSC JSON is authoritative for
        completion flags but can be partially streamed — worst case its
        snapshot holds only another, already-completed day, which would read
        as "nothing to do" and silently skip (and mark) the whole set.

        Rules: DOM wins when it sees more of today than the JSON group, or
        when the JSON group shares no destination with the DOM cards (i.e. the
        JSON group is some other day). Otherwise the JSON group wins.

        Returns:
            tuple: (items, source) with source "dom" or "json".
        """
        if len(dom_today) > len(json_today):
            return dom_today, "dom"
        if dom_today:
            dom_dests = {it.get("destination") for it in dom_today}
            if not any(it.get("destination") in dom_dests for it in json_today):
                return dom_today, "dom"
        return json_today, "json"

    def _read_items_dom(self, driver):
        """Fallback: read today's daily-set activities from the rendered DOM."""
        try:
            raw = driver.execute_script(_DOM_DAILY_SET_JS)
        except Exception as e:
            self._log(f"[WARNING] Could not read new-dashboard DOM: {e}")
            return []
        if not isinstance(raw, list):
            return []
        return [it for it in raw if isinstance(it, dict) and it.get("destination")]

    def _diagnostics(self, driver):
        """Return a small diagnostic dict about the current page (for logging)."""
        try:
            info = driver.execute_script(_DIAG_JS)
            return info if isinstance(info, dict) else {}
        except Exception as e:
            return {"error": str(e)[:120]}

    # -- Clicking activities ---------------------------------------------------

    def _expand_section(self, driver, section_id="dailyset"):
        """
        Expand a collapsed section so its cards become visible and clickable.
        react-aria marks the Disclosure toggle with slot="trigger"; clicking it
        when aria-expanded="false" opens the panel.
        """
        try:
            triggers = driver.find_elements(
                By.CSS_SELECTOR, f"#{section_id} button[slot='trigger']"
            )
        except Exception:
            return
        for btn in triggers:
            try:
                if (btn.get_attribute("aria-expanded") or "").lower() == "false":
                    driver.execute_script("arguments[0].click();", btn)
                    time.sleep(random.uniform(0.6, 1.2))
            except Exception:
                continue

    def _expand_all(self, driver):
        """
        Expand every collapsed react-aria disclosure on the page. Used on /earn,
        where quest punchcards live in their own collapsible panel (not
        #moreactivities) and would otherwise stay unrendered/undiscovered.
        """
        try:
            triggers = driver.find_elements(By.CSS_SELECTOR, "button[slot='trigger']")
        except Exception:
            return
        for btn in triggers:
            try:
                if (btn.get_attribute("aria-expanded") or "").lower() == "false":
                    driver.execute_script("arguments[0].click();", btn)
                    time.sleep(random.uniform(0.3, 0.6))
            except Exception:
                continue

    def _locate_anchor(self, driver, destination, section_id="dailyset"):
        """
        Find the card <a> matching `destination` in a section by its exact href.

        Returns None when there's no exact match: the activity list is filtered
        (completed cards, quests and badge-less promos are dropped), so a
        positional fallback would index the raw anchors out of step with that
        list and could click the wrong card. Callers fall back to direct
        navigation instead.
        """
        try:
            anchors = driver.find_elements(By.CSS_SELECTOR, f"#{section_id} a[href]")
        except Exception:
            return None
        for a in anchors:
            try:
                if (a.get_attribute("href") or "") == destination:
                    return a
            except Exception:
                continue
        return None

    def _locate_quest_task(self, driver, destination):
        """
        Find the actionable task link for `destination` on a quest page. Unlike
        daily-set cards, a quest task's clickable is a <span role="link"> (not an
        <a>), so this queries by href within the task list and skips disabled
        (locked) links.
        """
        try:
            links = driver.find_elements(
                By.CSS_SELECTOR,
                '[class*="rewardsTableAltBg"] [href*="bing.com"], '
                '[class*="rewardsTableAltBg"] [href*="microsoft.com/edge"], '
                '[class*="rewardsTableAltBg"] [role="link"][href]',
            )
        except Exception:
            return None
        for el in links:
            try:
                if (el.get_attribute("aria-disabled") or "").lower() == "true":
                    continue
                if (el.get_attribute("data-disabled") or "").lower() == "true":
                    continue
                if el.get_attribute("href") == destination:
                    return el
            except Exception:
                continue
        return None

    def _click_anchor(
        self,
        driver,
        human,
        anchor,
        main_tab,
        stop_event,
        return_url=DASHBOARD_URL,
        section_id="dailyset",
    ):
        """
        Click a card the way a user does (a real pointer click that opens the
        card's new tab) — this is what credits the offer; a bare navigation to
        the destination URL does not. Handles the new tab (dwell + close) or a
        same-tab navigation.

        On a same-tab navigation, returns to `return_url` and expands
        `section_id` so the caller's remaining anchors stay discoverable (each
        flow — daily set, earn page — has its own page and section). Returns True
        if the click was dispatched and handled.
        """
        try:
            # Skip a card that's momentarily 0x0 (SPA re-render / still collapsed).
            try:
                w, h = driver.execute_script(
                    "const r=arguments[0].getBoundingClientRect();"
                    "return [r.width, r.height];",
                    anchor,
                )
                if float(w) <= 6 or float(h) <= 6:
                    return False
            except Exception:
                pass

            try:
                driver.execute_script(
                    "arguments[0].scrollIntoView({block:'center', inline:'nearest'});",
                    anchor,
                )
                if wait_or_stop(random.uniform(0.4, 0.8), stop_event):
                    return False
            except Exception:
                pass

            before = set(driver.window_handles)
            cur_url = driver.current_url
            human.click_element(anchor, scroll_into_view=False)
            if wait_or_stop(random.uniform(2, 4), stop_event):
                return False

            new_tabs = [
                x for x in driver.window_handles if x != main_tab and x not in before
            ]
            if new_tabs:
                for tab in new_tabs:
                    driver.switch_to.window(tab)
                    # Dwell so the rewards credit beacon on the search page fires.
                    if wait_or_stop(random.uniform(2, 4), stop_event):
                        return False
                    try:
                        complete_if_interactive(
                            driver, log=self._log, stop_event=stop_event, human=human
                        )
                    except Exception:
                        pass
                    try:
                        human.scroll_page()
                    except Exception:
                        pass
                    if wait_or_stop(random.uniform(1, 2), stop_event):
                        return False
                    self._close_tab(driver)
                driver.switch_to.window(main_tab)
                if wait_or_stop(random.uniform(1, 2), stop_event):
                    return False
                return True

            if driver.current_url != cur_url:
                # Opened in the same tab: dwell, then return to the caller's
                # page/section so its remaining anchors stay discoverable.
                if wait_or_stop(random.uniform(2, 4), stop_event):
                    return False
                try:
                    complete_if_interactive(
                        driver, log=self._log, stop_event=stop_event, human=human
                    )
                except Exception:
                    pass
                try:
                    human.scroll_page()
                except Exception:
                    pass
                driver.get(return_url)
                self._wait_ready(driver)
                if wait_or_stop(random.uniform(1.5, 2.5), stop_event):
                    return False
                self._expand_section(driver, section_id)
                return True

            # Nothing happened — click missed.
            return False

        except Exception as e:
            if stop_event is not None and stop_event.is_set():
                return False
            self._log(f"[WARNING] Card click failed: {str(e).splitlines()[0][:140]}")
            try:
                for tab in list(driver.window_handles):
                    if tab != main_tab:
                        driver.switch_to.window(tab)
                        self._close_tab(driver)
            except Exception:
                pass
            try:
                driver.switch_to.window(main_tab)
            except Exception:
                pass
            return False

    @staticmethod
    def _date_key(item):
        """Parse an item's MM/DD/YYYY date into a comparable (Y, M, D) tuple."""
        raw = item.get("date")
        if not isinstance(raw, str):
            return None
        parts = raw.split("/")
        if len(parts) != 3:
            return None
        try:
            month, day, year = (int(p) for p in parts)
        except ValueError:
            return None
        return (year, month, day)

    def _todays_items(self, items):
        """
        Return the subset of items for "today".

        The dashboard returns today's set plus a few upcoming days, all of which
        are `isCompleted: false` until unlocked. Past days are never returned, so
        the smallest date present is today — using it avoids crediting (locked)
        future-day activities and sidesteps any client/server timezone mismatch.
        """
        keyed = [(self._date_key(it), it) for it in items]
        dated = [(k, it) for k, it in keyed if k is not None]
        if not dated:
            # No parseable dates — fall back to treating everything as today.
            return items
        today = min(k for k, _ in dated)

        # Some Daily Set cards don't carry a date in the payload (for example,
        # referral offers) but they still belong to today's set. Keep
        # undated items alongside the actual today's cards instead of dropping
        # them once any dated card is present.
        return [it for k, it in keyed if k is None or k == today]

    # -- Navigation helpers ----------------------------------------------------

    def _wait_ready(self, driver, timeout=15):
        """Wait until the new dashboard has streamed its data / rendered."""

        def _ready(d):
            try:
                return bool(
                    d.execute_script(
                        "return !!(window.__next_f || document.getElementById('dailyset'));"
                    )
                )
            except Exception:
                return False

        try:
            WebDriverWait(driver, timeout).until(_ready)
        except TimeoutException:
            pass

    def _wait_for(self, driver, selector, timeout=15):
        """Wait until `selector` matches an element. Returns True if it appeared."""

        def _ready(d):
            try:
                return bool(
                    d.execute_script(
                        "return !!document.querySelector(arguments[0]);", selector
                    )
                )
            except Exception:
                return False

        try:
            WebDriverWait(driver, timeout).until(_ready)
            return True
        except TimeoutException:
            return False

    # -- Top-level entry point -------------------------------------------------

    def perform(self, driver, human, stop_event=None):
        """
        Verify each Rewards function against the live dashboard, then run or
        skip with a reason. Order: Daily Set, Ready to claim, earn-page,
        punchcards, Edge minutes. Visual Search / mobile app are the caller.
        """
        self.needs_edge_browse = False
        try:
            driver.set_page_load_timeout(30)
        except Exception:
            pass
        self._log("[1/8] Daily Set — opening dashboard to verify cards...")
        progress = self.read_live_progress(driver, navigate=True)
        self._log_live_snapshot(progress)
        daily = progress.get("daily")
        daily_complete = (
            isinstance(daily, (list, tuple))
            and len(daily) == 2
            and int(daily[1]) > 0
            and int(daily[0]) >= int(daily[1])
        )
        daily_ok = False
        try:
            if daily_complete:
                self._log(
                    f"[1/8] Daily Set — live {daily[0]}/{daily[1]}, skipping card clicks."
                )
                daily_ok = True
            else:
                self._log(
                    "[1/8] Daily Set — scanning cards (will not hang on reload)..."
                )
                daily_ok = self._run_daily_set(
                    driver, human, stop_event=stop_event, already_on_dashboard=True
                )
        except Exception as e:
            self._log(f"[WARNING] Daily Set step aborted: {e}")
            daily_ok = False
        self._log("[1/8] Daily Set — finished, moving on.")
        try:
            self.visual_search_url = self._find_visual_search_url(driver)
            self.visual_search_progress = self.read_visual_search_progress(
                driver, navigate=False
            )
        except Exception as e:
            self._log(f"[WARNING] Visual-search link read failed: {e}")
        if stop_event is not None and stop_event.is_set():
            return daily_ok
        try:
            self._log("[2/8] Ready to claim — checking pending points...")
            self._run_claim(driver, human, stop_event=stop_event)
        except Exception as e:
            if not (stop_event is not None and stop_event.is_set()):
                self._log(f"[WARNING] Claim pass failed: {e}")
        if stop_event is not None and stop_event.is_set():
            return daily_ok
        try:
            self._log("[3/8] More activities (/earn) — verifying cards...")
            self._run_more_activities(driver, human, stop_event=stop_event)
        except Exception as e:
            if not (stop_event is not None and stop_event.is_set()):
                self._log(f"[WARNING] 'earn-page' pass failed: {e}")
        if stop_event is not None and stop_event.is_set():
            return daily_ok
        try:
            self._log("[4/8] Punchcards / quests — verifying /earn/quest...")
            self._run_quests(driver, human, stop_event=stop_event)
        except Exception as e:
            if not (stop_event is not None and stop_event.is_set()):
                self._log(f"[WARNING] Quest pass failed: {e}")
        if stop_event is not None and stop_event.is_set():
            return daily_ok
        try:
            earn_progress = self.read_live_progress(driver, navigate=False)
            edge = earn_progress.get("edge") or progress.get("edge")
            remaining = 0
            if isinstance(edge, (list, tuple)) and len(edge) == 2:
                remaining = max(0, int(edge[1]) - int(edge[0]))
                self._log(
                    f"[6/8] Edge browsing — live {edge[0]}/{edge[1]} minutes "
                    "(runs last so claim/check-in are not blocked)."
                )
            else:
                self._log("[6/8] Edge browsing — counter not on this page.")
            if remaining > 0 or self.needs_edge_browse:
                self.edge_minutes_remaining = remaining or 30
            else:
                self.edge_minutes_remaining = 0
                self._log("[6/8] Edge browsing — already complete, skipping.")
        except Exception as e:
            if not (stop_event is not None and stop_event.is_set()):
                self._log(f"[WARNING] Could not read Edge minutes: {e}")
        try:
            self.for_you_tasks = self.collect_for_you(driver)
            self._log(f"For you: {len(self.for_you_tasks)} open quest(s) saved.")
        except Exception as e:
            self._log(f"[WARNING] Could not collect For you quests: {e}")
        return daily_ok

    def collect_for_you(self, driver):
        """Incomplete punchcards still open on /earn. No static catalog, no ghosts."""
        items = []
        seen = set()

        def _add(task_id, title, detail, url, kind="quest"):
            if skip_offer(title, url):
                return
            key = (task_id or url or title or "").split("?")[0]
            if not key or key in seen:
                return
            if not (url or "").startswith("http"):
                return
            seen.add(key)
            items.append(
                {
                    "id": key[:80],
                    "title": (title or "Quest")[:90],
                    "detail": (detail or "")[:160],
                    "url": url,
                    "kind": kind,
                }
            )

        api = parse_userinfo(fetch_userinfo(driver))
        for q in api.get("punchcards") or []:
            if q.get("complete"):
                continue
            done, total = q.get("done"), q.get("total")
            if (
                isinstance(done, int)
                and isinstance(total, int)
                and total > 0
                and done >= total
            ):
                continue
            url = q.get("url") or ""
            if "/earn/quest/" not in url and "punchcard" not in url.lower():
                continue
            title = q.get("title") or "Punchcard"
            prog = (
                f"{done}/{total} tasks"
                if isinstance(done, int) and isinstance(total, int)
                else "open"
            )
            _add(url, title, prog, url, "quest")

        try:
            if "rewards.bing.com/earn" not in (driver.current_url or ""):
                self._safe_get(driver, EARN_URL)
                self._wait_ready(driver, timeout=8)
            self._expand_all(driver)
            quests = driver.execute_script(_QUESTS_JS) or []
        except Exception:
            quests = []
        for q in quests if isinstance(quests, list) else []:
            if not isinstance(q, dict):
                continue
            url = q.get("url") or ""
            title = q.get("title") or "Punchcard"
            if skip_offer(title, url):
                continue
            done, total = q.get("done"), q.get("total")
            if (
                isinstance(done, int)
                and isinstance(total, int)
                and total > 0
                and done >= total
            ):
                continue
            if "/earn/quest/" not in url:
                continue
            prog = (
                f"{done}/{total} tasks"
                if isinstance(done, int) and isinstance(total, int)
                else "open"
            )
            _add(url, title, prog, url, "quest")
        return items

    def _log_live_snapshot(self, progress):
        parts = []
        daily = progress.get("daily")
        if isinstance(daily, (list, tuple)) and len(daily) == 2:
            parts.append(f"Daily {daily[0]}/{daily[1]}")
        if isinstance(progress.get("claim"), int):
            parts.append(f"Claim {progress['claim']}")
        edge = progress.get("edge")
        if isinstance(edge, (list, tuple)) and len(edge) == 2:
            parts.append(f"Edge {edge[0]}/{edge[1]} min")
        checkin = progress.get("checkin")
        if isinstance(checkin, (list, tuple)) and len(checkin) == 2:
            parts.append(f"Check-in {checkin[0]}/{checkin[1]}")
        search = progress.get("search")
        if isinstance(search, (list, tuple)) and len(search) == 2:
            parts.append(f"Search {search[0]}/{search[1]}")
        if progress.get("hasVisual"):
            parts.append("Visual Search listed")
        if isinstance(progress.get("resetHours"), int):
            parts.append(f"daily set resets in {progress['resetHours']}h")
        self._log(
            "Live dashboard: "
            + (" | ".join(parts) if parts else "counters not readable")
        )
        search = progress.get("search")
        if isinstance(search, (list, tuple)) and len(search) == 2:
            self._log(
                f"Note: Search {search[0]}/{search[1]} is the daily *streak tile* "
                "(usually 1 search / 5 pts). It is not your PC/Mobile query boxes."
            )

    def _find_visual_search_url(self, driver):
        """
        Return the "visual search streak" mission's entry URL, or None.

        Called while the dashboard is loaded; the caller passes the URL to the
        visual search so the search credits the mission.
        """
        try:
            url = driver.execute_script(_FIND_VS_STREAK_URL_JS)
        except Exception:
            return None

        if not isinstance(url, str) or not url.startswith("http"):
            return None

        self._log(f"Visual search streak mission link: {url}")
        return url

    def read_visual_search_progress(self, driver, navigate=True):
        """
        Read the "visual search streak" mission progress from the dashboard.

        Args:
            driver: Selenium WebDriver instance.
            navigate (bool): Load the dashboard first. Pass False when the
                dashboard is already the current page.

        Returns:
            tuple: (done, total) — e.g. (0, 1) before today's search and (1, 1)
                once Rewards counted it — or None when the mission isn't
                offered or the progress can't be read.
        """
        try:
            if navigate:
                self._safe_get(driver, DASHBOARD_URL)
                self._wait_ready(driver, timeout=8)
                time.sleep(0.6)
            data = driver.execute_script(_VS_STREAK_PROGRESS_JS)
        except Exception:
            return None

        if not isinstance(data, dict):
            self._log(
                "[INFO] No visual search streak card on the dashboard "
                "(mission not offered, or its markup changed)."
            )
            return None

        try:
            done, total = int(data["done"]), int(data["total"])
        except (KeyError, TypeError, ValueError):
            return None

        if done == 0:
            self._log(
                f"[INFO] Streak read as {done}/{total} from the "
                f"{data.get('source', '?')} of: {data.get('card', '?')!r}"
            )

        return done, total

    def _find_claim_tile(self, driver):
        """
        Find the dashboard "ready to claim" tile.

        It is a clickable (non-link) card with the coins icon and a danger-status
        dot for the pending points. The balance tile shows the same coins icon
        but is an <a href="/redeem"> with no danger dot, so it is excluded.
        Matched by design-system tokens only, never by localized labels.

        Returns:
            tuple: (tile element or None, pending points as a string).
        """
        try:
            icons = driver.find_elements(
                By.CSS_SELECTOR, 'img[src*="CoinsTransparent"]'
            )
        except Exception:
            icons = []

        for icon in icons:
            try:
                anc = icon.find_element(
                    By.XPATH,
                    "./ancestor::*[contains(@class,'cursor-pointer')][1]",
                )
                if anc.tag_name.lower() == "a":
                    continue
                if not anc.find_elements(By.CSS_SELECTOR, '[class*="statusDanger"]'):
                    continue
                try:
                    pending = anc.find_element(
                        By.CSS_SELECTOR, ".text-pageHeader"
                    ).text.strip()
                except Exception:
                    pending = ""
                return anc, pending
            except Exception:
                continue

        return None, ""

    def _find_claim_control(self, driver, timeout=10):
        """
        Wait for the claim panel opened by the tile and return its primary control.

        Returns:
            WebElement: The element to click, or None if none appeared in time.
        """
        try:
            return WebDriverWait(driver, timeout).until(
                lambda d: d.execute_script(_FIND_CLAIM_CONTROL_JS)
            )
        except TimeoutException:
            return None
        except Exception:
            return None

    def _run_claim(self, driver, human, stop_event=None):
        """
        Claim pending points from the dashboard "ready to claim" tile.

        New-dashboard points must be claimed before they count toward the balance
        (and they expire ~1 month after being earned). The tile shows a pending
        count with a danger dot; clicking it opens a flyout whose primary button
        claims them. Best-effort and language-independent — matched by the
        coins-icon asset, the danger-status token and the brand-button token,
        never by localized labels.
        """
        self._log("Checking for claimable points (new dashboard)")
        if not self._safe_get(driver, DASHBOARD_URL):
            self._log("[WARNING] Could not open the dashboard to claim.")
            return
        self._wait_ready(driver, timeout=8)
        time.sleep(0.6)

        live = self.read_live_progress(driver, navigate=False)
        pending_live = live.get("claim")
        card, pending = self._find_claim_tile(driver)
        if not pending and pending_live:
            pending = str(pending_live)

        if card is None:
            try:
                card = driver.execute_script(_FIND_CLAIM_CTA_JS)
            except Exception:
                card = None

        if card is None and not pending_live:
            self._log("[2/8] Ready to claim — nothing pending, skipping.")
            return
        if card is None:
            self._log(
                f"[2/8] Ready to claim — {pending or pending_live} shown but "
                "no Claim control found."
            )
            return

        self._log(
            f"[2/8] Ready to claim — {pending or pending_live or '?'} pending, clicking Claim."
        )
        try:
            driver.execute_script(
                "arguments[0].scrollIntoView({block:'center'});", card
            )
            time.sleep(random.uniform(0.4, 0.8))
            human.click_element(card, scroll_into_view=False)
        except Exception as e:
            if stop_event is not None and stop_event.is_set():
                return
            self._log(f"[WARNING] Could not open the claim flyout: {e}")
            return

        # Newer dashboards put Claim on the tile itself (no flyout). Try that
        # first; fall back to the flyout brand control.
        time.sleep(random.uniform(0.8, 1.4))
        btn = None
        try:
            btn = driver.execute_script(_FIND_CLAIM_CTA_JS)
        except Exception:
            btn = None
        if btn is None:
            btn = self._find_claim_control(driver, timeout=8)

        if btn is None:
            try:
                diag = driver.execute_script(
                    "return document.querySelectorAll('[class*=\"bgCtrlBrand\"]').length"
                    " + '/' + document.querySelectorAll("
                    '\'[role="dialog"], [class*="bg-flyout"]\').length;'
                )
            except Exception:
                diag = "?"
            self._log(
                "[WARNING] Claim button not found after opening the claim tile "
                f"(brand controls/panels on page: {diag})."
            )
            return
        try:
            human.click_element(btn, scroll_into_view=True)
        except Exception as e:
            if stop_event is not None and stop_event.is_set():
                return
            try:
                driver.execute_script("arguments[0].click();", btn)
            except Exception:
                self._log(f"[WARNING] Could not click the claim button: {e}")
                return
        if wait_or_stop(random.uniform(2.0, 3.5), stop_event):
            return
        self.last_totals["attempted"] = self.last_totals.get("attempted", 0) + 1
        after = self.read_live_progress(driver, navigate=True)
        left = after.get("claim")
        if isinstance(left, int) and left == 0:
            self._log("Claim verified: 0 pending.")
        elif isinstance(left, int):
            self._log(
                f"[WARNING] Claim still shows {left} pending after click. Retrying."
            )
            try:
                again = driver.execute_script(_FIND_CLAIM_CTA_JS)
                if again is not None:
                    driver.execute_script("arguments[0].click();", again)
                    wait_or_stop(2.0, stop_event)
                    after = self.read_live_progress(driver, navigate=True)
                    left = after.get("claim")
            except Exception:
                pass
            if isinstance(left, int) and left == 0:
                self._log("Claim verified on retry: 0 pending.")
            else:
                self._log(f"[WARNING] Claim not confirmed (still {left}).")
        else:
            self._log("Clicked claim — pending amount could not be re-read.")

    def _flyout_activities(self, driver):
        """Read leftover +N quizzes/puzzles from the Bing Rewards flyout."""
        items = []
        try:
            if not self._safe_get(driver, FLYOUT_URL):
                return items
            time.sleep(1.2)
            raw = driver.execute_script("""
                var out = [];
                var seen = {};
                document.querySelectorAll('a[href*="bing.com"]').forEach(function(a) {
                  var href = a.href || '';
                  if (href.indexOf('/search') < 0 && href.indexOf('form=') < 0) return;
                  if (href.indexOf('redeem') >= 0) return;
                  var t = (a.innerText || '').replace(/\\s+/g, ' ').trim();
                  if (!t || t.length < 4) return;
                  if (seen[href]) return;
                  seen[href] = 1;
                  var m = t.match(/(\\d+)\\s*$/);
                  var pts = m ? parseInt(m[1], 10) : 0;
                  var title = t.replace(/\\s*\\d+\\s*$/, '').trim();
                  out.push({destination: href, title: title.slice(0, 80), points: pts});
                });
                return out;
                """) or []
        except Exception as e:
            self._log(f"[WARNING] Flyout activities unread: {e}")
            return items
        for it in raw if isinstance(raw, list) else []:
            title = it.get("title") or ""
            dest = it.get("destination") or ""
            if skip_offer(title, dest):
                continue
            if not dest.startswith("http"):
                continue
            if re.search(
                r"ver todo|buscar con bing|conjunto diario|search with bing|"
                r"daily set|panel de rewards",
                title,
                re.I,
            ):
                continue
            items.append(it)
        if items:
            self._log(f"Flyout: {len(items)} leftover quiz/puzzle link(s).")
        return items

    def _run_more_activities(self, driver, human, stop_event=None):
        """
        Click the incomplete point-earning cards in the /earn "earn-page"
        section (#moreactivities). Mirrors the legacy "More Activities" section.
        """
        self._log("Checking 'earn-page' activities (new dashboard)")
        if not self._safe_get(driver, EARN_URL):
            self._log("[WARNING] Could not open the earn page.")
            return

        self._wait_for(driver, "#moreactivities", timeout=8)
        time.sleep(0.6)
        self._expand_section(driver, "moreactivities")
        time.sleep(random.uniform(0.5, 1.0))

        try:
            items = driver.execute_script(_MORE_ACTIVITIES_JS)
        except Exception as e:
            self._log(f"[WARNING] Could not read 'earn-page' cards: {e}")
            return
        if not isinstance(items, list):
            items = []
        fly = self._flyout_activities(driver)
        seen = {(it.get("destination") or "").split("?")[0] for it in items}
        for extra in fly:
            dest = extra.get("destination") or ""
            if dest.split("?")[0] in seen:
                continue
            items.append(extra)
            seen.add(dest.split("?")[0])
        if not items:
            self._log("[3/8] More activities — nothing incomplete, skipping.")
            return

        self._log(f"[3/8] More activities — {len(items)} incomplete, running.")
        main_tab = driver.current_window_handle
        done = 0
        for item in items:
            if stop_event is not None and stop_event.is_set():
                self._log("Stop requested — halting 'earn-page'.")
                break
            dest = item.get("destination")
            title = item.get("title") or "activity"
            if not isinstance(dest, str) or not dest.startswith("http"):
                continue
            if skip_offer(title, dest):
                self._log(f"Skipping non-automatable activity: {title}")
                continue
            self._log(f"Opening activity: {title} (+{item.get('points')})")
            anchor = self._locate_anchor(driver, dest, section_id="moreactivities")
            if anchor is not None and self._click_anchor(
                driver,
                human,
                anchor,
                main_tab,
                stop_event,
                return_url=EARN_URL,
                section_id="moreactivities",
            ):
                done += 1
                continue
            # Fallback: direct navigation (less likely to credit, but better than skip).
            self._log(f"[INFO] Falling back to direct navigation for '{title}'.")
            try:
                driver.get(dest)
                done += 1
                time.sleep(random.uniform(2, 4))
                try:
                    human.scroll_page()
                except Exception:
                    pass
                time.sleep(random.uniform(2, 4))
                driver.get(EARN_URL)
                self._wait_for(driver, "#moreactivities", timeout=10)
                time.sleep(random.uniform(1, 2))
                self._expand_section(driver, "moreactivities")
            except Exception as e:
                if stop_event is not None and stop_event.is_set():
                    break
                self._log(f"[WARNING] Failed to open '{title}': {e}")

        if done:
            # These opens aren't re-read/confirmed, so they count in their own
            # `earn` bucket (and as attempts); `newly` stays reserved for
            # verified daily-set completions.
            self.last_totals["earn"] = self.last_totals.get("earn", 0) + done
            self.last_totals["attempted"] = self.last_totals.get("attempted", 0) + done
        self._log(f"'earn-page': opened {done} activity(ies) this run.")

    def _run_quests(self, driver, human, stop_event=None):
        """
        Complete the currently-actionable tasks inside /earn "quest" punchcards.

        A quest is a multi-task card that links to its own /earn/quest/<id> page;
        each task is a Bing-search link that must be really clicked to credit
        (like a daily-set card). Punchcard tasks are time-gated — typically only
        one unlocks per ~24h — so a run completes only what's unlocked right now;
        locked tasks carry aria-disabled / data-disabled and are skipped. Full
        completion of a quest therefore takes several daily runs.
        """
        self._log("Checking 'earn-page' quests (new dashboard)")
        if not self._safe_get(driver, EARN_URL):
            self._log("[WARNING] Could not open the earn page for quests.")
            return
        self._wait_ready(driver, timeout=8)

        # Quest cards sit in a collapsible panel and stream in progressively.
        # Expand every collapsed section, then poll discovery until the set of
        # quests stops growing so a late-rendered card isn't missed.
        self._expand_all(driver)
        quests = []
        for _ in range(6):
            time.sleep(random.uniform(0.8, 1.4))
            try:
                current = driver.execute_script(_QUESTS_JS) or []
            except Exception as e:
                self._log(f"[WARNING] Could not read quests: {e}")
                return
            if isinstance(current, list) and len(current) > len(quests):
                quests = current
            elif quests:
                break
        if not quests:
            self._log("Quests: none found.")
            return

        # Keep only quests that award points and aren't finished. Points-earning
        # quests carry a "+N" badge on their card; promo quests (partner offers,
        # e.g. Spotify/MasterClass) show none and are skipped, as are quests
        # already complete (progress N/N).
        pending = []
        for q in quests:
            if not isinstance(q, dict):
                continue
            url = q.get("url")
            if not isinstance(url, str) or "/earn/quest/" not in url:
                continue
            pts = q.get("points")
            url_l = url.lower()
            if skip_offer(q.get("title") or "", url):
                continue
            # Monthly punchcards (e.g. ENWW_pcparent_..._punchcard) must run
            # even when the "+N" badge failed to parse.
            if (not isinstance(pts, int) or pts <= 0) and "punchcard" not in url_l:
                continue
            d, t = q.get("done"), q.get("total")
            is_punchcard = "punchcard" in url_l
            # Never skip a punchcard just because the earn-page badge looks
            # full — the quest page is the source of truth.
            if (
                not is_punchcard
                and isinstance(d, int)
                and isinstance(t, int)
                and t > 0
                and d >= t
            ):
                continue
            pending.append(q)

        seen_urls = {(q.get("url") or "").split("?")[0].rstrip("/") for q in pending}
        api = parse_userinfo(fetch_userinfo(driver))
        api_cards = {
            (c.get("url") or "").split("?")[0].rstrip("/"): c
            for c in api.get("punchcards") or []
        }
        for known in KNOWN_PUNCHCARD_URLS:
            key = known.split("?")[0].rstrip("/")
            card = api_cards.get(key)
            if card and card.get("complete"):
                continue
            if key not in seen_urls:
                pending.append(
                    {
                        "url": known,
                        "title": (card or {}).get("title") or "Monthly PC punchcard",
                        "points": 50,
                    }
                )
                self._log(f"Quests: adding punchcard {known}")

        if not pending:
            self._log("Quests: no points-earning quest to do.")
            return

        self._log(f"Quests: {len(pending)} points-earning quest(s) to check.")
        main_tab = driver.current_window_handle
        opened = 0
        for q in pending:
            if stop_event is not None and stop_event.is_set():
                self._log("Stop requested — halting quests.")
                break
            url = q["url"]
            title = q.get("title") or "quest"
            self._log(f"Opening punchcard/quest: {title} ({url})")
            try:
                driver.get(url)
                self._wait_ready(driver)
            except Exception as e:
                self._log(f"[WARNING] Could not open quest '{title}': {e}")
                continue

            # The task list streams in after hydration; _wait_ready only gates on
            # the Next.js payload existing. Wait for a task heading to render
            # before reading, so a not-yet-loaded list isn't mistaken for
            # "nothing to do" (which would skip an unlocked task).
            if not self._wait_for(
                driver, '[class*="rewardsTableAltBg"] h3', timeout=15
            ):
                self._log(f"Quest '{title}': task list did not render — skipping.")
                continue
            time.sleep(random.uniform(1.0, 1.8))

            try:
                tasks = driver.execute_script(_QUEST_TASKS_JS)
            except Exception as e:
                self._log(f"[WARNING] Could not read tasks for quest '{title}': {e}")
                continue
            if not isinstance(tasks, list) or not tasks:
                self._log(
                    f"Quest '{title}': no actionable task right now "
                    "(locked or complete)."
                )
                continue

            self._log(f"Quest '{title}': {len(tasks)} actionable task(s).")
            for task in tasks:
                if stop_event is not None and stop_event.is_set():
                    break
                dest = task.get("destination")
                ttitle = task.get("title") or "task"
                if not isinstance(dest, str) or not dest.startswith("http"):
                    continue
                if skip_offer(ttitle, dest):
                    self._log(f"Skipping non-automatable quest task: {ttitle}")
                    continue
                self._log(f"Opening quest task: {ttitle}")
                low = (ttitle + " " + dest).lower()
                if any(
                    k in low
                    for k in (
                        "edge browsing",
                        "browse with microsoft edge",
                        "30 min",
                        "30-min",
                        "30 minutes",
                        "search on microsoft edge",
                    )
                ):
                    self.needs_edge_browse = True
                anchor = self._locate_quest_task(driver, dest)
                if anchor is not None and self._click_anchor(
                    driver, human, anchor, main_tab, stop_event, return_url=url
                ):
                    opened += 1
                    # Re-open the quest page so the next task's element can be
                    # relocated fresh (the DOM re-renders after each click).
                    try:
                        driver.get(url)
                        self._wait_ready(driver)
                        time.sleep(random.uniform(1, 2))
                    except Exception:
                        pass

        if opened:
            # Unverified opens count in their own `quests` bucket (and as
            # attempts); `newly` is reserved for verified completions.
            self.last_totals["quests"] = self.last_totals.get("quests", 0) + opened
            self.last_totals["attempted"] = (
                self.last_totals.get("attempted", 0) + opened
            )
        self._log(f"Quests: opened {opened} task(s) this run.")

    def _run_daily_set(
        self, driver, human, stop_event=None, already_on_dashboard=False
    ):
        """
        Open the new dashboard, visit each incomplete daily-set activity for
        today, then re-read to confirm progress.

        Args:
            driver: Selenium WebDriver instance.
            human: HumanBehavior instance (used for human-like dwell/scroll).
            stop_event (threading.Event, optional): When set, aborts cleanly.

        Returns:
            bool: True if it's reasonable to mark today as done, False if we made
                  no progress (so the next run can retry).
        """
        self._log("Performing daily Rewards tasks (new dashboard)")

        try:
            if not already_on_dashboard:
                self._safe_get(driver, DASHBOARD_URL)
            self._wait_ready(driver, timeout=8)
            if wait_or_stop(0.8, stop_event):
                return False
            self._log("Daily Set: reading card list...")

            # Primary: poll the embedded RSC JSON (streams in progressively). It
            # is authoritative — it carries the exact destination + isCompleted.
            # Cross-checked against the rendered #dailyset DOM by _choose_today:
            # the JSON is often drained post-hydration or partially streamed, so
            # the DOM decides which cards really are today's. A genuine failure
            # (neither source yields cards) is reported by the "No daily-set
            # activities found" warning below.
            json_today = self._todays_items(self._read_items_polling(driver))
            dom_today = self._todays_items(self._read_items_dom(driver))
            todays, source = self._choose_today(json_today, dom_today)
            if not todays:
                diag = self._diagnostics(driver)
                self._log(
                    "[WARNING] No daily-set activities found in the new dashboard — "
                    f"url={diag.get('url')!r} title={diag.get('title')!r} "
                    f"chunks={diag.get('chunks')} blobLen={diag.get('blobLen')} "
                    f"hasDailySetItems={diag.get('hasKey')} "
                    f"hasDailysetSection={diag.get('hasDailyset')}"
                )
                return False

            self._log(
                f"New dashboard daily set: read {len(todays)} item(s) via {source}."
            )

            incomplete = [it for it in todays if not it.get("isCompleted")]
            for it in todays:
                title = (it.get("title") or it.get("name") or "card").strip() or "card"
                if it.get("isCompleted"):
                    self._log(f"Daily Set: '{title}' already complete — skip.")
                else:
                    dest = (it.get("destination") or "")[:80]
                    kind = (
                        "quiz/poll"
                        if re.search(r"quiz|poll|dsetqu|wqoskey", dest, re.I)
                        else "click"
                    )
                    self._log(f"Daily Set: '{title}' incomplete — will {kind}.")
            total = len(todays)
            already = total - len(incomplete)
            self.last_totals = {
                "already": already,
                "newly": 0,
                "final": already,
                "total": total,
                "attempted": 0,
                "earn": 0,
                "quests": 0,
            }
            self._log(f"New dashboard daily set: {already}/{total} already complete.")

            if not incomplete:
                return True

            # Clicking the card (which opens its search in a new tab from the
            # dashboard) is what credits the offer — a bare driver.get() to the
            # destination does not. Expand the section, then click each incomplete
            # card like a user would.
            main_tab = driver.current_window_handle
            self._expand_section(driver)

            attempted = 0
            for item in todays:
                if stop_event is not None and stop_event.is_set():
                    self._log("Stop requested — halting new-dashboard daily set.")
                    break
                if item.get("isCompleted"):
                    continue

                destination = item.get("destination")
                title = item.get("title") or item.get("offerId") or "activity"
                if not isinstance(destination, str) or not destination.startswith(
                    "http"
                ):
                    self._log(f"[WARNING] Skipping '{title}': no valid destination.")
                    continue

                self._log(f"Opening daily-set activity: {title}")
                anchor = self._locate_anchor(driver, destination)
                if anchor is not None and self._click_anchor(
                    driver, human, anchor, main_tab, stop_event
                ):
                    attempted += 1
                    continue

                # Last resort if the card can't be located/clicked: navigate
                # directly (often won't credit, but better than skipping).
                self._log(f"[INFO] Falling back to direct navigation for '{title}'.")
                try:
                    driver.get(destination)
                    attempted += 1
                    if wait_or_stop(random.uniform(2, 4), stop_event):
                        break
                    try:
                        human.scroll_page()
                    except Exception:
                        pass
                    if wait_or_stop(random.uniform(2, 4), stop_event):
                        break
                    driver.get(DASHBOARD_URL)
                    self._wait_ready(driver)
                    if wait_or_stop(random.uniform(1, 2), stop_event):
                        break
                    self._expand_section(driver)
                except Exception as e:
                    if stop_event is not None and stop_event.is_set():
                        break
                    self._log(f"[WARNING] Failed to open '{title}': {e}")

            if attempted == 0:
                self._log("[WARNING] No daily-set activities could be opened.")
                return False

            if stop_event is not None and stop_event.is_set():
                return False

            # Re-read the dashboard to measure how many activities actually
            # flipped to complete. window.__next_f is drained after hydration, so
            # the re-read relies on the same JSON-then-DOM strategy as the initial
            # read — reading JSON only here would always look "all done" (empty)
            # and falsely report success.
            newly = 0
            verified = False
            try:
                driver.get(DASHBOARD_URL)
                self._wait_ready(driver)
                if wait_or_stop(random.uniform(1.5, 2.5), stop_event):
                    return False
                # The re-read can race a still-streaming (partial) snapshot; one
                # missing cards would make them look completed and inflate
                # `newly`. Only trust a snapshot that covers at least as many
                # cards as we started with — retry (JSON then DOM) until it does.
                after = []
                for _ in range(5):
                    # Same source arbitration as the initial read: a partial
                    # (or other-day) JSON snapshot must not beat the DOM, or
                    # missing cards would be counted as completed.
                    after, _src = self._choose_today(
                        self._todays_items(self._read_items(driver)),
                        self._todays_items(self._read_items_dom(driver)),
                    )
                    if len(after) >= len(todays):
                        break
                    if wait_or_stop(1.5, stop_event):
                        return False
                if after and len(after) >= len(todays):
                    verified = True
                    still_incomplete = sum(
                        1 for it in after if not it.get("isCompleted")
                    )
                    newly = max(0, len(incomplete) - still_incomplete)
                else:
                    self._log(
                        "[INFO] Post-run snapshot incomplete "
                        f"({len(after)}/{len(todays)} cards) — not confirming "
                        "completion this run."
                    )
            except Exception:
                pass

            self.last_totals["attempted"] = attempted
            self.last_totals["newly"] = newly
            self.last_totals["final"] = already + newly

            if newly > 0:
                self._log(f"New dashboard daily set: +{newly} completed this run.")
                return True

            if verified:
                # We could re-read the cards and they are still incomplete: the
                # visits did not credit (common in headless — Rewards often won't
                # credit a headless session) or the items are quizzes needing
                # manual answers. Report honestly and don't mark today done, so a
                # later (visible) run can retry.
                self._log(
                    "[WARNING] Daily-set activities were opened but none are marked "
                    "complete on the dashboard. Not marking today done — if this is "
                    "a headless run, try again with the browser visible."
                )
            else:
                self._log(
                    "[WARNING] Could not re-read the dashboard to confirm daily-set "
                    "completion. Not marking today done."
                )
            return False

        except Exception as e:
            if stop_event is not None and stop_event.is_set():
                self._log("New-dashboard daily set halted by Stop.")
                return False
            self._log(f"[ERROR] New-dashboard daily set failed: {e}")
            return False

    def _run_edge_browse_streak(self, driver, human, stop_event=None, minutes=30):
        """Quit the WebDriver session and browse in a real foreground Edge."""
        minutes = max(1, int(minutes or 30))
        mgr = getattr(self, "_driver_manager", None)
        if mgr is not None:
            try:
                mgr.close_running_edge(settle=False)
            except Exception:
                pass
        run_native_edge_streak(
            logger=self._log,
            stop_event=stop_event,
            minutes=minutes,
            driver_manager=mgr,
        )


def run_native_edge_streak(logger, stop_event, minutes, driver_manager):
    """
    Edge Browsing Streak uses a real Microsoft Edge process (not a WebDriver
    window). Launch it on the account profile without activating it, rotate
    Bing/MSN pages, and poll Minutes: x/30. If progress sticks (the common
    5/30 hang), kill Edge and relaunch.
    """
    from ..emulator.driver import DriverManager

    log = logger if callable(logger) else (lambda *_: None)
    if driver_manager is None or not isinstance(driver_manager, DriverManager):
        log("[WARNING] Edge streak: no profile manager, skipping.")
        return
    minutes = max(1, int(minutes or 30))
    pages = (
        "https://www.bing.com/?form=EDGNTC",
        "https://www.msn.com/?ocid=entnewsntp",
        "https://www.bing.com/news?form=EDGNTC",
        "https://www.bing.com/search?q=today+weather&form=EDGSRCH",
        "https://www.microsoft.com/en-us/edge?form=EDGNTC",
        "https://www.bing.com/search?q=local+news&form=ANNTH1",
    )
    log(
        f"Edge Browsing Streak: running Edge in the background for "
        f"up to {minutes} min (kills leftover Edge first; relaunch if stuck at 5/30)."
    )
    deadline = time.monotonic() + minutes * 60 + 180
    last_done = None
    last_change = time.monotonic()
    n = 0
    attached = None
    native_proc = None

    def _stopped():
        return stop_event is not None and stop_event.is_set()

    def _detach():
        nonlocal attached
        drv = attached
        attached = None
        if drv is None:
            return
        try:
            drv.quit()
        except Exception:
            pass

    def _launch():
        nonlocal attached, native_proc
        _detach()
        if _stopped():
            return None
        driver_manager.close_running_edge(settle=False)
        if wait_or_stop(0.4, stop_event):
            return None
        try:
            native_proc, port = driver_manager.start_native_edge(
                pages[0],
                stop_event=stop_event,
                hide=bool(getattr(driver_manager, "hide_browser", False)),
            )
        except Exception as err:
            if _stopped() or "stopped" in str(err).lower():
                return None
            raise
        last_err = None
        for attempt in range(5):
            if _stopped():
                return None
            if wait_or_stop(1.0 + attempt * 0.4, stop_event):
                return None
            try:
                attached = driver_manager.attach_to_edge(port)
                return attached
            except Exception as err:
                last_err = err
        raise last_err or RuntimeError("Could not attach to Edge")

    def _read_minutes(drv):
        try:
            drv.get(EARN_URL)
            if wait_or_stop(2.5, stop_event):
                return None
            data = drv.execute_script(_LIVE_PROGRESS_JS) or {}
            edge = data.get("edge") if isinstance(data, dict) else None
            if isinstance(edge, (list, tuple)) and len(edge) == 2:
                return int(edge[0]), int(edge[1])
        except Exception as e:
            from ..emulator.driver import is_browser_closed_error

            if is_browser_closed_error(e) or (
                native_proc is not None and native_proc.poll() is not None
            ):
                if stop_event is not None:
                    stop_event.set()
            return None
        return None

    try:
        drv = _launch()
        if drv is None:
            log("Edge Browsing Streak stopped by user.")
            return
        while time.monotonic() < deadline:
            if _stopped():
                log("Edge Browsing Streak stopped by user.")
                return
            if native_proc is not None and native_proc.poll() is not None:
                if stop_event is not None:
                    stop_event.set()
                log("Edge window closed by user — stopping Edge Browsing Streak.")
                return
            progress = _read_minutes(drv)
            if _stopped():
                log("Edge Browsing Streak stopped by user.")
                return
            if progress:
                done, total = progress
                if last_done is None or done != last_done:
                    log(f"Edge Browsing Streak: live {done}/{total} minutes.")
                    last_done = done
                    last_change = time.monotonic()
                if total > 0 and done >= total:
                    log("Edge Browsing Streak: 30/30 complete.")
                    return
                # Known hang: counter freezes at 5/30 until Edge is fully killed.
                if time.monotonic() - last_change > 480:
                    log(
                        "Edge Browsing Streak: no progress for 8 min "
                        f"(stuck at {done}/{total}). Killing Edge and relaunching."
                    )
                    drv = _launch()
                    if drv is None:
                        log("Edge Browsing Streak stopped by user.")
                        return
                    last_change = time.monotonic()
                    continue
            url = pages[n % len(pages)]
            n += 1
            try:
                drv.get(url)
                if wait_or_stop(random.uniform(2.0, 4.0), stop_event):
                    log("Edge Browsing Streak stopped by user.")
                    return
                try:
                    drv.execute_script(
                        "window.scrollBy(0, arguments[0]);",
                        random.randint(250, 900),
                    )
                except Exception:
                    pass
            except Exception as e:
                from ..emulator.driver import is_browser_closed_error

                if (
                    _stopped()
                    or is_browser_closed_error(e)
                    or (native_proc is not None and native_proc.poll() is not None)
                ):
                    if stop_event is not None:
                        stop_event.set()
                    log("Edge window closed by user — stopping Edge Browsing Streak.")
                    return
                log(f"[WARNING] Edge streak navigation failed: {e}")
            if wait_or_stop(50, stop_event):
                log("Edge Browsing Streak stopped by user.")
                return
        log("Edge Browsing Streak: time budget finished.")
    except Exception as e:
        if _stopped() or "stopped" in str(e).lower():
            log("Edge Browsing Streak stopped by user.")
            return
        log(f"[WARNING] Edge Browsing Streak failed: {e}")
    finally:
        _detach()
        try:
            driver_manager.close_running_edge(settle=False)
        except Exception:
            pass
