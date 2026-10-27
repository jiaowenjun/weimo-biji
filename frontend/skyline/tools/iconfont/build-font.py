import hashlib
import json
import os
import sys

from fontTools.subset import Options, Subsetter
from fontTools.ttLib import TTFont


def read_mapping(path):
    with open(path, "r", encoding="utf-8") as f:
        raw = json.load(f)
    out = []
    for item in raw:
        name = item["name"]
        source = int(item["source"], 16)
        target = int(item["target"], 16)
        out.append((name, source, target))
    return out


def set_font_name(font, family):
    name_table = font["name"]
    for rec in name_table.names:
        if rec.nameID in (1, 4, 6):
            enc = rec.getEncoding()
            rec.string = family.encode(enc, errors="replace")


def center_glyphs(font):
    glyf = font["glyf"]
    upem = font["head"].unitsPerEm
    for glyph_name in glyf.keys():
        g = glyf[glyph_name]
        if g.isComposite():
            bbox = g.getBBox(glyf)
            if not bbox:
                continue
            x_min, y_min, x_max, y_max = bbox
            cx = (x_min + x_max) / 2
            cy = (y_min + y_max) / 2
            dx = int(round(upem / 2 - cx))
            dy = int(round(-cy))
            if dx == 0 and dy == 0:
                continue
            for comp in g.components:
                comp.x += dx
                comp.y += dy
            continue
        if getattr(g, "numberOfContours", 0) == 0:
            continue
        coords, end_pts, flags = g.getCoordinates(glyf)
        if len(coords) == 0:
            continue
        xs = [p[0] for p in coords]
        ys = [p[1] for p in coords]
        cx = (min(xs) + max(xs)) / 2
        cy = (min(ys) + max(ys)) / 2
        dx = int(round(upem / 2 - cx))
        dy = int(round(-cy))
        if dx == 0 and dy == 0:
            continue
        coords.translate((dx, dy))
        g.coordinates = coords
        g.endPtsOfContours = end_pts
        g.flags = flags


def symmetrize_vertical_metrics(font):
    upem = font["head"].unitsPerEm
    half = int(upem / 2)
    hhea = font["hhea"]
    hhea.ascent = half
    hhea.descent = -half
    hhea.lineGap = 0
    if "OS/2" in font:
        os2 = font["OS/2"]
        os2.sTypoAscender = half
        os2.sTypoDescender = -half
        os2.sTypoLineGap = 0
        os2.usWinAscent = half
        os2.usWinDescent = half


def sync_hmtx_lsb(font):
    glyf = font["glyf"]
    hmtx = font["hmtx"]
    for glyph_name in glyf.keys():
        g = glyf[glyph_name]
        if getattr(g, "numberOfContours", 0) == 0 and not g.isComposite():
            continue
        g.recalcBounds(glyf)
        aw, _ = hmtx[glyph_name]
        hmtx[glyph_name] = (aw, g.xMin)


def md5_file(path):
    h = hashlib.md5()
    with open(path, "rb") as f:
        while True:
            chunk = f.read(1024 * 1024)
            if not chunk:
                break
            h.update(chunk)
    return h.hexdigest()


def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    mapping_path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(base_dir, "mapping.json")
    input_ttf = sys.argv[2] if len(sys.argv) > 2 else os.path.join(base_dir, "tdesign.ttf")
    output_ttf = sys.argv[3] if len(sys.argv) > 3 else os.path.join(base_dir, "biji-icon.ttf")

    mapping = read_mapping(mapping_path)
    source_to_targets = {}
    source_set = set()
    target_set = set()
    for _, source, target in mapping:
        source_set.add(source)
        target_set.add(target)
        source_to_targets.setdefault(source, []).append(target)

    font = TTFont(input_ttf)
    opts = Options()
    subsetter = Subsetter(options=opts)
    subsetter.populate(unicodes=source_set)
    subsetter.subset(font)

    cmap = font["cmap"]
    for table in cmap.tables:
        new_cmap = {}
        for cp, gname in table.cmap.items():
            targets = source_to_targets.get(cp)
            if not targets:
                continue
            for target in targets:
                new_cmap[target] = gname
        table.cmap = new_cmap

    set_font_name(font, "biji-icon")
    center_glyphs(font)
    sync_hmtx_lsb(font)
    symmetrize_vertical_metrics(font)

    final_cmap = font.getBestCmap() or {}
    final_targets = set(final_cmap.keys())
    if final_targets != target_set:
        missing = sorted([hex(x) for x in (target_set - final_targets)])
        extra = sorted([hex(x) for x in (final_targets - target_set)])
        raise RuntimeError(f"cmap mismatch. missing={missing} extra={extra}")

    font.save(output_ttf)
    sys.stdout.write(f"tdesign.ttf md5: {md5_file(input_ttf)}\n")
    sys.stdout.write(f"biji-icon.ttf md5: {md5_file(output_ttf)}\n")
    sys.stdout.write(f"glyphs: {len(source_set)}\n")
    sys.stdout.write(f"codepoints: {len(target_set)}\n")
    sys.stdout.write(f"out: {output_ttf}\n")


main()
