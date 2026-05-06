import { ThemeProvider, createTheme, CssBaseline } from "@mui/material";
import { TensorPcProvider } from "./context/TensorPcContext";
import { LayoutProvider } from "./context/LayoutContext";
import { FlowApp } from "./FlowApp";

const theme = createTheme({
  palette: {
    mode: "dark",
  },
});

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <TensorPcProvider>
        <LayoutProvider>
          <FlowApp />
        </LayoutProvider>
      </TensorPcProvider>
    </ThemeProvider>
  );
}
