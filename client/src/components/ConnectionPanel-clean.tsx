import { useState, useEffect } from "react";
import { usePlotter } from "@/hooks/usePlotter";
import { useToast } from "@/hooks/use-toast";
import { SerialPort } from "@shared/types";

export default function ConnectionPanel() {
  const [availablePorts, setAvailablePorts] = useState<SerialPort[]>([]);
  const [selectedPort, setSelectedPort] = useState<string>("");
  const [baudRate, setBaudRate] = useState<number>(115200);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [showReplitWarning, setShowReplitWarning] = useState<boolean>(false);
  
  const { isConnected, currentPort, connectToPort, disconnectFromPort, refreshPorts } = usePlotter();
  const { toast } = useToast();

  useEffect(() => {
    handleRefreshPorts();
    // Check if running in Replit
    setShowReplitWarning(window.location.hostname.includes('replit.dev') || window.location.hostname.includes('replit.app'));
    
    // Poll for ports every 5 seconds when not connected
    const intervalId = setInterval(() => {
      if (!isConnected) {
        handleRefreshPorts(true); // Silent refresh
      }
    }, 5000);
    
    return () => clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected]);

  const handleRefreshPorts = async (silent = false) => {
    if (!silent) {
      setIsRefreshing(true);
      toast({
        title: "Scanning ports...",
        description: "Looking for connected devices",
      });
    }
    
    try {
      // Directly fetch ports from API to ensure we get the latest data
      const response = await fetch('/api/ports');
      if (!response.ok) {
        throw new Error(`Failed to fetch ports: ${response.statusText}`);
      }
      
      const ports = await response.json();
      console.log("Direct API response:", ports);
      
      // Force refresh through the plotter hook as well (for WebSocket updates)
      refreshPorts().catch(err => console.error("Error in hook refreshPorts:", err));
      
      // Update UI with ports directly from API
      setAvailablePorts(ports);
      
      if (ports.length === 0 && !silent) {
        toast({
          title: "No ports found",
          description: "Make sure your device is connected and drivers are installed",
          variant: "destructive"
        });
      } else if (ports.length > 0 && !silent) {
        toast({
          title: `Found ${ports.length} ports`,
          description: "Select a port and click Connect",
        });
        
        // Debug which port we found
        ports.forEach(port => {
          console.log(`Port found: ${port.path} (${port.manufacturer || 'unknown manufacturer'})`);
        });
      }
      
      // Set a detected port if available and not already selected
      if ((!selectedPort || !ports.some(p => p.path === selectedPort)) && ports.length > 0) {
        let preferredPort = ports[0].path;
        
        // In real environments, try to find Arduino or USB Serial ports
        const arduinoPort = ports.find(p => 
          (p.manufacturer?.toLowerCase().includes('arduino') || false)
        );
        
        const usbSerialPort = ports.find(p => 
          (p.path?.toLowerCase().includes('usbserial') || false) ||
          (p.path?.toLowerCase().includes('ttyusb') || false) ||
          (p.path?.toLowerCase().includes('ttyacm') || false)
        );
        
        if (arduinoPort) {
          preferredPort = arduinoPort.path;
        } else if (usbSerialPort) {
          preferredPort = usbSerialPort.path;
        }
        
        setSelectedPort(preferredPort);
      }
    } catch (error) {
      if (!silent) {
        toast({
          title: "Error",
          description: "Failed to refresh ports. Please try again.",
          variant: "destructive"
        });
      }
    } finally {
      if (!silent) {
        setIsRefreshing(false);
      }
    }
  };

  const handleConnect = async () => {
    console.log("Connect button clicked");
    
    if (isConnected) {
      console.log("Attempting to disconnect...");
      try {
        await disconnectFromPort();
        console.log("Disconnected successfully");
      } catch (error) {
        console.error("Disconnect error:", error);
        toast({
          title: "Disconnect Failed",
          description: "Could not disconnect from device",
          variant: "destructive"
        });
      }
    } else {
      if (!selectedPort) {
        console.log("No port selected");
        toast({
          title: "Error",
          description: "No port selected",
          variant: "destructive"
        });
        return;
      }
      
      // If trying to connect in Replit environment, show warning
      if (window.location.hostname.includes('replit.dev') || window.location.hostname.includes('replit.app')) {
        toast({
          title: "Cannot Connect to Physical Hardware",
          description: "This application needs to run on your local machine to connect to physical hardware.",
          variant: "destructive"
        });
        
        return;
      }

      console.log(`Attempting to connect to ${selectedPort} at ${baudRate} baud...`);
      try {
        const result = await connectToPort(selectedPort, baudRate);
        console.log("Connect result:", result);
      } catch (error: any) {
        console.error("Connection error:", error);
        toast({
          title: "Connection Failed",
          description: error.message || "Could not connect to device",
          variant: "destructive"
        });
      }
    }
  };
  
  // Format port display for Arduino IDE style
  const formatPortDisplay = (port: SerialPort) => {
    // Special case for hardware unavailable message
    if (port.path === 'HARDWARE_UNAVAILABLE') {
      return port.displayName || 'Hardware Unavailable';
    }
    
    // Get the port name part
    let portName = port.path;
    
    // For macOS, make it more readable
    if (port.path.includes('/dev/')) {
      portName = port.path.split('/dev/')[1];
    }
    
    // Add device info if available
    let deviceInfo = '';
    
    if (port.manufacturer) {
      deviceInfo = port.manufacturer;
    } else if (port.isAppleDevice) {
      deviceInfo = 'Apple Device';
    } else if (port.path.includes('usbmodem') || port.path.includes('ttyACM')) {
      deviceInfo = 'Arduino or similar';
    } else if (port.path.includes('usbserial') || port.path.includes('wchusbserial')) {
      deviceInfo = 'USB Serial';
    }
    
    // Arduino IDE style: "portName (deviceInfo)"
    if (deviceInfo) {
      return `${portName} (${deviceInfo})`;
    }
    
    return portName;
  };
  
  // Get port category for grouping and styling (like Arduino IDE)
  const getPortCategory = (port: SerialPort): string => {
    // Special case for hardware unavailable message
    if (port.path === 'HARDWARE_UNAVAILABLE') {
      return 'warning';
    }
    
    if (port.manufacturer?.toLowerCase().includes('arduino') || 
        port.path.toLowerCase().includes('arduino')) {
      return 'arduino';
    }
    
    if (port.isAppleDevice) {
      return 'apple';
    }
    
    if (port.path.toLowerCase().includes('usbmodem') || 
        port.path.toLowerCase().includes('ttyacm')) {
      return 'microcontroller';
    }
    
    if (port.path.toLowerCase().includes('usbserial') || 
        port.path.toLowerCase().includes('ttyusb')) {
      return 'serial';
    }
    
    return 'other';
  };
  
  // Style ports based on their category
  const getPortStyle = (port: SerialPort): string => {
    const category = getPortCategory(port);
    
    switch (category) {
      case 'warning':
        return 'text-red-400 font-bold';
      case 'arduino':
        return 'text-cyan-400 font-bold'; // Arduino devices
      case 'apple':
        return 'text-green-400'; // Apple devices
      case 'microcontroller':
        return 'text-yellow-400'; // Likely microcontrollers
      case 'serial':
        return 'text-orange-400'; // Serial adapters
      default:
        return '';
    }
  };

  return (
    <div className="bg-gray-900 p-4 border border-white">
      <h2 className="text-xl uppercase font-bold mb-4">Connection</h2>
      
      {/* Replit warning */}
      {showReplitWarning && (
        <div className="mb-4 p-4 border border-red-500 bg-red-500 bg-opacity-20 text-red-300">
          <h3 className="font-bold mb-2">⚠️ IMPORTANT: HARDWARE ACCESS LIMITATION</h3>
          <p className="mb-2">
            Physical hardware connections are not possible in Replit's cloud environment.
          </p>
          <p className="mb-2">
            To connect to your Arduino device, you need to download and run this application locally on your computer.
          </p>
          <p>
            1. Download the code<br />
            2. Install dependencies with <code className="bg-black px-1">npm install</code><br />
            3. Run with <code className="bg-black px-1">npm start</code><br />
            4. Open <code className="bg-black px-1">http://localhost:5000</code> in your browser
          </p>
        </div>
      )}
      
      {/* Ports section */}
      <div className="mb-4">
        <div className="flex items-center mb-2">
          <label className="uppercase text-sm font-bold mr-2 w-24">Port:</label>
          <button 
            className={`ml-auto py-1 px-2 text-xs border border-white flex items-center ${isRefreshing ? 'animate-pulse bg-white text-black' : 'hover:bg-white hover:text-black'}`}
            onClick={() => handleRefreshPorts()}
            disabled={isConnected || isRefreshing}
          >
            <span className={`mr-1 ${isRefreshing ? 'animate-spin' : ''}`}>⟳</span>
            {isRefreshing ? 'Scanning...' : 'Refresh'}
          </button>
        </div>
        
        {availablePorts.length === 0 ? (
          <div className="text-yellow-400 py-2 border border-white border-dashed pl-2">
            No ports available. Connect a device and click Refresh.
          </div>
        ) : (
          <div className="border border-white">
            {availablePorts.map(port => (
              <div 
                key={port.path} 
                className={`
                  px-3 py-2 cursor-pointer flex items-center
                  ${selectedPort === port.path ? 'bg-white text-black' : 'hover:bg-gray-800'} 
                  ${selectedPort !== port.path ? getPortStyle(port) : ''}
                  ${port.path !== availablePorts[availablePorts.length - 1].path ? 'border-b border-gray-700' : ''}
                `}
                onClick={() => !isConnected && port.path !== 'HARDWARE_UNAVAILABLE' && setSelectedPort(port.path)}
              >
                <input 
                  type="radio" 
                  id={`port-${port.path}`}
                  name="port-selection" 
                  checked={selectedPort === port.path}
                  onChange={() => setSelectedPort(port.path)}
                  disabled={isConnected || port.path === 'HARDWARE_UNAVAILABLE'}
                  className="mr-2"
                />
                <label 
                  htmlFor={`port-${port.path}`} 
                  className="flex-1 cursor-pointer"
                >
                  {formatPortDisplay(port)}
                </label>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Baud rate section */}
      <div className="mb-4">
        <div className="flex items-center mb-2">
          <label className="uppercase text-sm font-bold w-24">Baud Rate:</label>
        </div>
        
        <div className="flex flex-wrap border border-white">
          {[9600, 57600, 115200, 250000].map(rate => (
            <div
              key={rate}
              className={`
                px-3 py-2 cursor-pointer text-center 
                ${baudRate === rate ? 'bg-white text-black' : 'hover:bg-gray-800'}
                ${rate !== 250000 ? 'border-r border-gray-700' : ''}
              `}
              style={{ width: '25%' }}
              onClick={() => !isConnected && setBaudRate(rate)}
            >
              {rate}
            </div>
          ))}
        </div>
      </div>
      
      {/* Connect button */}
      <button
        className={`w-full py-3 uppercase font-bold text-center ${
          isConnected 
            ? 'bg-red-600 hover:bg-red-700' 
            : showReplitWarning
              ? 'bg-gray-500 text-gray-300 cursor-not-allowed'
              : 'bg-white text-black hover:bg-gray-200'
        }`}
        onClick={handleConnect}
        disabled={showReplitWarning && !isConnected}
      >
        {isConnected ? "Disconnect" : "Connect"}
      </button>

      {/* Connection status indicator */}
      {isConnected && (
        <div className="flex items-center mt-3 border border-green-500 p-2 bg-green-900 bg-opacity-30">
          <div className="h-3 w-3 rounded-full bg-green-500 mr-2 animate-pulse"></div>
          <span className="text-green-400">Connected to: <span className="font-mono">{currentPort}</span></span>
        </div>
      )}
      
      {/* Additional message in Replit environment */}
      {showReplitWarning && (
        <div className="mt-4 text-center text-sm text-gray-400">
          <p>This application is designed to connect to physical Arduino hardware.</p>
          <p>Running in Replit's cloud environment prevents direct hardware access.</p>
        </div>
      )}
    </div>
  );
}