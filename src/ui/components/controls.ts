export interface ControlChangeHandler {
  (parameterName?: string): void;
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
      let isDragging = false;
      let startX = 0;
      let startValue = 0;
      let dragSensitivity = 1;
      
      const element = input as HTMLInputElement;
      const min = parseFloat(element.dataset.min || '0');
      const max = parseFloat(element.dataset.max || '100');
      
      // Get parameter name from input ID
      const parameterName = this.getParamNameFromElementId(element.id);
      
      // Calculate sensitivity based on 40% of screen width for full range
      const range = max - min;
      const targetPixelsForFullRange = window.screen.width * 0.4;
      dragSensitivity = range / targetPixelsForFullRange;

      element.addEventListener('mousedown', (e) => {
        if (e.detail === 1) { // Single click
          setTimeout(() => {
            if (!isDragging) {
              // Focus for editing
              element.focus();
              element.select();
              element.classList.add('being-edited');
              
              // Clear mixed value display when editing
              if (element.value === '--') {
                element.value = '';
                element.classList.remove('mixed-value');
              }
            }
          }, 200);
        }
        
        isDragging = false;
        
        // Handle mixed values - use the minimum value as starting point
        if (element.value === '--') {
          startValue = min;
          element.value = min.toString();
          element.classList.remove('mixed-value');
        } else {
          startValue = parseFloat(element.value) || 0;
        }
        
        startX = e.clientX;
        
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        e.preventDefault();
      });

      const onMouseMove = (e: MouseEvent) => {
        const deltaX = e.clientX - startX;
        
        if (Math.abs(deltaX) > 5 && !isDragging) {
          isDragging = true;
          element.classList.add('dragging');
          element.classList.remove('mixed-value');
          element.blur(); // Remove focus to prevent text editing
        }
        
        if (isDragging) {
          const newValue = Math.min(max, Math.max(min, startValue + (deltaX * dragSensitivity)));
          const roundedValue = Math.round(newValue);
          element.value = roundedValue.toString();
          this.changeHandler(parameterName);
        }
      };

      const onMouseUp = () => {
        if (isDragging) {
          element.classList.remove('dragging');
        }
        
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        
        setTimeout(() => {
          isDragging = false;
        }, 100);
      };

      // Handle direct text input
      element.addEventListener('input', () => {
        if (!isDragging) {
          element.classList.remove('mixed-value');
          let value = parseFloat(element.value);
          if (isNaN(value)) return;
          
          value = Math.min(max, Math.max(min, value));
          element.value = Math.round(value).toString();
          this.changeHandler(parameterName);
        }
      });

      // Handle Enter key and blur
      element.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          element.blur();
        }
      });

      element.addEventListener('blur', () => {
        element.classList.remove('being-edited');
        
        // Handle mixed value case
        if (element.value === '' || element.value === '--') {
          element.value = min.toString();
        }
        
        let value = parseFloat(element.value);
        if (isNaN(value)) {
          element.value = min.toString();
          value = min;
        }
        
        value = Math.min(max, Math.max(min, value));
        element.value = Math.round(value).toString();
        this.changeHandler(parameterName);
      });
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
    // Simplified - no mixed value handling as per original code
    input.value = value.toString();
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