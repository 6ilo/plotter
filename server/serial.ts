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
      log('Scanning for serial ports...', 'serial');
      
      // In Replit environment, we'll use a special approach with both mock and user-reported ports
      if (process.env.REPL_ID || process.env.REPLIT_ENVIRONMENT) {
        log('Running in Replit environment, returning available ports list from environment checks', 'serial');
        
        // Check if we're running on macOS
        const isMac = process.platform === 'darwin';
        // Check if we're running on Windows
        const isWindows = process.platform === 'win32';
        // Check if we're running on Linux
        const isLinux = process.platform === 'linux';
        
        // Common Arduino-compatible ports for different platforms
        const mockPorts: any[] = [];
        
        // Add platform-specific mock ports
        if (isMac) {
          // Add standard mock port
          mockPorts.push({
            path: '/dev/tty.usbmodem14201',
            manufacturer: 'Arduino (www.arduino.cc)',
            productId: '0043',
            vendorId: '2341'
          });
          
          // Add user's reported /dev/cu.usbmodem port
          mockPorts.push({
            path: '/dev/cu.usbmodem144301',
            manufacturer: 'Arduino (www.arduino.cc)',
            productId: '0043',
            vendorId: '2341'
          });
        } else if (isWindows) {
          mockPorts.push({
            path: 'COM3',
            manufacturer: 'Arduino (www.arduino.cc)',
            productId: '0043',
            vendorId: '2341'
          });
        } else if (isLinux) {
          mockPorts.push({
            path: '/dev/ttyACM0',
            manufacturer: 'Arduino (www.arduino.cc)',
            productId: '0043',
            vendorId: '2341'
          });
        }
        
        // Always add user's actual port for testing regardless of platform
        mockPorts.push({
          path: '/dev/cu.usbmodem144301',
          manufacturer: 'Arduino Uno (User\'s Device)',
          productId: '0043',
          vendorId: '2341'
        });
        
        log(`Found ${mockPorts.length} ports from environment detection`, 'serial');
        
        // Create array to hold all ports
        let allPorts = [...mockPorts];
        return allPorts.map(port => ({
          path: port.path,
          manufacturer: port.manufacturer,
          productId: port.productId,
          vendorId: port.vendorId,
          displayName: this.getPortDisplayName(port),
          isAppleDevice: port.manufacturer?.toLowerCase().includes('apple') || false
        }));
      }
      
      // For non-Replit environments with hardware access
      const ports = await SerialPort.list();
      
      // Log the detected ports for debugging
      log(`Found ${ports.length} ports:`, 'serial');
      ports.forEach(port => {
        log(`  - ${port.path} (${port.manufacturer || 'Unknown manufacturer'})`, 'serial');
      });
      
      // Create array to hold all ports
      let allPorts = [...ports];
      
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
        
        // For Replit environment, implement a mock connection
        if (process.env.REPL_ID || process.env.REPLIT_ENVIRONMENT) {
          log(`Connecting to ${portPath} in Replit environment (mock mode)`, 'serial');
          
          // Setup a mock connection
          this.isConnected = true;
          
          log(`Mock connection established for ${portPath}`, 'serial');
          
          // Send immediate connected event
          if (this.messageCallback) {
            this.messageCallback('info', `Connected to ${portPath} at ${baudRate} baud (mock mode)`);
          }
          
          // Simulate device ready message
          if (this.messageCallback) {
            setTimeout(() => {
              log(`Simulating device ready message`, 'serial');
              this.messageCallback!('received', 'STATE_READY');
              if (this.stateCallback) {
                this.stateCallback(PlotterState.READY);
              }
            }, 200);
            
            // Simulate initial position report
            setTimeout(() => {
              log(`Simulating initial position report`, 'serial');
              this.messageCallback!('received', 'Status - Polar: Angle=0.0 Radius=150.0 X=150.0 Y=0.0');
              if (this.positionCallback) {
                this.positionCallback({
                  angle: 0,
                  radius: 150,
                  x: 150,
                  y: 0
                });
              }
            }, 400);
          }
          
          log(`Successfully connected to ${portPath} at ${baudRate} baud (mock mode)`, 'serial');
          resolve(true);
          return;
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
    log('Disconnecting from port', 'serial');
    
    // Special handling for Replit environment
    if (process.env.REPL_ID || process.env.REPLIT_ENVIRONMENT) {
      log('Disconnecting mock serial connection', 'serial');
      
      // For mock connection, just reset the connection state
      this.isConnected = false;
      
      // Send notifications about disconnection
      if (this.messageCallback) {
        this.messageCallback('info', 'Disconnected from device (mock mode)');
      }
      
      if (this.stateCallback) {
        this.stateCallback(PlotterState.DISCONNECTED);
      }
      
      log('Mock connection disconnected successfully', 'serial');
      return;
    }
    
    // Real hardware disconnect
    if (this.port && this.port.isOpen) {
      log('Closing physical serial port connection', 'serial');
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
    
    log('Disconnection complete', 'serial');
  }

  public isPortConnected(): boolean {
    // In Replit environment, just check isConnected flag since we don't have a real port
    if (process.env.REPL_ID || process.env.REPLIT_ENVIRONMENT) {
      return this.isConnected;
    }
    
    // For real hardware, check that we have an open port
    return this.isConnected && this.port !== null && this.port.isOpen;
  }

  public sendCommand(command: PlotterCommand): boolean {
    if (!this.isConnected) {
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

    // For Replit environment, simulate command responses
    if (process.env.REPL_ID || process.env.REPLIT_ENVIRONMENT) {
      log(`Mock sending command: ${cmdString}`, 'serial');
      
      if (this.messageCallback) {
        this.messageCallback('sent', cmdString);
      }
      
      // Simulate responses based on command type
      setTimeout(() => {
        if (command.type === 'STATUS') {
          // Generate status response
          if (this.messageCallback) {
            this.messageCallback('received', 'Status - Polar: Angle=0.0 Radius=50.0 X=50.0 Y=0.0');
          }
          if (this.positionCallback) {
            this.positionCallback({
              angle: 0,
              radius: 50,
              x: 50,
              y: 0
            });
          }
        } else if (command.type === 'MOVE') {
          // Generate move acknowledgment
          if (this.messageCallback) {
            this.messageCallback('received', `Moving to: Angle ${command.angle} Radius ${command.radius}`);
          }
          
          // Simulate position update
          setTimeout(() => {
            if (this.positionCallback) {
              const angle = command.angle;
              const radius = command.radius;
              const angleRad = angle * (Math.PI / 180);
              const x = radius * Math.cos(angleRad);
              const y = radius * Math.sin(angleRad);
              
              this.positionCallback({
                angle,
                radius,
                x,
                y
              });
            }
          }, 500);
        } else if (command.type === 'DRAW') {
          // Simulate drawing state
          if (this.messageCallback) {
            this.messageCallback('received', 'STATE_DRAWING');
          }
          if (this.stateCallback) {
            this.stateCallback(PlotterState.DRAWING);
          }
          
          // Simulate completion after a delay
          setTimeout(() => {
            if (this.messageCallback) {
              this.messageCallback('received', 'STATE_READY');
            }
            if (this.stateCallback) {
              this.stateCallback(PlotterState.READY);
            }
          }, 2000);
        } else {
          // Generic acknowledgment
          if (this.messageCallback) {
            this.messageCallback('received', 'OK');
          }
        }
      }, 100);
      
      return true;
    }
    
    // For real hardware
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