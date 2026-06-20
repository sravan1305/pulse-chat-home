import { useEffect, useRef } from "react";
import { Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

type BubbleRole = "assistant" | "user";

interface BubbleProps {
  role: BubbleRole;
  children: React.ReactNode;
  onEdit?: () => void;
}

export function ChatBubble({ role, children, onEdit }: BubbleProps) {
  const isAssistant = role === "assistant";
  const editable = !isAssistant && typeof onEdit === "function";
  const Wrapper: React.ElementType = editable ? "button" : "div";
  return (
    <div className={cn("pulse-enter flex w-full", isAssistant ? "justify-start" : "justify-end")}>
      <Wrapper
        {...(editable
          ? {
              type: "button",
              onClick: onEdit,
              "aria-label": "Edit this answer",
              title: "Tap to change",
            }
          : {})}
        className={cn(
          "group relative inline-flex max-w-[88%] items-center gap-2 rounded-[14px] px-4 py-3 text-left text-[16px] leading-snug shadow-sm transition-all",
          isAssistant
            ? "bg-[var(--brand-navy)] text-white font-semibold"
            : "bg-[var(--brand-yellow)] text-[var(--brand-navy)] font-medium",
          editable && "cursor-pointer hover:brightness-95 active:scale-[0.98]",
        )}
        style={{ borderRadius: 14 }}
      >
        <span>{children}</span>
        {editable && (
          <Pencil
            className="h-3.5 w-3.5 shrink-0 opacity-50 transition-opacity group-hover:opacity-100"
            strokeWidth={2.5}
            aria-hidden
          />
        )}
      </Wrapper>
    </div>
  );
}

export function TypingBubble() {
  return (
    <div className="pulse-enter flex justify-start">
      <div
        className="flex gap-1 rounded-[14px] bg-[var(--brand-navy)] px-4 py-3"
        style={{ borderRadius: 14 }}
      >
        {[0, 0.15, 0.3].map((d, i) => (
          <span
            key={i}
            className="pulse-typing-dot block h-2 w-2 rounded-full bg-white/70"
            style={{ animationDelay: `${d}s` }}
          />
        ))}
      </div>
    </div>
  );
}

interface ChipProps {
  selected?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}

export function Chip({ selected, onClick, children, disabled }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "min-h-[48px] rounded-[14px] border-2 px-5 py-3 text-[16px] font-semibold transition-all",
        "active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40",
        selected
          ? "border-[var(--brand-yellow)] bg-[var(--brand-yellow)] text-[var(--brand-navy)]"
          : "border-[color:var(--border)] bg-white text-[var(--brand-navy)] hover:border-[var(--brand-navy)]",
      )}
      style={{ borderRadius: 14 }}
    >
      {children}
    </button>
  );
}

export function PrimaryButton({
  onClick,
  children,
  disabled,
}: {
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "min-h-[52px] w-full rounded-[14px] bg-[var(--brand-yellow)] px-6 py-3 text-[16px] font-semibold text-[var(--brand-navy)] transition-all",
        "active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 shadow-sm hover:shadow",
      )}
      style={{ borderRadius: 14 }}
    >
      {children}
    </button>
  );
}

export function SkipLink({ onClick, label = "Skip" }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-[14px] font-medium text-[var(--brand-stone)] underline-offset-4 hover:underline"
    >
      {label}
    </button>
  );
}

export function UndoLink({ onClick }: { onClick: () => void }) {
  return (
    <div className="pulse-enter flex w-full justify-end pr-1">
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-1 text-[13px] font-medium text-[var(--brand-stone)] underline-offset-4 hover:underline"
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M3 7v6h6" />
          <path d="M21 17a9 9 0 0 0-15-6.7L3 13" />
        </svg>
        Undo
      </button>
    </div>
  );
}

export function ProgressDots({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex items-center justify-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={cn(
            "h-1.5 rounded-full transition-all",
            i < current ? "w-6 bg-[var(--brand-navy)]" : "w-1.5 bg-[var(--border)]",
          )}
        />
      ))}
    </div>
  );
}

/** Auto-scrolls its container to the bottom whenever children change. */
export function ChatScroller({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [children]);

  return (
    <div ref={ref} className="flex flex-col gap-3 overflow-y-auto px-1 pb-2">
      {children}
    </div>
  );
}
