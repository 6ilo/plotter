import { usePlotter } from "@/hooks/usePlotter";
import { useToast } from "@/hooks/use-toast";

export default function TestPatterns() {
  const { isConnected, sendCommand } = usePlotter();
  const { toast } = useToast();

  // Function to send commands via direct API with WebSocket fallback
  const sendDirectCommand = (command: any) => {
    console.log("Sending direct test pattern command:", command);
    
    fetch('/api/direct-command', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ command })
    })
    .then(response => {
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      if (data.success) {
        console.log("Direct API test pattern success:", data.message);
        toast({
          title: "Pattern started",
          description: `Test pattern initiated successfully`,
        });
      } else {
        throw new Error(data.error || "Failed to send command");
      }
    })
    .catch(err => {
      console.error("Direct API test pattern failed, falling back to WebSocket:", err.message);
      // Fallback to WebSocket method
      sendCommand(command);
    });
  };

  const handleTestPattern = (pattern: string) => {
    if (!isConnected) {
      toast({
        title: "Error",
        description: "Not connected to device",
        variant: "destructive"
      });
      return;
    }

    let command;
    switch (pattern) {
      case 'CIRCLE':
        command = { type: 'DRAW' };
        break;
      case 'SQUARE':
        command = { type: 'SQUARE' };
        break;
      case 'AREA':
        command = { type: 'AREA' };
        break;
      case 'TEST':
        command = { type: 'TEST' };
        break;
      default:
        return;
    }
    
    // Send via direct API
    sendDirectCommand(command);
  };

  return (
    <div className="bg-gray-900 p-4 border border-white">
      <h2 className="text-xl uppercase font-bold mb-4">Test Patterns</h2>
      <div className="grid grid-cols-2 gap-2">
        <button 
          className="bg-white text-black px-3 py-3 uppercase font-bold"
          onClick={() => handleTestPattern('CIRCLE')}
        >
          Circle
        </button>
        <button 
          className="bg-white text-black px-3 py-3 uppercase font-bold"
          onClick={() => handleTestPattern('SQUARE')}
        >
          Square
        </button>
        <button 
          className="bg-white text-black px-3 py-3 uppercase font-bold"
          onClick={() => handleTestPattern('AREA')}
        >
          Area
        </button>
        <button 
          className="bg-white text-black px-3 py-3 uppercase font-bold"
          onClick={() => handleTestPattern('TEST')}
        >
          Test Move
        </button>
      </div>
    </div>
  );
}
