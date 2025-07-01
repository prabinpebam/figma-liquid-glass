// UI Entry Point - coordinates all UI functionality
import './styles/main.css';

console.log('Starting UI initialization...');

// Import all UI modules
import { TabSystem } from './components/tabs.js';
import { ControlManager } from './components/controls.js';
import { BlendModeDropdown } from './components/blend-mode-dropdown.js';
import { LiquidGlassRenderer } from './webgl/renderer.js';
import { pluginBridge } from './messaging/plugin-bridge.js';

class LiquidGlassUI {
  private canvas!: HTMLCanvasElement;
  private renderer!: LiquidGlassRenderer;
  private tabSystem!: TabSystem;
  private controlManager!: ControlManager;
  private blendModeDropdown!: BlendModeDropdown;
  private createBtn!: HTMLButtonElement;
  private updateAllBtn!: HTMLButtonElement;
  private placeholder!: HTMLElement;

  // UI State
  private isMultipleSelection: boolean = false;
  private hasMixedValues: { [key: string]: boolean } = {};
  private lgElementCount: number = 0;
  private currentShape: any = null;
  private currentShapeType: string = 'rectangle';

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    console.log('Starting UI initialization...');
    
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.initializeComponents());
    } else {
      this.initializeComponents();
    }

    // Fallback initialization
    setTimeout(() => {
      if (!this.createBtn) {
        console.log('Fallback initialization attempt');
        this.initializeComponents();
      }
    }, 500);
  }

  private initializeComponents(): void {
    console.log('Initializing UI components...');
    
    // Get DOM elements
    this.canvas = document.getElementById('lg-canvas') as HTMLCanvasElement;
    this.createBtn = document.getElementById('create-btn') as HTMLButtonElement;
    this.updateAllBtn = document.getElementById('update-all-btn') as HTMLButtonElement;
    this.placeholder = document.getElementById('placeholder') as HTMLElement;
    
    if (!this.canvas || !this.createBtn || !this.updateAllBtn) {
      console.error('Required DOM elements not found');
      return;
    }

    try {
      // Initialize WebGL renderer
      this.renderer = new LiquidGlassRenderer();
      this.renderer.initialize(this.canvas);
      console.log('WebGL renderer initialized successfully');

      // Initialize UI components
      this.tabSystem = new TabSystem();
      this.controlManager = new ControlManager((parameterName) => this.handleControlChange(parameterName));
      this.blendModeDropdown = new BlendModeDropdown((parameterName) => this.handleControlChange(parameterName));

      // Set up event listeners
      this.setupEventListeners();

      // Set up message handlers
      this.setupMessageHandlers();

      console.log('UI initialized successfully');
      
    } catch (error) {
      console.error('UI initialization failed:', error);
    }
  }

  private setupEventListeners(): void {
    this.createBtn.onclick = () => {
      console.log('Create button clicked');
      const params = this.getAllParams();
      
      if (this.createBtn.textContent === 'Apply Effect') {
        console.log('Sending apply-effect-to-selection message');
        pluginBridge.send('apply-effect-to-selection', { params });
      } else {
        console.log('Sending create-lg-element message');
        pluginBridge.send('create-lg-element', { params });
      }
    };

    this.updateAllBtn.onclick = () => {
      console.log('Update button clicked:', this.updateAllBtn.textContent);
      if (this.updateAllBtn.textContent.startsWith('Update selection')) {
        // Multiple LG elements are selected
        const params = this.getAllParams();
        pluginBridge.send('update-selection-lg-elements', { params });
      } else {
        // "Update all" - update all LG elements on the page
        pluginBridge.send('update-all-lg-elements', {});
      }
    };
  }

  private setupMessageHandlers(): void {
    pluginBridge.on('plugin-ready', () => {
      console.log('Plugin ready message received');
    });

    pluginBridge.on('update-ui-controls', (msg: any) => {
      this.handleUpdateUIControls(msg);
    });

    pluginBridge.on('selection-changed', (msg: any) => {
      this.handleSelectionChanged(msg);
    });

    pluginBridge.on('selection-cleared', () => {
      this.handleSelectionCleared();
    });

    pluginBridge.on('image-captured', (msg: any) => {
      this.handleImageCaptured(msg);
    });
  }

  private handleUpdateUIControls(msg: any): void {
    this.isMultipleSelection = msg.isMultipleSelection || false;
    this.hasMixedValues = msg.hasMixedValues || {};
    this.lgElementCount = msg.lgElementCount || 0;
    
    this.createBtn.disabled = msg.isSelected;
    this.createBtn.textContent = 'Create New';
    
    // Update button text based on selection state (matching original code logic)
    if (this.isMultipleSelection) {
      this.updateAllBtn.textContent = 'Update selection';
    } else {
      this.updateAllBtn.textContent = 'Update all';
    }
    
    // Update controls - no mixed value detection for multi-selection, just use provided values
    this.updateRefractionControls(msg.params);
    this.updateEffectsControls(msg.effectsParams);
    
    if (msg.isSelected && !this.isMultipleSelection) {
      pluginBridge.send('update-lg-element', { params: this.getAllParams() });
    }
  }

  private handleSelectionChanged(msg: any): void {
    this.isMultipleSelection = msg.isMultipleSelection || false;
    
    if (msg.canApplyEffect) {
      this.createBtn.textContent = 'Apply Effect';
      this.createBtn.disabled = false;
      this.updateAllBtn.textContent = 'Update all';
    } else if (msg.isLgElement) {
      this.createBtn.textContent = 'Create New';
      this.createBtn.disabled = true;
      if (this.isMultipleSelection) {
        this.updateAllBtn.textContent = 'Update selection';
      } else {
        this.updateAllBtn.textContent = 'Update all';
      }
    } else {
      this.createBtn.textContent = 'Create New';
      this.createBtn.disabled = false;
      this.updateAllBtn.textContent = this.isMultipleSelection ? 'Update selection' : 'Update all';
    }
  }

  private handleSelectionCleared(): void {
    this.isMultipleSelection = false;
    this.createBtn.disabled = false;
    this.createBtn.textContent = 'Create New';
    this.updateAllBtn.textContent = 'Update all';
    this.canvas.style.display = 'none';
    
    if (!document.getElementById('placeholder')) {
      const newPlaceholder = document.createElement('em');
      newPlaceholder.id = 'placeholder';
      newPlaceholder.innerHTML = `      
        Select or create a Liquid Glass element.
        <br><br>
        Plugin needs to be kept open to update the effect.      
      `;
      document.getElementById('output-area')!.prepend(newPlaceholder);
    }
  }

  private handleImageCaptured(msg: any): void {
    if (msg.error || !msg.shape) return;

    document.getElementById('placeholder')?.remove();
    this.currentShape = msg.shape;
    this.currentShapeType = msg.shapeType === 'complex' ? 'rectangle' : msg.shapeType;
    
    const img = new Image();
    img.onload = () => {
      this.renderer.updateTexture(img);
      this.renderer.setShape(this.currentShape, this.currentShapeType);
      this.renderer.updateUniforms(msg.params);
      this.renderer.render();
      
      this.canvas.style.display = 'block';
      
      const croppedDataUrl = this.renderer.getCanvasDataURL(20); // OFFSET = 20
      pluginBridge.send('apply-image-fill', { data: croppedDataUrl, nodeId: msg.nodeId });
    };
    img.src = msg.data;
  }

  private updateRefractionControls(params: any): void {
    // No mixed value handling - just set the values directly
    const updateInput = (id: string, value: any) => {
      const input = document.getElementById(id) as HTMLInputElement;
      if (input) {
        input.value = (value || 0).toString();
      }
    };

    updateInput('edge', params.edge);
    updateInput('strength', params.strength);
    updateInput('ca', params.ca);
    updateInput('frost', params.frost);
  }

  private updateEffectsControls(effectsParams: any): void {
    if (!effectsParams) return;

    const ep = effectsParams;
    
    // Update numeric inputs - no mixed value handling
    const updates = [
      ['inner-shadow-x', ep.innerShadowX],
      ['inner-shadow-y', ep.innerShadowY],
      ['inner-shadow-blur', ep.innerShadowBlur],
      ['inner-shadow-spread', ep.innerShadowSpread],
      ['inner-shadow-opacity', ep.innerShadowOpacity],
      ['stroke-angle', ep.strokeAngle],
      ['stroke-thickness', ep.strokeThickness],
      ['stroke-opacity', ep.strokeOpacity],
      ['highlight-stroke-weight', ep.highlightStrokeWeight],
      ['highlight-blur', ep.highlightBlur],
      ['reflection-opacity', ep.reflectionOpacity],
      ['tint-opacity', ep.tintOpacity]
    ];

    updates.forEach(([id, value]) => {
      const input = document.getElementById(id) as HTMLInputElement;
      if (input) {
        input.value = (value || 0).toString();
      }
    });

    // Update color inputs
    const colorUpdates = [
      ['stroke-color', ep.strokeColor],
      ['reflection-color', ep.reflectionColor],
      ['tint-color', ep.tintColor]
    ];

    colorUpdates.forEach(([id, value]) => {
      const input = document.getElementById(id) as HTMLInputElement;
      if (input) {
        input.value = value || '#ffffff';
      }
    });

    // Update blend mode dropdown
    let blendModeValue = ep.tintBlendMode || 'NORMAL';
    // Convert legacy values to match UI options
    if (blendModeValue === 'LINEAR_BURN') blendModeValue = 'PLUS_DARKER';
    if (blendModeValue === 'LINEAR_DODGE') blendModeValue = 'PLUS_LIGHTER';
    
    this.blendModeDropdown.setBlendMode(blendModeValue, false); // No mixed value indicator
  }

  private getAllParams(): any {
    const getValue = (id: string): number => {
      const element = document.getElementById(id) as HTMLInputElement;
      return element ? +element.value : 0;
    };

    const getColorValue = (id: string): string => {
      const element = document.getElementById(id) as HTMLInputElement;
      return element ? element.value : '#ffffff';
    };

    return {
      // Refraction params
      edge: getValue('edge'),
      strength: getValue('strength'),
      ca: getValue('ca'),
      frost: getValue('frost'),
      
      // Effects params
      innerShadowX: getValue('inner-shadow-x'),
      innerShadowY: getValue('inner-shadow-y'),
      innerShadowBlur: getValue('inner-shadow-blur'),
      innerShadowSpread: getValue('inner-shadow-spread'),
      innerShadowOpacity: getValue('inner-shadow-opacity'),
      strokeAngle: getValue('stroke-angle'),
      strokeColor: getColorValue('stroke-color'),
      strokeThickness: getValue('stroke-thickness'),
      strokeOpacity: getValue('stroke-opacity'),
      highlightStrokeWeight: getValue('highlight-stroke-weight'),
      highlightBlur: getValue('highlight-blur'),
      reflectionColor: getColorValue('reflection-color'),
      reflectionOpacity: getValue('reflection-opacity'),
      tintColor: getColorValue('tint-color'),
      tintOpacity: getValue('tint-opacity'),
      tintBlendMode: this.blendModeDropdown.getCurrentValue(),
    };
  }

  private handleControlChange(parameterName?: string): void {
    // For single LG element selection - update in real-time
    if (this.createBtn.disabled && !this.isMultipleSelection) {
      const params = this.getAllParams();
      
      // Update renderer if we have shape data and this is a refraction param
      const isRefractionParam = ['edge', 'strength', 'ca', 'frost'].includes(parameterName || '');
      if (this.currentShape && isRefractionParam) {
        this.renderer.updateUniforms(params);
        this.renderer.render();
      }
      
      // Determine update type
      const isEffectsParam = parameterName && !isRefractionParam;
      if (isEffectsParam) {
        pluginBridge.send('update-lg-element-effects-only', { params, parameterName });
      } else {
        pluginBridge.send('update-lg-element', { params });
      }
      return;
    }
    
    // For multiple selection - send real-time updates for effects only
    if (this.isMultipleSelection && parameterName) {
      const isEffectsParam = !['edge', 'strength', 'ca', 'frost'].includes(parameterName);
      
      if (isEffectsParam) {
        const params = this.getAllParams();
        pluginBridge.send('update-effects-realtime', { 
          parameterName, 
          parameterValue: params[parameterName]
        });
      }
      // For refraction params in multi-selection, no real-time updates - user must click "Update selection"
    }
  }

  private getElementIdForParam(paramName: string): string {
    const paramMap: { [key: string]: string } = {
      'edge': 'edge',
      'strength': 'strength', 
      'ca': 'ca',
      'frost': 'frost',
      'innerShadowX': 'inner-shadow-x',
      'innerShadowY': 'inner-shadow-y',
      'innerShadowBlur': 'inner-shadow-blur',
      'innerShadowSpread': 'inner-shadow-spread',
      'innerShadowOpacity': 'inner-shadow-opacity',
      'strokeAngle': 'stroke-angle',
      'strokeColor': 'stroke-color',
      'strokeThickness': 'stroke-thickness',
      'strokeOpacity': 'stroke-opacity',
      'highlightStrokeWeight': 'highlight-stroke-weight',
      'highlightBlur': 'highlight-blur',
      'reflectionColor': 'reflection-color',
      'reflectionOpacity': 'reflection-opacity',
      'tintColor': 'tint-color',
      'tintOpacity': 'tint-opacity',
      'tintBlendMode': 'tint-blend-mode'
    };
    return paramMap[paramName] || paramName;
  }
}

// Initialize the UI
new LiquidGlassUI();