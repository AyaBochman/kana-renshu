"""Trim the bundled fonts to the characters the app needs and save them as WOFF2 in fonts/.

Usage:   python3 scripts/build-fonts.py <folder with the original .ttf files>
Needs:   pip install fonttools brotli

The original fonts come from https://github.com/google/fonts (SIL Open Font License):
  ofl/kleeone/KleeOne-SemiBold.ttf
  ofl/zenkakugothicnew/ZenKakuGothicNew-{Regular,Medium,Bold}.ttf
  ofl/shipporimincho/ShipporiMincho-Medium.ttf
  ofl/zenmarugothic/ZenMaruGothic-Medium.ttf
  ofl/dmmono/DMMono-{Regular,Medium}.ttf

Kept: Latin (with macrons for rōmaji), punctuation, hiragana, katakana, and every kanji that
appears in index.html or src/*.js (the interface's own Japanese labels). Kanji in the word lists
are left to the system's Japanese fonts, which keeps each file small.
"""
import pathlib
import re
import sys

from fontTools import subset

ROOT = pathlib.Path(__file__).resolve().parent.parent
FONTS = [
    "KleeOne-SemiBold.ttf",
    "ZenKakuGothicNew-Regular.ttf",
    "ZenKakuGothicNew-Medium.ttf",
    "ZenKakuGothicNew-Bold.ttf",
    "ShipporiMincho-Medium.ttf",
    "ZenMaruGothic-Medium.ttf",
    "DMMono-Regular.ttf",
    "DMMono-Medium.ttf",
]
RANGES = [
    (0x0020, 0x007E), (0x00A0, 0x00FF), (0x0100, 0x017F),  # Latin, Latin-1, Latin Extended-A (ā ī ū ē ō)
    (0x2010, 0x2027), (0x2030, 0x205E), (0x2190, 0x2193),  # punctuation and arrows
    (0x3000, 0x303F), (0x3041, 0x309F), (0x30A0, 0x30FF),  # CJK punctuation, hiragana, katakana
    (0xFF01, 0xFF5E),                                      # full-width forms
]


def interface_kanji():
    text = (ROOT / "index.html").read_text(encoding="utf-8")
    for path in sorted((ROOT / "src").glob("*.js")):
        text += path.read_text(encoding="utf-8")
    return sorted(set(re.findall(r"[一-鿿々]", text)))


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    source = pathlib.Path(sys.argv[1])
    kanji = interface_kanji()
    unicodes = [cp for lo, hi in RANGES for cp in range(lo, hi + 1)] + [ord(c) for c in kanji]
    out_dir = ROOT / "fonts"
    out_dir.mkdir(exist_ok=True)
    for name in FONTS:
        options = subset.Options()
        options.flavor = "woff2"
        options.layout_features = ["*"]
        options.name_IDs = ["*"]
        options.hinting = False
        options.notdef_outline = True
        font = subset.load_font(str(source / name), options)
        subsetter = subset.Subsetter(options)
        subsetter.populate(unicodes=unicodes)
        subsetter.subset(font)
        target = out_dir / name.replace(".ttf", ".woff2")
        subset.save_font(font, str(target), options)
        print(f"{target.relative_to(ROOT)}: {target.stat().st_size // 1024} KB")
    print(f"Interface kanji kept: {''.join(kanji)}")


if __name__ == "__main__":
    main()
