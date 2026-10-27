// Minimal React host for a Fabric editing surface: canvas sized to a print spec,
// guides for trim and safe area, undo/redo, layer order and image drop. No menu content.
import { useEffect, useRef, useState } from 'react';
import { Canvas, Rect } from 'fabric';
import { Undo2, Redo2, ArrowUpToLine, ArrowDownToLine, Lock, Unlock } from 'lucide-react';
import { printBoxes, DEFAULT_PRINT, type PrintSpec } from './config';
import { CanvasHistory } from './history';
import { enableImageDrop, toFront, toBack, setLocked } from './layers';

type Props = {
  spec?: PrintSpec;
  dpi?: number;            // design resolution; 300 for print
  displayWidth?: number;   // on-screen width in CSS px
  onReady?: (canvas: Canvas, history: CanvasHistory) => void;
};

export default function MenuCanvas({ spec = DEFAULT_PRINT, dpi = 300, displayWidth = 1100, onReady }: Props) {
  const el = useRef<HTMLCanvasElement>(null);
  const [api, setApi] = useState<{ canvas: Canvas; history: CanvasHistory } | null>(null);
  const [, bump] = useState(0);

  useEffect(() => {
    const boxes = printBoxes(spec, dpi);
    const canvas = new Canvas(el.current!, { width: boxes.sheet.width, height: boxes.sheet.height, backgroundColor: '#ffffff', preserveObjectStacking: true });
    // shrink the view to fit the screen; exports still use full print pixels
    const zoom = displayWidth / boxes.sheet.width;
    canvas.setDimensions({ width: boxes.sheet.width * zoom, height: boxes.sheet.height * zoom }, { cssOnly: true });

    const guide = (b: { left: number; top: number; width: number; height: number }, color: string) =>
      new Rect({ ...b, fill: 'transparent', stroke: color, strokeWidth: 3, strokeDashArray: [18, 12], selectable: false, evented: false, excludeFromExport: true });
    canvas.add(guide(boxes.trim, '#e0263a'), guide(boxes.safe, '#2b8a3e'));

    const history = new CanvasHistory(canvas);
    history.onChange = () => bump(n => n + 1);
    const offDrop = enableImageDrop(canvas);
    setApi({ canvas, history });
    onReady?.(canvas, history);
    return () => { offDrop(); canvas.dispose(); };
  }, [spec, dpi, displayWidth]); // eslint-disable-line react-hooks/exhaustive-deps

  const active = api?.canvas.getActiveObject();
  const btn = { display: 'inline-flex', gap: 6, alignItems: 'center', padding: '6px 10px', border: '1px solid #ccc', borderRadius: 8, background: '#fff', cursor: 'pointer' } as const;

  return (
    <div dir="ltr" style={{ display: 'grid', gap: 10, justifyItems: 'start' }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <button style={btn} disabled={!api?.history.canUndo} onClick={() => api?.history.undo()}><Undo2 size={16} /> Undo</button>
        <button style={btn} disabled={!api?.history.canRedo} onClick={() => api?.history.redo()}><Redo2 size={16} /> Redo</button>
        <button style={btn} disabled={!active} onClick={() => api && active && toFront(api.canvas, active)}><ArrowUpToLine size={16} /> Front</button>
        <button style={btn} disabled={!active} onClick={() => api && active && toBack(api.canvas, active)}><ArrowDownToLine size={16} /> Back</button>
        <button style={btn} disabled={!active} onClick={() => { if (api && active) { setLocked(active, !active.lockMovementX); api.canvas.requestRenderAll(); bump(n => n + 1); } }}>
          {active?.lockMovementX ? <Unlock size={16} /> : <Lock size={16} />} Lock
        </button>
      </div>
      <canvas ref={el} />
    </div>
  );
}
