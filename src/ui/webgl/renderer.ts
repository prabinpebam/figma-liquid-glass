import { vertexShaderSource, fragmentShaderSource } from './shaders.js';

export class LiquidGlassRenderer {
  private gl!: WebGLRenderingContext;
  private program!: WebGLProgram;
  private uniforms: { [key: string]: WebGLUniformLocation | null } = {};
  private texture: WebGLTexture | null = null;
  private sdfTexture: WebGLTexture | null = null;
  private canvas!: HTMLCanvasElement;

  initialize(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.gl = canvas.getContext('webgl', { preserveDrawingBuffer: true })!;
    
    if (!this.gl) {
      throw new Error('WebGL not supported');
    }

    this.initializeShaders();
    this.setupGeometry();
  }

  private initializeShaders(): void {
    const gl = this.gl;
    
    const vs = this.compileShader(vertexShaderSource, gl.VERTEX_SHADER);
    const fs = this.compileShader(fragmentShaderSource, gl.FRAGMENT_SHADER);
    
    this.program = this.linkProgram(vs, fs);
    gl.useProgram(this.program);

    // Get uniform locations
    this.uniforms.edge = gl.getUniformLocation(this.program, 'u_edgeDistortionThickness');
    this.uniforms.strength = gl.getUniformLocation(this.program, 'u_refractionStrength');
    this.uniforms.ca = gl.getUniformLocation(this.program, 'u_chromaticAberrationAmount');
    this.uniforms.frost = gl.getUniformLocation(this.program, 'u_frostiness');
    this.uniforms.resolution = gl.getUniformLocation(this.program, 'u_resolution');
    this.uniforms.rectSize = gl.getUniformLocation(this.program, 'u_rectangleSize');
    this.uniforms.cornerRadius = gl.getUniformLocation(this.program, 'u_rectangleCornerRadius');
    this.uniforms.backgroundTexture = gl.getUniformLocation(this.program, 'u_backgroundTexture');
    this.uniforms.sdfTexture = gl.getUniformLocation(this.program, 'u_sdfTexture');
    this.uniforms.shapeType = gl.getUniformLocation(this.program, 'u_shapeType');
    this.uniforms.useSDFTexture = gl.getUniformLocation(this.program, 'u_useSDFTexture');
  }

  private compileShader(source: string, type: number): WebGLShader {
    const gl = this.gl;
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(shader) || 'Shader compilation failed');
    }
    
    return shader;
  }

  private linkProgram(vs: WebGLShader, fs: WebGLShader): WebGLProgram {
    const gl = this.gl;
    const program = gl.createProgram()!;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) || 'Program linking failed');
    }
    
    return program;
  }

  private setupGeometry(): void {
    const gl = this.gl;
    const pos = gl.getAttribLocation(this.program, 'a_position');
    const quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);
  }

  updateTexture(image: HTMLImageElement): void {
    const gl = this.gl;
    
    this.canvas.width = image.width;
    this.canvas.height = image.height;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);

    if (!this.texture) {
      this.texture = gl.createTexture();
    }
    
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

    gl.uniform2f(this.uniforms.resolution!, this.canvas.width, this.canvas.height);
    gl.uniform1i(this.uniforms.backgroundTexture!, 0);
  }

  setShape(shape: any, shapeType: string): void {
    const gl = this.gl;
    gl.uniform2f(this.uniforms.rectSize!, shape.width, shape.height);
    gl.uniform1f(this.uniforms.cornerRadius!, shape.cornerRadius);
    
    const shapeTypeValue = shapeType === 'ellipse' ? 1 : 0;
    gl.uniform1i(this.uniforms.shapeType!, shapeTypeValue);
    gl.uniform1i(this.uniforms.useSDFTexture!, shapeType === 'complex' ? 1 : 0);
  }

  updateUniforms(params: any): void {
    const gl = this.gl;
    gl.useProgram(this.program);
    gl.uniform1f(this.uniforms.edge!, params.edge);
    gl.uniform1f(this.uniforms.strength!, params.strength);
    gl.uniform1f(this.uniforms.ca!, params.ca);
    gl.uniform1f(this.uniforms.frost!, params.frost);
  }

  render(): void {
    if (!this.texture) return;
    const gl = this.gl;
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  getCanvasDataURL(offset: number): string {
    const tempCanvas = document.createElement('canvas');
    const w = this.canvas.width - offset * 2;
    const h = this.canvas.height - offset * 2;
    
    if (w <= 0 || h <= 0) {
      return this.canvas.toDataURL('image/png');
    }
    
    tempCanvas.width = w;
    tempCanvas.height = h;
    const ctx = tempCanvas.getContext('2d')!;
    ctx.drawImage(this.canvas, offset, offset, w, h, 0, 0, w, h);
    return tempCanvas.toDataURL('image/png');
  }
}