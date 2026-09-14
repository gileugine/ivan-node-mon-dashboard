import LocatorPage from "@/app/store-locator/page";
import { TooltipProvider } from "@/components/ui/tooltip";

function App() {
  return (
    <TooltipProvider delay={0}>
      <LocatorPage />
    </TooltipProvider>
  );
}

export default App;