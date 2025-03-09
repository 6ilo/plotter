import { useEffect } from "react";
import { Link } from "wouter";
import Visualization from "@/components/Visualization";
import ConnectionPanel from "@/components/ConnectionPanel";
import ManualControl from "@/components/ManualControl";
import SpeedControl from "@/components/SpeedControl";
import TestPatterns from "@/components/TestPatterns";
import CommandConsole from "@/components/CommandConsole";
import LogViewer from "@/components/LogViewer";
import EmergencyStop from "@/components/EmergencyStop";
import { usePlotter } from "@/hooks/usePlotter";
import { PlotterState } from "@shared/types";
import { Button } from "@/components/ui/button";

export default function Home() {
  const { state, isConnected, connectWebSocket } = usePlotter();
  
  useEffect(() => {
    connectWebSocket();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-black text-white font-mono">
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <header className="mb-6">
          <h1 className="text-3xl font-bold tracking-tighter">POLAR PLOTTER CONTROL</h1>
          <div className="flex justify-between items-center mt-2">
            <div className="flex items-center gap-2">
              <div 
                id="connection-status" 
                className={`px-3 py-1 text-sm uppercase font-bold ${
                  isConnected ? "bg-green-600" : "bg-red-500"
                }`}
              >
                {isConnected ? "CONNECTED" : "DISCONNECTED"}
              </div>
              <div id="plotter-state" className="bg-gray-900 px-3 py-1 text-sm uppercase">
                STATE: {state || PlotterState.DISCONNECTED}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/local-download">
                <Button variant="outline" size="sm" className="border-white/50 text-white hover:bg-white/10">
                  Run Locally
                </Button>
              </Link>
              <EmergencyStop />
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left side: visualization */}
          <div className="lg:col-span-2">
            <Visualization />
          </div>

          {/* Right side: control panels */}
          <div className="flex flex-col gap-6">
            <ConnectionPanel />
            <ManualControl />
            <SpeedControl />
            <TestPatterns />
          </div>
        </div>
        
        {/* Bottom section: command console and log */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <CommandConsole />
          <LogViewer />
        </div>
      </div>
    </div>
  );
}
