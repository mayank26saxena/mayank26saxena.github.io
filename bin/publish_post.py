# /// script
# requires-python = ">=3.10"
# dependencies = ["matplotlib"]
# ///
"""Publish any blog post into this site under /blog/<slug>/. One script for every post.

  uv run bin/publish_post.py SOURCE_DIR --slug SLUG --date YYYY-MM-DD    # first publish
  uv run bin/publish_post.py SOURCE_DIR --slug SLUG                      # republish (keeps the listed date)
  uv run bin/publish_post.py SOURCE_DIR --slug SLUG --dry-run            # show what would change, write nothing

SOURCE_DIR is the post's folder in its project repo: an index.html plus whatever it loads (data/*.js, post.js, images).
The page is the single source of truth for its title (<h1>), list description (<meta name="description">) and kicker.

What it does (it never commits or pushes):
  - copies every local file the page references (src/href), with content-hash ?v= cache busting, and removes files in
    blog/SLUG/ that the page no longer loads; .json files are never copied unless referenced; linked local .html pages are
    copied with their own references, and SOURCE_DIR/publish-files.txt may list files the pages fetch at run time;
  - points the shared style files (tokens.css, charts.js; referenced as assets/... or ../assets/...) at blog/assets/,
    and stops if the project's copy differs from the site's (pass --update-shared to replace the site copy, which
    changes every post);
  - adds the site chrome when the page lacks it: breadcrumbs, favicons, canonical and link-preview tags;
  - writes the date in the page's meta line as month and year only ("October 2026");
  - draws blog/SLUG/share.png (1200x630) from the kicker, title, description and the page's split colours;
  - updates blog/posts.json and the list in blog/index.html (newest first, "Oct 2026"), and the title of any homepage
    link to the post.
"""
import argparse
import hashlib
import html
import io
import json
import re
import shutil
import sys
from datetime import date
from pathlib import Path

SITE = Path(__file__).resolve().parents[1]
BLOG = SITE / "blog"
BASE = "https://mayank26saxena.github.io"
AUTHOR = "Mayank Saxena"
SHARED = ("tokens.css", "charts.js")
FAVICONS = [
    '<link rel="icon" type="image/png" sizes="32x32" href="/assets/img/favicon-32x32.png?v=3">',
    '<link rel="icon" type="image/png" sizes="96x96" href="/assets/img/favicon-96x96.png?v=3">',
    '<link rel="apple-touch-icon" href="/apple-touch-icon.png?v=3">',
]
CRUMBS = '<div class="col crumbs"><a href="/">Mayank Saxena</a><span aria-hidden="true">/</span><a href="/blog/">Writing</a></div>'
CRUMBS_CSS = """<style>
  .crumbs { display: flex; gap: 8px; align-items: baseline; padding-top: 26px; font: 500 14px/1 var(--sans); color: var(--muted); }
  .crumbs a { color: var(--ink-2); text-decoration: none; }
  .crumbs a:hover { color: var(--brand); text-decoration: underline; }
  header.top { padding-top: 44px; }
</style>"""
MONTHS = "January February March April May June July August September October November December".split()


def h8(b):
    return hashlib.sha1(b).hexdigest()[:8]


def text(s):
    return html.unescape(re.sub(r"<[^>]+>", "", s)).strip()


def css_vars(*sources):
    v = {}
    for s in sources:
        v.update(dict(re.findall(r"(--[\w-]+)\s*:\s*([^;]+);", s)))

    def res(x, depth=0):
        m = re.fullmatch(r"\s*var\((--[\w-]+)\)\s*", x)
        return res(v.get(m.group(1), "#8a9194"), depth + 1) if m and depth < 8 else x.strip()
    return res


def card(kicker, title, standfirst, split):
    """1200x630 share image in the house style (stone page, ink title, split rule); returns PNG bytes."""
    import textwrap

    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib.patches import Rectangle

    plt.rcParams["font.family"] = ["Helvetica Neue", "Arial", "DejaVu Sans"]
    fig = plt.figure(figsize=(12, 6.3), dpi=100, facecolor="#f2f3f3")
    ax = fig.add_axes([0, 0, 1, 1])
    ax.set_xlim(0, 1200); ax.set_ylim(0, 630); ax.axis("off")
    ax.text(72, 548, kicker.upper(), fontsize=15, fontweight="bold", color="#2f6b57", va="center")
    lines = textwrap.wrap(title, 24)[:3]
    for i, ln in enumerate(lines):
        ax.text(72, 462 - i * 74, ln, fontsize=46, fontweight="bold", color="#0f172a", va="center")
    y = 462 - len(lines) * 74 + 6
    ax.add_patch(Rectangle((72, y), 60, 7, color=split[0])); ax.add_patch(Rectangle((132, y), 60, 7, color=split[1]))
    ax.text(72, y - 50, textwrap.fill(standfirst, 70), fontsize=17, color="#475569", va="top", linespacing=1.45)
    ax.text(72, 52, f"{AUTHOR}  ·  mayank26saxena.github.io", fontsize=15, color="#64748b", va="center")
    buf = io.BytesIO()
    fig.savefig(buf, dpi=100, facecolor="#f2f3f3", format="png", metadata={"Software": None})
    plt.close(fig)
    return buf.getvalue()


def same_pixels(path, png):
    if not path.exists():
        return False
    import matplotlib.image as mpimg
    import numpy as np
    a, b = mpimg.imread(path), mpimg.imread(io.BytesIO(png))
    return a.shape == b.shape and float(np.abs(a - b).max()) < 1e-6


def head_tags(url, title, desc, iso):
    e = lambda s: html.escape(s, quote=True)
    return [f'<link rel="canonical" href="{url}">', '<meta property="og:type" content="article">',
            f'<meta property="og:title" content="{e(title)}">', f'<meta property="og:description" content="{e(desc)}">',
            f'<meta property="og:url" content="{url}">', f'<meta property="og:image" content="{url}share.png">',
            '<meta property="og:image:width" content="1200">', '<meta property="og:image:height" content="630">',
            f'<meta property="article:author" content="{AUTHOR}">', f'<meta property="article:published_time" content="{iso}">',
            '<meta name="twitter:card" content="summary_large_image">', f'<meta name="twitter:title" content="{e(title)}">',
            f'<meta name="twitter:description" content="{e(desc)}">', f'<meta name="twitter:image" content="{url}share.png">', *FAVICONS]


def list_items(posts):
    return [f'<li><a href="{p["slug"]}/"><span class="pl-date">{date.fromisoformat(p["date"]).strftime("%b %Y")}</span>'
            f'<span class="pl-title">{html.escape(p["title"])}</span><span class="pl-desc">{html.escape(p["description"])}</span></a></li>'
            for p in posts]


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("source", help="the post's folder in its project repo (contains index.html)")
    ap.add_argument("--slug", required=True, help="URL name under /blog/, e.g. placeholder-names-privacy")
    ap.add_argument("--date", help="date the post is listed under (YYYY-MM-DD; shown as month and year). Required the first time")
    ap.add_argument("--published", help="publication date for link previews (default: keep the current one, else --date)")
    ap.add_argument("--update-shared", action="store_true", help="replace blog/assets/ style files with the project's copies")
    ap.add_argument("--dry-run", action="store_true", help="list the files that would change and write nothing")
    a = ap.parse_args()

    src = Path(a.source).expanduser().resolve()
    page_src = src / "index.html"
    if not page_src.exists():
        sys.exit(f"{page_src} not found")
    if not re.fullmatch(r"[a-z0-9]+(-[a-z0-9]+)*", a.slug):
        sys.exit("slug: lowercase words joined by hyphens")
    post = BLOG / a.slug
    posts = json.loads((BLOG / "posts.json").read_text()) if (BLOG / "posts.json").exists() else []
    entry = next((p for p in posts if p["slug"] == a.slug), None)
    listed = a.date or (entry and entry["date"])
    if not listed:
        sys.exit("--date is required the first time a post is published")
    listed_d = date.fromisoformat(listed)
    out = {}  # path -> bytes (None = delete)

    t = page_src.read_text(encoding="utf-8")
    title = text(re.search(r"<h1>(.*?)</h1>", t, re.S).group(1))
    desc = html.unescape(re.search(r'<meta name="description" content="(.*?)">', t, re.S).group(1)).strip()
    kicker = text(re.search(r'<p class="kicker">(.*?)</p>', t, re.S).group(1))
    t = re.sub(r"<title>.*?</title>", f"<title>{html.escape(title, quote=False)}</title>", t, count=1, flags=re.S)

    # local references: shared style files go to blog/assets/, everything else is copied next to the page. Linked local
    # .html pages (for example an interactive demo next to the post) are copied too, with their own references, and files a
    # page only fetches at run time can be listed one per line in SOURCE_DIR/publish-files.txt.
    keep = {"index.html", "share.png"}
    done = set()

    def localize(page_text, page_rel):
        base = (src / page_rel).parent
        depth = len(Path(page_rel).parts) - 1

        def ref(m):
            attr, raw = m.group(1), m.group(2)
            frag = "#" + raw.split("#", 1)[1] if "#" in raw else ""
            path = raw.split("#")[0].split("?")[0]
            if not path:
                return m.group(0)
            name = path.split("/")[-1]
            if re.fullmatch(r"(\.\./)*assets/[^/]+", path) and name in SHARED:
                site_f, proj_f = BLOG / "assets" / name, (base / path)
                if proj_f.exists() and (not site_f.exists() or proj_f.read_bytes() != site_f.read_bytes()):
                    if not a.update_shared:
                        sys.exit(f"{proj_f} differs from blog/assets/{name} (shared by every post). Copy the site's version into the "
                                 f"project and re-check the page, or pass --update-shared to replace the site's copy.")
                    out[site_f] = proj_f.read_bytes()
                b = out.get(site_f) or site_f.read_bytes()
                return f'{attr}="{"../" * (depth + 1)}assets/{name}?v={h8(b)}"'
            if path.endswith("/"):
                path += "index.html"
            f = (base / path).resolve()
            if not f.is_file() or src not in f.parents and f != src:
                sys.exit(f"{page_rel} references {path}, which is not a file inside {src}")
            rel = f.relative_to(src).as_posix()
            if rel == "index.html":
                return f'{attr}="{path}{frag}"'
            keep.add(rel)
            if f.suffix == ".html" and attr == "href":
                if rel not in done:
                    done.add(rel)
                    out[post / rel] = localize(f.read_text(encoding="utf-8"), rel).encode()
                return f'{attr}="{path}{frag}"'
            out[post / rel] = f.read_bytes()
            return f'{attr}="{path}?v={h8(out[post / rel])}{frag}"'
        return re.sub(r'\b(src|href)="(?!https?:|//|/|#|mailto:|data:)([^"]+)"', ref, page_text)

    t = localize(t, "index.html")
    extra = src / "publish-files.txt"
    if extra.exists():
        for line in extra.read_text(encoding="utf-8").splitlines():
            rel = line.split("#")[0].strip()
            if not rel:
                continue
            f = (src / rel).resolve()
            if not f.is_file() or src not in f.parents:
                sys.exit(f"publish-files.txt lists {rel}, which is not a file inside {src}")
            keep.add(f.relative_to(src).as_posix())
            out[post / f.relative_to(src).as_posix()] = f.read_bytes()

    # site chrome: drop any old preview/icon tags, then add the current ones after the description
    t = re.sub(r'\n?<(?:link rel="(?:canonical|icon|apple-touch-icon)"|meta (?:property="(?:og|article):|name="twitter:))[^>]*>', "", t)
    old_page = (post / "index.html").read_text(encoding="utf-8") if (post / "index.html").exists() else ""
    cur = re.search(r'article:published_time" content="([\d-]+)"', old_page)
    iso = a.published or (cur.group(1) if cur else listed)
    url = f"{BASE}/blog/{a.slug}/"
    t = re.sub(r'(<meta name="description" content=".*?">)', lambda m: m.group(1) + "\n" + "\n".join(head_tags(url, title, desc, iso)), t, count=1, flags=re.S)
    if 'class="col crumbs"' not in t:
        t = t.replace("</head>", CRUMBS_CSS + "\n</head>", 1)
        t = re.sub(r"(<body[^>]*>)", lambda m: m.group(1) + "\n" + CRUMBS, t, count=1)
    month = f"{MONTHS[listed_d.month - 1]} {listed_d.year}"
    t = re.sub(r'(<div class="meta">.*?)(?:\d{1,2} )?(?:' + "|".join(MONTHS) + r") \d{4}", lambda m: m.group(1) + month, t, count=1, flags=re.S)
    out[post / "index.html"] = t.encode()

    # stale files in the post folder
    if post.exists():
        for f in post.rglob("*"):
            if f.is_file() and f.relative_to(post).as_posix() not in keep and f.name != ".DS_Store":
                out[f] = None

    # share image
    tokens = (BLOG / "assets/tokens.css").read_text(encoding="utf-8")
    res = css_vars(tokens, "\n".join(re.findall(r"<style>(.*?)</style>", t, re.S)))
    split = (res("var(--split-a)"), res("var(--split-b)"))
    try:
        png = card(kicker, title, desc.split(". ")[0].rstrip(".") + ".", split)
        if not same_pixels(post / "share.png", png):  # PNG bytes vary with library versions; only redraw real changes
            out[post / "share.png"] = png
    except ImportError:
        sys.exit("matplotlib is missing: run with `uv run bin/publish_post.py ...` (it installs it for this script)")

    # list page, posts.json, homepage link titles
    new = dict(slug=a.slug, title=title, description=desc, date=listed)
    posts = sorted([p for p in posts if p["slug"] != a.slug] + [new], key=lambda p: p["date"], reverse=True)
    out[BLOG / "posts.json"] = (json.dumps(posts, indent=2, ensure_ascii=False) + "\n").encode()
    lp = (BLOG / "index.html").read_text(encoding="utf-8")
    lp, n = re.subn(r'(<ul class="post-list">\n).*?(\n</ul>)', lambda m: m.group(1) + "\n".join(list_items(posts)) + m.group(2), lp, count=1, flags=re.S)
    if n != 1:
        sys.exit('blog/index.html has no <ul class="post-list"> block')
    out[BLOG / "index.html"] = lp.encode()
    home = (SITE / "index.html").read_text(encoding="utf-8")
    home = re.sub(rf'(<h[1-4][^>]*><a href="/blog/{a.slug}/">)[^<]*(</a>)', lambda m: m.group(1) + html.escape(title, quote=False) + m.group(2), home)
    out[SITE / "index.html"] = home.encode()

    changed = [p for p, b in out.items() if (b is None and p.exists()) or (b is not None and (not p.exists() or p.read_bytes() != b))]
    for p in changed:
        print(("would " if a.dry_run else "") + ("delete " if out[p] is None else "write  ") + str(p.relative_to(SITE)))
    if a.dry_run:
        return
    for p in changed:
        if out[p] is None:
            p.unlink()
        else:
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_bytes(out[p])
    print(f"{'updated' if changed else 'no changes for'} /blog/{a.slug}/ · listed {listed_d.strftime('%b %Y')} · review with git diff, then commit and push")


if __name__ == "__main__":
    main()
