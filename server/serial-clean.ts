import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';
import { log } from './vite';
import { PlotterState, PlotterPosition, PlotterCommand } from '@shared/types';

export interface SerialPortInfo {
  path: string;
  manufacturer?: string;
  productId?: string;
  vendorId?: string;
  displayName?: string;
  isAppleDevice?: boolean;
}

export class PlotterSerial {
  private port: SerialPort | null = null;
  private parser: ReadlineParser | null = null;
  private isConnected: boolean = false;
  private messageCallback: ((type: string, message: string) => void) | null = null;
  private stateCallback: ((state: PlotterState) => void) | null = null;
  private positionCallback: ((position: PlotterPosition) => void) | null = null;

  constructor() {}

  /**
   * List available serial ports
   */
  public async listPorts(): Promise<SerialPortInfo[]> {
    try {
      log('Scanning for serial ports...', 'serial');
      
      // In Replit environment, we can't access physical hardware
      if (process.env.REPL_ID || process.env.REPLIT_ENVIRONMENT) {
        log('IMPORTANT: Running in Replit environment - cannot access physical hardware', 'serial');
        log('This application needs to run locally on your computer to connect to physical hardware', 'serial');
        
        // Return an informative message as a port to help the user understand
        return [{
          path: 'HARDWARE_UNAVAILABLE',
          manufacturer: 'IMPORTANT: HARDWARE ACCESS UNAVAILABLE IN REPLIT',
          displayName: 'This app must be run locally to connect to physical hardware',
          isAppleDevice: false
        }];
      }
      
      // For real local environments with hardware access
      const ports = await SerialPort.list();
      
      log(`Found ${ports.length} ports:`, 'serial');
      ports.forEach(port => {
        log(`  - ${port.path} (${port.manufacturer || 'Unknown manufacturer'})`, 'serial');
      });
      
      // Create array to hold all ports
      const enhancedPorts = ports.map(port => {
        const isAppleDevice = 
          (port.manufacturer && port.manufacturer.toLowerCase().includes('apple')) ||
          (port.path && (
            port.path.toLowerCase().includes('usbmodem') || 
            port.path.toLowerCase().includes('cu.') ||
            port.path.toLowerCase().includes('tty.')
          ));
          
        const displayName = this.getPortDisplayName(port);
        
        return {
          path: port.path,
          manufacturer: port.manufacturer,
          productId: port.productId,
          vendorId: port.vendorId,
          displayName,
          isAppleDevice
        };
      });
      
      // Sort ports to prioritize likely Arduino/microcontroller ports
      return enhancedPorts.sort((a, b) => {
        // Push likely Arduino/USB serial ports to the top
        const aIsArduino = a.manufacturer?.toLowerCase().includes('arduino') || false;
        const bIsArduino = b.manufacturer?.toLowerCase().includes('arduino') || false;
        
        const aIsUSBSerial = a.path?.toLowerCase().includes('usbserial') || 
                           a.path?.toLowerCase().includes('ttyusb') ||
                           a.path?.toLowerCase().includes('ttyacm') || false;
        const bIsUSBSerial = b.path?.toLowerCase().includes('usbserial') || 
                           b.path?.toLowerCase().includes('ttyusb') ||
                           b.path?.toLowerCase().includes('ttyacm') || false;
        
        if (aIsArduino && !bIsArduino) return -1;
        if (!aIsArduino && bIsArduino) return 1;
        if (aIsUSBSerial && !bIsUSBSerial) return -1;
        if (!aIsUSBSerial && bIsUSBSerial) return 1;
        
        return 0;
      });
    } catch (error) {
      log(`Error listing serial ports: ${error}`, 'serial');
      return [{
        path: 'ERROR',
        manufacturer: 'Error scanning ports',
        displayName: `Error: ${error}`,
        isAppleDevice: false
      }];
    }
  }
  
  /**
   * Helper to create a more user-friendly display name for ports
   */
  private getPortDisplayName(port: any): string {
    let displayName = port.path;
    
    // Extract more meaningful names for macOS ports
    if (port.path.includes('/dev/tty.') || port.path.includes('/dev/cu.')) {
      // For macOS, try to get the descriptive part after the prefix
      const match = port.path.match(/\/(tty|cu)\.(.+)$/);
      if (match && match[2]) {
        displayName = match[2];
      }
    }
    
    // Add manufacturer if available
    if (port.manufacturer) {
      displayName = `${displayName} (${port.manufacturer})`;
    }
    
    return displayName;
  }

  /**
   * Connect to a serial port
   */
  public connect(portPath: string, baudRate: number = 115200): Promise<boolean> {
    return new Promise((resolve, reject) => {
      try {
        if (this.isConnected) {
          this.disconnect();
        }
        
        // In Replit environment, we can't access physical hardware
        if (process.env.REPL_ID || process.env.REPLIT_ENVIRONMENT) {
          log('Cannot connect to physical hardware in Replit environment', 'serial');
          reject(new Error('Cannot connect to physical hardware in Replit environment. This application needs to be run locally on your computer.'));
          return;
        }
        
        // Add special handling for macOS paths
        let finalPath = portPath;
        
        // For macOS, if we're given a cu.* device but tty.* is available, use tty.*
        // The cu.* (call-up) devices are for outgoing data only
        if (portPath.includes('/dev/cu.') && process.platform === 'darwin') {
          const ttyPath = portPath.replace('/dev/cu.', '/dev/tty.');
          
          // Check if the tty device exists (this is simplified)
          try {
            finalPath = ttyPath;
            log(`Using tty device ${ttyPath} instead of ${portPath}`, 'serial');
          } catch (e) {
            // If the tty version doesn't exist, we'll use the cu version
            log(`Couldn't find tty device, using ${portPath}`, 'serial');
          }
        }

        this.port = new SerialPort({
          path: finalPath,
          baudRate: baudRate,
          autoOpen: false
        });

        // Set a timeout for the open operation
        const openTimeout = process.platform === 'darwin' ? 2000 : 1000;
        const openTimer = setTimeout(() => {
          if (this.port && !this.port.isOpen) {
            log(`Timeout opening port ${finalPath}`, 'serial');
            this.port.close();
            reject(new Error('Timeout opening serial port'));
          }
        }, openTimeout);

        this.port.open((err) => {
          clearTimeout(openTimer);
          
          if (err) {
            log(`Error opening serial port: ${err.message}`, 'serial');
            
            // Special handling for common macOS error
            if (err.message && err.message.includes('Permission denied') && process.platform === 'darwin') {
              const errorMsg = 'Permission denied. On macOS, you may need to allow access to this device ' +
                              'in System Preferences > Security & Privacy > Privacy > Files and Folders.';
              log(errorMsg, 'serial');
              reject(new Error(errorMsg));
              return;
            }
            
            reject(err);
            return;
          }

          this.parser = this.port!.pipe(new ReadlineParser({ delimiter: '\n' }));
          this.setupListeners();
          this.isConnected = true;

          log(`Connected to ${finalPath} at ${baudRate} baud`, 'serial');
          
          // On macOS, some devices need a moment after connection
          if (process.platform === 'darwin') {
            setTimeout(() => {
              resolve(true);
            }, 500);
          } else {
            resolve(true);
          }
        });
      } catch (error) {
        log(`Error connecting to serial port: ${error}`, 'serial');
        reject(error);
      }
    });
  }

  /**
   * Disconnect from current port
   */
  public disconnect(): void {
    log('Disconnecting from port', 'serial');
    
    // Real hardware disconnect
    if (this.port && this.port.isOpen) {
      log('Closing serial port connection', 'serial');
      this.port.close((err) => {
        if (err) {
          log(`Error closing serial port: ${err.message}`, 'serial');
        } else {
          log('Serial port closed successfully', 'serial');
        }
      });
    } else {
      log('No open port to disconnect from', 'serial');
    }

    // Reset all connection state
    this.port = null;
    this.parser = null;
    this.isConnected = false;
    
    // Notify about disconnection through callbacks
    if (this.messageCallback) {
      this.messageCallback('info', 'Disconnected from device');
    }
    
    if (this.stateCallback) {
      this.stateCallback(PlotterState.DISCONNECTED);
    }
    
    log('Disconnection complete', 'serial');
  }

  /**
   * Check if connected to port
   */
  public isPortConnected(): boolean {
    return this.isConnected && this.port !== null && this.port.isOpen;
  }

  /**
   * Send command to device
   */
  public sendCommand(command: PlotterCommand): boolean {
    if (!this.isConnected || !this.port || !this.port.isOpen) {
      log('Cannot send command: not connected to a port', 'serial');
      return false;
    }

    let cmdString = '';

    // Convert command object to string based on type
    switch (command.type) {
      case 'MOVE':
        cmdString = `MOVE ${command.angle} ${command.radius}`;
        break;
      case 'DRAW':
      case 'SQUARE':
      case 'AREA':
      case 'STATUS':
      case 'TEST':
      case 'HOME':
      case 'ESTOP':
      case 'RESET':
        cmdString = command.type;
        break;
      case 'X':
        cmdString = `X${command.value}`;
        break;
      case 'Y':
        cmdString = `Y${command.value}`;
        break;
      case 'SPEED':
        cmdString = `SPEED ${command.angularMax} ${command.angularAccel} ${command.radialMax} ${command.radialAccel}`;
        break;
      case 'RAW':
        cmdString = command.command;
        break;
    }

    try {
      // Send the command to the device
      this.port.write(cmdString + '\n', (err) => {
        if (err) {
          log(`Error sending command: ${err.message}`, 'serial');
          if (this.messageCallback) {
            this.messageCallback('error', `Failed to send command: ${err.message}`);
          }
          return false;
        }
        
        // Log the sent command
        if (this.messageCallback) {
          this.messageCallback('sent', cmdString);
        }
        log(`Sent command: ${cmdString}`, 'serial');
      });
      return true;
    } catch (error) {
      log(`Error sending command: ${error}`, 'serial');
      if (this.messageCallback) {
        this.messageCallback('error', `Failed to send command: ${error}`);
      }
      return false;
    }
  }

  /**
   * Set callback for receiving messages
   */
  public setMessageCallback(callback: (type: string, message: string) => void): void {
    this.messageCallback = callback;
  }

  /**
   * Set callback for state changes
   */
  public setStateCallback(callback: (state: PlotterState) => void): void {
    this.stateCallback = callback;
  }

  /**
   * Set callback for position updates
   */
  public setPositionCallback(callback: (position: PlotterPosition) => void): void {
    this.positionCallback = callback;
  }

  /**
   * Set up event listeners for the serial port
   */
  private setupListeners(): void {
    if (!this.port || !this.parser) return;

    this.port.on('error', (err) => {
      log(`Serial port error: ${err.message}`, 'serial');
      if (this.messageCallback) {
        this.messageCallback('error', `Serial port error: ${err.message}`);
      }
      this.disconnect();
    });

    this.parser.on('data', (data: string) => {
      const message = data.toString().trim();
      log(`Received: ${message}`, 'serial');
      
      if (this.messageCallback) {
        this.messageCallback('received', message);
      }

      this.parseResponse(message);
    });
  }

  /**
   * Parse response from device
   */
  private parseResponse(message: string): void {
    // Check for state information
    if (message.includes('Error:')) {
      if (this.stateCallback) {
        this.stateCallback(PlotterState.ERROR);
      }
    } else if (message.includes('STATE_READY')) {
      if (this.stateCallback) {
        this.stateCallback(PlotterState.READY);
      }
    } else if (message.includes('STATE_DRAWING')) {
      if (this.stateCallback) {
        this.stateCallback(PlotterState.DRAWING);
      }
    }

    // Parse status message for position information
    if (message.includes('Status - Polar:')) {
      const angleMatch = message.match(/Angle=([0-9.]+)/);
      const radiusMatch = message.match(/Radius=([0-9.]+)/);
      const xMatch = message.match(/X=([0-9.-]+)/);
      const yMatch = message.match(/Y=([0-9.-]+)/);

      if (angleMatch && radiusMatch && xMatch && yMatch && this.positionCallback) {
        const position: PlotterPosition = {
          angle: parseFloat(angleMatch[1]),
          radius: parseFloat(radiusMatch[1]),
          x: parseFloat(xMatch[1]),
          y: parseFloat(yMatch[1])
        };
        this.positionCallback(position);
      }
    }

    // Parse move confirmation for position updates
    if (message.includes('Moving to: Angle')) {
      const angleMatch = message.match(/Angle ([0-9.]+)/);
      const radiusMatch = message.match(/Radius ([0-9.]+)/);

      if (angleMatch && radiusMatch && this.positionCallback) {
        const angle = parseFloat(angleMatch[1]);
        const radius = parseFloat(radiusMatch[1]);
        
        // Calculate X and Y from polar coordinates
        const angleRad = angle * (Math.PI / 180);
        const x = radius * Math.cos(angleRad);
        const y = radius * Math.sin(angleRad);

        const position: PlotterPosition = {
          angle,
          radius,
          x,
          y
        };
        
        this.positionCallback(position);
      }
    }
  }
}

// Create and export a singleton instance
export const plotterSerial = new PlotterSerial();