import { HashRouter, Navigate, Route, Routes } from "react-router";
import { AppShell } from "./components/AppShell";
import { Auth } from "./screens/Auth";
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
      <Routes>
        <Route path="/" element={<Navigate to="/welcome" replace />} />
        <Route path="/welcome" element={<Welcome />} />
        <Route path="/wizard/:toolId" element={<Wizard />} />
        <Route path="/auth/:toolId" element={<Auth />} />
        <Route path="/success/:toolId" element={<Success />} />
        <Route element={<AppShell />}>
          <Route path="/catalog" element={<Catalog />} />
          <Route path="/plugins" element={<Plugins />} />
          <Route path="/tools" element={<Dashboard />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
