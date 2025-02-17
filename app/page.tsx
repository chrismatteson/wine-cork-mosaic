"use client";

import NextImage from "next/image";
import { useState, useEffect } from "react";

export default function Home() {
  const [selectedSize, setSelectedSize] = useState("30x40");
  const [customSize, setCustomSize] = useState("");
  const [uploadedImage, setUploadedImage] = useState<File | null>(null);
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [originalImageDimensions, setOriginalImageDimensions] = useState<{ width: number; height: number } | null>(null);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [preprocessedImage, setPreprocessedImage] = useState<string | null>(null);
  const [cropPosition, setCropPosition] = useState({ x: 0.5, y: 0.5 });
  const [cropSize, setCropSize] = useState(100);
  const [orientation, setOrientation] = useState("portrait");
  const [corkCount, setCorkCount] = useState<Record<string, number>>({});
  const [preprocessingLevel, setPreprocessingLevel] = useState(0);
  const [isPreprocessedImageVisible, setIsPreprocessedImageVisible] = useState(false);

  let currentTaskId = 0;
  let debounceTimeout: NodeJS.Timeout | null = null;
  const WAIT_TIME = 300;

  useEffect(() => {
    if (uploadedImage) {
      debouncedProcessImageWithWorker(uploadedImage);
    }
  }, [selectedSize, customSize, orientation, cropPosition, cropSize, preprocessingLevel]);

  const handleSizeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedSize(event.target.value);
  };

  const handleCustomSizeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setCustomSize(event.target.value);
  };

  const handleOrientationChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setOrientation(event.target.value);
  };

  const handlePreprocessingChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const level = Number(event.target.value);
    setPreprocessingLevel(level);
    if (uploadedImage) {
      processImageWithWorker(uploadedImage);
    }
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadedImage(file);
      processImageWithWorker(file);
    }
  };

  const createFinalImage = (
    prepData: Uint8ClampedArray,
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
  ) => {
    //const edgeMask = preprocessImage(prepData, width, height);
    const circleRadius = 5;
    ctx.clearRect(0, 0, width * 10, height * 10);

    const usage: Record<string, number> = {};

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = (y * width + x) * 4;
        const redVal = prepData[index];
        const color = mapToPalette(redVal);
        const [r, g, b] = hexToRGB(color);

        // Draw simplified color region
        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        ctx.beginPath();
        ctx.arc(
          x * 10 + circleRadius,
          y * 10 + circleRadius,
          circleRadius,
          0,
          Math.PI * 2
        );
        ctx.fill();

        // Overlay edges
        //const edgeVal = edgeMask[y * width + x];
        //if (edgeVal === 255) {
        //  ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        //  ctx.beginPath();
        //  ctx.arc(
        //    x * 10 + circleRadius,
        //    y * 10 + circleRadius,
        //    circleRadius - 1,
        //    0,
        //    Math.PI * 2
        //  );
        //  ctx.fill();
        //}

        // Update color usage count
        usage[color] = (usage[color] || 0) + 1;
      }
    }

    setCorkCount(usage);
  };

  const quantizeGray = (value: number, steps: number): number => {
    if (steps >= 256) return value;
    const divisions = steps - 1;
    const chunk = 255 / divisions;
    return Math.round(value / chunk) * chunk;
  };

  const getDimensions = (size: string): [number, number] => {
    const dims: Record<string, [number, number]> = {
      "5x7": [127, 178],
      "8x10": [203, 254],
      "11x14": [279, 356],
      "12x16": [305, 406],
      "16x20": [406, 508],
      "18x24": [457, 610],
      "20x20": [508, 508],
      "24x30": [610, 762],
      "30x40": [762, 1016],
      "50x50": [1270, 1270],
      "100x100": [2540, 2540],
    };
    return dims[size] || [203, 254];
  };

  const getTargetDimensions = (size: string, orientation: string): [number, number] => {
    const [w, h] = getDimensions(size);
    if (orientation === "landscape") {
      return [h, w];
    }
    return [w, h];
  };

  const mapToPalette = (grayValue: number): string => {
    const palette = corkColors.map((color) => {
      const [r, g, b] = hexToRGB(color);
      const avg = (r + g + b) / 3;
      return { color, diff: Math.abs(avg - grayValue) };
    });
    palette.sort((a, b) => a.diff - b.diff);
    return palette[0].color;
  };

  const hexToRGB = (hex: string): [number, number, number] => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return [r, g, b];
  };

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        const { latitude, longitude } = position.coords;
        console.log(`Latitude: ${latitude}, Longitude: ${longitude}`);
      });
    }
  }, []);

  const corkColors = [
    "#F5DEB3", // Lighter cork shade for white wine
    "#CD853F", // Peru
    "#8A2BE2", // BlueViolet
    "#9400D3", // DarkViolet
    "#9932CC", // DarkOrchid
    "#BA55D3", // MediumOrchid
    "#D8BFD8", // Thistle
    "#DDA0DD", // Plum
  ];

  const handleCropSizeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setCropSize(Number(event.target.value));
    if (uploadedImage) {
      debouncedProcessImageWithWorker(uploadedImage);
    }
  };

  const handleCropPositionChange = (axis: 'x' | 'y', value: number) => {
    setCropPosition((prev) => ({ ...prev, [axis]: value }));
    // Update the crop overlay immediately
    if (uploadedImage) {
      debouncedProcessImageWithWorker(uploadedImage);
    }
  };

  function latestOnlyProcess(file: File) {
    // Clear any scheduled calls
    if (debounceTimeout) {
      clearTimeout(debounceTimeout);
    }

    // Schedule the idea of "this is the last call"
    debounceTimeout = setTimeout(() => {
      // Now that we've waited 300ms without interruption, run the worker
      const taskId = ++currentTaskId;
      processImageWithWorker(file);
    }, WAIT_TIME);
  }

  const processImageWithWorker = (file: File) => {
    const taskId = ++currentTaskId; // Increment task ID for each new task
    const reader = new FileReader();
    reader.onload = (e) => {
      if (!e.target?.result) return;
      const img = new Image();
      img.src = e.target.result as string;
      img.onload = () => {
        if (taskId !== currentTaskId) return; // Ignore if not the latest task

        setOriginalImage(img.src);
        setOriginalImageDimensions({ width: img.width, height: img.height });

        const [targetWidth, targetHeight] = getTargetDimensions(selectedSize, orientation);
        const numCorksX = Math.floor(targetWidth / 20);
        const numCorksY = Math.floor(targetHeight / 20);

        const aspectRatio = targetWidth / targetHeight;
        const imgAspectRatio = img.width / img.height;

        let cropWidth, cropHeight;
        if (imgAspectRatio > aspectRatio) {
          cropHeight = img.height * (cropSize / 100);
          cropWidth = cropHeight * aspectRatio;
        } else {
          cropWidth = img.width * (cropSize / 100);
          cropHeight = cropWidth / aspectRatio;
        }

        const cropX = cropPosition.x * (img.width - cropWidth);
        const cropY = cropPosition.y * (img.height - cropHeight);

        const canvas = document.createElement("canvas");
        canvas.width = cropWidth;
        canvas.height = cropHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.drawImage(
          img,
          cropX,
          cropY,
          cropWidth,
          cropHeight,
          0,
          0,
          cropWidth,
          cropHeight
        );

        const imageData = ctx.getImageData(0, 0, cropWidth, cropHeight);

        const worker = new Worker(new URL('./imageWorker.js', import.meta.url));
        worker.postMessage({
          imageData: imageData.data,
          width: cropWidth,
          height: cropHeight,
          preprocessingLevel
        });

        worker.onmessage = function (e) {
          if (taskId !== currentTaskId) {
            worker.terminate(); // Terminate worker if not the latest task
            return;
          }

          const processedData = e.data;
          ctx.putImageData(new ImageData(processedData, cropWidth, cropHeight), 0, 0);

          // Create a canvas for the reduced resolution image
          const prepCanvas = document.createElement("canvas");
          prepCanvas.width = numCorksX;
          prepCanvas.height = numCorksY;
          const prepCtx = prepCanvas.getContext("2d");
          if (!prepCtx) return;

          // Set preprocessed image for debugging
          setPreprocessedImage(canvas.toDataURL());

          // Draw the preprocessed full-resolution image onto the reduced resolution canvas
          prepCtx.drawImage(canvas, 0, 0, numCorksX, numCorksY);

          // Final Image Processing
          const processedCanvas = document.createElement("canvas");
          processedCanvas.width = numCorksX * 10;
          processedCanvas.height = numCorksY * 10;
          const processedCtx = processedCanvas.getContext("2d");
          if (!processedCtx) return;

          createFinalImage(prepCtx.getImageData(0, 0, numCorksX, numCorksY).data, processedCtx, numCorksX, numCorksY);

          setProcessedImage(processedCanvas.toDataURL());
          worker.terminate();
        };
      };
    };
    reader.readAsDataURL(file);
  };

  // Debounced version of processImageWithWorker
  const debouncedProcessImageWithWorker = debounce((file: File) => {
    processImageWithWorker(file);
  }, 300); // Adjust the delay to 300ms for a smoother experience

  return (
    <div className="grid min-h-screen grid-rows-[20px_1fr_20px] p-8 pb-20 gap-16 sm:p-20">
      <main className="row-start-2 flex flex-col gap-8 items-center sm:items-start">
        <h1 className="text-2xl font-bold">Wine Cork Mosaic Creator</h1>
        
        <div className="color-display">
          <h2>Wine Cork Colors</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {corkColors.map((color, idx) => (
              <div key={idx} className="flex flex-col items-center">
                <div
                  style={{ backgroundColor: color }}
                  className="w-16 h-16 rounded-full"
                ></div>
                <span className="text-xs mt-1">{color}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="image-processing">
          <h2>Upload Image</h2>
          <input type="file" accept="image/*" onChange={handleImageUpload} />

          <div className="flex items-center gap-2 mt-2">
            <label>Preprocessing Level:</label>
            <input
              type="range"
              min="0"
              max="5"
              value={preprocessingLevel}
              onChange={handlePreprocessingChange}
            />
          </div>

          {originalImage && originalImageDimensions && (
            <div className="mt-4">
              <h3>Original Image with Crop Area</h3>
              <div className="relative inline-block">
                <img
                  src={originalImage}
                  alt="Original"
                  className="max-w-full"
                  style={{ objectFit: "contain", display: "block", width: "600px" }}
                />
                <CropOverlay
                  selectedSize={selectedSize}
                  orientation={orientation}
                  cropPosition={cropPosition}
                  cropSize={cropSize}
                  originalImageDimensions={originalImageDimensions}
                />
              </div>

              <div className="flex gap-4 mt-4">
                <label>
                  Crop Size:
                  <input
                    type="range"
                    min="10"
                    max="100"
                    value={cropSize}
                    onChange={handleCropSizeChange}
                  />
                </label>
                <label>
                  Orientation:
                  <select
                    value={orientation}
                    onChange={(e) => {
                      setOrientation(e.target.value);
                    }}
                  >
                    <option value="portrait">Portrait</option>
                    <option value="landscape">Landscape</option>
                  </select>
                </label>
                <label>
                  Move X:
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={cropPosition.x}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      handleCropPositionChange('x', val);
                    }}
                  />
                </label>
                <label>
                  Move Y:
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={cropPosition.y}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      handleCropPositionChange('y', val);
                    }}
                  />
                </label>
              </div>
            </div>
          )}

          {preprocessedImage && (
            <div>
              <h3 className="flex items-center">
                Preprocessed Image (Debug Only)
                <button
                  onClick={() => setIsPreprocessedImageVisible(!isPreprocessedImageVisible)}
                  className="ml-2"
                >
                  {isPreprocessedImageVisible ? "▲" : "▼"}
                </button>
              </h3>
              {isPreprocessedImageVisible && (
                <img
                  src={preprocessedImage}
                  alt="Preprocessed"
                  className="max-w-full"
                  style={{ objectFit: "contain", display: "block", width: "600px", margin: 0, padding: 0, height: "auto" }}
                />
              )}
            </div>
          )}

          {processedImage && (
            <div className="mt-4">
              <h3>Paint by Numbers Mosaic</h3>
              <img
                src={processedImage}
                alt="Processed"
                className="max-w-full max-h-[600px] w-[90vw]"
                style={{ objectFit: "contain" }}
              />
            </div>
          )}
        </div>

        <div className="size-selection">
          <label htmlFor="size">Select Size:</label>
          <select id="size" value={selectedSize} onChange={handleSizeChange}>
            <option value="100x100">100" x 100"</option>
            <option value="50x50">50" x 50"</option>
            <option value="30x40">30" x 40"</option>
            <option value="24x30">24" x 30"</option>
            <option value="20x20">20" x 20"</option>
            <option value="18x24">18" x 24"</option>
            <option value="16x20">16" x 20"</option>
            <option value="12x16">12" x 16"</option>
            <option value="11x14">11" x 14"</option>
            <option value="8x10">8" x 10"</option>
            <option value="5x7">5" x 7"</option>
          </select>
          <input
            type="text"
            placeholder="Custom size"
            value={customSize}
            onChange={handleCustomSizeChange}
          />
        </div>

        <div className="paint-by-numbers mt-6">
          <h2>Paint by Numbers Guide</h2>
          {Object.keys(corkCount).length === 0 ? (
            <p>No mosaic generated yet.</p>
          ) : (
            <ul>
              {Object.entries(corkCount).map(([color, count]) => (
                <li key={color} style={{ color: color }}>
                  {color}: {count} corks
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
      <footer className="row-start-3 flex gap-6 flex-wrap items-center justify-center">
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="https://nextjs.org/learn"
          target="_blank"
          rel="noopener noreferrer"
        >
          <NextImage aria-hidden src="/file.svg" alt="File icon" width={16} height={16} />
          Learn
        </a>
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="https://vercel.com/templates?framework=next.js"
          target="_blank"
          rel="noopener noreferrer"
        >
          <NextImage aria-hidden src="/window.svg" alt="Window icon" width={16} height={16} />
          Examples
        </a>
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="https://nextjs.org"
          target="_blank"
          rel="noopener noreferrer"
        >
          <NextImage aria-hidden src="/globe.svg" alt="Globe icon" width={16} height={16} />
          Go to nextjs.org →
        </a>
      </footer>
    </div>
  );
}

function CropOverlay({
  selectedSize,
  orientation,
  cropPosition,
  cropSize,
  originalImageDimensions,
}: {
  selectedSize: string;
  orientation: string;
  cropPosition: { x: number; y: number };
  cropSize: number;
  originalImageDimensions: { width: number; height: number };
}) {
  const [targetW, targetH] = getTargetDimensions(selectedSize, orientation);
  const aspectRatio = targetW / targetH;

  const imgAspect = originalImageDimensions.width / originalImageDimensions.height;

  let overlayW, overlayH;
  if (imgAspect > aspectRatio) {
    overlayH = originalImageDimensions.height * (cropSize / 100);
    overlayW = overlayH * aspectRatio;
  } else {
    overlayW = originalImageDimensions.width * (cropSize / 100);
    overlayH = overlayW / aspectRatio;
  }

  const leftPx = cropPosition.x * (originalImageDimensions.width - overlayW);
  const topPx = cropPosition.y * (originalImageDimensions.height - overlayH);

  const topPct = (topPx / originalImageDimensions.height) * 100;
  const leftPct = (leftPx / originalImageDimensions.width) * 100;
  const widthPct = (overlayW / originalImageDimensions.width) * 100;
  const heightPct = (overlayH / originalImageDimensions.height) * 100;

  return (
    <div
      className="absolute border-2 border-red-500"
      style={{
        top: `${topPct}%`,
        left: `${leftPct}%`,
        width: `${widthPct}%`,
        height: `${heightPct}%`,
      }}
    />
  );
}

function getTargetDimensions(size: string, orientation: string): [number, number] {
  const dims: Record<string, [number, number]> = {
    "5x7": [127, 178],
    "8x10": [203, 254],
    "11x14": [279, 356],
    "12x16": [305, 406],
    "16x20": [406, 508],
    "18x24": [457, 610],
    "20x20": [508, 508],
    "24x30": [610, 762],
    "30x40": [762, 1016],
    "50x50": [1270, 1270],
    "100x100": [2540, 2540],
  };
  const [w, h] = dims[size] || [203, 254];
  if (orientation === "landscape") {
    return [h, w];
  }
  return [w, h];
}

function debounce(func: Function, wait: number) {
  let timeout: NodeJS.Timeout;
  return function (...args: any[]) {
    const context = this;
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(context, args), wait);
  };
}
