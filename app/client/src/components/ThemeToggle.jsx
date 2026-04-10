import { useTheme } from "../context/ThemeContext.jsx";

export default function ThemeToggle({ style }) {
  const { theme, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      style={{
        width: 36, height: 36,
        borderRadius: 10,
        background: "var(--paper-warm)",
        border: "1px solid var(--line)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 16, cursor: "pointer",
        transition: "background 0.18s ease",
        ...style,
      }}
    >
      {theme === "dark" ? "☀" : "☽"}
    </button>
  );
}
