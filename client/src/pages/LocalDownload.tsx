import { Button } from "@/components/ui/button";

export default function LocalDownload() {
  return (
    <div className="container mx-auto px-4 py-10 max-w-4xl">
      <div className="bg-slate-900 p-6 md:p-10 rounded-lg border border-white/10">
        <h1 className="text-3xl md:text-4xl font-bold mb-6">Run This Application Locally</h1>
        
        <div className="flex items-center mb-6 bg-red-900/30 border border-red-500 p-3 rounded">
          <div className="text-red-300 mr-2 text-3xl">⚠️</div>
          <div className="text-red-300">
            <p className="font-bold">Hardware Access Limitation</p>
            <p>Physical hardware connections are not possible in Replit's cloud environment. To connect to your Arduino devices, follow the instructions below to run this application locally.</p>
          </div>
        </div>
        
        <h2 className="text-xl font-bold mb-4">Why Run Locally?</h2>
        <p className="mb-6">
          This application is designed to connect directly to physical Arduino hardware through USB/serial ports. 
          Since Replit runs in the cloud, it cannot access hardware connected to your computer. 
          To use all features with your actual Arduino polar plotter, you need to run this application on your local machine.
        </p>
        
        <h2 className="text-xl font-bold mb-4">System Requirements</h2>
        <ul className="list-disc pl-6 mb-6 space-y-2">
          <li>Node.js (v18+) installed on your computer</li>
          <li>npm (usually comes with Node.js)</li>
          <li>Git (optional, for cloning the repository)</li>
          <li>Arduino with polar plotter firmware installed</li>
          <li>USB cable to connect your Arduino to your computer</li>
        </ul>
        
        <h2 className="text-xl font-bold mb-4">Download Instructions</h2>
        <div className="mb-6 space-y-6">
          <div className="bg-slate-800 p-4 rounded">
            <h3 className="font-bold text-lg mb-2">Option 1: Clone from GitHub</h3>
            <p className="mb-2">If you've pushed this project to GitHub, you can clone it:</p>
            <div className="bg-black p-3 rounded font-mono text-sm overflow-x-auto">
              git clone https://github.com/yourusername/polar-plotter.git<br />
              cd polar-plotter
            </div>
          </div>
          
          <div className="bg-slate-800 p-4 rounded">
            <h3 className="font-bold text-lg mb-2">Option 2: Download ZIP</h3>
            <p className="mb-2">You can download a ZIP file of this project from Replit:</p>
            <ol className="list-decimal pl-6 space-y-1">
              <li>Click the three dots menu in Replit's files panel</li>
              <li>Select "Download as zip"</li>
              <li>Unzip the file on your computer</li>
              <li>Open a terminal and navigate to the unzipped folder</li>
            </ol>
          </div>
        </div>
        
        <h2 className="text-xl font-bold mb-4">Installation Steps</h2>
        <div className="bg-black p-4 rounded font-mono text-sm mb-6 overflow-x-auto whitespace-pre">
{`# Install dependencies
npm install

# Start the application
npm run dev

# The application will be available at http://localhost:5000`}
        </div>
        
        <h2 className="text-xl font-bold mb-4">Connecting to Your Arduino</h2>
        <ol className="list-decimal pl-6 mb-6 space-y-2">
          <li>Connect your Arduino to your computer via USB</li>
          <li>Open the application in your browser at <code className="bg-slate-800 px-1">http://localhost:5000</code></li>
          <li>In the Connection panel, click "Refresh" to see available ports</li>
          <li>Select your Arduino port (typically named something like "/dev/ttyUSB0", "/dev/ttyACM0", or "COM3")</li>
          <li>Select the appropriate baud rate (usually 115200 for the polar plotter)</li>
          <li>Click "Connect"</li>
        </ol>
        
        <h2 className="text-xl font-bold mb-4">Troubleshooting</h2>
        <div className="space-y-4 mb-6">
          <div>
            <h3 className="font-bold">Port not showing up?</h3>
            <ul className="list-disc pl-6">
              <li>Make sure your Arduino is properly connected</li>
              <li>You may need to install drivers for your Arduino</li>
              <li>On macOS, you might need to allow access in System Preferences → Security & Privacy</li>
              <li>On Linux, you might need to add your user to the "dialout" group</li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-bold">Permission errors?</h3>
            <ul className="list-disc pl-6">
              <li>On Linux/macOS: <code className="bg-slate-800 px-1">sudo chmod a+rw /dev/ttyUSB0</code> (replace with your port)</li>
              <li>On Windows: Make sure you're running as administrator</li>
            </ul>
          </div>
        </div>
        
        <div className="flex justify-center">
          <a href="/" className="inline-flex">
            <Button size="lg" className="bg-white text-black hover:bg-gray-200">
              Return to Application
            </Button>
          </a>
        </div>
      </div>
    </div>
  );
}