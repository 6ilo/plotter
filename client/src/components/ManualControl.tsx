import { useState } from "react";
import { usePlotter } from "@/hooks/usePlotter";
import { useToast } from "@/hooks/use-toast";

export default function ManualControl() {
  const [angle, setAngle] = useState<number>(0);
  const [radius, setRadius] = useState<number>(0);
  const [stepSize, setStepSize] = useState<number>(10);
  
  const { isConnected, sendCommand } = usePlotter();
  const { toast } = useToast();

  const sendDirectCommand = (command: any) => {
    console.log("Sending direct command:", command);
    
    fetch('/api/direct-command', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ command })
    })
    .then(response => {
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      if (data.success) {
        console.log("Direct API command success:", data.message);
      } else {
        throw new Error(data.error || "Failed to send command");
      }
    })
    .catch(err => {
      console.error("Direct API command failed, falling back to WebSocket:", err.message);
      toast({
        title: "Command Error",
        description: err.message,
        variant: "destructive"
      });
      // Fallback to WebSocket method
      sendCommand(command);
    });
  };

  const handleMovePolar = () => {
    if (!isConnected) {
      toast({
        title: "Error",
        description: "Not connected to device",
        variant: "destructive"
      });
      return;
    }

    if (angle < 0 || angle > 360 || radius < 0 || radius > 100) {
      toast({
        title: "Error",
        description: "Values out of range (Angle: 0-360, Radius: 0-100)",
        variant: "destructive"
      });
      return;
    }

    // Try direct API first, fall back to WebSocket
    const command = { type: 'MOVE', angle, radius };
    sendDirectCommand(command);
  };

  const handleRelativeMove = (direction: string) => {
    if (!isConnected) {
      toast({
        title: "Error",
        description: "Not connected to device",
        variant: "destructive"
      });
      return;
    }

    let dx = 0, dy = 0;
    
    switch (direction) {
      case 'N': dy = stepSize; break;
      case 'S': dy = -stepSize; break;
      case 'E': dx = stepSize; break;
      case 'W': dx = -stepSize; break;
      case 'NE': dx = stepSize; dy = stepSize; break;
      case 'NW': dx = -stepSize; dy = stepSize; break;
      case 'SE': dx = stepSize; dy = -stepSize; break;
      case 'SW': dx = -stepSize; dy = -stepSize; break;
    }
    
    if (dx !== 0) sendCommand({ type: 'X', value: dx });
    if (dy !== 0) sendCommand({ type: 'Y', value: dy });
  };

  const handleHome = () => {
    if (!isConnected) {
      toast({
        title: "Error",
        description: "Not connected to device",
        variant: "destructive"
      });
      return;
    }

    sendCommand({ type: 'HOME' });
  };

  const handleStatus = () => {
    if (!isConnected) {
      toast({
        title: "Error",
        description: "Not connected to device",
        variant: "destructive"
      });
      return;
    }

    sendCommand({ type: 'STATUS' });
  };

  return (
    <div className="bg-gray-900 p-4 border border-white">
      <h2 className="text-xl uppercase font-bold mb-4">Manual Control</h2>
      
      {/* Polar movement controls */}
      <div className="mb-4">
        <h3 className="text-md uppercase mb-2">Polar Movement</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm mb-1">Angle (deg)</label>
            <div className="flex gap-2">
              <input 
                type="number" 
                className="bg-black text-white border border-white px-3 py-2 w-full"
                value={angle}
                onChange={(e) => setAngle(parseFloat(e.target.value))}
                min={0}
                max={360}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm mb-1">Radius (mm)</label>
            <div className="flex gap-2">
              <input 
                type="number" 
                className="bg-black text-white border border-white px-3 py-2 w-full"
                value={radius}
                onChange={(e) => setRadius(parseFloat(e.target.value))}
                min={0}
                max={100}
              />
            </div>
          </div>
        </div>
        <button 
          className="mt-2 bg-white text-black px-3 py-2 uppercase w-full font-bold"
          onClick={handleMovePolar}
        >
          MOVE
        </button>
      </div>
      
      {/* XY movement controls */}
      <div>
        <h3 className="text-md uppercase mb-2">XY Movement</h3>
        <div className="grid grid-cols-3 gap-2 mb-2">
          <button className="bg-white text-black px-2 py-2 text-center" onClick={() => handleRelativeMove('NW')}>↖</button>
          <button className="bg-white text-black px-2 py-2 text-center" onClick={() => handleRelativeMove('N')}>↑</button>
          <button className="bg-white text-black px-2 py-2 text-center" onClick={() => handleRelativeMove('NE')}>↗</button>
          <button className="bg-white text-black px-2 py-2 text-center" onClick={() => handleRelativeMove('W')}>←</button>
          <button className="bg-white text-black px-2 py-2 text-center font-bold" onClick={handleHome}>⌂</button>
          <button className="bg-white text-black px-2 py-2 text-center" onClick={() => handleRelativeMove('E')}>→</button>
          <button className="bg-white text-black px-2 py-2 text-center" onClick={() => handleRelativeMove('SW')}>↙</button>
          <button className="bg-white text-black px-2 py-2 text-center" onClick={() => handleRelativeMove('S')}>↓</button>
          <button className="bg-white text-black px-2 py-2 text-center" onClick={() => handleRelativeMove('SE')}>↘</button>
        </div>
        <div className="flex gap-2">
          <select 
            className="bg-black text-white border border-white px-3 py-2"
            value={stepSize}
            onChange={(e) => setStepSize(parseInt(e.target.value))}
          >
            <option value={1}>1mm</option>
            <option value={5}>5mm</option>
            <option value={10}>10mm</option>
            <option value={25}>25mm</option>
          </select>
          <button 
            className="bg-white text-black px-3 py-2 uppercase flex-1"
            onClick={handleStatus}
          >
            Status
          </button>
        </div>
      </div>
    </div>
  );
}
