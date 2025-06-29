const vertexShaderSource = `
  attribute vec2 a_position;
  varying vec2 v_texCoord;
  void main() {
      gl_Position = vec4(a_position, 0.0, 1.0);
      v_texCoord = a_position * 0.5 + 0.5;
  }
`;

const fragmentShaderSource = `
  precision mediump float;
  varying vec2 v_texCoord;

  uniform vec2 u_resolution;
  uniform sampler2D u_backgroundTexture;
  uniform sampler2D u_sdfTexture;
  uniform vec2 u_rectangleSize;
  uniform float u_rectangleCornerRadius;
  uniform float u_edgeDistortionThickness;
  uniform float u_refractionStrength;
  uniform float u_chromaticAberrationAmount;
  uniform float u_frostiness;
  uniform int u_shapeType; // 0 = rectangle, 1 = ellipse, 2 = complex (use texture)
  uniform bool u_useSDFTexture;

  float sdRoundedBox( vec2 p, vec2 b, float r ) {
      vec2 q = abs(p) - b + r;
      return min(max(q.x,q.y),0.0) + length(max(q,0.0)) - r;
  }

  float sdEllipse( vec2 p, vec2 r ) {
      float k0 = length(p/r);
      float k1 = length(p/(r*r));
      return k0*(k0-1.0)/k1;
  }

  vec4 renderBackground(vec2 coord) {
      vec2 uv = coord / u_resolution;
      return texture2D(u_backgroundTexture, uv);
  }

  vec4 renderLiquidGlass(vec2 currentPixelCoord, vec2 normDirToCenter, bool caActive, float distortion) {
      // If no blur, do the fast, single-sample version
      if (u_frostiness < 0.1) {
          if (caActive) {
              float rDist = max(0.0, distortion - u_chromaticAberrationAmount * 0.5);
              float bDist = distortion + u_chromaticAberrationAmount * 0.5;
              vec2 rCoord = currentPixelCoord - normDirToCenter * rDist;
              vec2 gCoord = currentPixelCoord - normDirToCenter * distortion;
              vec2 bCoord = currentPixelCoord - normDirToCenter * bDist;
              vec4 color;
              color.r = renderBackground(rCoord).r;
              color.g = renderBackground(gCoord).g;
              color.b = renderBackground(bCoord).b;
              color.a = renderBackground(gCoord).a;
              return color;
          } else {
              vec2 samplingCoord = currentPixelCoord - normDirToCenter * distortion;
              return renderBackground(samplingCoord);
          }
      }

      // Frosted version: loop over a 5x5 kernel and average the results
      vec4 totalColor = vec4(0.0);
      float sampleCount = 0.0;
      for (int x = -2; x <= 2; x++) {
          for (int y = -2; y <= 2; y++) {
              vec2 frostOffset = vec2(float(x), float(y)) * u_frostiness * 0.5;
              vec2 baseFrostedPixelCoord = currentPixelCoord + frostOffset;

              if (caActive) {
                  float rDist = max(0.0, distortion - u_chromaticAberrationAmount * 0.5);
                  float bDist = distortion + u_chromaticAberrationAmount * 0.5;
                  vec2 rCoord = baseFrostedPixelCoord - normDirToCenter * rDist;
                  vec2 gCoord = baseFrostedPixelCoord - normDirToCenter * distortion;
                  vec2 bCoord = baseFrostedPixelCoord - normDirToCenter * bDist;
                  totalColor.r += renderBackground(rCoord).r;
                  totalColor.g += renderBackground(gCoord).g;
                  totalColor.b += renderBackground(bCoord).b;
                  totalColor.a += renderBackground(gCoord).a;
              } else {
                  vec2 samplingCoord = baseFrostedPixelCoord - normDirToCenter * distortion;
                  totalColor += renderBackground(samplingCoord);
              }
              sampleCount += 1.0;
          }
      }
      return totalColor / sampleCount;
  }

  void main() {
      vec2 glassCenter = u_resolution * 0.5;
      vec2 currentPixelCoord = v_texCoord * u_resolution;
      vec2 relativeToCenter = currentPixelCoord - glassCenter;

      float sdf;
      
      if (u_useSDFTexture) {
          // For complex shapes, read from SDF texture
          vec2 uv = v_texCoord;
          float dist = texture2D(u_sdfTexture, uv).r;
          // Convert from [0,1] range to signed distance
          sdf = (dist - 0.5) * min(u_resolution.x, u_resolution.y);
      } else if (u_shapeType == 1) {
          // Ellipse
          sdf = sdEllipse(relativeToCenter, u_rectangleSize * 0.5);
      } else {
          // Rectangle (default)
          float cornerRadius = min(u_rectangleCornerRadius, min(u_rectangleSize.x, u_rectangleSize.y) * 0.5);
          sdf = sdRoundedBox(relativeToCenter, u_rectangleSize * 0.5, cornerRadius);
      }

      if (sdf > 0.0) {
          gl_FragColor = renderBackground(currentPixelCoord);
          return;
      }

      bool isInEdge = sdf > -u_edgeDistortionThickness;
      float edgeAmount = isInEdge ? (sdf + u_edgeDistortionThickness) / u_edgeDistortionThickness : 0.0;
      float distortion = isInEdge ? u_refractionStrength * pow(clamp(edgeAmount, 0.0, 1.0), 2.0) : 0.0;
      bool caActive = isInEdge && u_chromaticAberrationAmount > 0.001;
      vec2 normDir = length(relativeToCenter) > 0.001 ? normalize(relativeToCenter) : vec2(0.707, 0.707);

      gl_FragColor = renderLiquidGlass(currentPixelCoord, normDir, caActive, distortion);
  }
`;

const OFFSET = 20;
const send = (t: string, p: any) => parent.postMessage({ pluginMessage: { type: t, ...p } }, '*');

// WebGL context and variables
let canvas: HTMLCanvasElement;
let gl: WebGLRenderingContext;
let program: WebGLProgram;
let uniforms: Record<string, WebGLUniformLocation | null> = {};
let tex: WebGLTexture | null = null;
let sdfTex: WebGLTexture | null = null;
let currentShape: { width: number; height: number; cornerRadius: number } | null = null;
let currentShapeType: 'rectangle' | 'ellipse' | 'complex' = 'rectangle';

// UI elements
let createBtn: HTMLButtonElement;
let updateAllBtn: HTMLButtonElement;
let placeholder: HTMLElement;

function initGL() {
  const vs = compile(gl, vertexShaderSource, gl.VERTEX_SHADER);
  const fs = compile(gl, fragmentShaderSource, gl.FRAGMENT_SHADER);
  program = link(gl, vs, fs);
  gl.useProgram(program);

  // Get uniform locations
  uniforms.edge = gl.getUniformLocation(program, 'u_edgeDistortionThickness');
  uniforms.strength = gl.getUniformLocation(program, 'u_refractionStrength');
  uniforms.ca = gl.getUniformLocation(program, 'u_chromaticAberrationAmount');
  uniforms.frost = gl.getUniformLocation(program, 'u_frostiness');
  uniforms.resolution = gl.getUniformLocation(program, 'u_resolution');
  uniforms.rectSize = gl.getUniformLocation(program, 'u_rectangleSize');
  uniforms.cornerRadius = gl.getUniformLocation(program, 'u_rectangleCornerRadius');
  uniforms.backgroundTexture = gl.getUniformLocation(program, 'u_backgroundTexture');
  uniforms.sdfTexture = gl.getUniformLocation(program, 'u_sdfTexture');
  uniforms.shapeType = gl.getUniformLocation(program, 'u_shapeType');
  uniforms.useSDFTexture = gl.getUniformLocation(program, 'u_useSDFTexture');

  // Set up vertex buffer
  const pos = gl.getAttribLocation(program, 'a_position');
  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(pos);
  gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);
}

function compile(gl: WebGLRenderingContext, src: string, type: number): WebGLShader {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(s) || 'Shader compilation failed');
  }
  return s;
}

function link(gl: WebGLRenderingContext, vs: WebGLShader, fs: WebGLShader): WebGLProgram {
  const p = gl.createProgram()!;
  gl.attachShader(p, vs);
  gl.attachShader(p, fs);
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(p) || 'Program linking failed');
  }
  return p;
}

function updateValueDisplay(slider: HTMLInputElement) {
  const output = document.getElementById(slider.id + '-value') as HTMLOutputElement;
  if (output) output.textContent = slider.value;
}

function handleSliderChange() {
  if (createBtn.disabled) {
    const params = {
      edge: +(document.getElementById('edge') as HTMLInputElement).value,
      strength: +(document.getElementById('strength') as HTMLInputElement).value,
      ca: +(document.getElementById('ca') as HTMLInputElement).value,
      frost: +(document.getElementById('frost') as HTMLInputElement).value,
    };
    send('update-lg-element', { params });
  }
}

function updateUniformsAndRedraw(params: any) {
  if (!currentShape) return;
  gl.useProgram(program);
  gl.uniform1f(uniforms.edge!, params.edge);
  gl.uniform1f(uniforms.strength!, params.strength);
  gl.uniform1f(uniforms.ca!, params.ca);
  gl.uniform1f(uniforms.frost!, params.frost);
  gl.uniform2f(uniforms.rectSize!, currentShape.width, currentShape.height);
  gl.uniform1f(uniforms.cornerRadius!, currentShape.cornerRadius);
  
  // Set shape type
  const shapeTypeValue = currentShapeType === 'ellipse' ? 1 : 0;
  gl.uniform1i(uniforms.shapeType!, shapeTypeValue);
  gl.uniform1i(uniforms.useSDFTexture!, currentShapeType === 'complex' ? 1 : 0);
  
  redraw();
}

function redraw() {
  if (!tex || !currentShape) return;
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

function cropCanvasResult(sourceCanvas: HTMLCanvasElement, offset: number): string {
  const tempCanvas = document.createElement('canvas');
  const w = sourceCanvas.width - offset * 2;
  const h = sourceCanvas.height - offset * 2;
  if (w <= 0 || h <= 0) return sourceCanvas.toDataURL('image/png');
  tempCanvas.width = w;
  tempCanvas.height = h;
  const ctx = tempCanvas.getContext('2d')!;
  ctx.drawImage(sourceCanvas, offset, offset, w, h, 0, 0, w, h);
  return tempCanvas.toDataURL('image/png');
}

async function generateSDFFromSVG(svgData: string, width: number, height: number): Promise<ImageData> {
  // Create offscreen canvas to render SVG
  const offscreenCanvas = document.createElement('canvas');
  offscreenCanvas.width = width;
  offscreenCanvas.height = height;
  const ctx = offscreenCanvas.getContext('2d')!;
  
  // Create blob from SVG data and render to canvas
  const svgBlob = new Blob([svgData], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(svgBlob);
  const img = new Image();
  
  return new Promise((resolve) => {
    img.onload = () => {
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      
      // Get image data and convert to SDF (simplified version)
      const imageData = ctx.getImageData(0, 0, width, height);
      
      // Simple SDF generation (you may want to use tiny-sdf library here)
      // For now, just return the alpha channel as a basic distance field
      resolve(imageData);
    };
    img.src = url;
  });
}

// Initialize when DOM is ready
function initializeUI() {
  console.log('Initializing UI...');
  
  canvas = document.getElementById('lg-canvas') as HTMLCanvasElement;
  if (!canvas) {
    console.error('Canvas element not found');
    return;
  }
  
  gl = canvas.getContext('webgl', { preserveDrawingBuffer: true });
  if (!gl) {
    console.error('WebGL not supported');
    return;
  }
  
  createBtn = document.getElementById('create-btn') as HTMLButtonElement;
  updateAllBtn = document.getElementById('update-all-btn') as HTMLButtonElement;
  placeholder = document.getElementById('placeholder') as HTMLElement;
  
  if (!createBtn || !updateAllBtn) {
    console.error('Button elements not found');
    return;
  }
  
  console.log('Elements found, initializing WebGL...');
  
  try {
    initGL();
    console.log('WebGL initialized successfully');
  } catch (e) {
    console.error('WebGL initialization failed:', e);
    return;
  }

  // Set up event listeners
  createBtn.onclick = () => {
    console.log('Create button clicked');
    const params = {
      edge: +(document.getElementById('edge') as HTMLInputElement).value,
      strength: +(document.getElementById('strength') as HTMLInputElement).value,
      ca: +(document.getElementById('ca') as HTMLInputElement).value,
      frost: +(document.getElementById('frost') as HTMLInputElement).value,
    };
    
    console.log('Button clicked:', createBtn.textContent, params);
    
    if (createBtn.textContent === 'Apply Effect') {
      console.log('Sending apply-effect-to-selection message');
      send('apply-effect-to-selection', { params });
    } else {
      console.log('Sending create-lg-element message');
      send('create-lg-element', { params });
    }
  };

  updateAllBtn.onclick = () => {
    console.log('Update All button clicked');
    send('update-all-lg-elements', {});
  };

  // Set up sliders
  const sliders = document.querySelectorAll('input[type="range"]');
  console.log('Found sliders:', sliders.length);
  sliders.forEach((slider) => {
    updateValueDisplay(slider as HTMLInputElement);
    slider.addEventListener('input', () => {
      updateValueDisplay(slider as HTMLInputElement);
      handleSliderChange();
    });
  });
  
  console.log('UI initialized successfully');
}

// Try multiple initialization methods to ensure it runs
function tryInitialization() {
  console.log('Document ready state:', document.readyState);
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeUI);
  } else {
    initializeUI();
  }
  
  // Fallback initialization after a delay
  setTimeout(() => {
    console.log('Fallback initialization attempt');
    if (!createBtn) {
      initializeUI();
    }
  }, 500);
}

// Start initialization immediately
tryInitialization();

// Message handling
window.onmessage = async (e) => {
  const msg = e.data.pluginMessage;
  if (!msg) return;
  
  console.log('UI received message:', msg.type, msg);

  if (msg.type === 'plugin-ready') {
    console.log('Plugin ready, ensuring UI is initialized');
    if (!createBtn) {
      initializeUI();
    }
    return;
  }

  if (msg.type === 'update-ui-controls') {
    createBtn.disabled = msg.isSelected;
    createBtn.textContent = 'Create New'; // Always show "Create New" when LG element is selected
    (document.getElementById('edge') as HTMLInputElement).value = msg.params.edge;
    (document.getElementById('strength') as HTMLInputElement).value = msg.params.strength;
    (document.getElementById('ca') as HTMLInputElement).value = msg.params.ca;
    (document.getElementById('frost') as HTMLInputElement).value = msg.params.frost;
    
    document.querySelectorAll('input[type="range"]').forEach((slider) => {
      updateValueDisplay(slider as HTMLInputElement);
    });
    
    if (msg.isSelected) {
      send('update-lg-element', { params: msg.params });
    }
    return;
  }

  if (msg.type === 'selection-changed') {
    if (msg.canApplyEffect) {
      createBtn.textContent = 'Apply Effect';
      createBtn.disabled = false;
    } else if (msg.isLgElement) {
      createBtn.textContent = 'Create New';
      createBtn.disabled = true; // Disabled because editing existing LG element
    } else {
      createBtn.textContent = 'Create New';
      createBtn.disabled = false;
    }
    return;
  }

  if (msg.type === 'selection-cleared') {
    createBtn.disabled = false;
    createBtn.textContent = 'Create New';
    canvas.style.display = 'none';
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
    return;
  }

  if (msg.type !== 'image-captured' || msg.error) return;

  if (msg.shape) {
    document.getElementById('placeholder')?.remove();
    currentShape = msg.shape;
    currentShapeType = msg.shapeType || 'rectangle';
    
    const img = new Image();
    img.onload = async () => {
      canvas.width = img.width;
      canvas.height = img.height;
      canvas.style.display = 'block';
      gl.viewport(0, 0, canvas.width, canvas.height);

      if (!tex) tex = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);

      // Handle SDF texture for complex shapes
      if (msg.svgData && currentShapeType === 'complex') {
        if (!sdfTex) sdfTex = gl.createTexture();
        
        const sdfData = await generateSDFFromSVG(msg.svgData, canvas.width, canvas.height);
        
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, sdfTex);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sdfData);
        
        gl.uniform1i(uniforms.sdfTexture!, 1);
      }

      gl.uniform2f(uniforms.resolution!, canvas.width, canvas.height);
      gl.uniform1i(uniforms.backgroundTexture!, 0);

      updateUniformsAndRedraw(msg.params);
      
      const croppedDataUrl = cropCanvasResult(canvas, OFFSET);
      send('apply-image-fill', { data: croppedDataUrl, nodeId: msg.nodeId });
    };
    img.src = msg.data;
  }
};
