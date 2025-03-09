import { useState, useEffect } from "react";
import { usePlotter } from "@/hooks/usePlotter";
import { useToast } from "@/hooks/use-toast";
import { SerialPort } from "@shared/types";

export default function ConnectionPanel() {
  // Replace string array with SerialPort array to store more port information
  const [availablePorts, setAvailablePorts] = useState<SerialPort[]>([]);
  const [selectedPort, setSelectedPort] = useState<string>("");
  const [baudRate, setBaudRate] = useState<number>(115200);
  
  const { isConnected, currentPort, connectToPort, disconnectFromPort, refreshPorts } = usePlotter();
  const { toast } = useToast();

  useEffect(() => {
    handleRefreshPorts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRefreshPorts = async () => {
    try {
      const ports = await refreshPorts();
      setAvailablePorts(ports);
      
      if (ports.length > 0 && !selectedPort) {
        setSelectedPort(ports[0].path);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to refresh ports",
        variant: "destructive"
      });
    }
  };

  const handleConnect = async () => {
    if (isConnected) {
      await disconnectFromPort();
    } else {
      if (!selectedPort) {
        toast({
          title: "Error",
          description: "No port selected",
          variant: "destructive"
        });
        return;
      }

      try {
        await connectToPort(selectedPort, baudRate);
      } catch (error: any) {
        toast({
          title: "Connection Failed",
          description: error.message || "Could not connect to device",
          variant: "destructive"
        });
      }
    }
  };
  
  // Helper to get a friendly display name for a port
  const getPortDisplay = (port: SerialPort) => {
    if (port.displayName) {
      return port.displayName;
    }
    
    // If no display name is set, use the path
    return port.path;
  };
  
  // Helper to add a class if this is an Apple device
  const getPortClass = (port: SerialPort) => {
    if (port.isAppleDevice) {
      return "text-green-400"; // Highlight Apple devices in green
    }
    return "";
  };

  return (
    <div className="bg-gray-900 p-4 border border-white">
      <h2 className="text-xl uppercase font-bold mb-4">Connection</h2>
      <div className="flex flex-col gap-3">
        <div className="flex gap-2">
          <select
            id="port-select"
            className="bg-black text-white border border-white px-3 py-2 w-full"
            value={selectedPort}
            onChange={(e) => setSelectedPort(e.target.value)}
            disabled={isConnected}
          >
            <option value="">-- SELECT PORT --</option>
            {availablePorts.map(port => (
              <option 
                key={port.path} 
                value={port.path}
                className={getPortClass(port)}
              >
                {getPortDisplay(port)}
              </option>
            ))}
          </select>
          <button 
            className="bg-white text-black px-3 py-1 uppercase"
            onClick={handleRefreshPorts}
            disabled={isConnected}
          >
            ↻
          </button>
        </div>
        
        {/* Show additional port info if selected */}
        {selectedPort && !isConnected && (
          <div className="text-xs text-gray-400 pl-1 -mt-2">
            {availablePorts.find(p => p.path === selectedPort)?.manufacturer || 'Unknown device'}
          </div>
        )}
        
        <div className="flex gap-2">
          <select
            id="baud-select"
            className="bg-black text-white border border-white px-3 py-2"
            value={baudRate}
            onChange={(e) => setBaudRate(parseInt(e.target.value))}
            disabled={isConnected}
          >
            <option value="9600">9600</option>
            <option value="115200">115200</option>
            <option value="250000">250000</option>
          </select>
          <button
            className="bg-white text-black px-3 py-1 uppercase flex-1 font-bold"
            onClick={handleConnect}
          >
            {isConnected ? "Disconnect" : "Connect"}
          </button>
        </div>

        {/* Connection status indicator */}
        {isConnected && (
          <div className="flex items-center mt-2">
            <div className="h-3 w-3 rounded-full bg-green-500 mr-2 animate-pulse"></div>
            <span className="text-green-400">Connected to {currentPort}</span>
          </div>
        )}
      </div>
    </div>
  );
}
