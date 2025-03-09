import { useState } from "react";
import { usePlotter } from "@/hooks/usePlotter";
import { useToast } from "@/hooks/use-toast";

export default function SpeedControl() {
  const [angularMax, setAngularMax] = useState<number>(600);
  const [angularAccel, setAngularAccel] = useState<number>(150);
  const [radialMax, setRadialMax] = useState<number>(600);
  const [radialAccel, setRadialAccel] = useState<number>(150);
  
  const { isConnected, sendCommand } = usePlotter();
  const { toast } = useToast();

  const handleUpdateSpeed = () => {
    if (!isConnected) {
      toast({
        title: "Error",
        description: "Not connected to device",
        variant: "destructive"
      });
      return;
    }

    if (!angularMax || !angularAccel || !radialMax || !radialAccel) {
      toast({
        title: "Error",
        description: "All speed parameters are required",
        variant: "destructive"
      });
      return;
    }

    sendCommand({
      type: 'SPEED',
      angularMax,
      angularAccel,
      radialMax,
      radialAccel
    });
  };

  return (
    <div className="bg-gray-900 p-4 border border-white">
      <h2 className="text-xl uppercase font-bold mb-4">Speed Settings</h2>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="block text-sm mb-1">Angular Max</label>
          <input 
            type="number" 
            className="bg-black text-white border border-white px-3 py-2 w-full"
            value={angularMax}
            onChange={(e) => setAngularMax(parseInt(e.target.value))}
            min={1}
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Angular Accel</label>
          <input 
            type="number" 
            className="bg-black text-white border border-white px-3 py-2 w-full"
            value={angularAccel}
            onChange={(e) => setAngularAccel(parseInt(e.target.value))}
            min={1}
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Radial Max</label>
          <input 
            type="number" 
            className="bg-black text-white border border-white px-3 py-2 w-full"
            value={radialMax}
            onChange={(e) => setRadialMax(parseInt(e.target.value))}
            min={1}
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Radial Accel</label>
          <input 
            type="number" 
            className="bg-black text-white border border-white px-3 py-2 w-full"
            value={radialAccel}
            onChange={(e) => setRadialAccel(parseInt(e.target.value))}
            min={1}
          />
        </div>
      </div>
      <button 
        className="bg-white text-black px-3 py-2 uppercase w-full font-bold"
        onClick={handleUpdateSpeed}
      >
        UPDATE SPEED
      </button>
    </div>
  );
}
