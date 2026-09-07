import { Route, Routes } from "react-router-dom";
import AppShell from "./components/layout/AppShell";
import Overview from "./pages/Overview";
import NetworkLinks from "./pages/NetworkLinks";
import LinkDetail from "./pages/LinkDetail";
import Predictions from "./pages/Predictions";
import PredictionDetail from "./pages/PredictionDetail";
import Incidents from "./pages/Incidents";
import IncidentDetail from "./pages/IncidentDetail";
import Engineers from "./pages/Engineers";
import EngineerDetail from "./pages/EngineerDetail";
import NotFound from "./pages/NotFound";

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Overview />} />
        <Route path="links" element={<NetworkLinks />} />
        <Route path="links/:linkId" element={<LinkDetail />} />
        <Route path="predictions" element={<Predictions />} />
        <Route path="predictions/:predictionId" element={<PredictionDetail />} />
        <Route path="incidents" element={<Incidents />} />
        <Route path="incidents/:incidentId" element={<IncidentDetail />} />
        <Route path="engineers" element={<Engineers />} />
        <Route path="engineers/:engineerId" element={<EngineerDetail />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
