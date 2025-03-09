// Plotter Command Types
export type PlotterCommand = 
  | { type: 'MOVE', angle: number, radius: number }
  | { type: 'DRAW' }
  | { type: 'SQUARE' }
  | { type: 'AREA' }
  | { type: 'X', value: number }
  | { type: 'Y', value: number }
  | { type: 'STATUS' }
  | { type: 'TEST' }
  | { type: 'SPEED', angularMax: number, angularAccel: number, radialMax: number, radialAccel: number }
  | { type: 'HOME' }
  | { type: 'ESTOP' }
  | { type: 'RESET' }
  | { type: 'RAW', command: string };

// Plotter State Types
export enum PlotterState {
  READY = "STATE_READY",
  DRAWING = "STATE_DRAWING",
  ERROR = "STATE_ERROR",
  DISCONNECTED = "DISCONNECTED"
}

// Plotter Position
export interface PlotterPosition {
  angle: number;
  radius: number;
  x: number;
  y: number;
}

// Serial Ports
export interface SerialPort {
  path: string;
  manufacturer?: string;
  productId?: string;
  vendorId?: string;
}

// WebSocket Message Types
export type ServerToClientEvents = {
  connection_status: { connected: boolean, port?: string, baudRate?: number };
  plotter_state: { state: PlotterState };
  plotter_position: PlotterPosition;
  available_ports: SerialPort[];
  error: { message: string };
  log_message: { type: 'sent' | 'received' | 'error' | 'info' | 'warning', message: string };
};

export type ClientToServerEvents = {
  connect_to_port: { port: string, baudRate: number };
  disconnect_from_port: {};
  refresh_ports: {};
  send_command: PlotterCommand;
};

// Log Entry
export interface LogEntry {
  type: 'sent' | 'received' | 'error' | 'info' | 'warning';
  message: string;
  timestamp: Date;
}

// Path History Point
export interface PathPoint {
  angle: number;
  radius: number;
}
