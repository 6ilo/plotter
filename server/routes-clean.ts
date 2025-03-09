import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer } from 'ws';
import { WebSocket } from 'ws';
import { storage } from "./storage";
import { log } from "./vite";
import { plotterSerial } from "./serial-clean";
import { ClientToServerEvents, ServerToClientEvents, PlotterState } from "@shared/types";

export async function registerRoutes(app: Express): Promise<Server> {
  // Create HTTP server
  const httpServer = createServer(app);

  // Setup WebSocket server
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  // API routes
  app.get('/api/ports', async (req, res) => {
    try {
      const ports = await plotterSerial.listPorts();
      res.json(ports);
    } catch (error: any) {
      res.status(500).json({ 
        error: 'Failed to get ports', 
        message: error.message 
      });
    }
  });
  
  // Direct connect endpoint
  app.post('/api/direct-connect', async (req, res) => {
    try {
      log(`Direct connect request received: ${JSON.stringify(req.body)}`, 'api');
      const { port, baudRate } = req.body;
      
      if (!port) {
        log('Direct connect failed: Missing port', 'api');
        return res.status(400).json({ 
          success: false, 
          error: 'Port is required' 
        });
      }
      
      const rate = baudRate || 115200;
      log(`Attempting direct connection to ${port} at ${rate} baud`, 'api');
      
      try {
        const connected = await plotterSerial.connect(port, rate);
        log(`Connection result: ${connected ? 'SUCCESS' : 'FAILED'}`, 'api');
        
        if (connected) {
          // Broadcast connection to all WebSocket clients
          wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
              log('Broadcasting connection status to WebSocket client', 'api');
              sendToClient(client, 'connection_status', {
                connected: true,
                port: port,
                baudRate: rate
              });
              sendToClient(client, 'plotter_state', { state: PlotterState.READY });
              sendToClient(client, 'log_message', {
                type: 'info',
                message: `Connected to ${port} at ${rate} baud`
              });
            }
          });
          
          return res.json({ 
            success: true, 
            message: `Connected to ${port} at ${rate} baud` 
          });
        } else {
          return res.status(500).json({ 
            success: false, 
            error: 'Failed to connect' 
          });
        }
      } catch (connError) {
        log(`Connection error: ${connError}`, 'api');
        
        // If running in Replit, provide a clear explanation about hardware limitations
        if (process.env.REPL_ID || process.env.REPLIT_ENVIRONMENT) {
          return res.status(503).json({
            success: false,
            error: 'Cannot connect to physical hardware in Replit',
            message: 'Physical hardware connections are not possible in a cloud environment. To connect to your Arduino, you need to run this application locally on your computer.',
            needsLocalDownload: true
          });
        }
        
        return res.status(500).json({ 
          success: false, 
          error: `Failed to connect: ${connError.message}` 
        });
      }
    } catch (error: any) {
      log(`Direct connect error: ${error.message}`, 'api');
      res.status(500).json({ 
        success: false, 
        error: error.message || 'An unknown error occurred' 
      });
    }
  });
  
  // Direct disconnect endpoint
  app.post('/api/direct-disconnect', (req, res) => {
    try {
      log('Direct disconnect request received', 'api');
      plotterSerial.disconnect();
      log('Device disconnected successfully via direct API', 'api');
      
      // Broadcast disconnection to all WebSocket clients
      wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          log('Broadcasting disconnection status to WebSocket client', 'api');
          sendToClient(client, 'connection_status', { connected: false });
          sendToClient(client, 'plotter_state', { state: PlotterState.DISCONNECTED });
          sendToClient(client, 'log_message', {
            type: 'info',
            message: 'Disconnected from device'
          });
        }
      });
      
      res.json({ success: true, message: 'Disconnected successfully' });
    } catch (error: any) {
      log(`Direct disconnect error: ${error.message}`, 'api');
      res.status(500).json({ 
        success: false, 
        error: error.message || 'An unknown error occurred' 
      });
    }
  });
  
  // Direct command endpoint
  app.post('/api/direct-command', (req, res) => {
    try {
      log(`Direct command request received: ${JSON.stringify(req.body)}`, 'api');
      const { command } = req.body;
      
      if (!command) {
        log('Direct command failed: Missing command data', 'api');
        return res.status(400).json({ 
          success: false, 
          error: 'Command data is required' 
        });
      }
      
      // Check if connected to a port
      if (!plotterSerial.isPortConnected()) {
        // If running in Replit, explain the hardware limitation
        if (process.env.REPL_ID || process.env.REPLIT_ENVIRONMENT) {
          return res.status(503).json({
            success: false,
            error: 'Cannot send commands to physical hardware in Replit',
            message: 'To send commands to your Arduino, you need to run this application locally on your computer.',
            needsLocalDownload: true
          });
        }
        
        log('Direct command failed: Not connected to device', 'api');
        return res.status(400).json({ 
          success: false, 
          error: 'Not connected to device' 
        });
      }
      
      const success = plotterSerial.sendCommand(command);
      if (success) {
        log(`Command sent successfully via direct API: ${JSON.stringify(command)}`, 'api');
        return res.json({ 
          success: true, 
          message: 'Command sent successfully' 
        });
      } else {
        return res.status(500).json({ 
          success: false, 
          error: 'Failed to send command' 
        });
      }
    } catch (error: any) {
      log(`Direct command error: ${error.message}`, 'api');
      res.status(500).json({ 
        success: false, 
        error: error.message || 'An unknown error occurred' 
      });
    }
  });

  // Settings endpoints
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
  
  // Download endpoint for local version
  app.get('/api/download-local', (req, res) => {
    res.json({
      message: 'To connect to physical hardware, download the local version',
      downloadUrl: '#', // You would provide a real URL in a production app
      instructions: [
        'Download the application to your local computer',
        'Unzip and open a terminal in the project directory',
        'Run "npm install" to install dependencies',
        'Run "npm start" to start the application',
        'Open http://localhost:5000 in your web browser',
        'You should now be able to connect to your Arduino device'
      ]
    });
  });

  // WebSocket handler
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
            log(`Received connect_to_port message with data: ${JSON.stringify(data)}`, 'ws');
            if (data.port && data.baudRate) {
              log(`Attempting to connect to ${data.port} at ${data.baudRate} baud`, 'ws');
              try {
                const connected = await plotterSerial.connect(data.port, data.baudRate);
                log(`Connection result: ${connected}`, 'ws');
                
                sendToClient(ws, 'connection_status', { 
                  connected, 
                  port: data.port, 
                  baudRate: data.baudRate 
                });
                
                if (connected) {
                  log(`Port ${data.port} connected successfully, sending state update`, 'ws');
                  sendToClient(ws, 'plotter_state', { state: PlotterState.READY });
                  sendToClient(ws, 'log_message', { 
                    type: 'info', 
                    message: `Connected to ${data.port} at ${data.baudRate} baud` 
                  });
                }
              } catch (error: any) {
                log(`Connection error: ${error.message}`, 'ws');
                sendToClient(ws, 'error', { message: `Failed to connect: ${error.message}` });
                sendToClient(ws, 'log_message', { 
                  type: 'error', 
                  message: `Failed to connect: ${error.message}` 
                });
                
                // If running in Replit, provide a helpful explanation
                if (process.env.REPL_ID || process.env.REPLIT_ENVIRONMENT) {
                  sendToClient(ws, 'log_message', { 
                    type: 'info', 
                    message: 'Physical hardware connections are not possible in Replit. To connect to your Arduino, download and run this application locally on your computer.' 
                  });
                }
              }
            } else {
              log(`Invalid connect_to_port message: missing port or baudRate`, 'ws');
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
              
              // If running in Replit, provide helpful information
              if (process.env.REPL_ID || process.env.REPLIT_ENVIRONMENT) {
                sendToClient(ws, 'log_message', { 
                  type: 'info', 
                  message: 'To connect to physical hardware, run this application locally on your computer.' 
                });
              }
              return;
            }
            
            try {
              const success = plotterSerial.sendCommand(data.command);
              if (!success) {
                sendToClient(ws, 'error', { message: 'Failed to send command' });
                sendToClient(ws, 'log_message', { 
                  type: 'error', 
                  message: 'Failed to send command' 
                });
              }
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

/**
 * Helper function to send data to WebSocket client
 */
function sendToClient(ws: WebSocket, event: keyof ServerToClientEvents, data: any) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: event,
      data
    }));
  }
}