import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer } from 'ws';
import { WebSocket } from 'ws';
import { storage } from "./storage";
import { log } from "./vite";
import { plotterSerial } from "./serial";
import { ClientToServerEvents, ServerToClientEvents, PlotterState } from "@shared/types";

export async function registerRoutes(app: Express): Promise<Server> {
  // API routes
  app.get('/api/ports', async (req, res) => {
    try {
      const ports = await plotterSerial.listPorts();
      res.json(ports);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get ports' });
    }
  });

  app.get('/api/settings', async (req, res) => {
    try {
      const settings = await storage.getAllPlotterSettings();
      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get settings' });
    }
  });

  app.post('/api/settings', async (req, res) => {
    try {
      const newSettings = await storage.createPlotterSettings(req.body);
      res.status(201).json(newSettings);
    } catch (error) {
      res.status(500).json({ error: 'Failed to create settings' });
    }
  });

  // Create HTTP server
  const httpServer = createServer(app);

  // Setup WebSocket server
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws) => {
    log('WebSocket client connected', 'ws');

    // Initial state
    sendToClient(ws, 'connection_status', { 
      connected: plotterSerial.isPortConnected()
    });

    // Set up serial callbacks for this connection
    plotterSerial.setMessageCallback((type, message) => {
      sendToClient(ws, 'log_message', { type: type as any, message });
    });

    plotterSerial.setStateCallback((state) => {
      sendToClient(ws, 'plotter_state', { state });
    });
    
    plotterSerial.setPositionCallback((position) => {
      sendToClient(ws, 'plotter_position', position);
    });

    // Handle messages from client
    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message.toString());
        
        log(`Received WebSocket message: ${JSON.stringify(data)}`, 'ws');

        if (!data.type) {
          log('Invalid message format: missing type', 'ws');
          return;
        }

        switch (data.type) {
          case 'connect_to_port':
            if (data.port && data.baudRate) {
              try {
                const connected = await plotterSerial.connect(data.port, data.baudRate);
                sendToClient(ws, 'connection_status', { 
                  connected, 
                  port: data.port, 
                  baudRate: data.baudRate 
                });
                
                if (connected) {
                  sendToClient(ws, 'plotter_state', { state: PlotterState.READY });
                  sendToClient(ws, 'log_message', { 
                    type: 'info', 
                    message: `Connected to ${data.port} at ${data.baudRate} baud` 
                  });
                }
              } catch (error: any) {
                sendToClient(ws, 'error', { message: `Failed to connect: ${error.message}` });
                sendToClient(ws, 'log_message', { 
                  type: 'error', 
                  message: `Failed to connect: ${error.message}` 
                });
              }
            }
            break;

          case 'disconnect_from_port':
            plotterSerial.disconnect();
            sendToClient(ws, 'connection_status', { connected: false });
            sendToClient(ws, 'plotter_state', { state: PlotterState.DISCONNECTED });
            sendToClient(ws, 'log_message', { 
              type: 'info', 
              message: 'Disconnected from device' 
            });
            break;

          case 'refresh_ports':
            const ports = await plotterSerial.listPorts();
            sendToClient(ws, 'available_ports', ports);
            break;

          case 'send_command':
            if (!plotterSerial.isPortConnected()) {
              sendToClient(ws, 'error', { message: 'Not connected to device' });
              sendToClient(ws, 'log_message', { 
                type: 'error', 
                message: 'Not connected to device' 
              });
              return;
            }
            
            try {
              plotterSerial.sendCommand(data.command);
            } catch (error: any) {
              sendToClient(ws, 'error', { message: `Failed to send command: ${error.message}` });
              sendToClient(ws, 'log_message', { 
                type: 'error', 
                message: `Failed to send command: ${error.message}` 
              });
            }
            break;

          default:
            log(`Unknown message type: ${data.type}`, 'ws');
        }
      } catch (error) {
        log(`Error processing WebSocket message: ${error}`, 'ws');
      }
    });

    ws.on('close', () => {
      log('WebSocket client disconnected', 'ws');
    });
  });

  return httpServer;
}

function sendToClient(ws: WebSocket, event: keyof ServerToClientEvents, data: any) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: event,
      data
    }));
  }
}
