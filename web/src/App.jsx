import { BrowserRouter, Link, Route, Routes } from "react-router-dom";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/600.css";
import "@fontsource/dm-sans/700.css";
import "@fontsource/newsreader/400.css";
import "@fontsource/newsreader/400-italic.css";
import { AuthProvider, ToastProvider } from "./context";
import Layout from "./Layout";
import Dashboard from "./pages/Dashboard";
import Imports from "./pages/Imports";
import Login from "./pages/Login";
import Predictions from "./pages/Predictions";
import Products from "./pages/Products";
import Sales from "./pages/Sales";
import Training from "./pages/Training";
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
