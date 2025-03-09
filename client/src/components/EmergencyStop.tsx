import { usePlotter } from "@/hooks/usePlotter";
import { useToast } from "@/hooks/use-toast";

export default function EmergencyStop() {
  const { isConnected, sendCommand } = usePlotter();
  const { toast } = useToast();

  const handleEmergencyStop = () => {
    if (!isConnected) {
      toast({
        title: "Error",
        description: "Not connected to device",
        variant: "destructive"
      });
      return;
    }

    // Use direct API for emergency stop - this is critical
    fetch('/api/direct-command', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        command: { type: 'ESTOP' }
      })
    })
    .then(response => {
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      console.log("Emergency stop initiated via direct API");
      toast({
        title: "Emergency Stop",
        description: "Emergency stop triggered! Use RESET to clear error state.",
        variant: "destructive"
      });
    })
    .catch(err => {
      console.error("Direct API emergency stop failed, falling back to WebSocket:", err.message);
      // Fallback to WebSocket as last resort
      sendCommand({ type: 'ESTOP' });
      toast({
        title: "Emergency Stop",
        description: "Emergency stop triggered (fallback method)! Use RESET to clear error state.",
        variant: "destructive"
      });
    });
  };

  return (
    <button 
      className="bg-red-500 px-6 py-3 font-bold text-lg uppercase hover:bg-opacity-80 border-2 border-white focus:outline-none"
      onClick={handleEmergencyStop}
    >
      EMERGENCY STOP
    </button>
  );
}
