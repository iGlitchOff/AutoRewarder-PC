"""Mobile Rewards tasks via a simulated Bing *phone* client.

Check-in, news and Bing-app streak only credit from the mobile Bing app.
We do not install Windows Store apps or use winget. Edge is launched as an
iPhone with the BingSapphire user-agent (the same client the Bing app uses).
"""

import random

from selenium.common.exceptions import TimeoutException, WebDriverException
from selenium.webdriver.common.by import By

from .rewards_api import fetch_userinfo, parse_userinfo
from ..utils import wait_or_stop

# Bing *phone* client (Colombia). News and check-in live here, not on the PC dashboard.
MARKET = "es-CO"
APP_HOME = f"https://www.bing.com/?form=APMCS1&setmkt={MARKET}&setlang=es"
NEWS_URL = (
    f"https://www.bing.com/news/search?q=noticias+colombia&form=APMCS1&setmkt={MARKET}"
)
NEWS_HOME = f"https://www.bing.com/news?form=APMCS1&setmkt={MARKET}"
MSN_HOME = f"https://www.msn.com/es-co?ocid=bingnews&setmkt={MARKET}"
READ_TO_EARN = f"https://rewards.bing.com/earn?setmkt={MARKET}"
CHECKIN_URLS = (
    f"https://rewards.bing.com/dashboard?setmkt={MARKET}",
    f"https://www.bing.com/rewards?form=APMCS1&setmkt={MARKET}",
    f"https://rewards.bing.com/?form=ML2N2V&setmkt={MARKET}",
    APP_HOME,
)
CHECKIN_URL = CHECKIN_URLS[0]
EARN_URL = "https://rewards.bing.com/earn"
DASHBOARD_URL = "https://rewards.bing.com/dashboard"

_LIVE_APP_PROGRESS_JS = r"""
try {
  var text = (document.body.innerText || '').replace(/\u00a0/g, ' ');
  var out = {};
  var m = text.match(/(?:Check-in|Check in|Registro):\s*(\d+)\s*\/\s*(\d+)/i);
  if (m) out.checkin = [parseInt(m[1], 10), parseInt(m[2], 10)];
  out.hasNews = /read to earn|news articles|read article/i.test(text);
  return out;
} catch (e) { return {}; }
"""

NEWS_CARD_SELECTORS = (
    "a.title",
    "a.card-title",
    ".title-container a",
    "a.card-link",
    ".news-card a",
    ".newsitem a",
    "a.caption",
    "a[href*='msn.com/']",
    "a[href*='microsoftnews']",
    "[class*='news'] a[href]",
    "#hp_news a",
    "a[data-t='news']",
)

_CLICK_CHECKIN_JS = r"""
try {
  var nodes = document.querySelectorAll(
    'button, a, [role="button"], [class*="check"], span, div, p'
  );
  var best = null;
  for (var i = 0; i < nodes.length; i++) {
    var el = nodes[i];
    if (!el.getClientRects || !el.getClientRects().length) continue;
    var t = ((el.innerText || el.getAttribute('aria-label') || '') + '')
      .replace(/\s+/g, ' ').trim();
    if (!t || t.length > 90) continue;
    if (/redeem|canjear|donate|donar/i.test(t)) continue;
    if (/check[\s-]?in|registrar(se)?|fichar|asistencia/i.test(t)) {
      best = el.closest('button, a, [role="button"]') || el;
      break;
    }
  }
  if (!best) {
    for (var j = 0; j < nodes.length; j++) {
      var n = nodes[j];
      var t2 = ((n.innerText || '') + '').replace(/\s+/g, ' ');
      if (/Check-in:\s*0\s*\/\s*1/i.test(t2)) {
        best = n.closest('button, a, [role="button"], [class*="card"]') || n;
        break;
      }
    }
  }
  if (!best) return false;
  best.scrollIntoView({block:'center'});
  best.click();
  return true;
} catch (e) { return false; }
"""


class BingAppTasks:
    """Run check-in, news and app-streak as the Bing mobile app."""

    def __init__(self, logger=None):
        self.logger = logger
        self._active_stop_event = None

    def _log(self, message):
        if self.logger:
            self.logger(message)

    def _stopped(self, stop_event):
        if stop_event is not None:
            self._active_stop_event = stop_event
        return stop_event is not None and stop_event.is_set()

    def _wait(self, seconds, stop_event):
        return wait_or_stop(seconds, stop_event)

    def _harden_driver(self, driver, seconds=20):
        try:
            driver.set_page_load_timeout(seconds)
        except Exception:
            pass
        try:
            driver.set_script_timeout(seconds)
        except Exception:
            pass

    def _safe_get(self, driver, url):
        try:
            driver.get(url)
            return True
        except TimeoutException:
            try:
                driver.execute_script("window.stop();")
            except Exception:
                pass
            return True
        except Exception as e:
            from ..emulator.driver import is_browser_closed_error

            if is_browser_closed_error(e):
                if self._active_stop_event is not None:
                    self._active_stop_event.set()
                self._log("Browser window closed — stopping mobile app tasks.")
                return False
            self._log(f"[WARNING] Navigation failed ({url}): {e}")
            return False

    def _userinfo(self, driver):
        return fetch_userinfo(driver)

    def read_live_app_progress(self, driver, stop_event=None):
        """Read check-in from the Bing *phone* client, not the PC earn page."""
        out = {"hasNews": True}
        if driver is None or self._stopped(stop_event):
            return out
        for url in CHECKIN_URLS:
            if self._stopped(stop_event):
                break
            if not self._safe_get(driver, url):
                continue
            if self._wait(random.uniform(2.0, 3.5), stop_event):
                break
            try:
                data = driver.execute_script(_LIVE_APP_PROGRESS_JS) or {}
            except Exception:
                data = {}
            if isinstance(data, dict) and data:
                out.update(data)
            if out.get("checkin"):
                break
        progress, max_pts = self._news_progress(driver)
        if max_pts:
            out["news"] = [progress, max_pts]
        out["hasNews"] = True
        return out

    def _checkin_complete_from_api(self, driver):
        parsed = parse_userinfo(self._userinfo(driver))
        pair = parsed.get("checkin")
        if isinstance(pair, (list, tuple)) and len(pair) == 2:
            try:
                return int(pair[0]) >= int(pair[1]) > 0
            except (TypeError, ValueError):
                return False
        return False

    def _checkin_destination(self, driver):
        dest = parse_userinfo(self._userinfo(driver)).get("checkin_url")
        if dest and dest.startswith("/"):
            dest = "https://rewards.bing.com" + dest
        return dest

    def daily_checkin(self, driver, stop_event=None):
        """Claim check-in from a BingSapphire (mobile Bing app) session."""
        if self._stopped(stop_event) or driver is None:
            return False
        self._harden_driver(driver)
        self._log("Mobile check-in: opening Rewards in the Bing phone client...")
        dest = self._checkin_destination(driver)
        urls = ((dest,) + CHECKIN_URLS) if dest else CHECKIN_URLS
        opened = False
        for url in urls:
            if self._stopped(stop_event):
                return False
            if self._safe_get(driver, url):
                opened = True
                if self._wait(random.uniform(2.5, 4.0), stop_event):
                    return False
                clicked = False
                try:
                    clicked = bool(driver.execute_script(_CLICK_CHECKIN_JS))
                except Exception:
                    clicked = False
                if clicked:
                    self._log("Mobile check-in: tapped the Check-in control.")
                    if self._wait(3.5, stop_event):
                        return False
                    break
        if not opened:
            return False
        if self._checkin_complete_from_api(driver):
            self._log("Mobile check-in is complete.")
            return True
        # The PC dashboard tile is a Bing-*app* deep link. Clicking it on the
        # web does not navigate (verified live: stays on /dashboard).
        try:
            self._safe_get(driver, "https://rewards.bing.com/dashboard")
            if self._wait(1.5, stop_event):
                return False
            driver.execute_script("""
                var nodes=document.querySelectorAll('button,[role=button],a,[data-react-aria-pressable]');
                for (var i=0;i<nodes.length;i++){
                  var t=(nodes[i].innerText||'');
                  if (/Check-in:\\s*0\\s*\\/\\s*1/i.test(t)) { nodes[i].click(); return true; }
                }
                return false;
                """)
            self._wait(3.0, stop_event)
        except Exception:
            pass
        if self._checkin_complete_from_api(driver):
            self._log("Mobile check-in is complete.")
            return True
        live = self.read_live_app_progress(driver, stop_event=stop_event)
        checkin = live.get("checkin")
        if (
            isinstance(checkin, (list, tuple))
            and len(checkin) == 2
            and int(checkin[0]) >= int(checkin[1])
            and int(checkin[1]) > 0
        ):
            self._log(f"Mobile check-in is complete ({checkin[0]}/{checkin[1]}).")
            return True
        self._log(
            "Mobile check-in: Microsoft only credits this from the Bing phone "
            "app. The web dashboard may redirect or omit the app tile. "
            "Not marking done without a live counter."
        )
        return False

    def news_progress(self, driver):
        return self._news_progress(driver)

    def _news_progress(self, driver):
        pair = parse_userinfo(self._userinfo(driver)).get("news")
        if isinstance(pair, (list, tuple)) and len(pair) == 2:
            try:
                return int(pair[0]), int(pair[1])
            except (TypeError, ValueError):
                return 0, 0
        return 0, 0

    @staticmethod
    def _is_news_article(href):
        h = (href or "").lower()
        if not h.startswith("http"):
            return False
        if any(
            bad in h for bad in ("javascript:", "mailto:", "login", "account.microsoft")
        ):
            return False
        # Search listings do not credit read-to-earn.
        if "bing.com/search" in h:
            return False
        if "bing.com/news/search" in h:
            return False
        if "msn.com/" in h:
            return True
        if "microsoftnews" in h or "news.microsoft.com" in h:
            return True
        if "bing.com/news" in h:
            return True
        return False

    def _news_hrefs(self, driver):
        hrefs = []
        seen = set()
        for selector in NEWS_CARD_SELECTORS:
            try:
                for el in driver.find_elements(By.CSS_SELECTOR, selector):
                    try:
                        href = el.get_attribute("href") or ""
                        if href.startswith("/"):
                            href = "https://www.bing.com" + href
                        if href in seen or not self._is_news_article(href):
                            continue
                        seen.add(href)
                        hrefs.append(href)
                    except Exception:
                        continue
            except WebDriverException:
                continue
        return hrefs

    def read_news(self, driver, stop_event=None, max_articles=10):
        """Read news articles inside the simulated Bing mobile app."""
        if self._stopped(stop_event) or driver is None:
            return False
        self._harden_driver(driver, seconds=18)
        progress, max_pts = self._news_progress(driver)
        start_progress = progress
        if max_pts and progress >= max_pts:
            self._log(f"News already complete ({progress}/{max_pts} pts).")
            return True
        if max_pts == 0:
            self._log(
                "News: this account has no read-to-earn counter. "
                "The '¿Has visto las noticias?' card is a Bing quiz in More activities, "
                "not article reading. Skipping article crawl."
            )
            return False
        self._log(
            f"News: Bing phone client (Colombia), reading articles "
            f"({progress}/{max_pts})."
        )
        hrefs = []
        for url in (APP_HOME, NEWS_HOME, MSN_HOME, READ_TO_EARN, NEWS_URL):
            if self._stopped(stop_event):
                return False
            if not self._safe_get(driver, url):
                continue
            if self._wait(random.uniform(2.5, 4.0), stop_event):
                return False
            hrefs.extend(self._news_hrefs(driver))
        seen = set()
        uniq = []
        for href in hrefs:
            if href in seen:
                continue
            seen.add(href)
            uniq.append(href)
        hrefs = uniq
        if not hrefs:
            self._log("[WARNING] No news article links on the Bing phone feed.")
            return False
        random.shuffle(hrefs)
        target = max(1, min(max_articles, max(1, (max_pts - progress) // 3 + 1)))
        read = 0
        for href in hrefs:
            if self._stopped(stop_event) or read >= target:
                break
            self._log(f"News: opening article {read + 1} in Bing mobile app...")
            if not self._safe_get(driver, href):
                continue
            # Read-to-earn only credits after a real dwell, not a bounce.
            if self._wait(random.uniform(12.0, 16.0), stop_event):
                break
            try:
                driver.execute_script(
                    "window.scrollBy(0, arguments[0]);", random.randint(250, 700)
                )
            except Exception:
                pass
            if self._wait(random.uniform(2.0, 4.0), stop_event):
                break
            read += 1
            now_pts, now_max = self._news_progress(driver)
            if now_max:
                max_pts = now_max
            if now_pts > progress:
                self._log(f"News progress: {progress} → {now_pts}/{max_pts}")
                progress = now_pts
            if max_pts and progress >= max_pts:
                break
        new_progress, new_max = self._news_progress(driver)
        if new_max:
            max_pts = new_max
        if new_progress > progress:
            progress = new_progress
            self._log(f"News progress: {progress}/{max_pts}")
        self._log(f"News: opened {read} article(s) in Bing mobile app.")
        credited = progress > start_progress or (max_pts and progress >= max_pts)
        if not credited:
            self._log(
                f"[WARNING] News did not credit ({progress}/{max_pts} pts). "
                "Not marking done."
            )
        return bool(credited)

    def bing_app_streak(self, driver, stop_event=None):
        """Use Bing as the phone app so the Bing app streak can credit."""
        if self._stopped(stop_event) or driver is None:
            return False
        self._harden_driver(driver, seconds=25)
        self._log("Bing app streak: mobile BingSapphire session...")
        for url in (
            APP_HOME,
            CHECKIN_URLS[0],
            f"https://www.bing.com/search?q=noticias+hoy&form=APMCS1&setmkt={MARKET}",
            NEWS_URL,
        ):
            if self._stopped(stop_event):
                return False
            self._safe_get(driver, url)
            if self._wait(random.uniform(4.0, 7.0), stop_event):
                return False
            try:
                driver.execute_script(
                    "window.scrollBy(0, arguments[0]);", random.randint(200, 600)
                )
            except Exception:
                pass
            if self._wait(random.uniform(2.0, 4.0), stop_event):
                return False
        self._log("Bing app streak: mobile session finished.")
        return True
