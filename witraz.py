import numpy as np
import cv2
from scipy import ndimage
from skimage.segmentation import watershed
import trimesh
from shapely.geometry import Polygon
from pathlib import Path

# === parametry ===
INPUT_PATH       = "w3.png"
OUTPUT_DIR       = Path("tiles_stl_3")
PIXELS_PER_MM    = 1254/100     # 4 px = 1 mm  → obraz 1000 px = 250 mm
BASE_HEIGHT      = 0.6     # mm, grubość bazy (białe pole)
FRAME_HEIGHT     = 1.6     # mm, łączna wysokość ramy (baza + wystająca część)
MIN_TILE_AREA_PX = 200     # filtr na drobne śmieci
THRESHOLD        = 128

OUTPUT_DIR.mkdir(exist_ok=True)
PX = 1.0 / PIXELS_PER_MM

img = cv2.imread(INPUT_PATH, cv2.IMREAD_GRAYSCALE)
img = cv2.copyMakeBorder(img, 1, 1, 1, 1, cv2.BORDER_CONSTANT, value=0)
_, binary = cv2.threshold(img, THRESHOLD, 255, cv2.THRESH_BINARY)
white = binary == 255
black = ~white

# 1. Etykieta dla każdego białego pola (8-connectivity)
labels, num = ndimage.label(white, structure=np.ones((3, 3)))
sizes = ndimage.sum(white, labels, range(num + 1))
keep = sizes >= MIN_TILE_AREA_PX
keep[0] = False  # tło
remap = np.zeros(num + 1, dtype=np.int32)
remap[keep] = np.arange(1, keep.sum() + 1)
labels = remap[labels]
n_tiles = int(labels.max())
print(f"Found {n_tiles} tiles")

# kolorowa wizualizacja kafli
import matplotlib.pyplot as plt
rng = np.random.default_rng(42)
colors = rng.integers(50, 255, size=(n_tiles + 1, 3))
colors[0] = [0, 0, 0]
vis = colors[labels].astype(np.uint8)



# numery kafli w centroidach
centroids = ndimage.center_of_mass(labels > 0, labels, range(1, n_tiles + 1))
for tid, (cy, cx) in enumerate(centroids, start=1):
    text = str(tid)
    # rozmiar dobrany do rozdzielczości
    scale = max(0.4, min(labels.shape) / 2000)
    thickness = max(1, int(scale * 2))
    (tw, th), _ = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, scale, thickness)
    pos = (int(cx - tw / 2), int(cy + th / 2))
    # czarny outline + biały tekst dla czytelności na kolorowym tle
    cv2.putText(vis, text, pos, cv2.FONT_HERSHEY_SIMPLEX, scale,
                (0, 0, 0), thickness + 2, cv2.LINE_AA)
    cv2.putText(vis, text, pos, cv2.FONT_HERSHEY_SIMPLEX, scale,
                (255, 255, 255), thickness, cv2.LINE_AA)

cv2.imwrite("debug_labels.png", vis)
print(f"Tiles: {n_tiles}")
print(f"Sizes (px): min={sizes[keep].min():.0f}, max={sizes[keep].max():.0f}")
print(f"Sizes (mm²): min={sizes[keep].min()/PIXELS_PER_MM**2:.1f}")

# 2. Watershed: każdy czarny piksel → najbliższe białe pole
distance = ndimage.distance_transform_edt(black)
ws = watershed(distance, markers=labels, mask=np.ones_like(labels, bool))
from shapely.validation import make_valid
from shapely.geometry import Polygon, MultiPolygon
from shapely.geometry import Polygon, MultiPolygon, GeometryCollection
from shapely.validation import make_valid

def mask_to_polygon(mask, px):
    contours, hier = cv2.findContours(
        mask.astype(np.uint8), cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE
    )
    if not contours or hier is None:
        return None
    hier = hier[0]
    polys = []

    def collect(geom):
        if geom.is_empty:
            return
        if isinstance(geom, Polygon):
            if geom.area > 0:
                polys.append(geom)
        elif isinstance(geom, MultiPolygon):
            for g in geom.geoms:
                collect(g)
        elif isinstance(geom, GeometryCollection):
            for g in geom.geoms:
                collect(g)
        # LineString/Point ignorujemy

    for i, (cnt, h) in enumerate(zip(contours, hier)):
        if h[3] != -1 or len(cnt) < 3:
            continue
        outer = [(float(p[0][0]) * px, float(p[0][1]) * px) for p in cnt]
        holes = [
            [(float(p[0][0]) * px, float(p[0][1]) * px) for p in contours[j]]
            for j, hh in enumerate(hier) if hh[3] == i and len(contours[j]) >= 3
        ]
        try:
            p = Polygon(outer, holes)
            if not p.is_valid:
                p = make_valid(p)
            collect(p)
        except Exception as e:
            print(f"  polygon construction failed (contour {i}): {e}")
            try:
                collect(Polygon(outer).buffer(0))
            except Exception as e2:
                print(f"  buffer(0) fallback failed: {e2}")

    return max(polys, key=lambda p: p.area) if polys else None

tid = 6
tile_full = ws == tid
tile_white = labels == tid
print(f"full px: {tile_full.sum()}, white px: {tile_white.sum()}")
cv2.imwrite("debug_tile6.png", (tile_full * 255).astype(np.uint8))

mask = tile_full.astype(np.uint8)
contours, hier = cv2.findContours(mask, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_TC89_L1)
print(f"contours: {len(contours)}")
for i, cnt in enumerate(contours):
    parent = hier[0][i][3] if hier is not None else -1
    print(f"  {i}: {len(cnt)} pts, parent={parent}")

from shapely.geometry import Polygon
from shapely.validation import explain_validity
for i, (cnt, h) in enumerate(zip(contours, hier[0])):
    if h[3] != -1 or len(cnt) < 3:
        continue
    outer = [(float(p[0][0]) * PX, float(p[0][1]) * PX) for p in cnt]
    holes = [
        [(float(p[0][0]) * PX, float(p[0][1]) * PX) for p in contours[j]]
        for j, hh in enumerate(hier[0]) if hh[3] == i and len(contours[j]) >= 3
    ]
    try:
        p = Polygon(outer, holes)
        print(f"  outer #{i}: valid={p.is_valid}, area={p.area:.3f}, why={explain_validity(p)}")
    except Exception as e:
        print(f"  outer #{i}: EXCEPTION {type(e).__name__}: {e}")

for tid in range(1, n_tiles + 1):
    tile_full  = ws == tid
    tile_white = labels == tid
    tile_frame = tile_full & ~tile_white

    debug = (tid == 6)
    if debug:
        print(f"=== TILE {tid}: full={tile_full.sum()}px, white={tile_white.sum()}px ===")

    base_poly = mask_to_polygon(tile_full, PX)
    if debug:
        print(f"  base_poly: {type(base_poly).__name__ if base_poly else None}, "
              f"area={base_poly.area if base_poly else 'n/a'}")

    if base_poly is None:
        if debug: print(f"  SKIP: no base polygon")
        continue


    try:
        parts = [trimesh.creation.extrude_polygon(base_poly, BASE_HEIGHT)]
    except Exception as e:
        print(f"  TILE {tid} extrude(base) failed: {e}")
        continue

    if tile_frame.any():
        frame_poly = mask_to_polygon(tile_frame, PX)
        if frame_poly is not None and FRAME_HEIGHT > BASE_HEIGHT:
            try:
                ring = trimesh.creation.extrude_polygon(frame_poly, FRAME_HEIGHT - BASE_HEIGHT)
                ring.apply_translation([0, 0, BASE_HEIGHT])
                parts.append(ring)
            except Exception as e:
                print(f"  TILE {tid} extrude(frame) failed: {e}")

    mesh = trimesh.util.concatenate(parts)
    mesh.export(OUTPUT_DIR / f"tile_{tid:03d}.stl")
    if debug: print(f"  OK → tile_{tid:03d}.stl")

print(f"Saved → {OUTPUT_DIR}")