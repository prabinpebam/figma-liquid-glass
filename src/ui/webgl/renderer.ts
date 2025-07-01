import { vertexShaderSource, fragmentShaderSource } from './shaders.js';

export interface WebGLRenderer {
  initialize(canvas: HTMLCanvasElement): void;
  updateUniforms(params: any): void;
  render(): void;
  updateTexture(image: HTMLImageElement): void;
  setShape(shape: any, shapeType: string): void;
  getCanvasDataURL(offset: number): string;
}

export interface WebGLUniforms {
  edge: WebGLUniformLocation | null;
  strength: WebGLUniformLocation | null;
  ca: WebGLUniformLocation | null;
  frost: WebGLUniformLocation | null;
  resolution: WebGLUniformLocation | null;
  rectSize: WebGLUniformLocation | null;
  cornerRadius: WebGLUniformLocation | null;
  backgroundTexture: WebGLUniformLocation | null;
  sdfTexture: WebGLUniformLocation | null;
  shapeType: WebGLUniformLocation | null;
  useSDFTexture: WebGLUniformLocation | null;
}

export class LiquidGlassRenderer implements WebGLRenderer {
  private gl: WebGLRenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private uniforms: WebGLUniforms = {} as WebGLUniforms;
  private tex: WebGLTexture | null = null;
  private sdfTex: WebGLTexture | null = null;
  private currentShape: any = null;
  private currentShapeType: string = 'rectangle';

  initialize(canvas: HTMLCanvasElement): void {
    this.gl = canvas.getContext('webgl', { preserveDrawingBuffer: true });
    if (!this.gl) {
      throw new Error('WebGL not supported');
    }

    this.initGL();
  }

  private initGL(): void {
    if (!this.gl) return;

    const vs = this.compileShader(vertexShaderSource, this.gl.VERTEX_SHADER);
    const fs = this.compileShader(fragmentShaderSource, this.gl.FRAGMENT_SHADER);
    this.program = this.linkProgram(vs, fs);
    this.gl.useProgram(this.program);

    // Get uniform locations
    this.uniforms.edge = this.gl.getUniformLocation(this.program, 'u_edgeDistortionThickness');
    this.uniforms.strength = this.gl.getUniformLocation(this.program, 'u_refractionStrength');
    this.uniforms.ca = this.gl.getUniformLocation(this.program, 'u_chromaticAberrationAmount');
    this.uniforms.frost = this.gl.getUniformLocation(this.program, 'u_frostiness');
    this.uniforms.resolution = this.gl.getUniformLocation(this.program, 'u_resolution');
    this.uniforms.rectSize = this.gl.getUniformLocation(this.program, 'u_rectangleSize');
    this.uniforms.cornerRadius = this.gl.getUniformLocation(this.program, 'u_rectangleCornerRadius');
    this.uniforms.backgroundTexture = this.gl.getUniformLocation(this.program, 'u_backgroundTexture');
    this.uniforms.sdfTexture = this.gl.getUniformLocation(this.program, 'u_sdfTexture');
    this.uniforms.shapeType = this.gl.getUniformLocation(this.program, 'u_shapeType');
    this.uniforms.useSDFTexture = this.gl.getUniformLocation(this.program, 'u_useSDFTexture');

    // Set up vertex buffer
    const pos = this.gl.getAttribLocation(this.program, 'a_position');
    const quad = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, quad);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), this.gl.STATIC_DRAW);
    this.gl.enableVertexAttribArray(pos);
    this.gl.vertexAttribPointer(pos, 2, this.gl.FLOAT, false, 0, 0);
  }

  private compileShader(source: string, type: number): WebGLShader {
    if (!this.gl) throw new Error('WebGL context not available');

    const shader = this.gl.createShader(type);
    if (!shader) throw new Error('Failed to create shader');

    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);

    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      const info = this.gl.getShaderInfoLog(shader);
      this.gl.deleteShader(shader);
      throw new Error('Shader compilation failed: ' + info);
    }

    return shader;
  }

  private linkProgram(vs: WebGLShader, fs: WebGLShader): WebGLProgram {
    if (!this.gl) throw new Error('WebGL context not available');

    const program = this.gl.createProgram();
    if (!program) throw new Error('Failed to create program');

    this.gl.attachShader(program, vs);
    this.gl.attachShader(program, fs);
    this.gl.linkProgram(program);

    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      const info = this.gl.getProgramInfoLog(program);
      this.gl.deleteProgram(program);
      throw new Error('Program linking failed: ' + info);
    }

    return program;
  }

  updateTexture(image: HTMLImageElement): void {
    if (!this.gl) return;

    if (!this.tex) {
      this.tex = this.gl.createTexture();
    }

    this.gl.activeTexture(this.gl.TEXTURE0);
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.tex);
    this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL, true);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
    this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, image);

    this.gl.uniform1i(this.uniforms.backgroundTexture, 0);
  }

  setShape(shape: any, shapeType: string): void {
    this.currentShape = shape;
    this.currentShapeType = shapeType === 'complex' ? 'rectangle' : shapeType;
  }

  updateUniforms(params: any): void {
    if (!this.gl || !this.currentShape) return;

    this.gl.useProgram(this.program);
    this.gl.uniform1f(this.uniforms.edge, params.edge);
    this.gl.uniform1f(this.uniforms.strength, params.strength);
    this.gl.uniform1f(this.uniforms.ca, params.ca);
    this.gl.uniform1f(this.uniforms.frost, params.frost);
    this.gl.uniform2f(this.uniforms.rectSize, this.currentShape.width, this.currentShape.height);
    this.gl.uniform1f(this.uniforms.cornerRadius, this.currentShape.cornerRadius);

    const shapeTypeValue = this.currentShapeType === 'ellipse' ? 1 : 0;
    this.gl.uniform1i(this.uniforms.shapeType, shapeTypeValue);
    this.gl.uniform1i(this.uniforms.useSDFTexture, this.currentShapeType === 'complex' ? 1 : 0);
  }

  render(): void {
    if (!this.gl || !this.tex || !this.currentShape) return;

    this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);
    this.gl.uniform2f(this.uniforms.resolution, this.gl.canvas.width, this.gl.canvas.height);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
  }

  getCanvasDataURL(offset: number): string {
    if (!this.gl) return '';

    const canvas = this.gl.canvas as HTMLCanvasElement;
    const tempCanvas = document.createElement('canvas');
    const w = canvas.width - offset * 2;
    const h = canvas.height - offset * 2;

    if (w <= 0 || h <= 0) return canvas.toDataURL('image/png');

    tempCanvas.width = w;
    tempCanvas.height = h;
    const ctx = tempCanvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(canvas, offset, offset, w, h, 0, 0, w, h);
    }

    return tempCanvas.toDataURL('image/png');
  }
}
