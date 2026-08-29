"use client";

import { useRef, type ReactNode } from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";

interface VirtualListProps<T> {
  items: T[];
  estimateSize: number;
  gap?: number;
  keyExtractor: (item: T) => string;
  renderItem: (item: T, index: number) => ReactNode;
}

export function VirtualList<T>({
  items,
  estimateSize,
  gap = 0,
  keyExtractor,
  renderItem,
}: VirtualListProps<T>) {
  const listRef = useRef<HTMLDivElement>(null);
  const virtualizer = useWindowVirtualizer({
    count: items.length,
    estimateSize: () => estimateSize,
    overscan: 10,
    gap,
    scrollMargin: listRef.current?.offsetTop ?? 0,
  });

  return (
    <div ref={listRef}>
      {/* The list semantics belong here, on the elements that actually nest.
          A caller marking its own wrapper `role="list"` and its rows
          `role="listitem"` puts these two positioning divs between them, and
          ARIA only recognises a listitem directly owned by its list. */}
      <div role="list" className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((virtualRow) => (
          <div
            key={keyExtractor(items[virtualRow.index])}
            role="listitem"
            data-index={virtualRow.index}
            ref={virtualizer.measureElement}
            className="absolute left-0 w-full"
            style={{ top: virtualRow.start - (virtualizer.options.scrollMargin || 0) }}
          >
            {renderItem(items[virtualRow.index], virtualRow.index)}
          </div>
        ))}
      </div>
    </div>
  );
}
