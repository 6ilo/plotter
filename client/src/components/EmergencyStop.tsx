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

    sendCommand({ type: 'ESTOP' });
    toast({
      title: "Emergency Stop",
      description: "Emergency stop triggered! Use RESET to clear error state.",
      variant: "destructive"
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
