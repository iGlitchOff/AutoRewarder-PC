"""Search automation helpers for Bing queries."""

import base64
import json
import os
import random
import time
from urllib.parse import urlencode, urlparse
from selenium.webdriver.common.keys import Keys
from selenium.common.exceptions import (
    NoSuchElementException,
    NoSuchWindowException,
    TimeoutException,
    WebDriverException,
)
from selenium.webdriver.common.by import By

from ..utils import human_typing, wait_or_stop
from ..emulator import HumanBehavior

try:
    from ..emulator.driver import is_browser_closed_error
except ImportError:

    def is_browser_closed_error(exc: Exception) -> bool:
        if exc is None:
            return False
        msg = str(exc).lower()
        return any(
            needle in msg
            for needle in (
                "no such window",
                "target frame detached",
                "web view not found",
                "chrome not reachable",
                "disconnected",
                "invalid session id",
                "session deleted",
                "not connected to devtools",
                "unable to connect",
                "connection refused",
                "maxretryerror",
                "forcibly closed",
            )
        )


# Rewards' "visual search streak" mission credits a search only when it starts
# from the mission's own link: the Bing homepage carrying its promo code. The
# dashboard handler reads that link off the payload each run; this is the
# fallback for when it can't (mission not offered, legacy dashboard, daily-set
# pass skipped).
REWARDS_VISUAL_SEARCH_URL = (
    "https://www.bing.com/?features=vsstreak,vstooltip&form=ML2XES"
)

# Image results for a query, which is how a person reaches the camera: they
# search for something first. Bing stamps a search started from these results
# with the same FORM=SBIIRP as the bare Images page, so this changes how the
# camera is reached, not what Rewards records.
VISUAL_SEARCH_IMAGES_QUERY_URL = "https://www.bing.com/images/search"

# The Images vertical, and the surface the search actually runs on: Bing stamps
# a search started there with FORM=SBIIRP, and that is the only code the Rewards
# streak has been observed to credit. The homepage camera reports FORM=SBIHMP
# and went uncredited even though the search itself succeeded. Bing replaces the
# entry page's own form code either way, so the mission's promo code never
# reaches the search — only the surface does.
VISUAL_SEARCH_IMAGES_URL = "https://www.bing.com/images"

# Entry points for the "search by image" widget, tried in order. Images first
# for the reason above; it also renders the camera button server-side, while the
# homepage only injects it through a lazy fragment that some flights don't ship.
VISUAL_SEARCH_URLS = (
    VISUAL_SEARCH_IMAGES_URL,
    REWARDS_VISUAL_SEARCH_URL,
    "https://www.bing.com",
)

# The search box on the Bing homepage, and the Images tab on a results page.
VISUAL_SEARCH_BOX_LOCATORS = (
    (By.ID, "sb_form_q"),
    (By.CSS_SELECTOR, "form#sb_form input[name='q']"),
    (By.NAME, "q"),
)

VISUAL_SEARCH_IMAGES_TAB_LOCATORS = (
    (By.XPATH, "//nav/ul/li[@id='b-scopeListItem-images']/a"),
    (By.CSS_SELECTOR, "#b-scopeListItem-images a"),
    (By.CSS_SELECTOR, "nav a[href*='/images/search']"),
    (By.CSS_SELECTOR, "header a[href*='/images/search']"),
)

# Selectors for the camera button, from the most to the least specific.
VISUAL_SEARCH_BUTTON_LOCATORS = (
    (By.ID, "sb_sbi"),
    (By.CSS_SELECTOR, "#sbiarea [role='button']"),
    (By.ID, "sbi_b"),
)

# Hand the image to Bing the way a person does: dropped on the flyout, which
# advertises a drop target (data-drpanywhr / drop-eff-id) and handles it with
# its own code path.
_DROP_IMAGE_JS = r"""
var b64 = arguments[0], name = arguments[1], target = arguments[2] || document.body;
var bin = atob(b64), bytes = new Uint8Array(bin.length);
for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
var file = new File([bytes], name, {type: 'image/jpeg'});
var dt = new DataTransfer();
dt.items.add(file);
['dragenter', 'dragover', 'drop'].forEach(function (type) {
  target.dispatchEvent(
    new DragEvent(type, {bubbles: true, cancelable: true, dataTransfer: dt})
  );
});
return dt.files.length;
"""

# State of the upload zone, sampled before and after a drop.
_UPLOAD_ZONE_STATE_JS = r"""
var pane = document.querySelector(arguments[0]);
var loading = document.querySelector('#loadingimg, .loadingdiv, .dpload');
return {
  url: location.href,
  pane: pane ? (pane.innerText || '').replace(/\s+/g, ' ').trim() : null,
  shown: pane ? !!pane.getClientRects().length : null,
  loading: loading ? !!loading.getClientRects().length : false
};
"""

VISUAL_SEARCH_PANEL_SELECTOR = "#sb_sbipane, .sbipane, #sbi_d"

# Selectors for the hidden file input of the upload flyout.
VISUAL_SEARCH_INPUT_LOCATORS = (
    (By.ID, "sb_fileinput"),
    (By.CSS_SELECTOR, "input.fileinput[type='file']"),
    (By.CSS_SELECTOR, "input[type='file'][accept*='image']"),
)

# URL fragments Bing redirects to once an uploaded image has been searched.
VISUAL_SEARCH_RESULT_URL_MARKERS = (
    "form=sbi",
    "iss=sbi",
    "bcid=",
    "view=detailv2",
    "sbiupload",
    "visualsearch",
)

# DOM that appears when Bing keeps the homepage URL but shows image results
# in a pane (Copilot / visual-search overlay). URL markers miss this case.
VISUAL_SEARCH_RESULT_DOM_LOCATORS = (
    (By.ID, "sbi_cn"),
    (By.ID, "sbi_c"),
    (By.CSS_SELECTOR, "#vs_cont"),
    (By.CSS_SELECTOR, "#i_results"),
    (By.CSS_SELECTOR, ".sbi_img"),
    (By.CSS_SELECTOR, "[data-tag='sbi']"),
    (By.CSS_SELECTOR, "#b_results .b_imgSet"),
    (By.ID, "b-scopeListItem-images"),
    (By.CSS_SELECTOR, "img[alt*='Uploaded']"),
)

VISUAL_SEARCH_CONFIRM_LOCATORS = (
    (By.ID, "sbi_go_button"),
    (By.ID, "sb_search"),
    (By.CSS_SELECTOR, "#sb_form_go"),
    (By.CSS_SELECTOR, "input[type='submit'][id*='sbi']"),
    (By.CSS_SELECTOR, "button[aria-label*='Search']"),
    (By.CSS_SELECTOR, "button[type='submit']"),
)


class SearchEngine:
    """
    A class to handle search operations with human-like behavior.
    """

    def __init__(self, logger=None, history=None):
        """
        Initialize the SearchEngine with an optional logger and history manager.

        Args:
            logger (callable, optional): A logging function to log messages. Defaults to None.
            history (HistoryManager, optional): An instance of HistoryManager to manage search history. Defaults to None.
        """

        self._logger = logger
        self._history = history
        # Surface the last successful search ran on, so the caller can ask for
        # the other one when Rewards doesn't credit that one.
        self.last_search_url = None

    def _log(self, message):
        """
        Log a message using the provided logger, if available.

        Args:
            message (str): The message to log.
        """

        if self._logger:
            self._logger(message)

    def _add_to_history(self, query_text, status):
        """
        Add a search query and its status to the history manager.

        Args:
            query_text (str): The search query.
            status (str): The status of the search.
        """

        if self._history:
            self._history.add_to_history(query_text, status)

    def load_queries_from_json(self, filepath, num_needed):
        """
        Load search queries from a JSON file and return a random sample.

        Args:
            filepath (str): The path to the JSON file containing search queries.
            num_needed (int): The number of random queries to return.

        Returns:
            list: A list of randomly selected search queries.
            If the file is not found, an error is logged and an empty list is returned.
        """

        try:
            with open(filepath, "r", encoding="utf-8") as file:
                data = json.load(file)
                all_queries = data.get("queries", [])

                if len(all_queries) < num_needed:
                    self._log(
                        f"[WARNING] In the JSON file, there are only {len(all_queries)} queries available, but {num_needed} are needed."
                    )
                    return all_queries

                return random.sample(all_queries, num_needed)

        except FileNotFoundError:
            self._log(f"[ERROR] File {filepath} not found!")
            self._add_to_history("N/A", f"[ERROR] File {filepath} not found")
            return []

    def get_coffee_break_count(self):
        """
        Determine how many searches to perform before taking a coffee break, with a bias towards shorter breaks.

        Returns:
            int: The number of searches to perform before taking a break.
        """

        # 80% of the time, take a break after 4-9 searches
        if random.random() < 0.8:
            return random.randint(4, 9)
        # 20% of the time, take a break after 10-15 searches
        else:
            return random.randint(10, 15)

    def perform_searches(
        self,
        driver,
        queries,
        mobile=False,
        stop_event=None,
        on_success=None,
        search_delay_range=(4.0, 10.0),
    ):
        """
        Perform searches on Bing using Selenium WebDriver with human-like behavior.

        Args:
            driver (WebDriver): An instance of Selenium WebDriver to control the browser.
            queries (list): A list of search queries to perform.
            mobile (bool): When True, HumanBehavior emits touch gestures instead
                of mouse events — pair with a mobile-emulated driver.
            stop_event (threading.Event, optional): If provided and set, the
                loop bails out at the next checkpoint and any in-progress
                coffee break is interrupted immediately.
            on_success (callable, optional): Called with the running success
                count after each credited search so the UI can update live.
            search_delay_range (tuple): A tuple specifying the range of delays (min, max)
                to use for each search.

        Returns:
            int: the number of searches that completed successfully (used by
                the stats layer to record activity for this run).
        """

        human = HumanBehavior(
            driver, show_cursor=True, mobile=mobile, stop_event=stop_event
        )

        delay_min, delay_max = search_delay_range

        next_coffee_break = self.get_coffee_break_count()
        searches_since_break = 0
        successful = 0

        self._log(f"Loaded {len(queries)} queries. Starting searches...")
        self._log(f"Next coffee break after {next_coffee_break} searches.")

        for i, query in enumerate(queries):
            if stop_event is not None and stop_event.is_set():
                self._log("Stop requested — halting search loop.")
                return successful

            try:
                # Phone-client searches must look like the Bing app (Colombia).
                # Desktop matches the original repo: plain bing.com.
                try:
                    if mobile:
                        driver.get(
                            "https://www.bing.com/?form=APMCS1&setmkt=es-CO&setlang=es"
                        )
                    else:
                        driver.get("https://www.bing.com")
                except TimeoutException:
                    try:
                        driver.execute_script("window.stop();")
                    except Exception:
                        pass
                if wait_or_stop(random.uniform(delay_min, delay_max), stop_event):
                    self._log("Stop requested — halting search loop.")
                    return successful

                searches_since_break += 1

                # Longer break every few searches to mimic human behavior
                if searches_since_break >= next_coffee_break:

                    if next_coffee_break > 9:
                        pause_duration = random.uniform(45, 90)
                        self._log("Taking a big coffee break...")
                    else:
                        pause_duration = random.uniform(15, 30)
                        self._log("Taking a quick coffee break...")

                    self._log(
                        f"Sleeping for {pause_duration:.2f} seconds to mimic a coffee break."
                    )
                    if wait_or_stop(pause_duration, stop_event):
                        self._log("Stop requested during coffee break — halting.")
                        return successful

                    next_coffee_break = self.get_coffee_break_count()
                    searches_since_break = 0
                    self._log(f"Next coffee break after {next_coffee_break} searches.")

                # Find the search box, clear it (same NAME=q as upstream, plus fallbacks)
                try:
                    search_box = self._find_search_box(driver)
                except NoSuchElementException:
                    if not mobile:
                        raise
                    driver.get("https://www.bing.com")
                    if wait_or_stop(2, stop_event):
                        self._log("Stop requested — halting search loop.")
                        return successful
                    search_box = self._find_search_box(driver)
                search_box.clear()

                # Log the search query in log area
                self._log(f"Search #{i + 1}: {query}")

                # Type the query with human-like delays
                human_typing(search_box, query, stop_event=stop_event)
                if stop_event is not None and stop_event.is_set():
                    self._log("Stop requested — halting search loop.")
                    return successful
                search_box.send_keys(Keys.RETURN)  # Press Enter to search

                # Wait for result to load
                if wait_or_stop(random.uniform(2, 4), stop_event):
                    self._log("Stop requested — halting search loop.")
                    return successful

                tabs_config = [
                    {"name": "All", "priority": 70, "id": None},
                    {"name": "Images", "priority": 10, "id": "b-scopeListItem-images"},
                    {"name": "Videos", "priority": 10, "id": "b-scopeListItem-video"},
                    {"name": "News", "priority": 10, "id": "b-scopeListItem-news"},
                ]

                weights = [tab["priority"] for tab in tabs_config]
                chosen_tab = random.choices(tabs_config, weights=weights, k=1)[0]

                if chosen_tab["name"] != "All":
                    main_tab = driver.current_window_handle
                    tab_element = None

                    # Check if news tab exists, if it doesn't choose Images or Videos
                    if chosen_tab["name"] == "News":
                        try:
                            xpath = f"//nav/ul/li[@id='{chosen_tab['id']}']/a"
                            tab_element = driver.find_element(By.XPATH, xpath)
                        except NoSuchElementException:
                            chosen_tab = random.choice(tabs_config[1:3])

                    self._log(f"Chosen behavior: Switch to {chosen_tab['name']}")
                    try:
                        # Find the tab element using its id
                        if not tab_element:
                            xpath = f"//nav/ul/li[@id='{chosen_tab['id']}']/a"
                            tab_element = driver.find_element(By.XPATH, xpath)

                        # Move mouse and click the tab
                        human.click_element(tab_element)

                        if wait_or_stop(random.uniform(3, 6), stop_event):
                            self._log("Stop requested — halting search loop.")
                            return successful

                    except NoSuchElementException:
                        self._log(
                            f"[WARNING] Tab {chosen_tab['name']} not found. Staying on 'All'."
                        )

                        # Fallback to "All" if the chosen tab is not found
                        chosen_tab["name"] = "All"

                    except WebDriverException as e:
                        short_error = str(e).split("\n")[0][:28]
                        self._log(
                            f"[WARNING] WebDriver error when switching to {chosen_tab['name']}: {short_error}."
                        )
                        self._log("Staying on 'All'.")

                        chosen_tab["name"] = "All"

                # Scroll the page to mimic human behavior
                try:
                    if chosen_tab["name"] == "All":
                        human.scroll_page()
                except WebDriverException as e:
                    short_error = str(e).split("\n")[0][:28]
                    self._log(
                        f"[WARNING] WebDriver error when scrolling: {short_error}. Continuing."
                    )

                # Pause after scrolling
                if wait_or_stop(random.uniform(2, 4), stop_event):
                    self._log("Stop requested — halting search loop.")
                    return successful

                # Close all tabs other than main
                if chosen_tab["name"] != "All":
                    try:
                        open_tabs = list(driver.window_handles)
                    except WebDriverException:
                        open_tabs = []
                    new_tabs = [tab for tab in open_tabs if tab != main_tab]
                    for tab in new_tabs:
                        try:
                            if tab not in driver.window_handles:
                                continue
                            driver.switch_to.window(tab)
                            hostname = (
                                (urlparse(driver.current_url).hostname or "")
                                .lower()
                                .rstrip(".")
                            )
                            if hostname != "bing.com" and not hostname.endswith(
                                ".bing.com"
                            ):
                                continue
                            driver.close()
                        except (NoSuchWindowException, WebDriverException) as e:
                            error_text = str(e).lower()
                            if any(
                                marker in error_text
                                for marker in (
                                    "no such window",
                                    "target window already closed",
                                    "window was already closed",
                                )
                            ):
                                continue
                            short_error = str(e).split("\n")[0][:28]
                            self._log(
                                f"[WARNING] WebDriver error when closing tab: {short_error}. Continuing."
                            )

                    try:
                        remaining_tabs = list(driver.window_handles)
                    except WebDriverException:
                        remaining_tabs = []
                    if main_tab in remaining_tabs:
                        driver.switch_to.window(main_tab)
                    elif remaining_tabs:
                        driver.switch_to.window(remaining_tabs[0])

                # Add to history.json
                self._add_to_history(f"Search: {query}", "Success")
                successful += 1
                if callable(on_success):
                    try:
                        on_success(successful)
                    except Exception:
                        pass

            except NoSuchElementException:
                if stop_event is not None and stop_event.is_set():
                    return successful
                self._log(f"[ERROR] Search box not found on attempt #{i+1}")
                self._add_to_history(f"Search: {query}", "[ERROR] Search box not found")

            except WebDriverException as e:
                if stop_event is not None and stop_event.is_set():
                    return successful
                if is_browser_closed_error(e):
                    if stop_event is not None:
                        stop_event.set()
                    self._log("Browser window closed — stopping run.")
                    return successful
                short_error = str(e).split("\n")[0][:28]
                self._log(f"[ERROR] WebDriver error on attempt #{i+1}: {short_error}")
                self._add_to_history(
                    f"Search: {query}", f"[ERROR] WebDriver Error: {short_error}"
                )

            except Exception as e:
                if stop_event is not None and stop_event.is_set():
                    return successful
                if is_browser_closed_error(e):
                    if stop_event is not None:
                        stop_event.set()
                    self._log("Browser window closed — stopping run.")
                    return successful
                self._log(f"[ERROR] Unknown error on attempt #{i+1}: {e}")
                self._add_to_history(
                    f"Search: {query}", f"[ERROR] Unknown Error: {str(e)[:50]}"
                )

        return successful

    def _find_search_box(self, driver):
        """Locate Bing's search box. Upstream uses NAME=q; Bing also uses textarea."""
        locators = (
            (By.NAME, "q"),
            (By.ID, "sb_form_q"),
            (By.CSS_SELECTOR, "textarea[name='q']"),
            (By.CSS_SELECTOR, "input[name='q']"),
            (By.CSS_SELECTOR, "textarea#sb_form_q"),
            (By.CSS_SELECTOR, "input[type='search']"),
        )
        last = None
        for by, selector in locators:
            try:
                el = driver.find_element(by, selector)
                if el is not None:
                    return el
            except Exception as err:
                last = err
        if last is not None:
            raise last
        raise NoSuchElementException("search box")

    def _find_visual_search_element(
        self,
        driver,
        locators,
        timeout,
        poll_interval,
        require_displayed=False,
        stop_event=None,
    ):
        """
        Poll the page until one of the given locators matches an element.
        """
        deadline = time.monotonic() + timeout

        while True:
            if stop_event is not None and stop_event.is_set():
                return None

            for by, selector in locators:
                try:
                    element = driver.find_element(by, selector)

                    if require_displayed and not (
                        element.is_displayed() and element.is_enabled()
                    ):
                        continue

                    return element

                except WebDriverException:
                    continue

            if time.monotonic() >= deadline:
                return None

            if wait_or_stop(poll_interval, stop_event):
                return None

    def _attempt_visual_search(
        self,
        driver,
        human,
        url,
        image_path,
        poll_interval,
        stop_event=None,
        navigate=True,
    ):
        """
        Run one full search-by-image attempt from a single entry page.

        Returns:
            str: "done", "no widget", "no results", or "stopped".
        """
        if stop_event is not None and stop_event.is_set():
            return "stopped"

        if navigate:
            try:
                driver.get(url)
            except TimeoutException:
                pass

        start_url = self._current_url(driver) or url

        if wait_or_stop(random.uniform(1, 3), stop_event):
            return "stopped"

        button = self._find_visual_search_element(
            driver,
            VISUAL_SEARCH_BUTTON_LOCATORS,
            timeout=10,
            poll_interval=poll_interval,
            require_displayed=True,
            stop_event=stop_event,
        )

        if self._stopped(stop_event):
            return "stopped"

        if button is None:
            self._log(f"[INFO] No visual search button on {url}.")
            return "no widget"

        try:
            human.click_element(button)
        except Exception:
            try:
                driver.execute_script("arguments[0].click();", button)
            except Exception:
                pass

        if wait_or_stop(random.uniform(1, 3), stop_event):
            return "stopped"

        if not self._open_upload_panel(
            driver, human, button, poll_interval, stop_event
        ):
            self._log(f"[INFO] Upload flyout stayed closed on {url}.")
            return "stopped" if self._stopped(stop_event) else "no widget"

        upload_input = self._find_visual_search_element(
            driver,
            VISUAL_SEARCH_INPUT_LOCATORS,
            timeout=10,
            poll_interval=poll_interval,
            stop_event=stop_event,
        )

        panel = self._find_visual_search_element(
            driver,
            ((By.CSS_SELECTOR, VISUAL_SEARCH_PANEL_SELECTOR),),
            timeout=0,
            poll_interval=poll_interval,
        )

        if wait_or_stop(random.uniform(1, 3), stop_event):
            return "stopped"

        known_tabs = self._tab_snapshot(driver)

        if not self._drop_image(driver, image_path, panel, stop_event=stop_event):
            if upload_input is None:
                self._log(f"[INFO] No way to hand over the image on {url}.")
                return "stopped" if self._stopped(stop_event) else "no widget"

            self._log("[INFO] Drop not accepted; using the file input instead.")
            try:
                upload_input.send_keys(os.path.abspath(image_path))
                driver.execute_script(
                    """
                    const el = arguments[0];
                    el.dispatchEvent(new Event('input', {bubbles: true}));
                    el.dispatchEvent(new Event('change', {bubbles: true}));
                    """,
                    upload_input,
                )
            except Exception as e:
                self._log(f"[WARNING] Upload failed on {url}: {e}")
                return "no widget"

        if self._wait_for_visual_search_results(
            driver,
            start_url,
            timeout=35,
            poll_interval=poll_interval,
            stop_event=stop_event,
            known_tabs=known_tabs,
        ):
            self.last_search_url = url
            return "done"

        if self._stopped(stop_event):
            return "stopped"

        self._log(
            f"[INFO] Uploaded from {url} but no results came back "
            f"({self._page_state(driver)})."
        )
        return "no results"

    def _stopped(self, stop_event):
        """Whether Stop was requested."""
        return stop_event is not None and stop_event.is_set()

    def _drop_image(self, driver, image_path, target=None, stop_event=None):
        """
        Drop the image on Bing's upload zone, as a drag-and-drop would.
        """
        try:
            with open(image_path, "rb") as image:
                payload = base64.b64encode(image.read()).decode("ascii")
        except OSError as e:
            self._log(f"[INFO] Could not read the image to drop it: {e}")
            return False

        before = self._upload_zone_state(driver)

        try:
            files = driver.execute_script(
                _DROP_IMAGE_JS, payload, os.path.basename(image_path), target
            )
        except WebDriverException as e:
            short_error = str(e).split("\n")[0][:40]
            self._log(f"[INFO] Drop upload failed ({short_error}).")
            return False

        if not files:
            return False

        return self._drop_accepted(
            driver, before, timeout=5, poll_interval=0.25, stop_event=stop_event
        )

    def _upload_zone_state(self, driver):
        """Sample the upload zone's URL, flyout text and loading state."""
        try:
            state = driver.execute_script(
                _UPLOAD_ZONE_STATE_JS, VISUAL_SEARCH_PANEL_SELECTOR
            )
        except WebDriverException:
            return {}

        return state if isinstance(state, dict) else {}

    def _drop_accepted(self, driver, before, timeout, poll_interval, stop_event=None):
        """
        Whether the page reacted to the drop within `timeout` seconds.
        """
        deadline = time.monotonic() + timeout

        while True:
            if stop_event is not None and stop_event.is_set():
                return False

            after = self._upload_zone_state(driver)

            if after and (
                after.get("loading")
                or after.get("url") != before.get("url")
                or after.get("pane") != before.get("pane")
                or after.get("shown") != before.get("shown")
            ):
                return True

            if time.monotonic() >= deadline:
                return False

            if wait_or_stop(poll_interval, stop_event):
                return False

    def _open_upload_panel(self, driver, human, button, poll_interval, stop_event=None):
        """
        Make sure the camera click actually opened the upload flyout.
        """
        for attempt in range(3):
            if stop_event is not None and stop_event.is_set():
                return False

            try:
                panels = driver.find_elements(
                    By.CSS_SELECTOR, VISUAL_SEARCH_PANEL_SELECTOR
                )
            except WebDriverException:
                panels = []

            if not panels:
                self._log(
                    "[INFO] No upload flyout found on this page; uploading anyway."
                )
                return True

            if any(panel.is_displayed() for panel in panels):
                return True

            if attempt == 0:
                self._log("[INFO] Upload flyout didn't open. Clicking again.")
                try:
                    driver.execute_script("arguments[0].click();", button)
                except WebDriverException:
                    pass
            elif attempt == 1:
                try:
                    driver.switch_to.active_element.send_keys(Keys.ESCAPE)
                    human.click_element(button)
                except WebDriverException:
                    pass

            if wait_or_stop(poll_interval + random.uniform(0.5, 1.5), stop_event):
                return False

        return False

    def _tab_snapshot(self, driver):
        """Capture open tabs before upload so an old result cannot be reused."""
        snapshot = {}
        try:
            origin = driver.current_window_handle
            handles = driver.window_handles
        except WebDriverException:
            return snapshot
        for handle in handles:
            try:
                driver.switch_to.window(handle)
                snapshot[handle] = self._current_url(driver)
            except WebDriverException:
                continue
        try:
            driver.switch_to.window(origin)
        except WebDriverException:
            pass
        return snapshot

    def _wait_for_visual_search_results(
        self,
        driver,
        start_url,
        timeout,
        poll_interval,
        stop_event=None,
        known_tabs=None,
    ):
        """
        Wait until the uploaded image actually lands on a visual search result page.
        """

        deadline = time.monotonic() + timeout
        origin = None

        try:
            origin = driver.current_window_handle
        except WebDriverException:
            pass

        while True:
            if stop_event is not None and stop_event.is_set():
                return False

            current_url = self._current_url(driver)
            unchanged_tab = bool(
                known_tabs
                and origin in known_tabs
                and current_url == known_tabs.get(origin)
            )
            if not unchanged_tab and self._is_results_url(current_url, start_url):
                return True

            if not unchanged_tab:
                for by, selector in VISUAL_SEARCH_RESULT_DOM_LOCATORS:
                    try:
                        el = driver.find_element(by, selector)
                        if el:
                            return True
                    except WebDriverException:
                        continue

            # Results opened in another tab: adopt it and carry on there.
            try:
                handles = driver.window_handles
            except WebDriverException:
                handles = []

            for handle in handles:
                if handle == origin:
                    continue
                try:
                    driver.switch_to.window(handle)
                except WebDriverException:
                    continue
                url = self._current_url(driver)
                if known_tabs and url == known_tabs.get(handle):
                    continue
                if self._is_results_url(url, start_url):
                    self._log("Visual search results opened in a new tab.")
                    return True

            if origin is not None and handles:
                try:
                    driver.switch_to.window(origin)
                except WebDriverException:
                    pass

            if time.monotonic() >= deadline:
                return False

            if wait_or_stop(poll_interval, stop_event):
                return False

    def _current_url(self, driver):
        """Return the driver's current URL, or "" when it can't be read."""
        try:
            return driver.current_url or ""
        except WebDriverException:
            return ""

    def _is_results_url(self, url, start_url):
        """Whether `url` is a visual search result page and not the entry page."""
        lowered = (url or "").lower()
        if not lowered or url == start_url:
            return False
        if any(marker in lowered for marker in VISUAL_SEARCH_RESULT_URL_MARKERS):
            return True
        if "bing.com" in lowered and ("/search" in lowered or "/images/" in lowered):
            return True
        return False

    def _page_state(self, driver):
        """
        One-line snapshot of where the browser ended up, for failure logs.
        """
        try:
            tabs = len(driver.window_handles)
        except WebDriverException:
            tabs = "?"

        try:
            title = (driver.title or "")[:60]
        except WebDriverException:
            title = "?"

        try:
            panel = driver.execute_script(
                "var p = document.querySelector(arguments[0]);"
                "return p ? (p.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 120)"
                " : null;",
                VISUAL_SEARCH_PANEL_SELECTOR,
            )
        except WebDriverException:
            panel = "?"

        return f"tabs={tabs}, title={title!r}, flyout says {panel!r}"

    def _search_surface(self, driver):
        """Return the FORM code of the current page, or its path as a fallback."""
        try:
            current_url = driver.current_url or ""
        except WebDriverException:
            return "URL unknown"

        for part in current_url.split("?", 1)[-1].split("&"):
            if part.upper().startswith("FORM="):
                return part
        return urlparse(current_url).path or "no FORM code"

    def _log_visual_search_failure(self, driver, step, error=None, stop_event=None):
        """
        Log a visual search failure with the step that broke, for debugging.
        """

        if stop_event is not None and stop_event.is_set():
            self._log("Visual search stopped because Stop was requested.")
            return False

        try:
            current_url = driver.current_url
        except WebDriverException:
            current_url = "unknown"

        if error is None:
            reason = "timed out"
        else:
            short_error = str(error).split("\n")[0][:80].strip()
            reason = (
                f"{type(error).__name__}: {short_error}"
                if short_error
                else type(error).__name__
            )

        self._log(
            f"[ERROR] Visual search failed while {step} ({reason}). URL: {current_url}"
        )

        return False

    def _pick_query(self):
        """One query from the run's own pool, or None when it can't be read."""
        from ..config import JSON_FILE_PATH

        try:
            queries = self.load_queries_from_json(JSON_FILE_PATH, 1)
        except Exception:
            queries = []

        return queries[0] if queries else None

    def _images_results_url(self, query):
        """Image results for `query`, or the bare Images page without one."""
        if not query:
            return VISUAL_SEARCH_IMAGES_URL

        return f"{VISUAL_SEARCH_IMAGES_QUERY_URL}?{urlencode({'q': query})}"

    def _browse_to_image_results(
        self, driver, human, query, poll_interval, stop_event=None
    ):
        """
        Reach image results the way a person does: search for something on the
        homepage, then switch to the Images tab.
        """
        if not query or self._stopped(stop_event):
            return False

        try:
            driver.get("https://www.bing.com")
            if wait_or_stop(random.uniform(1, 3), stop_event):
                return False

            search_box = self._find_visual_search_element(
                driver,
                VISUAL_SEARCH_BOX_LOCATORS,
                timeout=10,
                poll_interval=poll_interval,
                require_displayed=True,
                stop_event=stop_event,
            )

            if search_box is None:
                return False

            human_typing(search_box, query, stop_event=stop_event)
            if self._stopped(stop_event):
                return False
            search_box.send_keys(Keys.RETURN)

            if wait_or_stop(random.uniform(2, 4), stop_event):
                return False

            images_tab = self._find_visual_search_element(
                driver,
                VISUAL_SEARCH_IMAGES_TAB_LOCATORS,
                timeout=8,
                poll_interval=poll_interval,
                require_displayed=True,
                stop_event=stop_event,
            )

            if images_tab is None:
                self._log(
                    "[INFO] No Images tab on the results page; "
                    "opening the image results directly."
                )
                return False

            known_windows = set(driver.window_handles)

            human.click_element(images_tab)

            deadline = time.monotonic() + 10

            while True:
                if self._stopped(stop_event):
                    return False

                if "/images" in self._current_url(driver):
                    self._log(f"Searched '{query}', then switched to Images.")
                    return True

                for window in driver.window_handles:
                    if window in known_windows:
                        continue

                    driver.switch_to.window(window)
                    known_windows.add(window)
                    break

                if time.monotonic() >= deadline:
                    return False

                if wait_or_stop(poll_interval, stop_event):
                    return False

        except WebDriverException as e:
            short_error = str(e).split("\n")[0][:40]
            self._log(f"[INFO] Could not browse to the image results ({short_error}).")
            return False

    def other_surface_url(self):
        """
        The surface to try when Rewards ignored the search we just made.
        """
        if not self.last_search_url:
            return None

        if "/images" in self.last_search_url:
            return REWARDS_VISUAL_SEARCH_URL

        return VISUAL_SEARCH_IMAGES_URL

    def perform_visual_search(
        self, driver, image_path, stop_event=None, entry_url=None, search_url=None
    ):
        """
        Perform a visual search on Bing using an image file.
        """
        from ..config import APP_DIR

        portable_mode = "config" in APP_DIR
        poll_interval = 1.5 if portable_mode else 0.5

        if stop_event is not None and stop_event.is_set():
            self._log("Skipping visual search because Stop was requested.")
            return False

        human = HumanBehavior(
            driver, show_cursor=True, mobile=False, stop_event=stop_event
        )
        step = "opening Bing"

        mission_url = entry_url or REWARDS_VISUAL_SEARCH_URL

        query = self._pick_query()

        entry_urls = list(VISUAL_SEARCH_URLS)
        if mission_url not in entry_urls:
            entry_urls.insert(1, mission_url)

        entry_urls.insert(0, self._images_results_url(query))
        if search_url:
            if search_url in entry_urls:
                entry_urls.remove(search_url)
            entry_urls.insert(0, search_url)

        try:
            try:
                driver.set_page_load_timeout(30)
            except Exception:
                pass

            try:
                driver.get(mission_url)
                if wait_or_stop(random.uniform(1, 3), stop_event):
                    self._log("Visual search stopped because Stop was requested.")
                    return False
            except WebDriverException as e:
                short_error = str(e).split("\n")[0][:28]
                self._log(
                    f"[INFO] Could not open the mission link ({short_error}). Continuing."
                )

            outcome = "no widget"

            browsed = not search_url and self._browse_to_image_results(
                driver, human, query, poll_interval, stop_event
            )

            for index, url in enumerate(entry_urls):
                outcome = self._attempt_visual_search(
                    driver,
                    human,
                    url,
                    image_path,
                    poll_interval,
                    stop_event,
                    navigate=not (browsed and index == 0),
                )

                if outcome in ("done", "stopped"):
                    break

                if outcome == "no results":
                    alternate = (
                        mission_url
                        if url == VISUAL_SEARCH_IMAGES_URL
                        else VISUAL_SEARCH_IMAGES_URL
                    )
                    if url != alternate:
                        self._log(f"Retrying the visual search from {alternate}.")
                        outcome = self._attempt_visual_search(
                            driver,
                            human,
                            alternate,
                            image_path,
                            poll_interval,
                            stop_event,
                        )
                    break

            if outcome == "stopped":
                self._log("Visual search stopped because Stop was requested.")
                return False

            if outcome != "done":
                step = (
                    "waiting for the visual search results"
                    if outcome == "no results"
                    else "reaching Bing's image upload flyout"
                )
                return self._log_visual_search_failure(
                    driver, step, stop_event=stop_event
                )

            if wait_or_stop(random.uniform(4, 8), stop_event):
                self._log("Visual search stopped because Stop was requested.")
                return False

            try:
                human.scroll_page()
            except WebDriverException as e:
                short_error = str(e).split("\n")[0][:28]
                self._log(
                    f"[WARNING] WebDriver error when scrolling visual search results: {short_error}. Continuing."
                )

            if stop_event is not None and stop_event.is_set():
                self._log("Visual search stopped because Stop was requested.")
                return False

            self._log(
                f"Visual search completed successfully ({self._search_surface(driver)})."
            )
            return True

        except Exception as e:
            return self._log_visual_search_failure(
                driver, step, e, stop_event=stop_event
            )

    def get_next_image_id(self, used_images_list):
        """
        Selects the next available image ID that hasn't been used recently.
        If all images have been used, resets the cycle.
        """
        all_images = set(range(1, 31))
        used_images = set(used_images_list)

        available_images = list(all_images - used_images)

        if not available_images:
            self._log("[INFO] All images have been used. Resetting the cycle.")
            available_images = list(all_images)
            used_images_list = []

        selected_image = random.choice(available_images)
        used_images_list.append(selected_image)

        return selected_image, used_images_list

    def prepare_unique_image(self, image_id):
        """
        Prepares a unique version of the image to bypass hash-based detection.
        Crops 1-5 pixels and randomizes JPEG compression quality.
        """
        import secrets
        import tempfile

        from PIL import Image

        from ..config import VISUAL_SEARCH_ASSETS_DIR

        original_path = os.path.join(
            VISUAL_SEARCH_ASSETS_DIR,
            f"{image_id}.jpg",
        )

        if not os.path.exists(original_path):
            self._log(f"[ERROR] Source image not found: {original_path}")
            return None

        temp_path = None
        file_descriptor = None

        try:
            with Image.open(original_path) as img:
                width, height = img.size

                # 54 684 unique variations
                crop_left = random.randint(0, 5)
                crop_top = random.randint(0, 5)
                crop_right = random.randint(1, 7)
                crop_bottom = random.randint(1, 7)

                cropped_img = img.crop(
                    (crop_left, crop_top, width - crop_right, height - crop_bottom)
                )

                random_quality = random.randint(65, 95)

                temp_path = os.path.join(
                    tempfile.gettempdir(), f"{secrets.token_hex(16)}.jpg"
                )
                file_descriptor = os.open(
                    temp_path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600
                )

                with os.fdopen(file_descriptor, "wb") as temp_file:
                    file_descriptor = None

                    cropped_img.save(temp_file, format="JPEG", quality=random_quality)

            return temp_path

        except Exception as e:
            if file_descriptor is not None:
                os.close(file_descriptor)

            if temp_path is not None:
                try:
                    os.remove(temp_path)
                except OSError:
                    pass

            self._log(f"[ERROR] Failed to process image {image_id}: {e}")
            return None
