// This file contains the TypeScript code that handles the UI logic and interactions. It communicates with the main plugin code in code.ts.

document.addEventListener('DOMContentLoaded', () => {
    const button = document.getElementById('my-button');
    button?.addEventListener('click', () => {
        parent.postMessage({ pluginMessage: { type: 'button-clicked' } }, '*');
    });
});