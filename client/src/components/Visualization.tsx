import { useEffect, useRef, useState } from "react";
import { usePlotter } from "@/hooks/usePlotter";
import { PathPoint } from "@shared/types";

// Constants from firmware
const MIN_ANGLE = 0.0;
const MAX_ANGLE = 360.0;
const MIN_RADIUS = 0.0;
const MAX_RADIUS = 100.0;

export default function Visualization() {
  const { position, pathHistory, clearPathHistory } = usePlotter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState<number>(1.0);
  
  // Setup canvas and draw initial visualization
  useEffect(() => {
    const setupCanvas = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;
      
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      
      drawVisualization();
    };
    
    setupCanvas();
    window.addEventListener('resize', setupCanvas);
    
    return () => {
      window.removeEventListener('resize', setupCanvas);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  // Redraw whenever position, pathHistory, or zoom changes
  useEffect(() => {
    drawVisualization();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position, pathHistory, zoom]);
  
  // Handle zoom controls
  const handleZoomIn = () => setZoom(Math.min(zoom * 1.2, 5.0));
  const handleZoomOut = () => setZoom(Math.max(zoom / 1.2, 0.5));
  const handleResetView = () => setZoom(1.0);
  
  // Draw the visualization
  const drawVisualization = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const scale = Math.min(width, height) / (2 * MAX_RADIUS) * zoom;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Draw grid background
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 1;
    
    // Draw grid circles
    for (let r = 20; r <= MAX_RADIUS; r += 20) {
      ctx.beginPath();
      ctx.arc(centerX, centerY, r * scale, 0, 2 * Math.PI);
      ctx.stroke();
      
      // Draw radius labels
      ctx.fillStyle = '#666666';
      ctx.font = '10px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`${r}mm`, centerX + 2, centerY - r * scale - 2);
    }
    
    // Draw angle lines
    for (let angle = 0; angle < 360; angle += 30) {
      const radians = angle * Math.PI / 180;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(
        centerX + MAX_RADIUS * scale * Math.cos(radians),
        centerY - MAX_RADIUS * scale * Math.sin(radians)
      );
      ctx.stroke();
      
      // Draw angle labels
      const labelRadius = MAX_RADIUS * scale * 0.9;
      ctx.fillStyle = '#666666';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(
        `${angle}°`, 
        centerX + labelRadius * Math.cos(radians), 
        centerY - labelRadius * Math.sin(radians)
      );
    }
    
    // Draw X and Y axes with stronger lines
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(centerX - MAX_RADIUS * scale, centerY);
    ctx.lineTo(centerX + MAX_RADIUS * scale, centerY);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(centerX, centerY + MAX_RADIUS * scale);
    ctx.lineTo(centerX, centerY - MAX_RADIUS * scale);
    ctx.stroke();
    
    // Draw boundary circle
    ctx.strokeStyle = '#FF3333';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(centerX, centerY, MAX_RADIUS * scale, 0, 2 * Math.PI);
    ctx.stroke();
    
    // Draw path history
    if (pathHistory && pathHistory.length > 0) {
      ctx.strokeStyle = '#33CCFF';
      ctx.lineWidth = 2;
      ctx.beginPath();
      
      // Convert first point from polar to cartesian
      const firstPoint = pathHistory[0];
      const firstAngleRad = firstPoint.angle * Math.PI / 180;
      const firstX = centerX + firstPoint.radius * scale * Math.cos(firstAngleRad);
      const firstY = centerY - firstPoint.radius * scale * Math.sin(firstAngleRad);
      
      ctx.moveTo(firstX, firstY);
      
      // Draw the rest of the path
      for (let i = 1; i < pathHistory.length; i++) {
        const point = pathHistory[i];
        const angleRad = point.angle * Math.PI / 180;
        const x = centerX + point.radius * scale * Math.cos(angleRad);
        const y = centerY - point.radius * scale * Math.sin(angleRad);
        ctx.lineTo(x, y);
      }
      
      ctx.stroke();
    }
  };
  
  // Calculate indicator position
  const getIndicatorStyle = () => {
    if (!canvasRef.current || !position) return {};
    
    const canvas = canvasRef.current;
    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const scale = Math.min(width, height) / (2 * MAX_RADIUS) * zoom;
    
    const angleRad = position.angle * Math.PI / 180;
    const x = centerX + position.radius * scale * Math.cos(angleRad);
    const y = centerY - position.radius * scale * Math.sin(angleRad);
    
    return {
      left: `${x}px`,
      top: `${y}px`,
    };
  };
  
  return (
    <div className="bg-gray-900 p-4 border border-white">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl uppercase font-bold">Visualization</h2>
        <div className="flex gap-2">
          <button className="bg-white text-black px-3 py-1 text-sm uppercase hover:bg-opacity-80" onClick={handleZoomIn}>
            Zoom+
          </button>
          <button className="bg-white text-black px-3 py-1 text-sm uppercase hover:bg-opacity-80" onClick={handleZoomOut}>
            Zoom-
          </button>
          <button className="bg-white text-black px-3 py-1 text-sm uppercase hover:bg-opacity-80" onClick={handleResetView}>
            Reset
          </button>
        </div>
      </div>
      
      {/* Canvas container */}
      <div className="relative aspect-square w-full border border-white overflow-hidden" ref={containerRef}>
        <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full"></canvas>
        
        {/* Current position indicator */}
        <div 
          className="absolute w-3 h-3 bg-cyan-400 rounded-full" 
          style={{
            transform: 'translate(-50%, -50%)',
            ...getIndicatorStyle()
          }}
        ></div>
        
        {/* Coordinates display */}
        <div className="absolute bottom-2 left-2 bg-black bg-opacity-70 p-2 text-sm">
          <div>POLAR: {position?.angle.toFixed(1)}° / {position?.radius.toFixed(1)}mm</div>
          <div>CART: X:{position?.x.toFixed(1)}mm Y:{position?.y.toFixed(1)}mm</div>
        </div>
      </div>
      
      {/* Path history controls */}
      <div className="mt-4 flex justify-between items-center">
        <h3 className="text-md uppercase">Path History</h3>
        <button 
          className="bg-white text-black px-3 py-1 text-sm uppercase hover:bg-opacity-80"
          onClick={clearPathHistory}
        >
          Clear
        </button>
      </div>
    </div>
  );
}
