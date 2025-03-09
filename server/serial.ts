import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';
import { log } from './vite';
import { PlotterState, PlotterPosition, PlotterCommand } from '@shared/types';

export interface SerialPortInfo {
  path: string;
  manufacturer?: string;
  productId?: string;
  vendorId?: string;
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
      const ports = await SerialPort.list();
      return ports.map(port => ({
        path: port.path,
        manufacturer: port.manufacturer,
        productId: port.productId,
        vendorId: port.vendorId,
      }));
    } catch (error) {
      log(`Error listing serial ports: ${error}`, 'serial');
      return [];
    }
  }

  public connect(portPath: string, baudRate: number = 115200): Promise<boolean> {
    return new Promise((resolve, reject) => {
      try {
        if (this.isConnected) {
          this.disconnect();
        }

        this.port = new SerialPort({
          path: portPath,
          baudRate: baudRate,
          autoOpen: false
        });

        this.port.open((err) => {
          if (err) {
            log(`Error opening serial port: ${err.message}`, 'serial');
            reject(err);
            return;
          }

          this.parser = this.port!.pipe(new ReadlineParser({ delimiter: '\n' }));
          this.setupListeners();
          this.isConnected = true;

          log(`Connected to ${portPath} at ${baudRate} baud`, 'serial');
          resolve(true);
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
