import { HashRouter, Navigate, Route, Routes } from "react-router";
import { AppShell } from "./components/AppShell";
import { AppUpdateProvider } from "./lib/appUpdateContext";
import { Catalog } from "./screens/Catalog";
import { Dashboard } from "./screens/Dashboard";
import { Plugins } from "./screens/Plugins";
import { Settings } from "./screens/Settings";
import { Success } from "./screens/Success";
import { Welcome } from "./screens/Welcome";
import { Wizard } from "./screens/Wizard";

export default function App() {
  return (
    <HashRouter>
      {/* Provider가 App 루트에 마운트되며 앱 시작 시 업데이트를 1회 확인한다(화면 무관) */}
      <AppUpdateProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/welcome" replace />} />
          <Route path="/welcome" element={<Welcome />} />
          <Route path="/wizard/:toolId" element={<Wizard />} />
          <Route path="/success/:toolId" element={<Success />} />
          <Route element={<AppShell />}>
            <Route path="/catalog" element={<Catalog />} />
            <Route path="/plugins" element={<Plugins />} />
            <Route path="/tools" element={<Dashboard />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Routes>
      </AppUpdateProvider>
    </HashRouter>
  );
}
