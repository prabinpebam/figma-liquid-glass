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

  vec4 renderLiquidGlass(vec2 currentPixelCoord, vec2 normDirToCenter, bool caActive, float distortion) {
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
