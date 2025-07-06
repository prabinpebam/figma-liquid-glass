export interface ControlChangeHandler {
  (parameterName?: string): void;
}

class DraggableInput {
  private element: HTMLInputElement;
  private changeHandler: ControlChangeHandler;
  private parameterName: string;

  private isDragging = false;
  private isPointerLocked = false;
  private startValue = 0;
  private accumulatedMovement = 0;

  private min: number;
  private max: number;
  private step: number;
  private pixelsPerStep: number;
  private decimalPlaces: number;

  constructor(element: HTMLInputElement, changeHandler: ControlChangeHandler, getParamName: (id: string) => string) {
    this.element = element;
    this.changeHandler = changeHandler;
    this.parameterName = getParamName(element.id);

    this.min = parseFloat(element.dataset.min ?? '-Infinity');
    this.max = parseFloat(element.dataset.max ?? 'Infinity');
    this.step = parseFloat(element.dataset.step ?? '1');
    this.decimalPlaces = this.getDecimalPlaces(this.step);
    this.pixelsPerStep = Math.max(3, 100 / (this.max - this.min) * this.step * 2);

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.element.addEventListener('mousedown', this.handleMouseDown.bind(this));
    document.addEventListener('mousemove', this.handlePointerLockMove.bind(this));
    document.addEventListener('mouseup', this.handleMouseUp.bind(this));
    document.addEventListener('pointerlockchange', this.handlePointerLockChange.bind(this));
    document.addEventListener('keydown', this.handleGlobalKeyDown.bind(this));

    this.element.addEventListener('focus', this.startEditing.bind(this));
    this.element.addEventListener('blur', this.stopEditing.bind(this));
    this.element.addEventListener('keydown', this.handleEditKeyDown.bind(this));
    this.element.addEventListener('input', this.handleInput.bind(this));
  }

  private handleMouseDown(e: MouseEvent): void {
    if (e.button !== 0) return; // Only main mouse button
    e.preventDefault();
    this.isDragging = true;
    this.accumulatedMovement = 0;

    if (this.element.value === '--') {
      this.startValue = this.min;
      this.element.classList.remove('mixed-value');
    } else {
      this.startValue = parseFloat(this.element.value);
    }

    this.element.requestPointerLock();
  }

  private handlePointerLockMove(e: MouseEvent): void {
    if (!this.isPointerLocked) return;
    this.accumulatedMovement += e.movementX;
    const steps = Math.round(this.accumulatedMovement / this.pixelsPerStep);

    if (Math.abs(steps) >= 1) {
      const newValue = this.startValue + (steps * this.step);
      this.setValue(newValue);
      this.startValue = parseFloat(this.element.value);
      this.accumulatedMovement = 0;
      this.changeHandler(this.parameterName);
    }
  }

  private handleMouseUp(): void {
    if (this.isPointerLocked) {
      document.exitPointerLock();
    }
    this.isDragging = false;
  }

  private handlePointerLockChange(): void {
    const hint = document.getElementById('pointer-lock-hint')!;
    this.isPointerLocked = document.pointerLockElement === this.element;
    if (this.isPointerLocked) {
      this.element.classList.add('pointer-locked');
      hint.classList.add('visible');
    } else {
      this.element.classList.remove('pointer-locked');
      hint.classList.remove('visible');
      this.isDragging = false;
    }
  }

  private handleGlobalKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape' && this.isPointerLocked) {
      document.exitPointerLock();
    }
  }

  private startEditing(): void {
    this.element.classList.add('being-edited');
    if (this.element.value === '--') {
      this.element.value = '';
      this.element.classList.remove('mixed-value');
    }
    this.element.select();
  }

  private stopEditing(): void {
    this.element.classList.remove('being-edited');
    const parsedValue = parseFloat(this.element.value);
    if (isNaN(parsedValue)) {
      this.setValue(this.startValue); // Revert if invalid
    } else {
      this.setValue(parsedValue);
    }
    this.changeHandler(this.parameterName);
  }

  private handleEditKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Enter') {
      this.element.blur();
    } else if (e.key === 'Escape') {
      this.setValue(this.startValue);
      this.element.blur();
    }
  }

  private handleInput(): void {
    this.element.classList.remove('mixed-value');
  }

  private setValue(newValue: number): void {
    let value = Math.max(this.min, Math.min(this.max, newValue));
    value = Math.round(value / this.step) * this.step;
    this.element.value = value.toFixed(this.decimalPlaces);
  }

  private getDecimalPlaces(num: number): number {
    const str = String(num);
    if (str.includes('.')) {
      return str.split('.')[1].length;
    }
    return 0;
  }
}

export class ControlManager {
  private changeHandler: ControlChangeHandler;

  constructor(changeHandler: ControlChangeHandler) {
    this.changeHandler = changeHandler;
    this.initialize();
  }

  private initialize(): void {
    this.setupDraggableInputs();
    this.setupColorPickers();
  }

  private setupDraggableInputs(): void {
    const draggableInputs = document.querySelectorAll('.draggable-input');
    draggableInputs.forEach(input => {
      new DraggableInput(input as HTMLInputElement, this.changeHandler, this.getParamNameFromElementId.bind(this));
    });
  }

  private setupColorPickers(): void {
    const colorPickers = document.querySelectorAll('input[type="color"]');
    colorPickers.forEach((picker) => {
      const element = picker as HTMLInputElement;
      const parameterName = this.getParamNameFromElementId(element.id);
      element.addEventListener('input', () => this.changeHandler(parameterName));
    });
  }

  private getParamNameFromElementId(elementId: string): string {
    const idMap: { [key: string]: string } = {
      'edge': 'edge',
      'strength': 'strength', 
      'ca': 'ca',
      'frost': 'frost',
      'inner-shadow-x': 'innerShadowX',
      'inner-shadow-y': 'innerShadowY',
      'inner-shadow-blur': 'innerShadowBlur',
      'inner-shadow-spread': 'innerShadowSpread',
      'inner-shadow-opacity': 'innerShadowOpacity',
      'stroke-angle': 'strokeAngle',
      'stroke-color': 'strokeColor',
      'stroke-thickness': 'strokeThickness',
      'stroke-opacity': 'strokeOpacity',
      'highlight-stroke-weight': 'highlightStrokeWeight',
      'highlight-blur': 'highlightBlur',
      'reflection-color': 'reflectionColor',
      'reflection-opacity': 'reflectionOpacity',
      'tint-color': 'tintColor',
      'tint-opacity': 'tintOpacity'
    };
    return idMap[elementId] || elementId;
  }

  // Helper methods for updating display
  public updateInputDisplay(input: HTMLInputElement, value: number, hasMixedValue: boolean = false): void {
    if (hasMixedValue) {
      input.value = '--';
      input.classList.add('mixed-value');
    } else {
      const step = parseFloat(input.dataset.step || '1');
      const decimalPlaces = String(step).includes('.') ? String(step).split('.')[1].length : 0;
      input.value = value.toFixed(decimalPlaces);
      input.classList.remove('mixed-value');
    }
  }

  public updateColorInputDisplay(input: HTMLInputElement, value: string, isMixed: boolean = false): void {
    if (isMixed) {
      input.style.background = 'linear-gradient(45deg, #666 25%, transparent 25%, transparent 75%, #666 75%, #666), linear-gradient(45deg, #666 25%, transparent 25%, transparent 75%, #666 75%, #666)';
      input.style.backgroundSize = '8px 8px';
      input.style.backgroundPosition = '0 0, 4px 4px';
      input.value = '#000000'; // Fallback value
    } else {
      input.style.background = '';
      input.style.backgroundSize = '';
      input.style.backgroundPosition = '';
      input.value = value;
    }
  }
}