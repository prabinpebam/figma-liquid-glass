export class TabSystem {
  private tabButtons: NodeListOf<HTMLElement>;
  private tabContents: NodeListOf<HTMLElement>;
  private outputArea: HTMLElement;

  constructor() {
    this.tabButtons = document.querySelectorAll('.tab-button');
    this.tabContents = document.querySelectorAll('.tab-content');
    this.outputArea = document.getElementById('output-area')!;
    this.initialize();
  }

  private initialize(): void {
    this.tabButtons.forEach(button => {
      button.addEventListener('click', () => {
        const targetTab = button.getAttribute('data-tab');
        if (targetTab) {
          this.switchToTab(targetTab);
        }
      });
    });
  }

  private switchToTab(targetTab: string): void {
    // Update button states
    this.tabButtons.forEach(btn => btn.classList.remove('active'));
    const targetButton = document.querySelector(`[data-tab="${targetTab}"]`);
    if (targetButton) {
      targetButton.classList.add('active');
    }

    // Update content states
    this.tabContents.forEach(content => content.classList.remove('active'));
    const targetContent = document.getElementById(targetTab + '-tab');
    if (targetContent) {
      targetContent.classList.add('active');
    }

    // Show/hide output area based on active tab
    if (targetTab === 'refraction') {
      this.outputArea.classList.remove('hidden');
    } else {
      this.outputArea.classList.add('hidden');
    }
  }

  public getCurrentTab(): string {
    const activeButton = document.querySelector('.tab-button.active');
    return activeButton?.getAttribute('data-tab') || 'refraction';
  }
}
