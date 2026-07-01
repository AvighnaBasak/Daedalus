import { useCallback, useEffect, useState } from "react";
import { ChevronRight, File as FileIcon, Folder, FolderOpen, RotateCw } from "lucide-react";
import { listDir, type DirEntry } from "@/lib/files";
import { cn } from "@/lib/cn";

export function FileTree({
  rootPath,
  activePath,
  onOpen,
}: {
  rootPath: string;
  activePath?: string;
  onOpen: (entry: DirEntry) => void;
}) {
  const [roots, setRoots] = useState<DirEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [children, setChildren] = useState<Record<string, DirEntry[]>>({});

  const loadRoot = useCallback(() => {
    setError(null);
    listDir(rootPath)
      .then(setRoots)
      .catch((e) => setError(String(e)));
  }, [rootPath]);

  useEffect(() => {
    loadRoot();
    setExpanded(new Set());
    setChildren({});
  }, [loadRoot]);

  const toggle = useCallback(
    async (entry: DirEntry) => {
      setExpanded((prev) => {
        const next = new Set(prev);
        if (next.has(entry.path)) next.delete(entry.path);
        else next.add(entry.path);
        return next;
      });
      if (!children[entry.path]) {
        try {
          const kids = await listDir(entry.path);
          setChildren((prev) => ({ ...prev, [entry.path]: kids }));
        } catch {
          /* ignore unreadable dir */
        }
      }
    },
    [children],
  );

  const renderNodes = (entries: DirEntry[], depth: number) =>
    entries.map((entry) => (
      <div key={entry.path}>
        <Row
          entry={entry}
          depth={depth}
          expanded={expanded.has(entry.path)}
          active={entry.path === activePath}
          onClick={() => (entry.is_dir ? toggle(entry) : onOpen(entry))}
        />
        {entry.is_dir && expanded.has(entry.path) && children[entry.path] && (
          <div>{renderNodes(children[entry.path], depth + 1)}</div>
        )}
      </div>
    ));

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-8 shrink-0 items-center justify-between border-b border-border px-2">
        <span className="mono-label truncate">Files</span>
        <button
          onClick={loadRoot}
          className="text-text-disabled hover:text-text"
          aria-label="Refresh files"
        >
          <RotateCw size={12} />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto py-1">
        {error ? (
          <p className="px-3 py-2 text-[11px] text-text-muted">{error}</p>
        ) : (
          renderNodes(roots, 0)
        )}
      </div>
    </div>
  );
}

function Row({
  entry,
  depth,
  expanded,
  active,
  onClick,
}: {
  entry: DirEntry;
  depth: number;
  expanded: boolean;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-1.5 py-[3px] pr-2 text-left text-[12px] transition-colors",
        active ? "bg-surface-raised text-text-emphasis" : "text-text-secondary hover:bg-overlay hover:text-text",
      )}
      style={{ paddingLeft: `${8 + depth * 12}px` }}
    >
      {entry.is_dir ? (
        <>
          <ChevronRight
            size={12}
            className={cn("shrink-0 text-text-muted transition-transform", expanded && "rotate-90")}
          />
          {expanded ? (
            <FolderOpen size={13} className="shrink-0 text-text-muted" />
          ) : (
            <Folder size={13} className="shrink-0 text-text-muted" />
          )}
        </>
      ) : (
        <>
          <span className="w-3 shrink-0" />
          <FileIcon size={13} className="shrink-0 text-text-disabled" />
        </>
      )}
      <span className="truncate">{entry.name}</span>
    </button>
  );
}
