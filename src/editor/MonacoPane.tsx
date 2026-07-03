import Editor, { type OnMount, type BeforeMount } from "@monaco-editor/react";
import { daedalusNoir } from "./monacoTheme";
// Monaco is heavy — this import lives here (not main.tsx) so the whole editor
// bundle loads lazily, only when a Monaco surface first opens.
import "./setupMonaco";

/**
 * Monaco surface themed as daedalus-noir. Read-oriented for v1 (the terminal is
 * where Claude edits); the pane keeps the editor calm and greyscale.
 */
export function MonacoPane({
  path,
  value,
  language,
  readOnly,
  onChange,
}: {
  path?: string;
  value: string;
  language?: string;
  readOnly?: boolean;
  onChange?: (value: string) => void;
}) {
  const beforeMount: BeforeMount = (monaco) => {
    monaco.editor.defineTheme("daedalus-noir", daedalusNoir);
  };
  const onMount: OnMount = (_editor, monaco) => {
    monaco.editor.setTheme("daedalus-noir");
  };

  return (
    <Editor
      theme="daedalus-noir"
      path={path}
      language={language}
      value={value}
      onChange={(v) => onChange?.(v ?? "")}
      beforeMount={beforeMount}
      onMount={onMount}
      options={{
        readOnly,
        fontFamily: 'var(--font-mono), "JetBrains Mono", Consolas, monospace',
        fontSize: 13,
        lineHeight: 1.6,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        smoothScrolling: true,
        renderWhitespace: "none",
        renderLineHighlight: "line",
        padding: { top: 12, bottom: 12 },
        fontLigatures: true,
        cursorBlinking: "smooth",
        scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
        overviewRulerLanes: 0,
        guides: { indentation: true },
      }}
    />
  );
}
