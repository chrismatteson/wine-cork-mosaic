self.onmessage = function (e) {
  const { imageData, width, height, preprocessingLevel } = e.data;
  const data = new Uint8ClampedArray(imageData);

  // Convert to grayscale
  for (let i = 0; i < data.length; i += 4) {
    const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
    data[i] = data[i + 1] = data[i + 2] = avg;
  }

  // Apply Gaussian blur
  const blurredData = applyGaussianBlur(data, width, height);

  // Edge detection
  const edgeMask = applySobelEdgeDetection(blurredData, width, height);

  // Quantization
  const levelsMap = [256, 64, 32, 16, 8, 4];
  const steps = levelsMap[preprocessingLevel] || 256;
  for (let i = 0; i < data.length; i += 4) {
    const grayVal = data[i];
    const quantized = quantizeGray(grayVal, steps);
    data[i] = data[i + 1] = data[i + 2] = quantized;
  }

  // Overlay edges in black
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4;
      if (edgeMask[y * width + x] === 255) {
        data[index] = data[index + 1] = data[index + 2] = 0; // Set to black
      }
    }
  }

  self.postMessage(data);
};

function applyGaussianBlur(data, width, height) {
  const kernel = [
    [1, 4, 7, 4, 1],
    [4, 16, 26, 16, 4],
    [7, 26, 41, 26, 7],
    [4, 16, 26, 16, 4],
    [1, 4, 7, 4, 1]
  ];
  const kernelSize = 5;
  const kernelSum = 273;
  const output = new Uint8ClampedArray(data.length);

  for (let y = 2; y < height - 2; y++) {
    for (let x = 2; x < width - 2; x++) {
      let sum = 0;
      for (let ky = 0; ky < kernelSize; ky++) {
        for (let kx = 0; kx < kernelSize; kx++) {
          const px = x + kx - 2;
          const py = y + ky - 2;
          const index = (py * width + px) * 4;
          sum += data[index] * kernel[ky][kx];
        }
      }
      const outputIndex = (y * width + x) * 4;
      const blurredValue = sum / kernelSum;
      output[outputIndex] = output[outputIndex + 1] = output[outputIndex + 2] = blurredValue;
      output[outputIndex + 3] = data[outputIndex + 3];
    }
  }
  return output;
}

function applySobelEdgeDetection(data, width, height) {
  const output = new Uint8Array(width * height);
  const gxKernel = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
  const gyKernel = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let gx = 0;
      let gy = 0;
      let idx = 0;

      for (let ny = -1; ny <= 1; ny++) {
        for (let nx = -1; nx <= 1; nx++) {
          const px = x + nx;
          const py = y + ny;
          const imageIndex = py * width + px;
          const grayVal = data[imageIndex * 4];
          gx += grayVal * gxKernel[idx];
          gy += grayVal * gyKernel[idx];
          idx++;
        }
      }
      const magnitude = Math.sqrt(gx * gx + gy * gy);
      output[y * width + x] = magnitude > 100 ? 255 : 0;
    }
  }
  return output;
}

function quantizeGray(value, steps) {
  if (steps >= 256) return value;
  const divisions = steps - 1;
  const chunk = 255 / divisions;
  return Math.round(value / chunk) * chunk;
}