import { ControlChangeHandler } from './controls.js';

export class BlendModeDropdown {
  private dropdown: HTMLElement;
  private selected: HTMLElement;
  private options: HTMLElement;
  private selectedText: HTMLElement;
  private isOpen: boolean = false;
  private originalValue: string = 'NORMAL';
  private currentValue: string = 'NORMAL';
  private changeHandler: ControlChangeHandler;

  constructor(changeHandler: ControlChangeHandler) {
    this.changeHandler = changeHandler;
    this.dropdown = document.getElementById('tint-blend-mode-dropdown')!;
    this.selected = document.getElementById('blend-mode-selected')!;
    this.options = document.getElementById('blend-mode-options')!;
    this.selectedText = document.getElementById('blend-mode-text')!;
    this.initialize();
  }

  private initialize(): void {
    this.setupEventListeners();
    
    // Expose global functions for external access
    (window as any).updateBlendModeDisplay = (value: string, isMixed: boolean) => {
      this.setBlendMode(value, isMixed);
    };

    (window as any).getBlendModeValue = () => {
      return this.currentValue;
    };
  }

  private setupEventListeners(): void {
    // Handle click on selected area
    this.selected.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.isOpen) {
        this.closeDropdown(false);
      } else {
        this.openDropdown();
      }
    });

    // Handle option hover
    this.options.addEventListener('mouseover', (e) => {
      if (!this.isOpen) return;
      
      const option = (e.target as HTMLElement).closest('.dropdown-option') as HTMLElement;
      if (option && !option.classList.contains('separator')) {
        const hoveredValue = option.dataset.value;
        if (hoveredValue) {
          console.log('Previewing blend mode:', hoveredValue);
          this.sendMessage('preview-blend-mode', { blendMode: hoveredValue });
        }
      }
    });

    // Handle option click
    this.options.addEventListener('click', (e) => {
      if (!this.isOpen) return;
      
      const option = (e.target as HTMLElement).closest('.dropdown-option') as HTMLElement;
      if (option && !option.classList.contains('separator')) {
        const selectedValue = option.dataset.value;
        if (selectedValue) {
          console.log('Committing blend mode:', selectedValue);
          this.setBlendMode(selectedValue);
          this.changeHandler('tintBlendMode');
          this.closeDropdown(true);
        }
      }
    });

    // Handle click outside
    document.addEventListener('click', (e) => {
      if (this.isOpen && !this.dropdown.contains(e.target as Node)) {
        console.log('Clicked outside dropdown, reverting to:', this.originalValue);
        this.closeDropdown(false);
      }
    });

    // Handle escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        console.log('Escape pressed, reverting to:', this.originalValue);
        this.closeDropdown(false);
      }
    });
  }

  private openDropdown(): void {
    if (this.isOpen) return;
    this.isOpen = true;
    this.originalValue = this.currentValue;
    this.selected.classList.add('open');
    this.options.classList.add('open');
    console.log('Blend mode dropdown opened, original value:', this.originalValue);
  }

  private closeDropdown(commit: boolean = false): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.selected.classList.remove('open');
    this.options.classList.remove('open');

    if (!commit) {
      // Revert to original value
      console.log('Reverting blend mode to:', this.originalValue);
      this.setBlendMode(this.originalValue);
      this.sendMessage('revert-blend-mode', { originalBlendMode: this.originalValue });
    }
  }

  public setBlendMode(value: string, isMixed: boolean = false): void {
    // Remove previous selection
    this.options.querySelectorAll('.dropdown-option').forEach(opt => {
      opt.classList.remove('selected');
    });

    if (isMixed) {
      this.selectedText.textContent = '--';
      this.selected.classList.add('mixed-value');
    } else {
      // Find and select the option
      const option = this.options.querySelector(`[data-value="${value}"]`) as HTMLElement;
      if (option) {
        option.classList.add('selected');
        this.selectedText.textContent = option.textContent || value;
      }
      this.selected.classList.remove('mixed-value');
    }
    this.currentValue = value;
  }

  public getCurrentValue(): string {
    return this.currentValue;
  }

  private sendMessage(type: string, data: any): void {
    (parent as any).postMessage({ pluginMessage: { type, ...data } }, '*');
  }
}
