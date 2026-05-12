import { useCallback, useMemo, useState } from "react";
import { ThemeProvider, createTheme, CssBaseline } from "@mui/material";
import { TensorPcProvider } from "./context/TensorPcContext";
import { LayoutProvider } from "./context/LayoutContext";
import { FlowApp } from "./FlowApp";

export type ThemeMode = "dark" | "light";

export default function App() {
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem("tensorpc-devdock-theme");
    return saved === "light" ? "light" : "dark";
  });

  const handleThemeToggle = useCallback(() => {
    setThemeMode((current) => {
      const next = current === "dark" ? "light" : "dark";
      localStorage.setItem("tensorpc-devdock-theme", next);
      return next;
    });
  }, []);

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: themeMode,
        },
      }),
    [themeMode],
  );

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <TensorPcProvider>
        <LayoutProvider>
          <FlowApp themeMode={themeMode} onThemeToggle={handleThemeToggle} />
        </LayoutProvider>
      </TensorPcProvider>
    </ThemeProvider>
  );
}
