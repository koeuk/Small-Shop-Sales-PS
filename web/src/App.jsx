import { BrowserRouter, Link, Route, Routes } from "react-router-dom";
import "@fontsource/dm-sans/latin-400.css";
import "@fontsource/dm-sans/latin-500.css";
import "@fontsource/dm-sans/latin-600.css";
import "@fontsource/dm-sans/latin-700.css";
import "@fontsource/dm-sans/latin-800.css";
import "@fontsource/newsreader/latin-400.css";
import "@fontsource/newsreader/latin-400-italic.css";
import { AuthProvider, ToastProvider } from "./context";
import Layout from "./Layout";
import Dashboard from "./pages/Dashboard";
import Imports from "./pages/Imports";
import Login from "./pages/Login";
import Predictions from "./pages/Predictions";
import Products from "./pages/Products";
import Sales from "./pages/Sales";
import Training from "./pages/Training";
import Users from "./pages/Users";
import Settings from "./pages/Settings";
import { Empty } from "./components";
import "./App.css";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="/products" element={<Products />} />
              <Route path="/sales" element={<Sales />} />
              <Route path="/imports" element={<Imports />} />
              <Route path="/training" element={<Training />} />
              <Route path="/predictions" element={<Predictions />} />
              <Route path="/users" element={<Users />} />
              <Route path="/settings" element={<Settings />} />
              <Route
                path="*"
                element={
                  <Empty
                    title="A little off the path"
                    description="This page isn’t in your workspace."
                  >
                    <Link className="button primary" to="/">
                      Back to overview
                    </Link>
                  </Empty>
                }
              />
            </Route>
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
