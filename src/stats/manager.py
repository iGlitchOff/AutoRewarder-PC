"""
Statistics storage + points-balance scraping for a single account.

Two complementary data sources feed the dashboard (see the design choice in
the GUI):

  * Activity counters — exact counts of PC / Mobile searches and Daily Set
    cards completed, accumulated from each run. These drive an *estimated*
    points figure (counters x per-item constants) used as a fallback when the
    real balance can't be scraped.
  * Real balance — the actual "available points" number scraped from
    rewards.bing.com at the end of a run that visits it. This is the source of
    truth for the total, and successive scrapes give the points delta for a
    session.

Persistence mirrors HistoryManager: atomic temp-file writes and graceful
recovery (back up + reset) when the JSON file is unreadable.
"""

import os
import json
from datetime import datetime

# Microsoft Rewards awards roughly these points per item. Used ONLY for the
# estimated-points figure shown when no real balance has been scraped yet;
# the scraped balance always takes precedence as the source of truth.
POINTS_PER_SEARCH = 3
POINTS_PER_CARD = 10

# How many recent days of activity to retain for the dashboard timeline.
# Stored as per-day aggregates (not per-run), so heavy advanced-scheduling days
# — which fire one session per query — can't evict older days.
_DAILY_KEEP = 90

# JS executed on rewards.bing.com (or a Bing SERP) to read the user's current
# available-points balance. Works on both the legacy mee-rewards-* dashboard
# (DOM selectors) and the new Next.js dashboard (RSC payload in window.__next_f).
# Tries a series of known selectors and returns an
# object {value, via, candidates}. `value` is the first plausible integer found
# (thousand separators stripped) or null; `candidates` is a small sample of
# what each selector matched, logged when value is null so the real (locale-
# and version-dependent) DOM can be diagnosed without a live debugger.
# Defensive throughout: any DOM shift just yields a null value and the caller
# falls back to the estimate rather than crashing.
_SCRAPE_BALANCE_JS = r"""
return (function () {
  function toInt(raw) {
    if (raw == null) return null;
    var s = String(raw).trim();
    if (!s) return null;
    // Match the first contiguous formatted number (e.g. "12,450" or "12.450" or "9 494")
    // rather than concatenating unrelated digits across a string.
    var m = s.match(/\d{1,3}(?:[.,\s\u00A0]\d{3})+|\d+/);
    if (!m) return null;
    var digits = m[0].replace(/[^0-9]/g, '');
    if (!digits) return null;
    var n = parseInt(digits, 10);
    return (isFinite(n) && n >= 0 && n <= 10000000) ? n : null;
  }
  var selectors = [
    'mee-rewards-user-status-banner-balance .pointsValue span[aria-label]',
    'mee-rewards-user-status-banner-balance mee-rewards-counter-animation span',
    'mee-rewards-user-status-banner-balance .pointsValue',
    '#balanceToolTipDiv .pointsValue',
    'a[href="/redeem"] .text-pageHeader',
    '#fly_id_rc', '#id_rc'
  ];
  var candidates = [];
  for (var i = 0; i < selectors.length; i++) {
    var nodes = document.querySelectorAll(selectors[i]);
    for (var j = 0; j < nodes.length; j++) {
      var el = nodes[j];
      var aria = el.getAttribute('aria-label');
      var txt = (el.textContent || '').replace(/\s+/g, ' ').trim();
      var val = toInt(aria);
      if (val == null) val = toInt(txt);
      if (candidates.length < 14) {
        candidates.push(selectors[i] + ' => "' + (aria || txt).slice(0, 32) + '" [' + val + ']');
      }
      if (val != null && val >= 0) {
        return {
          value: val, via: selectors[i], candidates: candidates,
          url: location.href, title: document.title
        };
      }
    }
  }
  try {
    if (window.__next_f) {
      var parts = [];
      for (var k = 0; k < window.__next_f.length; k++) {
        var e = window.__next_f[k];
        if (Array.isArray(e)) { if (typeof e[1] === 'string') parts.push(e[1]); }
        else if (typeof e === 'string') { parts.push(e); }
      }
      var blob = parts.join('');
      var re = /"availablePoints"\s*:\s*(\d+)/g;
      var m, last = null;
      while ((m = re.exec(blob)) !== null) { last = parseInt(m[1], 10); }
      if (last != null && isFinite(last) && last >= 0 && last <= 10000000) {
        if (candidates.length < 14) {
          candidates.push('__next_f.availablePoints => [' + last + ']');
        }
        return {
          value: last, via: 'new-dashboard:availablePoints', candidates: candidates,
          url: location.href, title: document.title
        };
      }
    }
  } catch (eNext) { /* fall through to null */ }
  return {
    value: null, via: null, candidates: candidates,
    url: location.href, title: document.title
  };
})();
"""


def _fetch_api_userinfo_balance(driver):
    """Fetch authoritative availablePoints and counters from /api/getuserinfo."""
    if driver is None:
        return None
    try:
        url = str(getattr(driver, "current_url", "") or "").lower()
        if "rewards.bing.com" not in url:
            return None
        driver.set_script_timeout(12)
        data = driver.execute_async_script("""
            const done = arguments[0];
            fetch('/api/getuserinfo?type=1&_=' + Date.now(), {
              credentials: 'include',
              headers: {Accept: 'application/json'}
            })
              .then(r => r.ok ? r.json() : null)
              .then(d => {
                if (!d) return done(null);
                const dash = d.dashboard || d;
                const us = (dash && dash.userStatus) || {};
                if (us.isSignedOut === true || d.isSignedOut === true) return done(null);
                const avail = us.availablePoints;
                if (typeof avail === 'number' && isFinite(avail) && avail >= 0) {
                  return done({value: Math.floor(avail), via: 'api:getuserinfo'});
                }
                return done(null);
              })
              .catch(() => done(null));
            """)
        if isinstance(data, dict) and isinstance(data.get("value"), int):
            return data
    except Exception:
        pass
    return None


def scrape_points_balance_debug(driver):
    """
    Run the balance-scraping logic, preferring the authoritative
    /api/getuserinfo endpoint on rewards.bing.com and validating DOM fallback.
    """
    api_res = _fetch_api_userinfo_balance(driver)
    if api_res is not None:
        try:
            api_res["url"] = driver.current_url
            api_res["title"] = driver.title
            api_res["candidates"] = [f"api:getuserinfo => [{api_res['value']}]"]
        except Exception:
            pass
        return api_res

    try:
        result = driver.execute_script(_SCRAPE_BALANCE_JS)
    except Exception as e:
        return {"value": None, "via": None, "candidates": [], "error": str(e)[:120]}

    if isinstance(result, dict):
        # Reject unverified 0 balances from Bing SERP counters (#id_rc / #fly_id_rc)
        # because #id_rc initializes at 0 before the Rewards flyout finishes authenticating.
        via = str(result.get("via") or "")
        if result.get("value") == 0 and via in ("#id_rc", "#fly_id_rc"):
            result["value"] = None
        return result
    if isinstance(result, (int, float)) and not isinstance(result, bool):
        return {"value": int(result), "via": "legacy", "candidates": []}
    return {"value": None, "via": None, "candidates": []}


def scrape_points_balance(driver, logger=None):
    """
    Read the current Microsoft Rewards available-points balance from the page
    the driver is currently on (expected to be rewards.bing.com or a Bing
    results page where the rewards counter is visible).

    Logs the value on success; stays silent on failure (raw debug details are
    available via scrape_points_balance_debug for the dashboard's on-demand
    refresh diagnostic).

    Args:
        driver: Selenium WebDriver, already navigated to a page that shows the
            rewards balance.
        logger (callable, optional): logging function.

    Returns:
        int | None: the scraped balance, or None if it couldn't be read.
    """
    info = scrape_points_balance_debug(driver)
    value = info.get("value")

    if isinstance(value, (int, float)) and not isinstance(value, bool) and value >= 0:
        balance = int(value)
        if logger:
            logger(f"Points balance scraped: {balance:,}")
        return balance

    # Not found: stay silent in the activity feed. The raw debug info is
    # available via scrape_points_balance_debug() for the dashboard's on-demand
    # refresh diagnostic.
    return None


class StatsManager:
    """
    Manages the statistics file for a single account. Each instance is bound to
    a specific stats.json file path.
    """

    def __init__(self, stats_file, logger=None):
        """
        Args:
            stats_file (str): Absolute path to this account's stats.json.
            logger (callable, optional): Logging function.
        """
        self.stats_file = stats_file
        self._logger = logger

    def _log(self, message):
        if self._logger:
            self._logger(message)

    @staticmethod
    def _default():
        """Return a fresh, fully-populated stats structure."""
        return {
            # Cumulative totals over the account's whole lifetime.
            "lifetime": {
                "pc_searches": 0,
                "mobile_searches": 0,
                "daily_cards": 0,
                "earn_cards": 0,
                "quest_tasks": 0,
                "visual_searches": 0,
                "checkins": 0,
                "news_reads": 0,
                "edge_minutes": 0,
                "runs": 0,
                "points_estimate": 0,
            },
            # Real scraped balance (source of truth for the total). `previous`
            # is the value before the most recent scrape, used for the delta.
            "balance": {
                "current": None,
                "previous": None,
                "updated_at": None,
            },
            # Snapshot of the most recently recorded run.
            "last_session": {
                "ended_at": None,
                "pc_searches": 0,
                "mobile_searches": 0,
                "daily_cards": 0,
                "earn_cards": 0,
                "quest_tasks": 0,
                "visual_searches": 0,
                "checkins": 0,
                "news_reads": 0,
                "edge_minutes": 0,
                "points_estimate": 0,
                "points_delta": None,
            },
            # Per-day activity aggregates for the dashboard timeline, keyed by
            # "YYYY-MM-DD" → {pc, mobile, cards, runs}. Capped to _DAILY_KEEP
            # days. Per-day (not per-run) so a busy day can't evict old days.
            "daily": {},
        }

    @staticmethod
    def _trim_daily(daily):
        """Keep only the most recent _DAILY_KEEP days (by sorted date key)."""
        if not isinstance(daily, dict):
            return {}
        keys = sorted(daily.keys())
        for k in keys[:-_DAILY_KEEP]:
            daily.pop(k, None)
        return daily

    @staticmethod
    def _daily_from_runs(runs):
        """
        Build per-day aggregates from the legacy per-run `runs` list, so an
        existing stats.json keeps whatever history its rolling window still has.
        """
        daily = {}
        for r in runs:
            if not isinstance(r, dict):
                continue
            day = str(r.get("ts", ""))[:10]
            if len(day) != 10:
                continue
            bucket = daily.setdefault(
                day, {"pc": 0, "mobile": 0, "cards": 0, "runs": 0}
            )
            bucket["pc"] += int(r.get("pc", 0) or 0)
            bucket["mobile"] += int(r.get("mobile", 0) or 0)
            bucket["cards"] += int(r.get("cards", 0) or 0)
            bucket["runs"] += 1
        return daily

    def _merge_defaults(self, data):
        """Overlay stored data onto the default shape so missing keys can't KeyError."""
        merged = self._default()
        if not isinstance(data, dict):
            return merged
        for section in ("lifetime", "balance", "last_session"):
            stored = data.get(section)
            if isinstance(stored, dict):
                merged[section].update(stored)

        # Prefer the new per-day aggregates; otherwise migrate from any legacy
        # per-run `runs` list left in an older stats.json.
        daily = data.get("daily")
        if isinstance(daily, dict):
            merged["daily"] = self._trim_daily(dict(daily))
        elif isinstance(data.get("runs"), list):
            merged["daily"] = self._trim_daily(self._daily_from_runs(data["runs"]))
        return merged

    def get_stats(self):
        """
        Retrieve the statistics from the JSON file. Returns a fresh default
        structure if the file is missing; recovers (back up + reset) if it is
        unreadable, mirroring HistoryManager.
        """
        if not os.path.exists(self.stats_file) or os.path.getsize(self.stats_file) == 0:
            return self._default()

        try:
            with open(self.stats_file, "r", encoding="utf-8") as file:
                data = json.load(file)
                if not isinstance(data, dict):
                    raise ValueError("Stats data must be an object")
                return self._merge_defaults(data)
        except (json.JSONDecodeError, UnicodeDecodeError, ValueError):
            self._log(
                "[ERROR] Stats file was unreadable or damaged. Starting with a fresh one."
            )
            backup_path = self.stats_file + ".backup"
            if os.path.exists(backup_path):
                os.remove(backup_path)
            os.replace(self.stats_file, backup_path)
            fresh = self._default()
            self.save_stats(fresh)
            return fresh

    def save_stats(self, data):
        """Save the statistics to the JSON file atomically via a temp file."""
        os.makedirs(os.path.dirname(self.stats_file), exist_ok=True)
        temp_file = self.stats_file + ".tmp"
        with open(temp_file, "w", encoding="utf-8") as file:
            json.dump(data, file, indent=4)
        os.replace(temp_file, self.stats_file)

    def _ensure_day_start_balance(self, stats, new_balance):
        """Remember the first known balance of the local day.

        Earned today = current balance minus this snapshot, so interrupted
        test runs still add up instead of resetting per session.
        """
        if new_balance is None:
            return
        new_balance = int(new_balance)
        today = datetime.now().date().isoformat()
        bucket = stats["daily"].setdefault(
            today, {"pc": 0, "mobile": 0, "cards": 0, "earn": 0, "quests": 0, "runs": 0}
        )
        prior = stats["balance"].get("current")
        # Guard against unauthenticated 0 scrapes corrupting start_balance
        if new_balance == 0 and isinstance(prior, int) and prior > 50:
            return
        start_bal = bucket.get("start_balance")
        if start_bal is None or (
            start_bal == 0 and new_balance > 50 and int(bucket.get("runs") or 0) <= 1
        ):
            if isinstance(prior, int) and prior > 0:
                bucket["start_balance"] = int(prior)
            else:
                bucket["start_balance"] = new_balance
        bucket["end_balance"] = new_balance
        if isinstance(bucket.get("start_balance"), int):
            bucket["verified_points"] = max(
                0, int(bucket["end_balance"]) - int(bucket["start_balance"])
            )

    def update_balance(self, balance):
        """
        Update only the real points balance, without recording any activity or
        run. Used by the on-launch / manual balance refresh, which scrapes the
        balance outside of a normal run.

        Args:
            balance (int | None): the freshly scraped balance. None is a no-op.

        Returns:
            dict: the updated stats structure (also persisted to disk).
        """
        if balance is None:
            return self.get_stats()

        balance = int(balance)
        stats = self.get_stats()
        prior = stats["balance"].get("current")
        # Reject bogus 0 scrape if user already had a real positive balance
        if balance == 0 and isinstance(prior, int) and prior > 50:
            return stats
        self._ensure_day_start_balance(stats, balance)
        stats["balance"]["previous"] = prior
        stats["balance"]["current"] = balance
        stats["balance"]["updated_at"] = datetime.now().isoformat(timespec="seconds")
        stats["daily"] = self._trim_daily(stats["daily"])
        self.save_stats(stats)
        return stats

    def reset_stats(self, scope="chart"):
        """
        Reset statistics according to the user-selected scope:
        - 'today': Reset only today's earned points & activity bucket.
        - 'chart': Reset all daily chart bars while keeping current balance & lifetime.
        - 'lifetime': Reset lifetime activity counters while keeping balance & chart.
        - 'all': Reset chart, today, lifetime, and last_session while keeping current balance as baseline.
        """
        scope = str(scope or "chart").strip().lower()
        stats = self.get_stats()
        current_bal = stats.get("balance", {}).get("current")
        now_iso = datetime.now().isoformat(timespec="seconds")
        today = now_iso[:10]
        fresh = self._default()

        if scope == "today":
            stats["daily"].pop(today, None)
            if isinstance(current_bal, int):
                stats["daily"][today] = {
                    "pc": 0,
                    "mobile": 0,
                    "cards": 0,
                    "earn": 0,
                    "quests": 0,
                    "runs": 0,
                    "start_balance": current_bal,
                    "end_balance": current_bal,
                    "verified_points": 0,
                    "points_delta": 0,
                    "points_estimate": 0,
                }
            stats["last_session"] = dict(fresh["last_session"])
            if isinstance(current_bal, int):
                stats["balance"]["previous"] = current_bal
        elif scope == "chart":
            stats["daily"] = {}
            if isinstance(current_bal, int):
                stats["daily"][today] = {
                    "pc": 0,
                    "mobile": 0,
                    "cards": 0,
                    "earn": 0,
                    "quests": 0,
                    "runs": 0,
                    "start_balance": current_bal,
                    "end_balance": current_bal,
                    "verified_points": 0,
                    "points_delta": 0,
                    "points_estimate": 0,
                }
                stats["balance"]["previous"] = current_bal
            stats["last_session"] = dict(fresh["last_session"])
        elif scope == "lifetime":
            stats["lifetime"] = dict(fresh["lifetime"])
        else:  # 'all'
            stats = fresh
            if isinstance(current_bal, int):
                stats["balance"] = {
                    "current": current_bal,
                    "previous": current_bal,
                    "updated_at": now_iso,
                }
                stats["daily"][today] = {
                    "pc": 0,
                    "mobile": 0,
                    "cards": 0,
                    "earn": 0,
                    "quests": 0,
                    "runs": 0,
                    "start_balance": current_bal,
                    "end_balance": current_bal,
                    "verified_points": 0,
                    "points_delta": 0,
                    "points_estimate": 0,
                }

        self.save_stats(stats)
        return stats

    def record_session(
        self,
        pc_searches=0,
        mobile_searches=0,
        daily_cards=0,
        earn_cards=0,
        quest_tasks=0,
        visual_searches=0,
        checkins=0,
        news_reads=0,
        edge_minutes=0,
        balance=None,
    ):
        """
        Record one completed run: bump lifetime counters, refresh the
        last-session snapshot, fold in a freshly-scraped balance (if any), and
        add this run's activity to today's per-day aggregate.

        Args:
            pc_searches (int): successful PC searches this run.
            mobile_searches (int): successful Mobile searches this run.
            daily_cards (int): Daily Set cards newly completed (verified).
            earn_cards (int): /earn point-earning cards opened this run.
            quest_tasks (int): quest punchcard tasks opened this run.
            balance (int | None): scraped real balance, or None if unavailable.

        Returns:
            dict: the updated stats structure (also persisted to disk).
        """
        pc = max(0, int(pc_searches or 0))
        mobile = max(0, int(mobile_searches or 0))
        cards = max(0, int(daily_cards or 0))
        earn = max(0, int(earn_cards or 0))
        quests = max(0, int(quest_tasks or 0))
        visual = max(0, int(visual_searches or 0))
        checkin = max(0, int(checkins or 0))
        news = max(0, int(news_reads or 0))
        edge = max(0, int(edge_minutes or 0))

        # Nothing happened (e.g. an empty batch in advanced scheduling and no
        # balance to refresh) — don't pollute the timeline with a no-op run.
        if (
            pc == 0
            and mobile == 0
            and cards == 0
            and earn == 0
            and quests == 0
            and visual == 0
            and checkin == 0
            and news == 0
            and edge == 0
            and (balance is None)
        ):
            return self.get_stats()

        stats = self.get_stats()
        session_estimate = (
            pc * POINTS_PER_SEARCH
            + mobile * POINTS_PER_SEARCH
            + (cards + earn + quests) * POINTS_PER_CARD
        )

        lifetime = stats["lifetime"]
        lifetime["pc_searches"] += pc
        lifetime["mobile_searches"] += mobile
        lifetime["daily_cards"] += cards
        lifetime["earn_cards"] = lifetime.get("earn_cards", 0) + earn
        lifetime["quest_tasks"] = lifetime.get("quest_tasks", 0) + quests
        lifetime["visual_searches"] = lifetime.get("visual_searches", 0) + visual
        lifetime["checkins"] = lifetime.get("checkins", 0) + checkin
        lifetime["news_reads"] = lifetime.get("news_reads", 0) + news
        lifetime["edge_minutes"] = lifetime.get("edge_minutes", 0) + edge
        lifetime["runs"] += 1
        lifetime["points_estimate"] += session_estimate

        now_iso = datetime.now().isoformat(timespec="seconds")

        # Balance delta: difference against the previously-stored balance. Only
        # meaningful when we have both a fresh scrape and a prior value.
        points_delta = None
        if balance is not None:
            self._ensure_day_start_balance(stats, balance)
            prior = stats["balance"]["current"]
            if isinstance(prior, int):
                points_delta = balance - prior
            stats["balance"]["previous"] = prior
            stats["balance"]["current"] = balance
            stats["balance"]["updated_at"] = now_iso

        stats["last_session"] = {
            "ended_at": now_iso,
            "pc_searches": pc,
            "mobile_searches": mobile,
            "daily_cards": cards,
            "earn_cards": earn,
            "quest_tasks": quests,
            "visual_searches": visual,
            "checkins": checkin,
            "news_reads": news,
            "edge_minutes": edge,
            "points_estimate": session_estimate,
            "points_delta": points_delta,
        }

        # Fold this run into today's per-day aggregate. Pre-existing day
        # buckets from older stats.json files lack the earn/quests keys, so
        # those are folded in .get-safely.
        today = now_iso[:10]
        bucket = stats["daily"].setdefault(
            today, {"pc": 0, "mobile": 0, "cards": 0, "earn": 0, "quests": 0, "runs": 0}
        )
        bucket["pc"] += pc
        bucket["mobile"] += mobile
        bucket["cards"] += cards
        bucket["earn"] = bucket.get("earn", 0) + earn
        bucket["quests"] = bucket.get("quests", 0) + quests
        bucket["runs"] += 1
        bucket["points_estimate"] = (
            int(bucket.get("points_estimate") or 0) + session_estimate
        )
        if points_delta is not None:
            bucket["points_delta"] = int(bucket.get("points_delta") or 0) + int(
                points_delta
            )
        stats["daily"] = self._trim_daily(stats["daily"])

        self.save_stats(stats)
        return stats
