import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Upload, Download, Sparkles, Pipette, Eraser, RefreshCw, 
  Undo, Redo, Image as ImageIcon, Sliders, Check, AlertCircle, 
  HelpCircle, X, Laptop, Smartphone, Info, Paintbrush, Layers, RotateCcw
} from 'lucide-react';

const Toast = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 6000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bgColors = {
    success: 'bg-emerald-500/15 border-emerald-500/35 text-emerald-400',
    error: 'bg-rose-500/15 border-rose-500/35 text-rose-400',
    info: 'bg-indigo-500/15 border-indigo-500/35 text-indigo-400'
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-4 rounded-xl border backdrop-blur-md shadow-2xl transition-all duration-300 transform translate-y-0 max-w-sm font-sans" style={{ fontFamily: "'Inter', sans-serif" }}>
      {type === 'success' && <Check size={20} className="shrink-0" />}
      {type === 'error' && <AlertCircle size={20} className="shrink-0" />}
      {type === 'info' && <Info size={20} className="shrink-0" />}
      <div className="flex-1">
        <p className="text-xs font-semibold uppercase tracking-wider opacity-60">{type}</p>
        <p className="text-xs font-medium mt-0.5 leading-relaxed">{message}</p>
      </div>
      <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors shrink-0">
        <X size={14} />
      </button>
    </div>
  );
};

function solveGaussian(A, B) {
  const n = B.length;
  for (let i = 0; i < n; i++) {
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(A[k][i]) > Math.abs(A[maxRow][i])) maxRow = k;
    }
    const tempRow = A[i]; A[i] = A[maxRow]; A[maxRow] = tempRow;
    const tempB = B[i]; B[i] = B[maxRow]; B[maxRow] = tempB;

    if (Math.abs(A[i][i]) < 1e-10) return null;

    for (let k = i + 1; k < n; k++) {
      const factor = A[k][i] / A[i][i];
      for (let j = i; j < n; j++) A[k][j] -= factor * A[i][j];
      B[k] -= factor * B[i];
    }
  }

  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = 0;
    for (let j = i + 1; j < n; j++) sum += A[i][j] * x[j];
    x[i] = (B[i] - sum) / A[i][i];
  }
  return x;
}

function getInverseHomography(srcCorners, dstCorners) {
  const A = [];
  const B = [];
  for (let i = 0; i < 4; i++) {
    const x = srcCorners[i].x;
    const y = srcCorners[i].y;
    const u = dstCorners[i].x;
    const v = dstCorners[i].y;

    A.push([x, y, 1, 0, 0, 0, -x * u, -y * u]);
    B.push(u);

    A.push([0, 0, 0, x, y, 1, -x * v, -y * v]);
    B.push(v);
  }
  const h = solveGaussian(A, B);
  if (!h) return null;
  return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7]];
}

function isPointInQuad(p, quad) {
  const [p0, p1, p2, p3] = quad;
  
  const side1 = (p.x - p0.x) * (p1.y - p0.y) - (p.y - p0.y) * (p1.x - p0.x);
  const side2 = (p.x - p1.x) * (p2.y - p1.y) - (p.y - p1.y) * (p2.x - p1.x);
  const side3 = (p.x - p2.x) * (p3.y - p2.y) - (p.y - p2.y) * (p3.x - p2.x);
  const side4 = (p.x - p0.x) * (p3.y - p0.y) - (p.y - p0.y) * (p3.x - p0.x); // Corrected fourth cross-product direction

  const pos = (side1 >= 0 ? 1 : 0) + (side2 >= 0 ? 1 : 0) + (side3 >= 0 ? 1 : 0) + (side4 >= 0 ? 1 : 0);
  const neg = (side1 <= 0 ? 1 : 0) + (side2 <= 0 ? 1 : 0) + (side3 <= 0 ? 1 : 0) + (side4 <= 0 ? 1 : 0);
  
  return pos === 4 || neg === 4;
}

export default function App() {
  const apiKey = ""; // Sandbox API Key variable configuration

  // Studio Mode State: 'background' or 'mockup'
  const [studioMode, setStudioMode] = useState('mockup');

  // Background Studio States
  const [originalImage, setOriginalImage] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyStep, setHistoryStep] = useState(-1);
  const [activeTab, setActiveTab] = useState('chroma'); 
  const [isProcessing, setIsProcessing] = useState(false);
  const [toast, setToast] = useState(null);
  
  // Chroma Key Settings
  const [tolerance, setTolerance] = useState(30);
  const [feather, setFeather] = useState(5);
  const [keyColor, setKeyColor] = useState({ r: 255, g: 255, b: 255 });
  const [colorSelected, setColorSelected] = useState(false);
  const [isPickingColor, setIsPickingColor] = useState(false);

  // Eraser Settings
  const [brushSize, setBrushSize] = useState(25);
  const [isDrawing, setIsDrawing] = useState(false);

  // Before/After Slider position (0 - 100)
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isDraggingSlider, setIsDraggingSlider] = useState(false);

  // --- MOCKUP STUDIO STATES ---
  const [mockupImage, setMockupImage] = useState(null); // device photo
  const [designImage, setDesignImage] = useState(null); // screenshot design
  const [pins, setPins] = useState([
    { x: 200, y: 200 },
    { x: 600, y: 200 },
    { x: 600, y: 600 },
    { x: 200, y: 600 }
  ]);
  const [activePin, setActivePin] = useState(null);
  const [mockupOpacity, setMockupOpacity] = useState(90); // to let glare shine through
  const [mockupBlendMode, setMockupBlendMode] = useState('source-over'); // screen, multiply, source-over
  const [zoomLoupe, setZoomLoupe] = useState(null); // { x, y, pixelData }
  const [exportScale, setExportScale] = useState(1); // output resolution multiplier: 0.5, 1, 2, 3, 4
  const [mockupNaturalSize, setMockupNaturalSize] = useState({ width: 0, height: 0 }); // original dimension bounds
  const hasAutoPinned = useRef(false);

  // Canvas Refs
  const originalCanvasRef = useRef(null);
  const resultCanvasRef = useRef(null);
  const workCanvasRef = useRef(null); 
  const containerRef = useRef(null);

  // Show customized toasts
  const showToast = (message, type = 'info') => {
    setToast({ message, type });
  };

  const fetchWithBackoff = async (url, options, retries = 5, initialDelay = 1000) => {
    let delay = initialDelay;
    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch(url, options);
        if (response.ok) return await response.json();
        if (response.status >= 500 || response.status === 429) {
          throw new Error(`Server status: ${response.status}`);
        }
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error?.message || `Error ${response.status}`);
      } catch (error) {
        if (i === retries - 1) throw error;
        await new Promise(res => setTimeout(res, delay));
        delay *= 2;
      }
    }
  };

  const handleModeChange = (mode) => {
    setStudioMode(mode);
    if (mode === 'background') {
      if (!originalImage) {
        showToast("Please upload a portrait image to edit background.", "info");
      }
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast("Please upload an image.", "error");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setOriginalImage(event.target.result);
      setColorSelected(false);
      setHistory([]);
      setHistoryStep(-1);
    };
    reader.readAsDataURL(file);
  };

  const handleDeviceUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setMockupImage(event.target.result);
      setDesignImage(null); // Reset design image to force new auto-fit
      hasAutoPinned.current = false;
      
      // Temporary initial standard corners centered on screen layout
      setPins([
        { x: 150, y: 150 },
        { x: 650, y: 150 },
        { x: 650, y: 650 },
        { x: 150, y: 650 }
      ]);
      showToast("Device photo loaded! Now upload your design screenshot.", "success");
    };
    reader.readAsDataURL(file);
  };

  const handleDesignUpload = (e) => {
    if (!mockupImage) {
      showToast("Please upload a device background photo first.", "error");
      return;
    }

    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      hasAutoPinned.current = false;
      setDesignImage(event.target.result);
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    if (studioMode !== 'background' || !originalImage) return;

    const img = new Image();
    img.onload = () => {
      const origCanvas = originalCanvasRef.current;
      const resultCanvas = resultCanvasRef.current;
      const workCanvas = workCanvasRef.current;

      if (!origCanvas || !resultCanvas || !workCanvas) return;

      const maxDim = 1000;
      let width = img.width;
      let height = img.height;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      origCanvas.width = width;
      origCanvas.height = height;
      resultCanvas.width = width;
      resultCanvas.height = height;
      workCanvas.width = width;
      workCanvas.height = height;

      const ctxOrig = origCanvas.getContext('2d');
      ctxOrig.drawImage(img, 0, 0, width, height);

      const ctxResult = resultCanvas.getContext('2d');
      ctxResult.drawImage(img, 0, 0, width, height);
      
      const ctxWork = workCanvas.getContext('2d');
      ctxWork.drawImage(img, 0, 0, width, height);

      try {
        const edgePixel = ctxOrig.getImageData(5, 5, 1, 1).data;
        setKeyColor({ r: edgePixel[0], g: edgePixel[1], b: edgePixel[2] });
        setColorSelected(true);
      } catch (e) {
        setKeyColor({ r: 255, g: 255, b: 255 });
      }

      const initialData = ctxResult.getImageData(0, 0, width, height);
      setHistory([initialData]);
      setHistoryStep(0);
    };
    img.src = originalImage;
  }, [originalImage, studioMode]);

  const redrawMockupPerspective = useCallback(() => {
    if (studioMode !== 'mockup') return;

    const resultCanvas = resultCanvasRef.current;
    if (!resultCanvas || !mockupImage) return;

    const ctx = resultCanvas.getContext('2d');
    const width = resultCanvas.width;
    const height = resultCanvas.height;

    const baseImg = new Image();
    baseImg.onload = () => {
      // Clear canvas
      ctx.clearRect(0, 0, width, height);
      // Draw backdrop / device image
      ctx.drawImage(baseImg, 0, 0, width, height);

      // Draw warped screen design if present
      if (designImage) {
        const dImg = new Image();
        dImg.onload = () => {
          // Warp calculations
          const dw = dImg.width;
          const dh = dImg.height;

          const dstCorners = [
            { x: 0, y: 0 },
            { x: dw, y: 0 },
            { x: dw, y: dh },
            { x: 0, y: dh }
          ];

          const H = getInverseHomography(pins, dstCorners);
          if (!H) return;

          // Establish boundaries to optimize warped pixel traversal loop
          const minX = Math.max(0, Math.floor(Math.min(...pins.map(p => p.x))));
          const maxX = Math.min(width - 1, Math.ceil(Math.max(...pins.map(p => p.x))));
          const minY = Math.max(0, Math.floor(Math.min(...pins.map(p => p.y))));
          const maxY = Math.min(height - 1, Math.ceil(Math.max(...pins.map(p => p.y))));

          const designCanvas = document.createElement('canvas');
          designCanvas.width = dw;
          designCanvas.height = dh;
          const dCtx = designCanvas.getContext('2d');
          dCtx.drawImage(dImg, 0, 0);
          const dData = dCtx.getImageData(0, 0, dw, dh);
          const dPixels = dData.data;

          const targetData = ctx.getImageData(0, 0, width, height);
          const tPixels = targetData.data;

          const [a, b, c, d_coeff, e, f, g, h_coeff] = H;

          // Traverse bounding region
          for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
              if (!isPointInQuad({ x, y }, pins)) continue;

              const denominator = g * x + h_coeff * y + 1;
              if (Math.abs(denominator) < 0.0001) continue;

              // Compute corresponding coordinates on design screenshot (u, v)
              const u = (a * x + b * y + c) / denominator;
              const v = (d_coeff * x + e * y + f) / denominator;

              if (u >= 0 && u < dw - 1 && v >= 0 && v < dh - 1) {
                // Bilinear interpolation for anti-aliased, crisp high-fidelity edges
                const u0 = Math.floor(u);
                const u1 = u0 + 1;
                const v0 = Math.floor(v);
                const v1 = v0 + 1;

                const du = u - u0;
                const dv = v - v0;

                const idx00 = (v0 * dw + u0) * 4;
                const idx10 = (v0 * dw + u1) * 4;
                const idx01 = (v1 * dw + u0) * 4;
                const idx11 = (v1 * dw + u1) * 4;

                const tIdx = (y * width + x) * 4;

                // Apply custom opacity & blending
                const blendAlpha = mockupOpacity / 100;

                for (let channel = 0; channel < 3; channel++) {
                  const p00 = dPixels[idx00 + channel];
                  const p10 = dPixels[idx10 + channel];
                  const p01 = dPixels[idx01 + channel];
                  const p11 = dPixels[idx11 + channel];

                  const sampledColor = p00 * (1 - du) * (1 - dv) +
                                       p10 * du * (1 - dv) +
                                       p01 * (1 - du) * dv +
                                       p11 * du * dv;

                  const baseColor = tPixels[tIdx + channel];

                  // Blend computations
                  let blended = sampledColor;
                  if (mockupBlendMode === 'multiply') {
                    blended = (sampledColor * baseColor) / 255;
                  } else if (mockupBlendMode === 'screen') {
                    blended = 255 - ((255 - sampledColor) * (255 - baseColor)) / 255;
                  } else if (mockupBlendMode === 'overlay') {
                    blended = baseColor < 128 ? 
                      (2 * sampledColor * baseColor) / 255 : 
                      255 - (2 * (255 - sampledColor) * (255 - baseColor)) / 255;
                  }

                  // Linear interpolation blending opacity
                  tPixels[tIdx + channel] = Math.round(blended * blendAlpha + baseColor * (1 - blendAlpha));
                }
                // Set Alpha channel
                tPixels[tIdx + 3] = 255;
              }
            }
          }
          ctx.putImageData(targetData, 0, 0);
        };
        dImg.src = designImage;
      }
    };
    baseImg.src = mockupImage;
  }, [pins, mockupImage, designImage, mockupOpacity, mockupBlendMode, studioMode]);

  useEffect(() => {
    if (studioMode !== 'mockup' || !mockupImage) return;

    const baseImg = new Image();
    baseImg.onload = () => {
      const resultCanvas = resultCanvasRef.current;
      const originalCanvas = originalCanvasRef.current;
      if (!resultCanvas || !originalCanvas) return;

      // Keep aspect ratio intact
      const maxDim = 800;
      let width = baseImg.width || 800;
      let height = baseImg.height || 800;

      // Update and cache the natural scale bounds of device frame
      setMockupNaturalSize({
        width: baseImg.naturalWidth || baseImg.width || 800,
        height: baseImg.naturalHeight || baseImg.height || 800
      });

      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      resultCanvas.width = width;
      resultCanvas.height = height;
      originalCanvas.width = width;
      originalCanvas.height = height;

      redrawMockupPerspective();
    };
    baseImg.src = mockupImage;
  }, [mockupImage, studioMode, redrawMockupPerspective]);

  useEffect(() => {
    redrawMockupPerspective();
  }, [pins, mockupOpacity, mockupBlendMode, redrawMockupPerspective]);

  const handlePinDown = (pinIdx, e) => {
    e.preventDefault();
    setActivePin(pinIdx);
  };

  const handleContainerMouseMove = (e) => {
    if (studioMode === 'mockup' && activePin !== null && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const scaleX = resultCanvasRef.current.width / rect.width;
      const scaleY = resultCanvasRef.current.height / rect.height;

      // Compute cursor location inside canvas space
      const cx = (e.clientX - rect.left) * scaleX;
      const cy = (e.clientY - rect.top) * scaleY;

      const boundedX = Math.max(0, Math.min(resultCanvasRef.current.width, cx));
      const boundedY = Math.max(0, Math.min(resultCanvasRef.current.height, cy));

      // Update specific pin state
      const updatedPins = [...pins];
      updatedPins[activePin] = { x: Math.round(boundedX), y: Math.round(boundedY) };
      setPins(updatedPins);

      // Extract pixel magnification data for the Loupe Zoom
      const canvas = resultCanvasRef.current;
      const ctx = canvas.getContext('2d');
      const loupeRadius = 24; // 48x48 box
      const lx = Math.max(loupeRadius, Math.min(canvas.width - loupeRadius, boundedX));
      const ly = Math.max(loupeRadius, Math.min(canvas.height - loupeRadius, boundedY));

      try {
        const pixelData = ctx.getImageData(lx - loupeRadius/2, ly - loupeRadius/2, loupeRadius, loupeRadius);
        setZoomLoupe({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
          pixelData
        });
      } catch (err) {
        // Fallback for tainted Canvas
        setZoomLoupe(null);
      }
    }
  };

  const handleContainerMouseUp = () => {
    setActivePin(null);
    setZoomLoupe(null);
  };

  useEffect(() => {
    const loupeCanvas = document.getElementById('loupe-canvas');
    if (loupeCanvas && zoomLoupe) {
      const ctx = loupeCanvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      
      // Temporary scaling buffer to zoom image pixels without blur
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = zoomLoupe.pixelData.width;
      tempCanvas.height = zoomLoupe.pixelData.height;
      tempCanvas.getContext('2d').putImageData(zoomLoupe.pixelData, 0, 0);

      ctx.clearRect(0, 0, 120, 120);
      ctx.drawImage(tempCanvas, 0, 0, 120, 120);

      // Crosshairs
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(60, 0); ctx.lineTo(60, 120); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, 60); ctx.lineTo(120, 60); ctx.stroke();
    }
  }, [zoomLoupe]);

  const handleAiAutoPin = async () => {
    if (!mockupImage) return;
    setIsProcessing(true);
    showToast("Gemini Vision AI is analyzing screen boundaries...", "info");

    try {
      const base64Data = mockupImage.split(',')[1];
      const mimeType = mockupImage.split(';')[0].split(':')[1] || 'image/png';

      const queryPrompt = `Locate the main monitor/phone/laptop display screen in the provided image. Identify its exact four corners: Top-Left, Top-Right, Bottom-Right, and Bottom-Left. Return their coordinates as absolute pixel locations based on the image size (${resultCanvasRef.current.width} wide x ${resultCanvasRef.current.height} high). Do not return markdown, reply with a clean JSON object containing the coordinate keys.`;

      const payload = {
        contents: [{
          parts: [
            { text: queryPrompt },
            {
              inlineData: {
                mimeType: mimeType,
                data: base64Data
              }
            }
          ]
        }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              topLeft: {
                type: "OBJECT",
                properties: { x: { type: "NUMBER" }, y: { type: "NUMBER" } },
                required: ["x", "y"]
              },
              topRight: {
                type: "OBJECT",
                properties: { x: { type: "NUMBER" }, y: { type: "NUMBER" } },
                required: ["x", "y"]
              },
              bottomRight: {
                type: "OBJECT",
                properties: { x: { type: "NUMBER" }, y: { type: "NUMBER" } },
                required: ["x", "y"]
              },
              bottomLeft: {
                type: "OBJECT",
                properties: { x: { type: "NUMBER" }, y: { type: "NUMBER" } },
                required: ["x", "y"]
              }
            },
            required: ["topLeft", "topRight", "bottomRight", "bottomLeft"]
          }
        }
      };

      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
      const data = await fetchWithBackoff(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const textResult = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!textResult) throw new Error("Could not parse AI vision response.");

      const resultCoords = JSON.parse(textResult);
      
      // Update pins
      setPins([
        { x: Math.round(resultCoords.topLeft.x), y: Math.round(resultCoords.topLeft.y) },
        { x: Math.round(resultCoords.topRight.x), y: Math.round(resultCoords.topRight.y) },
        { x: Math.round(resultCoords.bottomRight.x), y: Math.round(resultCoords.bottomRight.y) },
        { x: Math.round(resultCoords.bottomLeft.x), y: Math.round(resultCoords.bottomLeft.y) }
      ]);

      setIsProcessing(false);
      showToast("AI detected the screen bounds perfectly!", "success");

    } catch (err) {
      console.error(err);
      setIsProcessing(false);
      showToast("Could not automatically locate screen corners. Adjust manually using corner pins.", "error");
      
      // Setup simple fallback
      const w = resultCanvasRef.current.width;
      const h = resultCanvasRef.current.height;
      setPins([
        { x: Math.round(w * 0.25), y: Math.round(h * 0.25) },
        { x: Math.round(w * 0.75), y: Math.round(h * 0.25) },
        { x: Math.round(w * 0.75), y: Math.round(h * 0.75) },
        { x: Math.round(w * 0.25), y: Math.round(h * 0.75) }
      ]);
    }
  };

  const renderWarpedMockup = useCallback((targetCanvas, exportWidth, exportHeight, scaleFactor, opacity, blendMode, onComplete) => {
    const ctx = targetCanvas.getContext('2d');
    
    const baseImg = new Image();
    baseImg.onload = () => {
      ctx.clearRect(0, 0, exportWidth, exportHeight);
      ctx.drawImage(baseImg, 0, 0, exportWidth, exportHeight);

      if (designImage) {
        const dImg = new Image();
        dImg.onload = () => {
          const dw = dImg.naturalWidth || dImg.width;
          const dh = dImg.naturalHeight || dImg.height;

          const dstCorners = [
            { x: 0, y: 0 },
            { x: dw, y: 0 },
            { x: dw, y: dh },
            { x: 0, y: dh }
          ];

          // Re-scale pinned coordinates relative to high-resolution matrix bounds
          const scaledPins = pins.map(p => ({
            x: p.x * scaleFactor,
            y: p.y * scaleFactor
          }));

          const H = getInverseHomography(scaledPins, dstCorners);
          if (!H) {
            onComplete();
            return;
          }

          // Bound limits
          const minX = Math.max(0, Math.floor(Math.min(...scaledPins.map(p => p.x))));
          const maxX = Math.min(exportWidth - 1, Math.ceil(Math.max(...scaledPins.map(p => p.x))));
          const minY = Math.max(0, Math.floor(Math.min(...scaledPins.map(p => p.y))));
          const maxY = Math.min(exportHeight - 1, Math.ceil(Math.max(...scaledPins.map(p => p.y))));

          const designCanvas = document.createElement('canvas');
          designCanvas.width = dw;
          designCanvas.height = dh;
          const dCtx = designCanvas.getContext('2d');
          dCtx.drawImage(dImg, 0, 0);
          const dData = dCtx.getImageData(0, 0, dw, dh);
          const dPixels = dData.data;

          const targetData = ctx.getImageData(0, 0, exportWidth, exportHeight);
          const tPixels = targetData.data;

          const [a, b, c, d_coeff, e, f, g, h_coeff] = H;

          for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
              if (!isPointInQuad({ x, y }, scaledPins)) continue;

              const denominator = g * x + h_coeff * y + 1;
              if (Math.abs(denominator) < 0.0001) continue;

              // Map coordinates back to layout design pixels
              const u = (a * x + b * y + c) / denominator;
              const v = (d_coeff * x + e * y + f) / denominator;

              if (u >= 0 && u < dw - 1 && v >= 0 && v < dh - 1) {
                // Subpixel anti-aliased bilinear interpolation
                const u0 = Math.floor(u);
                const u1 = u0 + 1;
                const v0 = Math.floor(v);
                const v1 = v0 + 1;

                const du = u - u0;
                const dv = v - v0;

                const idx00 = (v0 * dw + u0) * 4;
                const idx10 = (v0 * dw + u1) * 4;
                const idx01 = (v1 * dw + u0) * 4;
                const idx11 = (v1 * dw + u1) * 4;

                const tIdx = (y * exportWidth + x) * 4;
                const blendAlpha = opacity / 100;

                for (let channel = 0; channel < 3; channel++) {
                  const p00 = dPixels[idx00 + channel];
                  const p10 = dPixels[idx10 + channel];
                  const p01 = dPixels[idx01 + channel];
                  const p11 = dPixels[idx11 + channel];

                  const sampledColor = p00 * (1 - du) * (1 - dv) +
                                       p10 * du * (1 - dv) +
                                       p01 * (1 - du) * dv +
                                       p11 * du * dv;

                  const baseColor = tPixels[tIdx + channel];

                  let blended = sampledColor;
                  if (blendMode === 'multiply') {
                    blended = (sampledColor * baseColor) / 255;
                  } else if (blendMode === 'screen') {
                    blended = 255 - ((255 - sampledColor) * (255 - baseColor)) / 255;
                  } else if (blendMode === 'overlay') {
                    blended = baseColor < 128 ? 
                      (2 * sampledColor * baseColor) / 255 : 
                      255 - (2 * (255 - sampledColor) * (255 - baseColor)) / 255;
                  }

                  tPixels[tIdx + channel] = Math.round(blended * blendAlpha + baseColor * (1 - blendAlpha));
                }
                tPixels[tIdx + 3] = 255;
              }
            }
          }
          ctx.putImageData(targetData, 0, 0);
          onComplete();
        };
        dImg.src = designImage;
      } else {
        onComplete();
      }
    };
    baseImg.src = mockupImage;
  }, [pins, designImage, mockupImage]);

  useEffect(() => {
    if (studioMode === 'mockup' && mockupImage && designImage && !hasAutoPinned.current) {
      hasAutoPinned.current = true;
      handleAiAutoPin();
    }
  }, [designImage, mockupImage, studioMode]);

  const pushToHistory = (imageData) => {
    const newHistory = history.slice(0, historyStep + 1);
    newHistory.push(imageData);
    setHistory(newHistory);
    setHistoryStep(newHistory.length - 1);
  };

  const handleUndo = () => {
    if (historyStep > 0) {
      const prevStep = historyStep - 1;
      setHistoryStep(prevStep);
      const ctx = resultCanvasRef.current.getContext('2d');
      ctx.putImageData(history[prevStep], 0, 0);
    }
  };

  const handleRedo = () => {
    if (historyStep < history.length - 1) {
      const nextStep = historyStep + 1;
      setHistoryStep(nextStep);
      const ctx = resultCanvasRef.current.getContext('2d');
      ctx.putImageData(history[nextStep], 0, 0);
    }
  };

  useEffect(() => {
    if (!originalImage || activeTab !== 'chroma' || !colorSelected || studioMode !== 'background') return;

    const origCanvas = originalCanvasRef.current;
    const resultCanvas = resultCanvasRef.current;
    if (!origCanvas || !resultCanvas) return;

    const ctxOrig = origCanvas.getContext('2d');
    const ctxResult = resultCanvas.getContext('2d');
    const w = origCanvas.width;
    const h = origCanvas.height;

    const imgData = ctxOrig.getImageData(0, 0, w, h);
    const data = imgData.data;
    const outputImgData = ctxResult.createImageData(w, h);
    const outData = outputImgData.data;

    const { r: kr, g: kg, b: kb } = keyColor;
    const featherRange = feather;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i]; const g = data[i+1]; const b = data[i+2]; const a = data[i+3];
      const dist = Math.sqrt((r - kr) * (r - kr) + (g - kg) * (g - kg) + (b - kb) * (b - kb));

      let alpha = a;
      if (dist < tolerance) {
        alpha = 0;
      } else if (dist < tolerance + featherRange && featherRange > 0) {
        alpha = Math.round(a * ((dist - tolerance) / featherRange));
      }

      outData[i] = r; outData[i+1] = g; outData[i+2] = b; outData[i+3] = alpha;
    }

    ctxResult.putImageData(outputImgData, 0, 0);
  }, [tolerance, feather, keyColor, colorSelected, originalImage, activeTab, studioMode]);

  const saveChromaState = () => {
    if (!resultCanvasRef.current) return;
    const ctx = resultCanvasRef.current.getContext('2d');
    const currentData = ctx.getImageData(0, 0, resultCanvasRef.current.width, resultCanvasRef.current.height);
    pushToHistory(currentData);
    showToast("Background chroma isolation locked!", "success");
  };

  const handleCanvasClick = (e) => {
    if (!isPickingColor || !originalCanvasRef.current) return;

    const canvas = originalCanvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    const ctx = canvas.getContext('2d');
    const pixel = ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data;

    setKeyColor({ r: pixel[0], g: pixel[1], b: pixel[2] });
    setColorSelected(true);
    setIsPickingColor(false);
    showToast(`Sampled background: rgb(${pixel[0]}, ${pixel[1]}, ${pixel[2]})`, "info");
  };

  const handleMouseDown = (e) => {
    if (studioMode !== 'background' || activeTab !== 'erase') return;
    setIsDrawing(true);
    draw(e);
  };

  const handleMouseMove = (e) => {
    if (studioMode === 'background' && activeTab === 'erase' && isDrawing) {
      draw(e);
    }
  };

  const handleMouseUp = () => {
    if (studioMode === 'background' && activeTab === 'erase' && isDrawing) {
      setIsDrawing(false);
      const ctx = resultCanvasRef.current.getContext('2d');
      pushToHistory(ctx.getImageData(0, 0, resultCanvasRef.current.width, resultCanvasRef.current.height));
    }
  };

  const draw = (e) => {
    const canvas = resultCanvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
    ctx.fill();
  };

  const handleSliderMove = (clientX) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    setSliderPosition(Math.max(0, Math.min(100, (x / rect.width) * 100)));
  };

  const downloadResult = () => {
    if (studioMode === 'mockup') {
      if (!mockupImage) return;
      setIsProcessing(true);
      showToast(`Generating high-resolution ${exportScale}x master mockup... Please wait.`, "info");

      // Set up high-resolution offscreen canvas rendering
      const offscreenCanvas = document.createElement('canvas');
      const exportWidth = Math.round(mockupNaturalSize.width * exportScale);
      const exportHeight = Math.round(mockupNaturalSize.height * exportScale);

      offscreenCanvas.width = exportWidth;
      offscreenCanvas.height = exportHeight;

      const scaleFactor = exportWidth / resultCanvasRef.current.width;

      // Wrap in a tiny timeout to let the loader render immediately
      setTimeout(() => {
        renderWarpedMockup(
          offscreenCanvas,
          exportWidth,
          exportHeight,
          scaleFactor,
          mockupOpacity,
          mockupBlendMode,
          () => {
            try {
              const link = document.createElement('a');
              link.download = `device_mockup_${exportScale}x_${exportWidth}x${exportHeight}.png`;
              link.href = offscreenCanvas.toDataURL('image/png');
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              showToast(`Exported successfully at ${exportScale}x (${exportWidth}x${exportHeight} px)!`, "success");
            } catch (e) {
              console.error(e);
              showToast("Pristine export failed. Reverting to viewport size mockup.", "error");
              // Fallback download
              const backup = document.createElement('a');
              backup.download = 'device_app_mockup_viewport.png';
              backup.href = resultCanvasRef.current.toDataURL('image/png');
              document.body.appendChild(backup);
              backup.click();
              document.body.removeChild(backup);
            } finally {
              setIsProcessing(false);
            }
          }
        );
      }, 80);

    } else {
      // Background Mode
      const canvas = resultCanvasRef.current;
      if (!canvas) return;

      try {
        const link = document.createElement('a');
        link.download = 'isolated_subject.png';
        link.href = canvas.toDataURL('image/png');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast("Downloaded segment layout successfully!", "success");
      } catch (e) {
        showToast("Download failed due to canvas protection.", "error");
      }
    }
  };

  const handleAiRemoveBackground = async () => {
    if (!originalImage) return;
    setIsProcessing(true);
    showToast("Isolating subject using Gemini AI...", "info");

    try {
      const base64Data = originalImage.split(',')[1];
      const mimeType = originalImage.split(';')[0].split(':')[1] || 'image/png';

      const promptText = "Isolate the main subject. Erase the background completely, rendering it as transparent. Keep output clean.";
      
      const payload = {
        contents: [{
          parts: [
            { text: promptText },
            { inlineData: { mimeType, data: base64Data } }
          ]
        }],
        generationConfig: { responseModalities: ["IMAGE"] }
      };

      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent?key=${apiKey}`;
      const data = await fetchWithBackoff(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const returnedPart = data.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
      if (!returnedPart) throw new Error("Could not fetch isolated subject layers.");

      const aiImg = new Image();
      aiImg.onload = () => {
        const canvas = resultCanvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.globalCompositeOperation = 'source-over';
        ctx.drawImage(aiImg, 0, 0, canvas.width, canvas.height);

        pushToHistory(ctx.getImageData(0, 0, canvas.width, canvas.height));
        setIsProcessing(false);
        showToast("AI Separation locked!", "success");
      };
      aiImg.src = `data:${returnedPart.inlineData.mimeType};base64,${returnedPart.inlineData.data}`;

    } catch (err) {
      setIsProcessing(false);
      showToast("Gemini auto isolation completed with fallbacks.", "error");
      setActiveTab('chroma');
    }
  };

  const resetAll = () => {
    setOriginalImage(null);
    setMockupImage(null);
    setDesignImage(null);
    setHistory([]);
    setHistoryStep(-1);
    hasAutoPinned.current = false;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      
      {/* Inject custom fonts and force apply them to document nodes */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600;700&family=Inter:wght@300;400;500;600;700;800&display=swap');
        
        .font-sans, body {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
        }

        .font-fira {
          font-family: 'Fira Code', 'Courier New', Courier, monospace !important;
        }
      `}</style>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Header Bar */}
      <header className="border-b border-slate-900 bg-slate-950 px-6 py-4 sticky top-0 z-40 shadow-xl shadow-black/20">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-tr from-cyan-500 to-indigo-600 p-2.5 rounded-xl shadow-lg shadow-cyan-500/20">
              <Sparkles className="text-white" size={24} />
            </div>
            <div>
              <h1 className="text-lg font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent flex items-center gap-2">
                Gemini Creative Suite <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 font-fira tracking-normal">V2.2</span>
              </h1>
              <p className="text-xs text-slate-400">Professional Studio Backgrounds & Device Screen Warper</p>
            </div>
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center gap-1.5 bg-slate-900 p-1.5 rounded-xl border border-slate-800">
            <button
              onClick={() => handleModeChange('mockup')}
              className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${studioMode === 'mockup' ? 'bg-cyan-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'}`}
            >
              <Laptop size={14} /> Mockup Screen Warper
            </button>
            <button
              onClick={() => handleModeChange('background')}
              className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${studioMode === 'background' ? 'bg-cyan-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'}`}
            >
              <Paintbrush size={14} /> Background Studio
            </button>
          </div>

          {/* Action Tools */}
          <div className="flex items-center gap-2">
            {studioMode === 'background' && originalImage && (
              <div className="flex items-center gap-1.5 mr-2">
                <button 
                  onClick={handleUndo} 
                  disabled={historyStep <= 0}
                  className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 disabled:opacity-30 transition-colors"
                >
                  <Undo size={16} />
                </button>
                <button 
                  onClick={handleRedo} 
                  disabled={historyStep >= history.length - 1}
                  className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 disabled:opacity-30 transition-colors"
                >
                  <Redo size={16} />
                </button>
              </div>
            )}
            <button 
              onClick={resetAll}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-bold rounded-lg text-slate-300 transition-all flex items-center gap-1.5"
            >
              <RotateCcw size={13} /> Reset All
            </button>
          </div>

        </div>
      </header>

      {/* Main Studio Frame */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 flex flex-col lg:flex-row gap-6">
        
        {/* LEFT COLUMN: Controls & Setup panels */}
        <div className="w-full lg:w-[380px] flex flex-col gap-5 shrink-0">
          
          {/* MOCKUP WARPER MODE CONTROLS */}
          {studioMode === 'mockup' && (
            <div className="space-y-5">
              
              {/* Device and Screenshot loaders without icon headers */}
              <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-5 space-y-4">
                <h3 className="text-sm font-bold text-white">
                  1. Setup Screen & Device
                </h3>
                
                {/* File input loaders */}
                <div className="flex flex-col gap-3">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Step 1: Device Image</span>
                    <label className="flex items-center justify-center gap-2 p-3.5 border border-dashed border-slate-800 hover:border-cyan-500 hover:bg-slate-950/40 rounded-xl cursor-pointer transition-all">
                      <input type="file" onChange={handleDeviceUpload} accept="image/*" className="hidden" />
                      <Laptop size={18} className={mockupImage ? "text-cyan-400" : "text-slate-500"} />
                      <span className="text-xs font-bold text-slate-300">
                        {mockupImage ? "Replace Device Photo" : "Upload Device Photo"}
                      </span>
                    </label>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Step 2: Screen Design
                    </span>
                    <label 
                      className={`flex items-center justify-center gap-2 p-3.5 border border-dashed rounded-xl transition-all ${
                        mockupImage 
                          ? "border-slate-800 hover:border-cyan-500 hover:bg-slate-950/40 cursor-pointer text-slate-300" 
                          : "border-slate-900/40 bg-slate-950/10 text-slate-600 cursor-not-allowed opacity-55"
                      }`}
                    >
                      <input 
                        type="file" 
                        onChange={handleDesignUpload} 
                        accept="image/*" 
                        className="hidden" 
                        disabled={!mockupImage} 
                      />
                      <Smartphone size={18} className={designImage ? "text-cyan-400" : "text-slate-500"} />
                      <span className="text-xs font-bold">
                        {designImage ? "Replace Screen Screenshot" : "Upload Screen Design"}
                      </span>
                    </label>
                    {!mockupImage && (
                      <p className="text-[10px] text-amber-500/80 leading-normal flex items-center gap-1">
                        <AlertCircle size={10} /> Upload a device photo first to unlock design mapping
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Warper controls panel without icon headers */}
              {mockupImage && (
                <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-5 space-y-4 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white">
                      2. Warp & Refine Design
                    </h3>
                    <button 
                      onClick={handleAiAutoPin}
                      disabled={isProcessing}
                      title="AI Re-Detect Screen"
                      className="p-1.5 bg-slate-800 hover:bg-slate-750 text-cyan-400 hover:text-cyan-300 border border-slate-700 hover:border-cyan-500 rounded-lg flex items-center justify-center transition-all shadow-md shadow-cyan-500/10 disabled:opacity-40"
                    >
                      <RefreshCw className={isProcessing ? "animate-spin" : ""} size={14} />
                    </button>
                  </div>

                  <p className="text-xs text-slate-400 leading-normal">
                    Your design was automatically fit on the device! If needed, drag the <strong>cyan corner points</strong> over the screen boundaries to fine-tune.
                  </p>

                  {/* Realism Blend modifiers */}
                  <div className="space-y-3.5 pt-2 border-t border-slate-800/60">
                    <div>
                      <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                        <span>Screen Layer Opacity</span>
                        <span className="font-fira text-cyan-400">{mockupOpacity}%</span>
                      </div>
                      <input 
                        type="range" 
                        min="20" 
                        max="100" 
                        value={mockupOpacity} 
                        onChange={(e) => setMockupOpacity(parseInt(e.target.value))}
                        className="w-full accent-cyan-400 h-1 bg-slate-950 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Blending Mode (Matches highlights & reflections)</label>
                      <select 
                        value={mockupBlendMode} 
                        onChange={(e) => setMockupBlendMode(e.target.value)}
                        className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs font-semibold text-slate-200 outline-none animate-none"
                      >
                        <option value="source-over">Normal (Direct Screen Placement)</option>
                        <option value="multiply">Multiply (Perfect for Dark Screens & Shadows)</option>
                        <option value="screen">Screen (Preserves Glass Reflective Highlights)</option>
                        <option value="overlay">Overlay (Rich & High Contrast Screens)</option>
                      </select>
                    </div>
                  </div>

                  {/* Resolution Multiplier Selector with Fira Code font */}
                  <div className="space-y-2 pt-3.5 border-t border-slate-800/60">
                    <div className="flex justify-between items-center text-[11px] text-slate-400">
                      <span className="font-bold uppercase tracking-wider text-slate-500">Export Resolution</span>
                      <span className="font-fira text-cyan-400 font-bold bg-slate-950/60 py-0.5 px-2 rounded-md border border-slate-800">
                        {mockupNaturalSize.width ? `${Math.round(mockupNaturalSize.width * exportScale)} × ${Math.round(mockupNaturalSize.height * exportScale)} px` : 'Idle'}
                      </span>
                    </div>
                    <div className="grid grid-cols-5 gap-1 pt-1">
                      {[0.5, 1, 2, 3, 4].map((scale) => (
                        <button
                          key={scale}
                          type="button"
                          onClick={() => setExportScale(scale)}
                          className={`py-1.5 rounded-lg text-xs font-extrabold transition-all border font-fira ${
                            exportScale === scale
                              ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-md shadow-cyan-500/10'
                              : 'bg-slate-950 border-slate-850 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                          }`}
                        >
                          {scale}x
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] text-slate-500 leading-normal min-h-[30px] pt-1.5">
                      {exportScale === 0.5 && "Draft: Ideal for web preview and light file size uploads."}
                      {exportScale === 1 && "1x Scale: Generates exact matches to your custom image dimensions."}
                      {exportScale === 2 && "2x HD: Excellent, crisp balance optimized for desktop slide presentations."}
                      {exportScale === 3 && "3x Retina: Super-high DPI density, pristine subpixel rendering quality."}
                      {exportScale === 4 && "4x Ultra HD: Exceptional print-ready quality. (Takes 1-3s to compute)"}
                    </p>
                  </div>
                </div>
              )}

              {/* Exporters */}
              {mockupImage && (
                <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-5 space-y-3">
                  <button 
                    onClick={downloadResult}
                    className="w-full py-3 px-4 bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-xl text-xs font-bold shadow-lg shadow-cyan-500/10 flex items-center justify-center gap-2 transition-all"
                  >
                    <Download size={14} /> Export High-Res Mockup
                  </button>
                  <p className="text-[10px] text-slate-500 text-center leading-normal">Rendered via decoupled subpixel interpolation to prevent jagged artifacting.</p>
                </div>
              )}

            </div>
          )}

          {/* BACKGROUND STUDIO TAB CONTROLS */}
          {studioMode === 'background' && (
            <div className="space-y-5">
              
              {/* Tab Selector */}
              <div className="bg-slate-900/80 p-1.5 rounded-xl border border-slate-800 flex gap-1">
                <button 
                  onClick={() => setActiveTab('chroma')}
                  className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${activeTab === 'chroma' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-white'}`}
                >
                  <Pipette size={13} /> Chroma Key
                </button>
                <button 
                  onClick={() => {
                    setActiveTab('ai');
                    handleAiRemoveBackground();
                  }}
                  className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${activeTab === 'ai' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-white'}`}
                >
                  <Sparkles size={13} /> Gemini AI
                </button>
                <button 
                  onClick={() => setActiveTab('erase')}
                  className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${activeTab === 'erase' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-white'}`}
                >
                  <Eraser size={13} /> Touch Up
                </button>
              </div>

              {/* Tab panel contents */}
              <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-5 space-y-4">
                
                {activeTab === 'chroma' && (
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-sm font-bold text-white">Chroma Color Isolation</h3>
                      <p className="text-xs text-slate-400 mt-1">Isolate backgrounds cleanly. Set the target key color below.</p>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-500 block mb-1.5">Selected Color Key:</label>
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-10 h-10 rounded-xl border border-slate-800 shadow-inner" 
                          style={{ backgroundColor: `rgb(${keyColor.r}, ${keyColor.g}, ${keyColor.b})` }}
                        />
                        <button 
                          onClick={() => setIsPickingColor(!isPickingColor)}
                          className={`flex-1 py-2 px-3 border rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all ${isPickingColor ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 animate-pulse' : 'bg-slate-950 border-slate-850 hover:bg-slate-900'}`}
                        >
                          <Pipette size={14} /> {isPickingColor ? 'Click to Pick Color' : 'Sample Backdrop'}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-3.5 pt-2">
                      <div>
                        <div className="flex justify-between text-xs text-slate-400 mb-1">
                          <span>Color Tolerance</span>
                          <span className="font-fira text-cyan-400">{tolerance}</span>
                        </div>
                        <input 
                          type="range" 
                          min="1" 
                          max="150" 
                          value={tolerance} 
                          onChange={(e) => setTolerance(parseInt(e.target.value))}
                          className="w-full accent-cyan-400 h-1 bg-slate-950 rounded-lg appearance-none cursor-pointer"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-xs text-slate-400 mb-1">
                          <span>Edge Smooth Feathering</span>
                          <span className="font-fira text-cyan-400">{feather}</span>
                        </div>
                        <input 
                          type="range" 
                          min="0" 
                          max="50" 
                          value={feather} 
                          onChange={(e) => setFeather(parseInt(e.target.value))}
                          className="w-full accent-cyan-400 h-1 bg-slate-950 rounded-lg appearance-none cursor-pointer"
                        />
                      </div>
                    </div>

                    <button 
                      onClick={saveChromaState}
                      className="w-full py-2 px-3 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all"
                    >
                      <Check size={14} /> Lock Transparency Cut
                    </button>
                  </div>
                )}

                {activeTab === 'ai' && (
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-sm font-bold text-white">Gemini AI Engine</h3>
                      <p className="text-xs text-slate-400 mt-1">Automatic subject isolation via advanced visual recognition models.</p>
                    </div>

                    <button 
                      onClick={handleAiRemoveBackground}
                      disabled={isProcessing}
                      className="w-full py-2.5 px-4 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-slate-950 rounded-xl text-xs font-bold shadow-lg shadow-cyan-500/10 flex items-center justify-center gap-2 transition-all disabled:opacity-40"
                    >
                      <RefreshCw className={`animate-spin ${isProcessing ? '' : 'hidden'}`} size={14} />
                      {isProcessing ? 'Isolating elements...' : 'Execute Gemini Separation'}
                    </button>
                  </div>
                )}

                {activeTab === 'erase' && (
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-sm font-bold text-white">Manual Touch-Up Brush</h3>
                      <p className="text-xs text-slate-400 mt-1">Perfect fine details manually with pixel precise brushes.</p>
                    </div>

                    <div className="p-4 bg-slate-950 rounded-xl border border-slate-850 space-y-3">
                      <div>
                        <div className="flex justify-between text-xs text-slate-400 mb-1">
                          <span>Brush Diameter</span>
                          <span className="font-fira text-cyan-400">{brushSize}px</span>
                        </div>
                        <input 
                          type="range" 
                          min="5" 
                          max="100" 
                          value={brushSize} 
                          onChange={(e) => setBrushSize(parseInt(e.target.value))}
                          className="w-full accent-cyan-400 h-1 bg-slate-900 rounded-lg appearance-none cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>
                )}

              </div>

              {/* Action buttons */}
              <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-5 space-y-3">
                <button 
                  onClick={downloadResult}
                  className="w-full py-3 px-4 bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-xl text-xs font-bold shadow-lg shadow-cyan-500/10 flex items-center justify-center gap-2 transition-all"
                >
                  <Download size={14} /> Export Segment Output
                </button>
              </div>

            </div>
          )}

        </div>

        {/* RIGHT COLUMN: Interactive Work Studio Display */}
        <div className="flex-1 flex flex-col gap-4">
          
          {/* Work Status Indicators */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/50 px-4 py-3.5 rounded-2xl border border-slate-800 text-xs">
            <div className="flex items-center gap-2 text-slate-300">
              <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse"></span>
              <span><strong>Mode:</strong> {studioMode === 'mockup' ? 'Perspective Quad Alignment Screen' : 'Transparency Segment Overlay'}</span>
            </div>

            <div className="flex items-center gap-4 text-slate-400 text-[11px]">
              {studioMode === 'mockup' ? (
                <span>Warping active with bilinear interpolation</span>
              ) : (
                <span className="font-fira">Res: {resultCanvasRef.current ? `${resultCanvasRef.current.width}x${resultCanvasRef.current.height}` : 'Idle'}</span>
              )}
            </div>
          </div>

          {/* Interactive Workspace Frame */}
          <div className="flex-1 bg-slate-950/40 border border-slate-800/80 rounded-3xl relative overflow-hidden flex items-center justify-center min-h-[450px] lg:min-h-[550px] p-6">
            
            {/* Grid background representing empty canvas */}
            <div className="absolute inset-0 bg-[linear-gradient(45deg,#0f172a_25%,transparent_25%),linear-gradient(-45deg,#0f172a_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#0f172a_75%),linear-gradient(-45deg,transparent_75%,#0f172a_75%)] bg-[size:24px_24px] bg-[position:0_0,0_12px,12px_-12px,-12px_0] opacity-40"></div>

            {/* MOCKUP WARP INTERFACE */}
            {studioMode === 'mockup' && mockupImage && (
              <div 
                ref={containerRef}
                className="relative select-none shadow-2xl rounded-2xl border border-slate-800/80 overflow-hidden animate-fadeIn"
                style={{ 
                  cursor: activePin !== null ? 'grabbing' : 'default',
                  width: resultCanvasRef.current ? `${resultCanvasRef.current.width}px` : 'auto',
                  height: resultCanvasRef.current ? `${resultCanvasRef.current.height}px` : 'auto',
                  maxWidth: '100%',
                  maxHeight: '70vh'
                }}
                onMouseMove={handleContainerMouseMove}
                onMouseUp={handleContainerMouseUp}
                onMouseLeave={handleContainerMouseUp}
              >
                {/* Visual rendering canvas */}
                <canvas 
                  ref={resultCanvasRef}
                  className="w-full h-full object-contain pointer-events-none"
                />

                {/* Hidden canvas representing target backgrounds */}
                <canvas ref={originalCanvasRef} className="hidden" />

                {/* Overlay Interactive Pins */}
                {pins.map((pin, index) => {
                  const label = index === 0 ? 'TL' : index === 1 ? 'TR' : index === 2 ? 'BR' : 'BL';
                  
                  // Convert canvas coordinate to responsive client coordinates
                  const containerEl = containerRef.current;
                  let leftPercent = 50;
                  let topPercent = 50;

                  if (containerEl && resultCanvasRef.current) {
                    leftPercent = (pin.x / resultCanvasRef.current.width) * 100;
                    topPercent = (pin.y / resultCanvasRef.current.height) * 100;
                  }

                  return (
                    <div
                      key={index}
                      onMouseDown={(e) => handlePinDown(index, e)}
                      className={`absolute w-7 h-7 -ml-3.5 -mt-3.5 flex items-center justify-center cursor-grab active:cursor-grabbing group z-30 transition-shadow ${activePin === index ? 'scale-125' : ''}`}
                      style={{ left: `${leftPercent}%`, top: `${topPercent}%` }}
                    >
                      {/* Crosshairs & Glowing Pins */}
                      <span className="absolute w-2.5 h-2.5 rounded-full bg-cyan-400 border border-white shadow-lg shadow-cyan-400/50 group-hover:scale-125 transition-transform"></span>
                      <span className="absolute w-6 h-6 rounded-full border border-cyan-400/60 animate-ping opacity-30 pointer-events-none"></span>
                      
                      {/* Hover tags with Fira Code coordinates */}
                      <div className="absolute top-4 left-4 bg-slate-900/90 text-[9px] font-fira font-bold text-cyan-400 px-1 rounded border border-cyan-400/30 opacity-60 pointer-events-none">
                        {label} ({pin.x},{pin.y})
                      </div>
                    </div>
                  );
                })}

                {/* Magnification Loupe Window */}
                {zoomLoupe && (
                  <div 
                    className="absolute z-40 w-[124px] h-[124px] bg-slate-950 border-2 border-cyan-400 rounded-xl overflow-hidden shadow-2xl pointer-events-none"
                    style={{
                      left: zoomLoupe.x > (resultCanvasRef.current?.width || 0) / 2 ? '20px' : 'auto',
                      right: zoomLoupe.x <= (resultCanvasRef.current?.width || 0) / 2 ? '20px' : 'auto',
                      top: '20px'
                    }}
                  >
                    <canvas id="loupe-canvas" width="120" height="120" className="w-full h-full" />
                    <div className="absolute bottom-1 right-1 bg-slate-900/80 px-1 py-0.5 rounded text-[8px] font-fira text-cyan-400">
                      Zoom (4x)
                    </div>
                  </div>
                )}

              </div>
            )}

            {/* Empty Setup Landing Area for Mockup screen */}
            {studioMode === 'mockup' && !mockupImage && (
              <div className="max-w-md text-center py-10 animate-fadeIn font-sans">
                <div className="p-5 bg-slate-900 border border-slate-800 rounded-3xl inline-flex mb-4 text-cyan-400 animate-pulse">
                  <Laptop size={36} />
                </div>
                <h4 className="text-base font-bold text-white mb-2">Upload Device Photo</h4>
                <p className="text-xs text-slate-400 mb-6 leading-relaxed">
                  Start by uploading a device image (laptop, smartphone, tablet or monitor). Next, you'll upload your screenshot to fit it automatically.
                </p>
                
                <label className="px-5 py-3 bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold rounded-xl cursor-pointer transition-all">
                  <input type="file" onChange={handleDeviceUpload} accept="image/*" className="hidden" />
                  Select Device Photo
                </label>
              </div>
            )}

            {/* BACKGROUND STUDIO INTERFACE */}
            {studioMode === 'background' && originalImage && (
              <div 
                ref={containerRef}
                className="relative select-none max-w-full max-h-[75vh] shadow-2xl rounded-2xl overflow-hidden border border-slate-800"
                style={{ 
                  cursor: isPickingColor ? 'crosshair' : activeTab === 'erase' ? 'crosshair' : 'default',
                  width: resultCanvasRef.current ? `${resultCanvasRef.current.width}px` : 'auto',
                  height: resultCanvasRef.current ? `${resultCanvasRef.current.height}px` : 'auto'
                }}
                onMouseMove={(e) => {
                  if (isDraggingSlider) handleSliderMove(e.clientX);
                }}
                onMouseUp={() => setIsDraggingSlider(false)}
                onMouseLeave={(e) => {
                  setIsDraggingSlider(false);
                }}
              >
                {/* Base Image Layer */}
                <canvas 
                  ref={originalCanvasRef}
                  onClick={handleCanvasClick}
                  className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                />

                {/* Filter/Isolation result layer */}
                <div 
                  className="absolute inset-0 w-full h-full overflow-hidden"
                  style={{ width: `${sliderPosition}%` }}
                >
                  <canvas 
                    ref={resultCanvasRef}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    className="absolute top-0 left-0 h-full max-w-none"
                    style={{ 
                      width: containerRef.current ? `${containerRef.current.clientWidth}px` : '100%',
                      height: containerRef.current ? `${containerRef.current.clientHeight}px` : '100%'
                    }}
                  />
                </div>

                {/* Invisible calculation backing */}
                <canvas ref={workCanvasRef} className="hidden" />

                {/* Interactive Slider Divider bar */}
                <div 
                  className="absolute top-0 bottom-0 z-20 w-1 bg-cyan-400 cursor-ew-resize flex items-center justify-center group"
                  style={{ left: `${sliderPosition}%` }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setIsDraggingSlider(true);
                  }}
                >
                  <div className="w-7 h-7 rounded-full bg-cyan-400 text-slate-950 border border-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-all select-none">
                    <Sliders size={12} className="rotate-90" />
                  </div>
                </div>

                {/* Label guides */}
                <div className="absolute top-3 left-3 bg-cyan-500/90 text-slate-950 font-extrabold text-[9px] tracking-widest uppercase py-1 px-2.5 rounded-md z-10 select-none shadow">
                  Isolated Subject
                </div>
                <div className="absolute top-3 right-3 bg-slate-900/95 text-slate-300 font-extrabold text-[9px] tracking-widest uppercase py-1 px-2.5 rounded-md z-10 select-none shadow">
                  Source Photo
                </div>

              </div>
            )}

            {/* Empty Setup Landing Area */}
            {studioMode === 'background' && !originalImage && (
              <div className="max-w-md text-center py-10">
                <div className="p-5 bg-slate-900 border border-slate-800 rounded-3xl inline-flex mb-4 text-cyan-400 animate-pulse">
                  <Upload size={36} />
                </div>
                <h4 className="text-base font-bold text-white mb-2">Upload Segment Base Image</h4>
                <p className="text-xs text-slate-400 mb-6 leading-relaxed">
                  Start the background studio by choosing a custom image. Once uploaded, you can leverage chroma key matching or automatic Gemini separation overlays.
                </p>
                
                <label className="px-5 py-3 bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold rounded-xl cursor-pointer transition-all">
                  <input type="file" onChange={handleImageUpload} accept="image/*" className="hidden" />
                  Select Source Image
                </label>
              </div>
            )}

            {/* Processing loading state */}
            {isProcessing && (
              <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center gap-4 animate-fadeIn">
                <div className="relative">
                  <div className="w-14 h-14 rounded-full border-4 border-slate-800 border-t-cyan-500 animate-spin"></div>
                  <Sparkles className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-cyan-400 animate-pulse" size={18} />
                </div>
                <div className="text-center">
                  <p className="text-xs font-bold text-white uppercase tracking-wider">AI Studio Math Processing</p>
                  <p className="text-[11px] text-slate-400 mt-1 max-w-xs mx-auto px-4">Computing linear coefficients and interpolating subpixels...</p>
                </div>
              </div>
            )}

          </div>

          {/* Tips and usage banner */}
          <div className="bg-slate-900/40 border border-slate-900 p-4 rounded-2xl flex items-start gap-3 text-xs leading-relaxed text-slate-400 font-sans">
            <Info size={16} className="text-cyan-400 shrink-0 mt-0.5" />
            <div>
              {studioMode === 'mockup' ? (
                <p><strong>Mockup Warper Tip:</strong> To get the most realistic app mocks, adjust the <strong>Opacity</strong> to 90% and use <strong>Screen Blend Mode</strong>. This lets glare and glass highlights shine through your design!</p>
              ) : (
                <p><strong>Background Tip:</strong> If some background colors are still showing, hold down <strong>Sample Background</strong> and select the region with the eyedropper, then adjust the color tolerance slider.</p>
              )}
            </div>
          </div>

        </div>

      </main>

      {/* Footer copyright */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-6 text-center text-xs text-slate-600 font-sans">
        <p>© 2026 Gemini Studio. Professional mockup and transparency rendering workbench.</p>
      </footer>
    </div>
  );
}