# Cuts the drumstick character out of the logo (its yellow fill + its dark outline), for the mascot.
import sys, cv2, numpy as np
src, out = sys.argv[1], sys.argv[2]
im = cv2.imread(src, cv2.IMREAD_UNCHANGED)
im = cv2.resize(im, None, fx=3, fy=3, interpolation=cv2.INTER_LANCZOS4)
bgr, a = im[:, :, :3], im[:, :, 3]
hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
yellow = cv2.inRange(hsv, (12, 90, 140), (38, 255, 255))
yellow[:, :int(im.shape[1] * .55)] = 0                      # the leg is on the right of the logo
n, lab, stats, _ = cv2.connectedComponentsWithStats(yellow)
k = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA])); m = (lab == k).astype(np.uint8) * 255
cnts, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
fill = np.zeros_like(m); cv2.drawContours(fill, cnts, -1, 255, -1)          # fills the face lines
inner = cv2.GaussianBlur(cv2.dilate(fill, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))), (5, 5), 0)
outer = cv2.GaussianBlur(cv2.dilate(fill, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (31, 31))), (5, 5), 0)
# a clean, even dark outline everywhere (the logo's letters cover part of the original one)
ink = np.full_like(bgr, (16, 17, 26)); k = (inner.astype(np.float32) / 255)[:, :, None]
col = (bgr * k + ink * (1 - k)).astype(np.uint8)
res = np.dstack([col, outer])
x, y, w, h = cv2.boundingRect((outer > 10).astype(np.uint8))
res = res[y:y + h, x:x + w]
cv2.imwrite(out, res); print(out, w, h)
