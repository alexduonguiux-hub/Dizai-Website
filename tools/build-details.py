#!/usr/bin/env python3
"""Builds the project detail pages work/<slug>/index.html from one template
and the content of Figma "Detail-Content" (42:5305). Run from the repo root:
    python3 tools/build-details.py
Images: assets/img/detail/<key>-NN.jpg (2048 x 1277, from the Figma frames)."""
import html, os, re

# index: the project's place in the Work list (index.html), so going back
# to Work opens on it
INDEX = {"chochoi": 0, "viettel-post": 1, "nuriflex": 2, "nuff": 3, "viettel-tammi": 4, "zen-design-system": 6}

PROJECTS = [
  dict(slug="chochoi", url="https://chochoicreative.com/", key="cc", n=8, title="ChoChoi Creative", width=942,
       desc="ChoChoi is a glocal-minded branding studio. We've seen brands chase every new look and fade just as fast. So we start deeper, with strategy built on the story, the culture and the details that are truly yours.",
       launch="2025", services=["UX Audit", "UX Improvement", "UI Design"], client="ChoChoi"),
  dict(slug="viettel-post", url="https://apps.apple.com/us/app/viettel-post/id1398283517", key="vp", n=6, title="Viettel Post", width=942,
       desc="Viettel Post is one of Vietnam’s largest logistics providers, with nearly 47,000 employees and 2,000 post offices. Its app serves two very different groups: online sellers, who create and track orders every day, and individual senders, who occasionally ship parcels to family.",
       launch="2025", services=["UX Audit", "UX Improvement", "UI Design", "Design System"], client="Viettel Post"),
  dict(slug="nuriflex", url="https://nuriflex.com.vn/projects/", key="nr", n=8, title="Nuriflex", width=942,
       desc="One-stop Provider In Rooftop Solar Solution. Solar System, Developer and EPC Services, Operation and Maintenance (O&M), Services for Renewable Energy Systems, Centralized Operation and Monitoring Center (TOC)",
       launch="2024", services=["UX Audit", "UX Improvement", "UI Design", "Design System"], client="Nuriflex"),
  dict(slug="nuff", url="https://nuffjuice.com", key="nf", n=8, title="Nuff Juice", width=942,
       desc="Nuff sells tropical fruit juices crafted from Vietnamese produce—pure, freshly pressed, free from reconstituted concentrates, and containing no additives. As a new brand, Nuff needed a space where first-time customers could learn who they are and what sets them apart from other juices on the shelf; their website was created to serve this very purpose.",
       launch="2024", services=["UX Audit", "UX Improvement", "UI Design"], client="ChoChoi"),
  dict(slug="viettel-tammi", url="https://apps.apple.com/vn/app/viettel-tammi/id6749427319", key="tm", n=7, title="Tammi", width=942,
       desc="Viettel Tammi is an all-in-one super app and a new digital ecosystem developed by Viettel Telecom.",
       launch="2026", services=["UX Audit", "UX Improvement", "UI Design", "Design System"], client="Viettel"),
  dict(slug="zen-design-system", url="https://zen.dizai.studio/", key="zn", n=11, title="Zen Design System", width=1267,
       desc="A scalable design system for agencies, enterprise platforms, and modern product teams. Built From Real Production Experience from design to code: Zen was shaped by the realities of scaling products, managing teams, and maintaining systems over time.",
       launch="2023", services=["Design System", "Codebase", "Canvas Studio Editor"], client="Đìzai Studio"),
]

def esc(s): return html.escape(s, quote=False)

def build(stamp):
    for i, p in enumerate(PROJECTS):
        nxt = PROJECTS[(i + 1) % len(PROJECTS)]
        plain = re.sub(r"<br>", " ", p["title"])
        key = p["key"]
        shots = "\n".join(
            f'        <figure class="dt-shot"><img class="dt-img" src="../../assets/img/detail/{key}-{k:02d}.jpg?v={stamp}" width="2048" height="1277" alt="{esc(plain)}, image {k}"{" loading=\"lazy\"" if k > 2 else ""}></figure>'
            for k in range(1, p["n"] + 1))
        thumbs = "\n".join(
            f'      <li><button type="button" aria-label="Image {k}"><img src="../../assets/img/detail/thumb/{key}-{k:02d}.jpg?v={stamp}" width="106" height="66" alt=""></button></li>'
            for k in range(1, p["n"] + 1))
        services = "<br>".join(esc(s) for s in p["services"])
        # "Visit project →": the live project (Figma 51:17891), when there is one
        visit = (f'<a class="dt-visit trim" href="{p["url"]}" target="_blank" rel="noopener">Visit project<span class="dt-arrow" aria-hidden="true">→</span></a>'
                 if p.get("url") else "")
        page = f'''<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{esc(plain)} — Đìzai Studio</title>
  <meta name="description" content="{esc(p["desc"][:150])}">
  <link rel="icon" type="image/png" sizes="32x32" href="../../favicon-32x32.png?v=3">
  <link rel="icon" type="image/png" sizes="16x16" href="../../favicon-16x16.png?v=3">
  <link rel="icon" type="image/svg+xml" href="../../favicon.svg?v=3">
  <link rel="shortcut icon" href="../../favicon.ico?v=3">
  <link rel="apple-touch-icon" sizes="180x180" href="../../apple-touch-icon.png?v=3">
  <meta name="theme-color" content="#f0efee">
  <meta name="format-detection" content="telephone=no, email=no, address=no, date=no">
  <link rel="preload" href="../../assets/fonts/AnNamSerif-VF.woff2?v=0.915s" as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="../../assets/img/detail/{key}-01.jpg?v={stamp}" as="image">
  <link rel="prefetch" href="../{nxt["slug"]}/">
  <link rel="stylesheet" href="../../assets/css/style.css?v={stamp}">
  <script>(function (r) {{ r.classList.add("is-entering"); try {{ history.scrollRestoration = "manual"; }} catch (e) {{}}
    setTimeout(function () {{ r.classList.remove("is-entering"); }}, 3000); }})(document.documentElement)</script>
</head>
<body class="page-detail" data-up="../../#work" data-down="../{nxt["slug"]}/" data-project="{INDEX[p["slug"]]}">
  <!-- Project page (Figma Work-Detail-00 … 03, 10:1738 / 10:1517 / 10:1526 /
       10:1536; content and pictures from Detail-Content 42:5305), built by
       tools/build-details.py; the motion is assets/js/detail.js.
       00: the title at the top; the services, the description, "Launch ·
       Client" and Visit project in one centred column; a small picture on
       the foot.
       00 → 01: scrolling, the picture grows into place (696 × 434) and the
       facts roll away; then the pictures run up as a column over the title,
       which sinks back. Thumbnails bottom right. Past the end, scrolling goes
       on to the next project (back to Work: the menu). -->
  <header class="site-nav">
    <nav aria-label="Main">
      <ul class="nav-list trim">
        <li><a href="../../">Home</a></li>
        <li><a href="../../about/">About</a></li>
        <li><a href="../../#work" aria-current="page">Work</a></li>
        <li><a href="../../contact/">Contact</a></li>
      </ul>
    </nav>
  </header>

  <main class="dt">
    <address class="contact cp-info dt-info trim">
      <a href="mailto:hello@dizai.studio">hello@dizai.studio</a><br>
      <a href="tel:+84937937195">+84 937 937 195</a><br>
      Saigon, Vietnam
    </address>

    <h1 class="dt-title" style="--tw: {p["width"]}">{p["title"]}</h1>
    <div class="dt-facts">
      <p class="dt-services trim">{services}</p>
      <p class="dt-desc">{esc(p["desc"])}</p>
      <p class="dt-meta">Launch: {p["launch"]} • Client: {esc(p["client"])}</p>
      {visit}
      <div class="dt-ph" aria-hidden="true"></div>
    </div>

    <div class="dt-scroll">
      <div class="dt-shots">
{shots}
      </div>
    </div>

    <ol class="dt-thumbs" aria-label="Pictures">
{thumbs}
    </ol>
  </main>

  <div class="cursor cursor-invert" aria-hidden="true"></div>
  <div class="cursor cursor-tint" aria-hidden="true"></div>
  <script src="../../assets/js/roll.js?v={stamp}"></script>
  <script src="../../assets/vendor/gsap/gsap.min.js?v=3.15.0"></script>
  <script src="../../assets/js/detail.js?v={stamp}"></script>
  <script src="../../assets/js/cursor.js?v={stamp}"></script>
</body>
</html>
'''
        os.makedirs(f"work/{p['slug']}", exist_ok=True)
        with open(f"work/{p['slug']}/index.html", "w") as f:
            f.write(page)
        print("work/%s/index.html" % p["slug"])

if __name__ == "__main__":
    m = re.search(r"\?v=(20\d{10})", open("index.html").read())
    build(m.group(1) if m else "1")
