export const vertexShaderSource = `
  attribute vec2 a_position;
  varying vec2 v_texCoord;
  void main() {
      gl_Position = vec4(a_position, 0.0, 1.0);
      v_texCoord = a_position * 0.5 + 0.5;
  }
`;

export const fragmentShaderSource = `
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
  uniform int u_shapeType;
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

  // High-quality Gaussian blur implementation adapted from reference
  vec4 applyGaussianBlur(vec2 currentPixelCoord, float blurRadius) {
    if (blurRadius < 0.1) {
      vec2 uv = currentPixelCoord / u_resolution;
      return texture2D(u_backgroundTexture, uv);
    }
    
    // Generate Gaussian kernel dynamically
    float sigma = blurRadius / 3.0;
    float kernelSizeFloat = ceil(blurRadius) * 2.0 + 1.0;
    float maxKernelSize = 15.0;
    kernelSizeFloat = min(kernelSizeFloat, maxKernelSize); // Now both are floats
    int kernelSize = int(kernelSizeFloat); // Convert to int after calculation
    int halfKernel = kernelSize / 2;
    
    vec4 color = vec4(0.0);
    float totalWeight = 0.0;
    
    // Separable blur - horizontal pass simulation
    for (int i = 0; i < 15; i++) {
      if (i >= kernelSize) break;
      
      int offset = i - halfKernel;
      float x = float(offset);
      
      // Gaussian weight calculation
      float weight = exp(-(x * x) / (2.0 * sigma * sigma));
      
      vec2 sampleCoord = currentPixelCoord + vec2(x, 0.0);
      vec2 uv = sampleCoord / u_resolution;
      
      // Edge handling - clamp coordinates
      uv = clamp(uv, vec2(0.0), vec2(1.0));
      
      color += texture2D(u_backgroundTexture, uv) * weight;
      totalWeight += weight;
    }
    
    // Normalize by total weight
    color /= totalWeight;
    
    // Second pass would be vertical, but for real-time performance we approximate
    // with a slightly larger single-pass kernel that samples in both directions
    vec4 finalColor = vec4(0.0);
    float finalWeight = 0.0;
    
    for (int x = -3; x <= 3; x++) {
      for (int y = -3; y <= 3; y++) {
        vec2 offset = vec2(float(x), float(y)) * blurRadius * 0.3;
        vec2 sampleCoord = currentPixelCoord + offset;
        vec2 uv = sampleCoord / u_resolution;
        
        // Edge handling
        uv = clamp(uv, vec2(0.0), vec2(1.0));
        
        // Distance-based weight for 2D Gaussian approximation
        float dist = length(vec2(float(x), float(y)));
        float weight = exp(-(dist * dist) / (2.0 * sigma * sigma));
        
        finalColor += texture2D(u_backgroundTexture, uv) * weight;
        finalWeight += weight;
      }
    }
    
    return finalColor / finalWeight;
  }

  vec4 renderLiquidGlass(vec2 currentPixelCoord, vec2 normDirToCenter, bool caActive, float distortion) {
      if (u_frostiness < 0.1) {
          // No blur - render direct refraction with optional chromatic aberration
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

      // Apply high-quality Gaussian blur with refraction offset
      // This is the ONLY place where frost blur is applied - no Figma layer blur used
      vec2 baseSamplingCoord = currentPixelCoord - normDirToCenter * distortion;
      
      if (caActive) {
          // Apply chromatic aberration to the blurred result
          float rDist = max(0.0, distortion - u_chromaticAberrationAmount * 0.5);
          float bDist = distortion + u_chromaticAberrationAmount * 0.5;
          
          vec2 rCoord = currentPixelCoord - normDirToCenter * rDist;
          vec2 gCoord = baseSamplingCoord;
          vec2 bCoord = currentPixelCoord - normDirToCenter * bDist;
          
          vec4 color;
          color.r = applyGaussianBlur(rCoord, u_frostiness).r;
          color.g = applyGaussianBlur(gCoord, u_frostiness).g;
          color.b = applyGaussianBlur(bCoord, u_frostiness).b;
          color.a = applyGaussianBlur(gCoord, u_frostiness).a;
          return color;
      } else {
          return applyGaussianBlur(baseSamplingCoord, u_frostiness);
      }
  }

  void main() {
      vec2 glassCenter = u_resolution * 0.5;
      vec2 currentPixelCoord = v_texCoord * u_resolution;
      vec2 relativeToCenter = currentPixelCoord - glassCenter;

      float sdf;
      
      if (u_useSDFTexture) {
          vec2 uv = v_texCoord;
          float dist = texture2D(u_sdfTexture, uv).r;
          sdf = (dist - 0.5) * min(u_resolution.x, u_resolution.y);
      } else if (u_shapeType == 1) {
          sdf = sdEllipse(relativeToCenter, u_rectangleSize * 0.5);
      } else {
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
