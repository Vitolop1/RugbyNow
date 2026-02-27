# scripts/sync_flashscore.py
# ------------------------------------------------------------
# Sync Flashscore (results + fixtures) into Supabase + local logs
# - Redirects ALL prints + errors to a .txt log file
# ------------------------------------------------------------

import os
import re
import json
import sys
import asyncio
from datetime import datetime, timezone
from contextlib import redirect_stdout, redirect_stderr

from dotenv import load_dotenv
from supabase import create_client
from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeoutError


# -------------------------
# SIMPLE LOGGER (stdout/stderr to file)
# -------------------------
class Tee:
    """
    Write to file and (optionally) also to console.
    """
    def __init__(self, file_obj, also_console: bool = True):
        self.file_obj = file_obj
        self.also_console = also_console
        self.console = sys.__stdout__

    def write(self, s):
        try:
            self.file_obj.write(s)
            self.file_obj.flush()
        except:
            pass
        if self.also_console:
            try:
                self.console.write(s)
                self.console.flush()
            except:
                pass

    def flush(self):
        try:
            self.file_obj.flush()
        except:
            pass
        if self.also_console:
            try:
                self.console.flush()
            except:
                pass


def ensure_logs_dir():
    os.makedirs("logs", exist_ok=True)

def make_run_log_path():
    ensure_logs_dir()
    ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    return f"logs/run_{ts}.txt"


# -------------------------
# ENV + SUPABASE
# -------------------------
load_dotenv(".env.local")

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
sb = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


# -------------------------
# HELPERS
# -------------------------
MONTHS_NUM = {
    "Jan": 1, "Feb": 2, "Mar": 3, "Apr": 4, "May": 5, "Jun": 6,
    "Jul": 7, "Aug": 8, "Sep": 9, "Oct": 10, "Nov": 11, "Dec": 12,
}

MONTH_RE = r"(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)"

BAD_EXACT = {
    "RUGBY UNION",
    "SOUTH AMERICA:",
    "SOUTH AMERICA",
    "ENGLAND:",
    "FRANCE:",
    "EUROPE:",
    "WORLD:",
    "ARGENTINA:",
    "USA:",
}

def _clean(s: str) -> str:
    if not s:
        return ""
    return re.sub(r"\s+", " ", s).strip()

def slugify(s: str) -> str:
    s = (s or "").strip().lower()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    s = re.sub(r"-+", "-", s).strip("-")
    return s

def _is_bad_team(s: str) -> bool:
    if not s:
        return True
    if s in BAD_EXACT:
        return True
    if s.isupper() and len(s) <= 25 and (":" in s or " " in s):
        return True
    if len(s) <= 3:
        return True
    return False

async def _get_best_text(loc):
    for attr in ("title", "aria-label", "data-tooltip"):
        try:
            v = _clean(await loc.get_attribute(attr) or "")
            if v and len(v) > 3:
                return v
        except:
            pass
    try:
        return _clean(await loc.inner_text())
    except:
        return ""


# -------------------------
# LOCAL LOG DUMPS (jsonl + summary)
# -------------------------
def make_log_paths(comp_slug: str, season_name: str):
    ensure_logs_dir()
    ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    safe_season = season_name.replace("/", "-")
    base = f"logs/flashscore_{comp_slug}_{safe_season}_{ts}"
    return base + ".jsonl", base + "_summary.txt"

def write_jsonl(path: str, rows: list[dict]):
    with open(path, "w", encoding="utf-8") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")

def write_summary(path: str, comp: dict, season_name: str, results_items: list, fixtures_items: list, upsert_ok: int, upsert_fail: int):
    lines = []
    lines.append(f"competition: {comp.get('name')} ({comp.get('slug')})")
    lines.append(f"season: {season_name}")
    lines.append(f"results: {len(results_items)}")
    lines.append(f"fixtures: {len(fixtures_items)}")
    lines.append(f"upsert_ok: {upsert_ok}")
    lines.append(f"upsert_fail: {upsert_fail}")
    lines.append("")
    lines.append("results_preview:")
    for it in results_items[:5]:
        lines.append(str(it))
    lines.append("")
    lines.append("fixtures_preview:")
    for it in fixtures_items[:5]:
        lines.append(str(it))

    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))


# -------------------------
# SUPABASE DB OPS
# -------------------------
def get_competitions_with_urls():
    r = (
        sb.table("competitions")
        .select("id,name,slug,results_url,fixtures_url,standings_url")
        .execute()
    )
    comps = []
    for c in (r.data or []):
        if c.get("slug") and (c.get("results_url") or c.get("fixtures_url")):
            comps.append(c)
    return comps

def get_or_create_season(competition_id: int, season_name: str) -> int:
    r = (
        sb.table("seasons")
        .select("id,name")
        .eq("competition_id", competition_id)
        .eq("name", season_name)
        .limit(1)
        .execute()
    )
    if r.data:
        return r.data[0]["id"]

    ins = (
        sb.table("seasons")
        .insert({"competition_id": competition_id, "name": season_name})
        .execute()
    )
    return ins.data[0]["id"]

def upsert_team(name: str) -> int:
    team_slug = slugify(name)
    r = sb.table("teams").select("id").eq("slug", team_slug).limit(1).execute()
    if r.data:
        return r.data[0]["id"]
    ins = sb.table("teams").insert({"name": name, "slug": team_slug}).execute()
    return ins.data[0]["id"]

def build_source_event_key(competition_slug: str, season_name: str, match_date: str, kickoff_time: str, home: str, away: str) -> str:
    return slugify(f"{competition_slug}|{season_name}|{match_date}|{kickoff_time}|{home}|{away}")

def upsert_matches_bulk(season_id: int, competition_slug: str, season_name: str, items: list, source_url: str):
    ok = 0
    fail = 0

    for it in items:
        try:
            home_id = upsert_team(it["home"])
            away_id = upsert_team(it["away"])

            key = build_source_event_key(
                competition_slug=competition_slug,
                season_name=season_name,
                match_date=it["match_date"],
                kickoff_time=it["kickoff_time"],
                home=it["home"],
                away=it["away"],
            )

            payload = {
                "season_id": season_id,
                "round": it.get("round"),
                "match_date": it["match_date"],
                "kickoff_time": it["kickoff_time"],
                "status": it["status"],
                "home_team_id": home_id,
                "away_team_id": away_id,
                "home_score": it.get("home_score"),
                "away_score": it.get("away_score"),
                "source": "flashscore",
                "source_event_key": key,
                "source_url": source_url,
            }

            sb.table("matches").upsert(
                payload,
                on_conflict="season_id,match_date,home_team_id,away_team_id",
            ).execute()
            ok += 1
        except Exception as e:
            fail += 1
            print(f"⚠️ upsert failed for {it.get('match_date')} {it.get('home')} vs {it.get('away')} -> {repr(e)}")

    return ok, fail


# -------------------------
# SEASON + DATE LOGIC
# -------------------------
async def detect_season_name(page, fallback: str):
    try:
        for sel in [".heading__info", ".heading__name", "header", "body"]:
            loc = page.locator(sel).first
            if await loc.count() == 0:
                continue
            txt = _clean(await loc.inner_text())
            m = re.search(r"\b(20\d{2})/(20\d{2})\b", txt)
            if m:
                return f"{m.group(1)}/{m.group(2)}"
    except:
        pass
    return fallback

def infer_season_fallback(now_utc: datetime) -> str:
    y = now_utc.year
    if now_utc.month >= 7:
        return f"{y}/{y+1}"
    return f"{y-1}/{y}"

def year_for_match(season_name: str, month_abbr: str) -> int:
    mnum = MONTHS_NUM[month_abbr]
    a, b = season_name.split("/")
    y1, y2 = int(a), int(b)
    return y1 if mnum >= 7 else y2

def build_match_date(season_name: str, mon: str, day: int) -> str:
    y = year_for_match(season_name, mon)
    mm = MONTHS_NUM[mon]
    dd = int(day)
    return f"{y:04d}-{mm:02d}-{dd:02d}"

def parse_kickoff_time_from_row_text(txt: str) -> str:
    txt = txt or ""
    tm = re.search(r"\b(\d{1,2}):(\d{2})(?:\s?(AM|PM))?\b", txt)
    if not tm:
        return "00:00:00"

    hh = int(tm.group(1))
    mm = int(tm.group(2))
    ap = tm.group(3)
    if ap:
        ap = ap.upper()
        if ap == "PM" and hh != 12:
            hh += 12
        if ap == "AM" and hh == 12:
            hh = 0
    return f"{hh:02d}:{mm:02d}:00"


# -------------------------
# PLAYWRIGHT SCRAPE
# -------------------------
async def accept_cookies_if_any(page):
    candidates = [
        "button:has-text('I Accept')",
        "button:has-text('Accept')",
        "button:has-text('Accept all')",
        "button:has-text('AGREE')",
        "button:has-text('Agree')",
    ]
    for sel in candidates:
        try:
            btn = page.locator(sel).first
            if await btn.count() > 0:
                await btn.click(timeout=1500)
                await page.wait_for_timeout(300)
                return
        except:
            pass

async def expand_all_events(page):
    for _ in range(10):
        try:
            await page.mouse.wheel(0, 3000)
            await page.wait_for_timeout(400)
        except:
            pass

        for sel in [
            "a:has-text('Show more matches')",
            "button:has-text('Show more matches')",
            "a:has-text('Show more')",
            "button:has-text('Show more')",
        ]:
            try:
                b = page.locator(sel).first
                if await b.count() > 0:
                    await b.click(timeout=1200)
                    await page.wait_for_timeout(700)
            except:
                pass

async def parse_rows_to_items(page, rows, status: str):
    items = []
    count = min(await rows.count(), 800)

    for i in range(count):
        row = rows.nth(i)
        try:
            hloc = row.locator(".event__participant--home").first
            aloc = row.locator(".event__participant--away").first
            if await hloc.count() == 0 or await aloc.count() == 0:
                continue

            home = await _get_best_text(hloc)
            away = await _get_best_text(aloc)
            if _is_bad_team(home) or _is_bad_team(away):
                continue

            try:
                txt = (await row.inner_text()).strip()
            except:
                txt = ""
            if not txt or "Advertisement" in txt or "We Care About Your Privacy" in txt:
                continue

            dm = re.search(rf"\b{MONTH_RE}\s+(\d{{1,2}})\b", txt)
            if not dm:
                continue
            mon = dm.group(1)
            day = int(dm.group(2))

            kickoff_time = parse_kickoff_time_from_row_text(txt)

            round_num = None
            rm = re.search(r"Round\s+(\d+)", txt, re.I)
            if rm:
                round_num = int(rm.group(1))

            home_score = None
            away_score = None
            if status == "FT":
                hs_loc = row.locator(".event__score--home").first
                as_loc = row.locator(".event__score--away").first

                if await hs_loc.count() == 0 or await as_loc.count() == 0:
                    hs_loc = row.locator(".event__score").nth(0)
                    as_loc = row.locator(".event__score").nth(1)

                if await hs_loc.count() == 0 or await as_loc.count() == 0:
                    continue

                hs = _clean(await hs_loc.inner_text())
                a_s = _clean(await as_loc.inner_text())
                if not re.fullmatch(r"\d{1,3}", hs) or not re.fullmatch(r"\d{1,3}", a_s):
                    continue

                home_score = int(hs)
                away_score = int(a_s)
                if not (0 <= home_score <= 120 and 0 <= away_score <= 120):
                    continue

            items.append({
                "round": round_num,
                "month": mon,
                "day": day,
                "home": home,
                "away": away,
                "home_score": home_score,
                "away_score": away_score,
                "status": status,
                "kickoff_time": kickoff_time,
            })
        except:
            continue

    return items

async def scrape_competition(page, comp: dict):
    now_utc = datetime.now(timezone.utc)
    season_fallback = infer_season_fallback(now_utc)

    results_items = []
    fixtures_items = []
    season_name = season_fallback

    if comp.get("results_url"):
        await page.goto(comp["results_url"], wait_until="domcontentloaded", timeout=60000)
        await accept_cookies_if_any(page)
        try:
            await page.wait_for_selector(".event__match", timeout=15000)
        except PlaywrightTimeoutError:
            await page.wait_for_timeout(2000)

        await expand_all_events(page)
        season_name = await detect_season_name(page, fallback=season_fallback)

        rows = page.locator(".event__match")
        parsed = await parse_rows_to_items(page, rows, status="FT")
        for it in parsed:
            it["match_date"] = build_match_date(season_name, it["month"], it["day"])
            it["source_event_key"] = build_source_event_key(
                comp["slug"], season_name, it["match_date"], it["kickoff_time"], it["home"], it["away"]
            )
        results_items = parsed

    if comp.get("fixtures_url"):
        await page.goto(comp["fixtures_url"], wait_until="domcontentloaded", timeout=60000)
        await accept_cookies_if_any(page)
        try:
            await page.wait_for_selector(".event__match", timeout=15000)
        except PlaywrightTimeoutError:
            await page.wait_for_timeout(2000)

        await expand_all_events(page)
        season_name = await detect_season_name(page, fallback=season_name)

        rows = page.locator(".event__match")
        parsed = await parse_rows_to_items(page, rows, status="NS")
        for it in parsed:
            it["match_date"] = build_match_date(season_name, it["month"], it["day"])
            it["source_event_key"] = build_source_event_key(
                comp["slug"], season_name, it["match_date"], it["kickoff_time"], it["home"], it["away"]
            )
        fixtures_items = parsed

    return season_name, results_items, fixtures_items


# -------------------------
# MAIN
# -------------------------
async def main():
    comps = get_competitions_with_urls()
    print(f"Found competitions with URLs: {len(comps)}")

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport={"width": 1280, "height": 900},
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
        )
        page = await context.new_page()

        for comp in comps:
            print(f"\n=== {comp['name']} ({comp['slug']}) ===")

            try:
                season_name, results_items, fixtures_items = await scrape_competition(page, comp)
            except Exception as e:
                print(f"❌ scrape failed: {comp['slug']} -> {repr(e)}")
                continue

            print(f"season: {season_name}")
            print(f"parsed results: {len(results_items)}")
            if results_items[:3]:
                print("results preview:", results_items[:3])
            print(f"parsed fixtures: {len(fixtures_items)}")
            if fixtures_items[:3]:
                print("fixtures preview:", fixtures_items[:3])

            # dump parsed matches
            jsonl_path, summary_path = make_log_paths(comp["slug"], season_name)
            write_jsonl(jsonl_path, results_items + fixtures_items)
            print(f"📝 wrote local dump: {jsonl_path}")

            season_id = get_or_create_season(comp["id"], season_name)

            upsert_ok = 0
            upsert_fail = 0

            if results_items and comp.get("results_url"):
                ok, fail = upsert_matches_bulk(
                    season_id=season_id,
                    competition_slug=comp["slug"],
                    season_name=season_name,
                    items=results_items,
                    source_url=comp["results_url"],
                )
                upsert_ok += ok
                upsert_fail += fail

            if fixtures_items and comp.get("fixtures_url"):
                ok, fail = upsert_matches_bulk(
                    season_id=season_id,
                    competition_slug=comp["slug"],
                    season_name=season_name,
                    items=fixtures_items,
                    source_url=comp["fixtures_url"],
                )
                upsert_ok += ok
                upsert_fail += fail

            write_summary(
                summary_path,
                comp=comp,
                season_name=season_name,
                results_items=results_items,
                fixtures_items=fixtures_items,
                upsert_ok=upsert_ok,
                upsert_fail=upsert_fail,
            )
            print(f"📝 wrote summary: {summary_path}")
            print(f"✅ upsert done (ok={upsert_ok}, fail={upsert_fail})")

        await context.close()
        await browser.close()

    print("\n✅ done")


if __name__ == "__main__":
    # 1) Create ONE run log that captures everything
    run_log_path = make_run_log_path()

    # 2) Choose whether you still want console output:
    ALSO_CONSOLE = False   # <- ponelo True si querés verlo también en terminal

    with open(run_log_path, "w", encoding="utf-8") as f:
        tee = Tee(f, also_console=ALSO_CONSOLE)
        with redirect_stdout(tee), redirect_stderr(tee):
            print(f"Run log: {run_log_path}")
            try:
                asyncio.run(main())
            except Exception as e:
                print(f"❌ fatal: {repr(e)}")
                raise