"""Stamps a PORTFOLIO section onto the base resume PDF, once per site edition.

The base PDF has no Portfolio section; this script never modifies it. Each
variant links to one edition of the site and describes that edition, and its
stack, so a resume sent for a React role points at react.mvcprogrammer.com and so on. The section is typeset in the
base PDF's own styles (Inter via PyMuPDF, fonts instanced by build_fonts.py).

    python docs/pdf/build_fonts.py <font dir>
    python docs/pdf/build_resume_variants.py <base.pdf> <font dir> <output dir>

Writes <output dir>/Neal_Thomas_Resume-{vanilla,blazor,angular,react}.pdf.
"""
import os
import sys
import pymupdf

base_pdf, font_dir, out_dir = sys.argv[1:4]
os.makedirs(out_dir, exist_ok=True)
SEMI = os.path.join(font_dir, "Inter-SemiBold.ttf")
REG = os.path.join(font_dir, "Inter-Regular.ttf")

def rgb(hex6):
    return tuple(int(hex6[i:i + 2], 16) / 255 for i in (0, 2, 4))

BLUE, INK, BODY, MUTED, RULE = rgb("2f5fc4"), rgb("1e1f22"), rgb("33363b"), rgb("6f737a"), rgb("d9dce1")
LEFT, RIGHT, RULE_RIGHT, HEAD_X = 54, 558, 564, 60
PITCH = 13.6          # body line pitch used by the Experience bullets
BOTTOM = 738          # page bottom margin (54 pt)

API = ("Backed by a C# / .NET 10 API on AWS Lambda and DynamoDB with an OpenAPI contract and ETag caching, "
       "deployed with GitHub Actions.")
HOSTING = "served from S3 and CloudFront under a strict Content Security Policy. "
EDITIONS = {
    "vanilla": {
        "host": "mvcprogrammer.com",
        "detail": "HTML · CSS · JavaScript · .NET 10 API",
        "body": "Live portfolio site in hand-written HTML, CSS, and JavaScript with no framework or build step, "
                + HOSTING + API,
    },
    "blazor": {
        "host": "blazor.mvcprogrammer.com",
        "detail": "Blazor WebAssembly · C# · .NET 10 API",
        "body": "Live portfolio site built in Blazor WebAssembly on .NET 10 with a typed HttpClient and validated Options "
                "configuration, " + HOSTING + API,
    },
    "angular": {
        "host": "angular.mvcprogrammer.com",
        "detail": "Angular 22 · signals · .NET 10 API",
        "body": "Live portfolio site built in Angular 22 with standalone components, signals, and OnPush change detection, "
                + HOSTING + API,
    },
    "react": {
        "host": "react.mvcprogrammer.com",
        "detail": "React 19 · TypeScript · Vite · .NET 10 API",
        "body": "Live portfolio site built in React 19 with TypeScript, Vite, hooks and context, and Vitest component tests, "
                + HOSTING + API,
    },
}

semi, reg = pymupdf.Font(fontfile=SEMI), pymupdf.Font(fontfile=REG)

def wrap(text, size, width):
    """Greedy word wrap; "C# / .NET" is kept together so a line never ends on the slash."""
    lines, cur = [], ""
    for word in text.replace("C# / .NET", "C#\x01/\x01.NET").split(" "):
        word = word.replace("\x01", " ")
        trial = f"{cur} {word}".strip()
        if reg.text_length(trial, fontsize=size) <= width:
            cur = trial
        else:
            lines.append(cur)
            cur = word
    lines.append(cur)
    return lines

for key, e in EDITIONS.items():
    doc = pymupdf.open(base_pdf)
    page = doc[-1]
    assert "P O R T F O L I O" not in page.get_text(), "base PDF already has a Portfolio section"
    # Anchor on the last Education entry and mirror the Experience -> Education spacing (37 pt).
    anchor = [s for b in page.get_text("dict")["blocks"] for l in b.get("lines", []) for s in l["spans"]
              if s["text"] == "High School Diploma"][0]
    y_head = anchor["origin"][1] + 37.0
    y_rule = y_head + 7.0
    y_entry = y_head + 24.9
    y_body = y_entry + 14.6

    # Font names must be new to this document; reusing one makes insert_text pick up an old subset.
    page.insert_text((HEAD_X, y_head), "P O R T F O L I O", fontname="InterSemiPort", fontfile=SEMI, fontsize=8.8, color=BLUE)
    page.draw_line((HEAD_X, y_rule), (RULE_RIGHT, y_rule), color=RULE, width=0.6)

    page.insert_text((LEFT, y_entry), e["host"], fontname="InterSemiPort", fontfile=SEMI, fontsize=9.4, color=INK)
    w = semi.text_length(e["host"], fontsize=9.4)
    page.insert_link({"kind": pymupdf.LINK_URI, "uri": f"https://{e['host']}",
                      "from": pymupdf.Rect(LEFT, y_entry - 9.4, LEFT + w, y_entry + 2.5)})

    dw = reg.text_length(e["detail"], fontsize=8.8)
    page.insert_text((RIGHT - dw, y_entry - 0.5), e["detail"], fontname="InterRegPort", fontfile=REG, fontsize=8.8, color=MUTED)

    lines = wrap(e["body"], 9.4, RIGHT - LEFT)
    assert len(lines) <= 3, f"{key}: body wraps to {len(lines)} lines"
    y = y_body
    for ln in lines:
        page.insert_text((LEFT, y), ln, fontname="InterRegPort", fontfile=REG, fontsize=9.4, color=BODY)
        y += PITCH
    assert y - PITCH + 3 <= BOTTOM, f"{key}: runs past the bottom margin"

    doc.subset_fonts()
    out = os.path.join(out_dir, f"Neal_Thomas_Resume-{key}.pdf")
    doc.save(out, garbage=4, deflate=True)
    doc.close()

    check = pymupdf.open(out)
    text = check[-1].get_text()
    links = [l["uri"] for l in check[-1].get_links()]
    assert e["host"] in text and links == [f"https://{e['host']}"], (key, links)
    print(f"{key:8} {os.path.getsize(out) // 1024} KB  {len(lines)} body lines  link {links[0]}")
