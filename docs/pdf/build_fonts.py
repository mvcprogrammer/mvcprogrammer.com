"""Instances static TTFs from the site's variable WOFF2 subsets in assets/fonts, for the PDF build.

    python docs/pdf/build_fonts.py <output dir>
"""
import os
import sys
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

src_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "assets", "fonts")
out_dir = sys.argv[1]
os.makedirs(out_dir, exist_ok=True)

def make(woff2, weight, out):
    f = TTFont(f"{src_dir}/{woff2}")
    axes = {a.axisTag: (a.minValue, a.maxValue) for a in f["fvar"].axes} if "fvar" in f else {}
    print(woff2, "axes:", axes)
    if "wght" in axes:
        f = instancer.instantiateVariableFont(f, {"wght": weight}, updateFontNames=True)
    f.flavor = None
    f.save(f"{out_dir}/{out}")
    cmap = f.getBestCmap()
    missing = [c for c in "–—•·→“”‘’…" if ord(c) not in cmap]
    print(out, "missing glyphs:", missing)

make("inter-latin.woff2", 400, "Inter-Regular.ttf")
make("inter-latin.woff2", 600, "Inter-SemiBold.ttf")
make("inter-latin.woff2", 700, "Inter-Bold.ttf")
make("jetbrains-mono-latin.woff2", 400, "JetBrainsMono-Regular.ttf")
