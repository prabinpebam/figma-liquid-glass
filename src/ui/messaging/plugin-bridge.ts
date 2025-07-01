export interface PluginMessage {
  type: string;
  [key: string]: any;
}

export class PluginBridge {
  private messageHandlers: Map<string, Function[]> = new Map();

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    window.onmessage = async (e) => {
      const msg = e.data.pluginMessage;
      if (!msg) return;
      
      console.log('UI received message:', msg.type, msg);
      this.handleMessage(msg);
    };
  }

  public send(type: string, data: any = {}): void {
    const message = { type, ...data };
    console.log('UI sending message:', message);
    (parent as any).postMessage({ pluginMessage: message }, '*');
  }

  public on(messageType: string, handler: Function): void {
    if (!this.messageHandlers.has(messageType)) {
      this.messageHandlers.set(messageType, []);
    }
    this.messageHandlers.get(messageType)!.push(handler);
  }

  public off(messageType: string, handler: Function): void {
    const handlers = this.messageHandlers.get(messageType);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  private handleMessage(msg: PluginMessage): void {
    const handlers = this.messageHandlers.get(msg.type);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(msg);
        } catch (error) {
          console.error(`Error in message handler for ${msg.type}:`, error);
        }
      });
    }
  }
}

// Global instance
export const pluginBridge = new PluginBridge();
