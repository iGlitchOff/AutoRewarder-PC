"""Mobile Rewards tasks via the official Bing app OAuth DAPI + BingSapphire session.

Check-in and Read-to-Earn news are claimed and verified against
https://prod.rewardsplatform.microsoft.com/dapi/me/activities using the
Bing mobile OAuth client (0000000040170455), checking real balance increases.
"""

import random
import uuid
from urllib.parse import parse_qs, unquote, urlparse

import requests
from selenium.common.exceptions import TimeoutException
from selenium.webdriver.common.by import By

from .rewards_api import fetch_userinfo, parse_userinfo
from ..utils import wait_or_stop

MARKET = "es-CO"
APP_HOME = f"https://www.bing.com/?form=APMCS1&setmkt={MARKET}&setlang=es"
NEWS_URL = (
    f"https://www.bing.com/news/search?q=noticias+colombia&form=APMCS1&setmkt={MARKET}"
)
NEWS_HOME = f"https://www.bing.com/news?form=APMCS1&setmkt={MARKET}"
MSN_HOME = f"https://www.msn.com/es-co?ocid=bingnews&setmkt={MARKET}"
READ_TO_EARN = f"https://www.bing.com/readtoearn?form=APMCS1&setmkt={MARKET}"
CHECKIN_URLS = (
    f"https://www.bing.com/rewards/app/dashboard?form=APMCS1&setmkt={MARKET}",
    f"https://www.bing.com/rewards?form=APMCS1&setmkt={MARKET}",
    f"https://rewards.bing.com/?form=ML2N2V&setmkt={MARKET}",
    APP_HOME,
)
CHECKIN_URL = CHECKIN_URLS[0]
EARN_URL = "https://rewards.bing.com/earn"
DASHBOARD_URL = "https://rewards.bing.com/dashboard"

BING_NATIVE_UA = (
    "Bing/32.5.431027001 (com.microsoft.bing; build:431027001; iOS 17.6.1) "
    "Alamofire/5.10.2"
)
TOKEN_URL = (
    "https://login.live.com/oauth20_authorize.srf"
    "?client_id=0000000040170455"
    "&response_type=token"
    "&redirect_uri=https://login.live.com/oauth20_desktop.srf"
    "&scope=service::prod.rewardsplatform.microsoft.com::MBI_SSL"
    "&display=touch"
    "&prompt=none"
)
DAPI_ACTIVITIES = "https://prod.rewardsplatform.microsoft.com/dapi/me/activities"
DAPI_ME = "https://prod.rewardsplatform.microsoft.com/dapi/me"

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
  if (!best) return false;
  best.scrollIntoView({block:'center'});
  best.click();
  return true;
} catch (e) { return false; }
"""


def _token_from_url(url):
    if not url or "access_token=" not in url:
        return None
    frag = urlparse(url).fragment or ""
    if "access_token=" not in frag:
        frag = url.split("#", 1)[-1]
    token = (parse_qs(frag).get("access_token") or [None])[0]
    return unquote(token) if token else None


def _dapi_headers(token, country="us"):
    return {
        "Authorization": f"Bearer {token}",
        "User-Agent": BING_NATIVE_UA,
        "Content-Type": "application/json",
        "Accept": "application/json",
        "X-Rewards-Country": country,
        "X-Rewards-Language": "en",
        "X-Rewards-ismobile": "true",
    }


def _dapi_me(token, country="us"):
    try:
        r = requests.get(
            DAPI_ME,
            params={"channel": "SAAndroid", "options": 613},
            headers=_dapi_headers(token, country),
            timeout=20,
        )
        if r.status_code == 200 and r.content:
            return r.json()
    except Exception:
        pass
    return {}


def _dapi_post(token, payload, country="us"):
    try:
        r = requests.post(
            DAPI_ACTIVITIES,
            headers=_dapi_headers(token, country),
            json=payload,
            timeout=20,
        )
        data = r.json() if r.content else {}
        return {"status": r.status_code, "data": data}
    except Exception as exc:
        return {"status": -1, "data": str(exc)}


def _balance_of(resp):
    if not isinstance(resp, dict):
        return None
    data = resp.get("data") if "data" in resp else resp
    if not isinstance(data, dict):
        return None
    inner = data.get("response") if isinstance(data.get("response"), dict) else data
    b = inner.get("balance") if isinstance(inner, dict) else None
    try:
        return int(b) if b is not None else None
    except (TypeError, ValueError):
        return None


class BingAppTasks:
    """Run check-in, news and app-streak as the Bing mobile app."""

    def __init__(self, logger=None):
        self.logger = logger
        self._cached_token = None

    def _log(self, message):
        if self.logger:
            self.logger(message)

    def _stopped(self, stop_event):
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
            self._log(f"[WARNING] Navigation failed ({url}): {e}")
            return False

    def _userinfo(self, driver):
        return fetch_userinfo(driver)

    def _get_app_token(self, driver, stop_event=None):
        if self._cached_token:
            return self._cached_token
        if driver is None or self._stopped(stop_event):
            return None
        for url in (TOKEN_URL, TOKEN_URL.replace("&prompt=none", "")):
            if self._stopped(stop_event):
                return None
            self._safe_get(driver, url)
            if self._wait(2.5, stop_event):
                return None
            try:
                current = driver.current_url or ""
            except Exception:
                current = ""
            token = _token_from_url(current)
            if not token:
                try:
                    token = driver.execute_script(
                        "return (location.hash||'').includes('access_token=') ? "
                        "new URLSearchParams(location.hash.slice(1)).get('access_token') : null;"
                    )
                except Exception:
                    token = None
            if token:
                self._cached_token = token
                return token
            try:
                for xp in (
                    "//button[contains(.,'Skip')]",
                    "//button[contains(.,'Not now')]",
                    "//button[contains(.,'Cancel')]",
                    "//a[contains(.,'Skip')]",
                    "//button[contains(.,'Omitir')]",
                ):
                    els = driver.find_elements(By.XPATH, xp)
                    if els:
                        driver.execute_script("arguments[0].click();", els[0])
                        if self._wait(2.0, stop_event):
                            return None
                        token = _token_from_url(driver.current_url or "")
                        if token:
                            self._cached_token = token
                            return token
            except Exception:
                pass
        return None

    def read_live_app_progress(self, driver, stop_event=None):
        """Read check-in and news from the Bing phone client."""
        out = {"hasNews": True}
        if driver is None or self._stopped(stop_event):
            return out
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

    def daily_checkin(self, driver, stop_event=None):
        """Claim check-in via official Bing App OAuth DAPI and verify balance."""
        if self._stopped(stop_event) or driver is None:
            return False
        self._harden_driver(driver)
        token = self._get_app_token(driver, stop_event)
        if token:
            me = _dapi_me(token, "us")
            start_bal = _balance_of(me)
            for typ in (103, 101):
                if self._stopped(stop_event):
                    return False
                payload = {
                    "id": str(uuid.uuid4()),
                    "amount": 1,
                    "type": typ,
                    "attributes": {"offerid": "Gamification_Sapphire_DailyCheckIn"},
                    "country": "us",
                }
                resp = _dapi_post(token, payload, "us")
                bal = _balance_of(resp)
                if bal is not None and start_bal is not None and bal > start_bal:
                    self._log(f"Mobile check-in complete (+{bal - start_bal} pts).")
                    return True
                if bal is not None:
                    start_bal = bal
                if self._wait(1.2, stop_event):
                    return False
        if self._checkin_complete_from_api(driver):
            self._log("Mobile check-in is complete.")
            return True
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

    def read_news(self, driver, stop_event=None, max_articles=10):
        """Claim Read-to-Earn news via Bing App OAuth DAPI (~3.2s per article, verified by balance)."""
        if self._stopped(stop_event) or driver is None:
            return False
        self._harden_driver(driver, seconds=18)
        token = self._get_app_token(driver, stop_event)
        if token:
            me = _dapi_me(token, "us")
            last_bal = _balance_of(me)
            start_bal = last_bal
            articles = 0
            stall = 0
            for i in range(max_articles):
                if self._stopped(stop_event):
                    break
                payload = {
                    "amount": 1,
                    "id": uuid.uuid4().hex + uuid.uuid4().hex,
                    "type": 101,
                    "attributes": {"offerid": "ENUS_readarticle3_30points"},
                    "country": "us",
                }
                resp = _dapi_post(token, payload, "us")
                bal = _balance_of(resp)
                if last_bal is not None and bal is not None and bal > last_bal:
                    gained = bal - last_bal
                    last_bal = bal
                    articles += 1
                    stall = 0
                    self._log(
                        f"News {articles}/{max_articles}: +{gained} pts (balance: {bal})"
                    )
                else:
                    stall += 1
                    if bal is not None:
                        last_bal = bal
                    if stall >= 3:
                        break
                if self._wait(random.uniform(3.0, 3.8), stop_event):
                    break
            if articles > 0 or (
                start_bal is not None and last_bal is not None and last_bal > start_bal
            ):
                return True
        return False

    def bing_app_streak(self, driver, stop_event=None):
        """Use Bing as the phone app so the Bing app streak can credit."""
        if self._stopped(stop_event) or driver is None:
            return False
        self._harden_driver(driver, seconds=25)
        for url in (APP_HOME, CHECKIN_URLS[0], NEWS_URL):
            if self._stopped(stop_event):
                return False
            self._safe_get(driver, url)
            if self._wait(random.uniform(3.0, 5.0), stop_event):
                return False
        return True
