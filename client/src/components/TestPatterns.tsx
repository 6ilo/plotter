import { usePlotter } from "@/hooks/usePlotter";
import { useToast } from "@/hooks/use-toast";

export default function TestPatterns() {
  const { isConnected, sendCommand } = usePlotter();
  const { toast } = useToast();

  const handleTestPattern = (pattern: string) => {
    if (!isConnected) {
      toast({
        title: "Error",
        description: "Not connected to device",
        variant: "destructive"
      });
      return;
    }

    switch (pattern) {
      case 'CIRCLE':
        sendCommand({ type: 'DRAW' });
        break;
      case 'SQUARE':
        sendCommand({ type: 'SQUARE' });
        break;
      case 'AREA':
        sendCommand({ type: 'AREA' });
        break;
      case 'TEST':
        sendCommand({ type: 'TEST' });
        break;
    }
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
