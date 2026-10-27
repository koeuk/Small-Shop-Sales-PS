import { useCallback, useContext, useEffect, useState } from "react";
import { api } from "./api";
import { AuthContext, ToastContext } from "./contexts";

export const useAuth = () => useContext(AuthContext);
export const useToast = () => useContext(ToastContext);

export function useResource(path) {
  const [state, setState] = useState({ key: null, data: null, error: "" });
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((value) => value + 1), []);
  const key = `${path}:${version}`;
  useEffect(() => {
    const controller = new AbortController();
    api(path, { signal: controller.signal })
      .then((value) => {
        if (!controller.signal.aborted)
          setState({ key, data: value, error: "" });
      })
      .catch((error) => {
        if (error.name !== "AbortError" && !controller.signal.aborted)
          setState((current) => ({ ...current, key, error: error.message }));
      });
    return () => controller.abort();
  }, [path, key]);
  return {
    data: state.data,
    loading: state.key !== key,
    error: state.key === key ? state.error : "",
    reload,
  };
}
