import { useState } from "react";
import { usePlotter } from "@/hooks/usePlotter";
import { useToast } from "@/hooks/use-toast";

export default function CommandConsole() {
  const [command, setCommand] = useState<string>("");
  
  const { isConnected, sendCommand } = usePlotter();
  const { toast } = useToast();

  const handleSendCommand = () => {
    if (!isConnected) {
      toast({
        title: "Error",
        description: "Not connected to device",
        variant: "destructive"
      });
      return;
    }

    if (!command.trim()) {
      toast({
        title: "Error",
        description: "No command entered",
        variant: "destructive"
      });
      return;
    }

    sendCommand({ type: 'RAW', command: command.trim() });
    setCommand("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSendCommand();
    }
  };

  return (
    <div className="bg-gray-900 p-4 border border-white">
      <h2 className="text-xl uppercase font-bold mb-4">Command Console</h2>
      <div className="flex gap-2 mb-3">
        <input 
          type="text" 
          className="bg-black text-white border border-white px-3 py-2 w-full uppercase" 
          placeholder="Enter command..."
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button 
          className="bg-white text-black px-3 py-2 uppercase font-bold"
          onClick={handleSendCommand}
        >
          Send
        </button>
      </div>
      <div className="text-xs opacity-70 mb-1">
        Available commands: MOVE, DRAW, SQUARE, AREA, X/Y, STATUS, TEST, SPEED, HOME, ESTOP, RESET
      </div>
    </div>
  );
}
