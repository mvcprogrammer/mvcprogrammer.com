"""Shared styling and helpers for the edition guidelines in docs/ (see build_blazor_guide.py, build_angular_guide.py, and build_react_guide.py)."""
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import inch
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, Preformatted, SimpleDocTemplate, Spacer, Table, TableStyle

INK = colors.HexColor("#1e1f22")
BODY = colors.HexColor("#33363b")
MUTED = colors.HexColor("#6b7079")
ACCENT = colors.HexColor("#2f62d9")
RULE = colors.HexColor("#d9dce2")
CODE_BG = colors.HexColor("#f3f4f7")
HEAD_BG = colors.HexColor("#eef2fb")

REPO = "https://github.com/mvcprogrammer/mvcprogrammer.com"
BLOB = f"{REPO}/blob/main/"
TREE = f"{REPO}/tree/main/"

S = {
    "title": ParagraphStyle("title", fontName="Inter-Bold", fontSize=24, leading=30, textColor=INK, spaceAfter=4),
    "subtitle": ParagraphStyle("subtitle", fontName="Inter", fontSize=11, leading=15, textColor=MUTED, spaceAfter=18),
    "h1": ParagraphStyle("h1", keepWithNext=1, fontName="Inter-SemiBold", fontSize=14.5, leading=19, textColor=INK, spaceBefore=18, spaceAfter=6),
    "h2": ParagraphStyle("h2", keepWithNext=1, fontName="Inter-SemiBold", fontSize=11, leading=15, textColor=INK, spaceBefore=10, spaceAfter=3),
    "body": ParagraphStyle("body", fontName="Inter", fontSize=9.4, leading=13.6, textColor=BODY, spaceAfter=6),
    "bullet": ParagraphStyle("bullet", fontName="Inter", fontSize=9.4, leading=13.6, textColor=BODY, leftIndent=14, bulletIndent=3, spaceAfter=3),
    "cell": ParagraphStyle("cell", fontName="Inter", fontSize=8.6, leading=12, textColor=BODY),
    "cellsmall": ParagraphStyle("cellsmall", fontName="Inter", fontSize=8, leading=11.5, textColor=BODY),
    "cellhead": ParagraphStyle("cellhead", fontName="Inter-SemiBold", fontSize=8.6, leading=12, textColor=INK),
    "code": ParagraphStyle("code", fontName="Mono", fontSize=7.9, leading=11.2, textColor=INK, alignment=TA_LEFT),
    "caption": ParagraphStyle("caption", fontName="Inter", fontSize=8.2, leading=11, textColor=MUTED, spaceBefore=2, spaceAfter=8),
}


def register_fonts(font_dir):
    """Registers the Inter and JetBrains Mono instances built by build_fonts.py."""
    pdfmetrics.registerFont(TTFont("Inter", f"{font_dir}/Inter-Regular.ttf"))
    pdfmetrics.registerFont(TTFont("Inter-SemiBold", f"{font_dir}/Inter-SemiBold.ttf"))
    pdfmetrics.registerFont(TTFont("Inter-Bold", f"{font_dir}/Inter-Bold.ttf"))
    pdfmetrics.registerFont(TTFont("Mono", f"{font_dir}/JetBrainsMono-Regular.ttf"))
    pdfmetrics.registerFontFamily("Inter", normal="Inter", bold="Inter-SemiBold", italic="Inter", boldItalic="Inter-SemiBold")


def p(text, style="body"):
    return Paragraph(text, S[style])


def b(text):
    return Paragraph(text, S["bullet"], bulletText="•")


def c(text):
    """Inline code."""
    return f'<font name="Mono" size="8.3" color="#1e1f22">{text}</font>'


def link(text, url):
    return f'<a href="{url}" color="#2f62d9"><u>{text}</u></a>'


def code_block(lines):
    t = Table([[Preformatted("\n".join(lines), S["code"])]], colWidths=[7.0 * inch])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), CODE_BG),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("LINEBEFORE", (0, 0), (0, -1), 2, ACCENT),
    ]))
    return [t, Spacer(1, 8)]


def table(head, rows, widths, first_style="cell"):
    data = [[Paragraph(h, S["cellhead"]) for h in head]]
    data += [[Paragraph(cell, S[first_style] if i == 0 else S["cell"]) for i, cell in enumerate(row)] for row in rows]
    t = Table(data, colWidths=widths, repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), HEAD_BG),
        ("LINEBELOW", (0, 0), (-1, 0), 0.8, ACCENT),
        ("LINEBELOW", (0, 1), (-1, -1), 0.4, RULE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    return t


# ---------------------------------------------------------------- Palettes
# One row per edition: the palette file, a one-line description, and the token colors as they are declared in that
# file (page, optional band, accent, hover) for each color scheme. Every guideline prints the same table, so a palette
# change is made here once.
PALETTES = [
    ("Default", "vanilla.css",
     "Eggshell paper with a terracotta accent and a coral hover; a warm charcoal after dark.",
     ["#f0ead6", "#a64a23", "#d4602f"], ["#211e18", "#e0855c", "#ffb088"]),
    ("Angular", "angular/src/angular.css",
     "The four Google logo colors, each with a job: a blue page, a yellow quote band, red buttons, green hovers. "
     "Dark mode flips to royal blue and green with yellow buttons.",
     ["#d2e3fc", "#fde293", "#b31412", "#137333"], ["#174ea6", "#0d652d", "#fcc934", "#fad2cf"]),
    ("React", "react/src/react.css",
     "The react.dev documentation palette: cool slate surfaces, React blue for buttons and links, the logo cyan on hover.",
     ["#f6f7f9", "#067394", "#149eca"], ["#23272f", "#58c4dc", "#61dafb"]),
    ("Blazor", "blazor/src/Portfolio.Blazor/<br/>wwwroot/blazor.css",
     ".NET violet: the .NET brand purple on faint lavender, a deep violet-black with lilac buttons after dark, "
     "the Blazor gradient's pink on hover.",
     ["#f4f1fb", "#512bd4", "#c2187a"], ["#1a1430", "#b49cff", "#ff7ac8"]),
]


def swatches(hexes):
    """A row of small color squares, one per hex value, for a table cell."""
    size = 0.16 * inch
    t = Table([[""] * len(hexes)], colWidths=[size + 3] * len(hexes), rowHeights=[size])
    style = [("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 3),
             ("TOPPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 0)]
    for i, h in enumerate(hexes):
        style.append(("BACKGROUND", (i, 0), (i, 0), colors.HexColor(h)))
        style.append(("BOX", (i, 0), (i, 0), 0.4, RULE))
    t.setStyle(TableStyle(style))
    return t


def palette_table():
    """The four edition palettes: file, description, and light and dark swatches (page, band, accent, hover)."""
    head = ["Edition", "Palette file", "Palette", "Light", "Dark"]
    data = [[Paragraph(h, S["cellhead"]) for h in head]]
    for name, path, text, light, dark in PALETTES:
        data.append([Paragraph(name, S["cell"]), Paragraph(c(path), S["cell"]), Paragraph(text, S["cellsmall"]),
                     swatches(light), swatches(dark)])
    t = Table(data, colWidths=[0.65 * inch, 2.2 * inch, 2.25 * inch, 0.95 * inch, 0.95 * inch], repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), HEAD_BG),
        ("LINEBELOW", (0, 0), (-1, 0), 0.8, ACCENT),
        ("LINEBELOW", (0, 1), (-1, -1), 0.4, RULE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    return t


def page_decorator(running_title, dated):
    """Returns the onPage callback that draws the running head and the page number."""
    def on_page(canvas, doc):
        canvas.saveState()
        w, h = letter
        canvas.setFont("Inter", 8)
        canvas.setFillColor(MUTED)
        canvas.drawString(0.75 * inch, h - 0.5 * inch, running_title)
        canvas.drawRightString(w - 0.75 * inch, h - 0.5 * inch, dated)
        canvas.setStrokeColor(RULE)
        canvas.setLineWidth(0.5)
        canvas.line(0.75 * inch, h - 0.58 * inch, w - 0.75 * inch, h - 0.58 * inch)
        canvas.drawCentredString(w / 2, 0.5 * inch, f"{doc.page}")
        canvas.restoreState()
    return on_page


def build(out, story, title, subject, running_title, dated):
    """Lays the story out on US Letter with the shared margins and metadata."""
    doc = SimpleDocTemplate(
        out, pagesize=letter,
        leftMargin=0.75 * inch, rightMargin=0.75 * inch, topMargin=0.85 * inch, bottomMargin=0.8 * inch,
        title=title, author="Neal Thomas", subject=subject,
    )
    on_page = page_decorator(running_title, dated)
    doc.build(story, onFirstPage=on_page, onLaterPages=on_page)
    print("wrote", out)
