// Layer ordering, alignment inside print boxes, locking, and drag-and-drop image import.
import { FabricImage, type Canvas, type FabricObject } from 'fabric';

export function bringForward(canvas: Canvas, obj: FabricObject) { canvas.bringObjectForward(obj); canvas.fire('object:modified', { target: obj }); }
export function sendBackward(canvas: Canvas, obj: FabricObject) { canvas.sendObjectBackwards(obj); canvas.fire('object:modified', { target: obj }); }
export function toFront(canvas: Canvas, obj: FabricObject) { canvas.bringObjectToFront(obj); canvas.fire('object:modified', { target: obj }); }
export function toBack(canvas: Canvas, obj: FabricObject) { canvas.sendObjectToBack(obj); canvas.fire('object:modified', { target: obj }); }

export function setLocked(obj: FabricObject, locked: boolean) {
  obj.set({ selectable: !locked, evented: !locked, lockMovementX: locked, lockMovementY: locked, hasControls: !locked });
  (obj as FabricObject & { locked?: boolean }).locked = locked;
}

type Box = { left: number; top: number; width: number; height: number };
type Align = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom';

/** Align an object to an edge or centre of a box (e.g. the trim or safe area from printBoxes). */
export function alignTo(obj: FabricObject, box: Box, how: Align) {
  const r = obj.getBoundingRect();
  const dx = { left: box.left - r.left, center: box.left + (box.width - r.width) / 2 - r.left, right: box.left + box.width - r.width - r.left }[how as 'left'] ?? 0;
  const dy = { top: box.top - r.top, middle: box.top + (box.height - r.height) / 2 - r.top, bottom: box.top + box.height - r.height - r.top }[how as 'top'] ?? 0;
  obj.set({ left: (obj.left ?? 0) + dx, top: (obj.top ?? 0) + dy });
  obj.setCoords();
}

/** Accept image files dropped onto the canvas element and place them at the drop point. */
export function enableImageDrop(canvas: Canvas, maxSide = 1200) {
  const el = canvas.upperCanvasEl;
  const over = (e: DragEvent) => e.preventDefault();
  const drop = async (e: DragEvent) => {
    e.preventDefault();
    const files = [...(e.dataTransfer?.files ?? [])].filter(f => f.type.startsWith('image/'));
    const pt = canvas.getScenePoint(e);
    for (const file of files) {
      const url = URL.createObjectURL(file);
      const img = await FabricImage.fromURL(url);
      URL.revokeObjectURL(url);
      const s = Math.min(1, maxSide / Math.max(img.width ?? 1, img.height ?? 1));
      img.set({ left: pt.x, top: pt.y, scaleX: s, scaleY: s, originX: 'center', originY: 'center' });
      canvas.add(img);
      canvas.setActiveObject(img);
    }
  };
  el.addEventListener('dragover', over);
  el.addEventListener('drop', drop);
  return () => { el.removeEventListener('dragover', over); el.removeEventListener('drop', drop); };
}
