import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { LogEntry, PathPoint, PlotterCommand, PlotterState, PlotterPosition, SerialPort } from '@shared/types';
import { useToast } from '@/hooks/use-toast';

interface PlotterContextType {
  isConnected: boolean;
  currentPort: string | null;
  state: PlotterState;
  position: PlotterPosition | null;
  pathHistory: PathPoint[];
  logEntries: LogEntry[];
  connectWebSocket: () => void;
  refreshPorts: () => Promise<SerialPort[]>;
  connectToPort: (port: string, baudRate: number) => Promise<boolean>;
  disconnectFromPort: () => Promise<boolean>;
  sendCommand: (command: PlotterCommand) => void;
  clearPathHistory: () => void;
  clearLog: () => void;
}

const defaultPosition: PlotterPosition = {
  angle: 0,
  radius: 0,
  x: 0,
  y: 0
};

const PlotterContext = createContext<PlotterContextType>({
  isConnected: false,
  currentPort: null,
  state: PlotterState.DISCONNECTED,
  position: defaultPosition,
  pathHistory: [],
  logEntries: [],
  connectWebSocket: () => {},
  refreshPorts: async () => [],
  connectToPort: async () => false,
  disconnectFromPort: async () => false,
  sendCommand: () => {},
  clearPathHistory: () => {},
  clearLog: () => {}
});

export const usePlotter = () => useContext(PlotterContext);

export const PlotterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [currentPort, setCurrentPort] = useState<string | null>(null);
  const [state, setState] = useState<PlotterState>(PlotterState.DISCONNECTED);
  const [position, setPosition] = useState<PlotterPosition | null>(null);
  const [pathHistory, setPathHistory] = useState<PathPoint[]>([]);
  const [logEntries, setLogEntries] = useState<LogEntry[]>([
    { 
      type: 'info', 
      message: 'Plotter control ready. Connect to device to begin.', 
      timestamp: new Date() 
    }
  ]);
  const [availablePorts, setAvailablePorts] = useState<SerialPort[]>([]);
  
  const { toast } = useToast();
  
  // Add log entry function
  const addLogEntry = useCallback((type: string, message: string) => {
    setLogEntries(prev => [
      ...prev, 
      { 
        type: type as any, 
        message, 
        timestamp: new Date() 
      }
    ]);
  }, []);

  // Clear path history
  const clearPathHistory = useCallback(() => {
    setPathHistory([]);
    addLogEntry('info', 'Path history cleared');
  }, [addLogEntry]);

  // Clear log
  const clearLog = useCallback(() => {
    setLogEntries([]);
  }, []);

  // Refresh available serial ports - uses addLogEntry
  const refreshPorts = useCallback(async (): Promise<SerialPort[]> => {
    try {
      console.log('Refreshing ports...');
      // Always force a fresh fetch from API to ensure we get the latest ports
      const portsResponse = await fetch('/api/ports');
      
      if (!portsResponse.ok) {
        console.error('Failed to fetch ports from API:', portsResponse.statusText);
        return availablePorts;
      }
      
      const ports = await portsResponse.json();
      console.log('Ports received:', ports);
      
      // Debug raw response
      if (ports && Array.isArray(ports)) {
        console.log(`Found ${ports.length} ports in API response`);
        ports.forEach(port => {
          console.log(`Port: ${port.path}, Manufacturer: ${port.manufacturer || 'unknown'}`);
        });
      } else {
        console.error('API returned non-array response:', ports);
      }
      
      // Update state with the fresh ports
      setAvailablePorts(ports);
      
      // Also notify the backend to sync up
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
          type: 'refresh_ports'
        }));
      }
      
      addLogEntry('info', `Found ${ports.length} port(s)`);
      
      return ports;
    } catch (error) {
      console.error('Error refreshing ports:', error);
      addLogEntry('error', `Error scanning ports: ${error}`);
      return availablePorts;
    }
  }, [socket, availablePorts, addLogEntry]);

  // Connect to WebSocket server - uses refreshPorts which uses addLogEntry
  const connectWebSocket = useCallback(() => {
    console.log('CONNECTING WEBSOCKET (NEW IMPLEMENTATION)');
    
    // Close existing socket if it exists
    if (socket) {
      console.log('Closing existing socket connection');
      socket.close();
      setSocket(null);
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    console.log('WebSocket connecting to URL:', wsUrl);
    
    try {
      const newSocket = new WebSocket(wsUrl);
      console.log('WebSocket instance created');
      
      // Set socket immediately to prevent race conditions
      setSocket(newSocket);
      
      // Setup event handlers
      newSocket.addEventListener('open', () => {
        console.log('WebSocket OPEN event fired');
        
        // Request available ports
        refreshPorts().catch(error => {
          console.error('Error refreshing ports on WebSocket connect:', error);
        });
      });
      
      newSocket.addEventListener('close', (event) => {
        console.log(`WebSocket CLOSED (code: ${event.code}, reason: ${event.reason})`);
        setSocket(null);
        setIsConnected(false);
        setState(PlotterState.DISCONNECTED);
        
        // Try to reconnect after a delay if not closing intentionally
        setTimeout(() => {
          console.log('Attempting to reconnect WebSocket...');
          connectWebSocket();
        }, 3000);
      });
      
      newSocket.addEventListener('error', (event) => {
        console.error('WebSocket ERROR event:', event);
        toast({
          title: 'Connection Error',
          description: 'WebSocket connection error. Please try refreshing the page.',
          variant: 'destructive'
        });
      });
      
      newSocket.addEventListener('message', (event) => {
        console.log(`WebSocket MESSAGE received:`, event.data);
        try {
          const data = JSON.parse(event.data);
          
          if (!data.type) {
            console.error('Invalid WebSocket message format (missing type):', data);
            return;
          }
          
          console.log(`Processing message type: ${data.type}`, data);
          
          switch (data.type) {
            case 'connection_status':
              console.log('Setting connection status:', data.data.connected);
              setIsConnected(data.data.connected);
              if (data.data.connected && data.data.port) {
                setCurrentPort(data.data.port);
              } else if (!data.data.connected) {
                setCurrentPort(null);
              }
              break;
              
            case 'plotter_state':
              console.log('Setting plotter state:', data.data.state);
              setState(data.data.state);
              break;
              
            case 'plotter_position':
              console.log('Received position update:', data.data);
              setPosition(data.data);
              // Add to path history
              setPathHistory(prev => [...prev, { 
                angle: data.data.angle, 
                radius: data.data.radius 
              }]);
              break;
              
            case 'available_ports':
              console.log('Received port list from WebSocket:', data.data);
              setAvailablePorts(data.data);
              break;
              
            case 'error':
              console.error('Received error from server:', data.data.message);
              toast({
                title: 'Server Error',
                description: data.data.message,
                variant: 'destructive'
              });
              break;
              
            case 'log_message':
              console.log(`Log message (${data.data.type}): ${data.data.message}`);
              addLogEntry(
                data.data.type, 
                data.data.message
              );
              break;
              
            default:
              console.warn('Unknown message type received:', data.type);
          }
        } catch (error) {
          console.error('Error processing WebSocket message:', error, event.data);
        }
      });
      
      console.log('All WebSocket event handlers registered');
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      toast({
        title: 'Connection Error',
        description: 'Failed to establish WebSocket connection.',
        variant: 'destructive'
      });
    }
  }, [socket, toast, refreshPorts, addLogEntry]);

  // Connect to serial port
  const connectToPort = useCallback(async (port: string, baudRate: number): Promise<boolean> => {
    console.log("connectToPort called with:", { port, baudRate });
    
    if (!socket) {
      console.error("WebSocket not connected in connectToPort");
      throw new Error('WebSocket not connected');
    }
    
    console.log("WebSocket state:", socket.readyState);
    console.log("WebSocket is open:", socket.readyState === WebSocket.OPEN);
    
    const message = JSON.stringify({
      type: 'connect_to_port',
      port,
      baudRate
    });
    
    console.log("Sending message:", message);
    socket.send(message);
    
    console.log("Message sent successfully");
    return true;
  }, [socket]);

  // Disconnect from serial port
  const disconnectFromPort = useCallback(async (): Promise<boolean> => {
    if (!socket) {
      throw new Error('WebSocket not connected');
    }
    
    socket.send(JSON.stringify({
      type: 'disconnect_from_port'
    }));
    
    return true;
  }, [socket]);

  // Send command to plotter
  const sendCommand = useCallback((command: PlotterCommand) => {
    if (!socket) {
      console.error('WebSocket not connected');
      return;
    }
    
    socket.send(JSON.stringify({
      type: 'send_command',
      command
    }));
  }, [socket]);

  // Connect to WebSocket on component mount
  useEffect(() => {
    connectWebSocket();
    // This is intentional - we only want to connect once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <PlotterContext.Provider
      value={{
        isConnected,
        currentPort,
        state,
        position,
        pathHistory,
        logEntries,
        connectWebSocket,
        refreshPorts,
        connectToPort,
        disconnectFromPort,
        sendCommand,
        clearPathHistory,
        clearLog
      }}
    >
      {children}
    </PlotterContext.Provider>
  );
};
