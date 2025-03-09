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

  public async listPorts(): Promise<SerialPortInfo[]> {
    try {
      // Try to get real ports first
      const ports = await SerialPort.list();
      
      // Include mock ports for demo in Replit environment (or when no real ports available)
      const includeMockPorts = ports.length === 0 || process.env.NODE_ENV !== 'production';
      
      // Create array to hold all ports (real + mock if needed)
      let allPorts = [...ports];
      
      // Add mock ports for demonstration when no real hardware is connected
      if (includeMockPorts) {
        const mockPorts = [
          {
            path: '/dev/tty.usbmodem14201',
            manufacturer: 'Arduino (www.arduino.cc)',
            productId: '0043',
            vendorId: '2341'
          },
          {
            path: '/dev/cu.usbserial-A6004byf',
            manufacturer: 'FTDI',
            productId: '6001',
            vendorId: '0403'
          },
          {
            path: '/dev/tty.wchusbserial14240',
            manufacturer: 'wch.cn',
            productId: '55d4',
            vendorId: '1a86'
          },
          {
            path: '/dev/tty.Bluetooth-Incoming-Port',
            manufacturer: 'Apple Inc.',
            productId: '8006',
            vendorId: '05ac'
          },
          {
            path: 'COM3',
            manufacturer: 'Microsoft',
            productId: '7523',
            vendorId: '1a86'
          }
        ];
        
        // Add the mock ports to our list
        allPorts = [...allPorts, ...mockPorts];
      }
      
      // Get a more user-friendly port list with better detection for Apple devices
      const enhancedPorts = allPorts.map(port => {
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
        const aIsFTDI = a.manufacturer?.toLowerCase().includes('ftdi') || 
                        (a.path?.toLowerCase().includes('tty.usbserial') || false);
        const bIsFTDI = b.manufacturer?.toLowerCase().includes('ftdi') || 
                        (b.path?.toLowerCase().includes('tty.usbserial') || false);
        
        const aIsArduino = a.manufacturer?.toLowerCase().includes('arduino') || 
                          (a.path?.toLowerCase().includes('arduino') || false);
        const bIsArduino = b.manufacturer?.toLowerCase().includes('arduino') || 
                          (b.path?.toLowerCase().includes('arduino') || false);
        
        const aIsCH340 = a.manufacturer?.toLowerCase().includes('ch340') || 
                        (a.path?.toLowerCase().includes('wchusbserial') || false);
        const bIsCH340 = b.manufacturer?.toLowerCase().includes('ch340') || 
                        (b.path?.toLowerCase().includes('wchusbserial') || false);
        
        if (aIsArduino && !bIsArduino) return -1;
        if (!aIsArduino && bIsArduino) return 1;
        if (aIsFTDI && !bIsFTDI) return -1;
        if (!aIsFTDI && bIsFTDI) return 1;
        if (aIsCH340 && !bIsCH340) return -1;
        if (!aIsCH340 && bIsCH340) return 1;
        
        return 0;
      });
    } catch (error) {
      log(`Error listing serial ports: ${error}`, 'serial');
      return [];
    }
  }
  
  // Helper to create a more user-friendly display name for ports
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

  public connect(portPath: string, baudRate: number = 115200): Promise<boolean> {
    return new Promise((resolve, reject) => {
      try {
        if (this.isConnected) {
          this.disconnect();
        }
        
        // Add special handling for macOS paths
        let finalPath = portPath;
        
        // For macOS, if we're given a cu.* device but tty.* is available, use tty.*
        // The cu.* (call-up) devices are for outgoing data only
        if (portPath.includes('/dev/cu.') && process.platform === 'darwin') {
          const ttyPath = portPath.replace('/dev/cu.', '/dev/tty.');
          
          // Check if the tty device exists (this is simplified - in a real app we'd check if the file exists)
          try {
            // For simplicity, we're assuming the tty version exists
            // In a full implementation, you'd check the file exists
            // Fallback to cu.* only if tty.* doesn't exist
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

        // For Apple Silicon Macs, some devices need a longer timeout
        const openTimeout = process.platform === 'darwin' ? 2000 : 1000;
        
        // Set a timeout for the open operation
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
            if (err.message && 
                err.message.includes('Permission denied') && 
                process.platform === 'darwin') {
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
          
          // On macOS, some devices need a moment after connection before they're ready
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

  public disconnect(): void {
    if (this.port && this.port.isOpen) {
      this.port.close((err) => {
        if (err) {
          log(`Error closing serial port: ${err.message}`, 'serial');
        } else {
          log('Serial port closed', 'serial');
        }
      });
    }

    this.port = null;
    this.parser = null;
    this.isConnected = false;
  }

  public isPortConnected(): boolean {
    return this.isConnected && this.port !== null && this.port.isOpen;
  }

  public sendCommand(command: PlotterCommand): boolean {
    if (!this.isPortConnected()) {
      log('Cannot send command: not connected to a port', 'serial');
      return false;
    }

    let cmdString = '';

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
      this.port!.write(cmdString + '\n', (err) => {
        if (err) {
          log(`Error sending command: ${err.message}`, 'serial');
          if (this.messageCallback) {
            this.messageCallback('error', `Failed to send command: ${err.message}`);
          }
          return false;
        }
        
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

  public setMessageCallback(callback: (type: string, message: string) => void): void {
    this.messageCallback = callback;
  }

  public setStateCallback(callback: (state: PlotterState) => void): void {
    this.stateCallback = callback;
  }

  public setPositionCallback(callback: (position: PlotterPosition) => void): void {
    this.positionCallback = callback;
  }

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
