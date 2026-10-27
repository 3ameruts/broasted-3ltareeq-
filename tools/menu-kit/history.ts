// Undo/redo for a Fabric canvas using JSON snapshots.
import type { Canvas } from 'fabric';

const PROPS = ['id', 'name', 'locked', 'selectable', 'evented'];

export class CanvasHistory {
  private undoStack: string[] = [];
  private redoStack: string[] = [];
  private restoring = false;
  private readonly limit: number;
  private readonly canvas: Canvas;
  onChange?: () => void;

  constructor(canvas: Canvas, limit = 80) {
    this.canvas = canvas;
    this.limit = limit;
    this.undoStack.push(this.snapshot());
    const record = () => this.record();
    canvas.on('object:added', record);
    canvas.on('object:removed', record);
    canvas.on('object:modified', record);
  }

  private snapshot() {
    return JSON.stringify(this.canvas.toObject(PROPS));
  }

  /** Call after programmatic edits that Fabric doesn't report (e.g. set() + renderAll()). */
  record() {
    if (this.restoring) return;
    const s = this.snapshot();
    if (s === this.undoStack[this.undoStack.length - 1]) return;
    this.undoStack.push(s);
    if (this.undoStack.length > this.limit) this.undoStack.shift();
    this.redoStack = [];
    this.onChange?.();
  }

  get canUndo() { return this.undoStack.length > 1; }
  get canRedo() { return this.redoStack.length > 0; }

  async undo() {
    if (!this.canUndo) return;
    this.redoStack.push(this.undoStack.pop()!);
    await this.restore(this.undoStack[this.undoStack.length - 1]);
  }

  async redo() {
    if (!this.canRedo) return;
    const s = this.redoStack.pop()!;
    this.undoStack.push(s);
    await this.restore(s);
  }

  private async restore(json: string) {
    this.restoring = true;
    try {
      await this.canvas.loadFromJSON(json);
      this.canvas.requestRenderAll();
    } finally {
      this.restoring = false;
      this.onChange?.();
    }
  }
}
