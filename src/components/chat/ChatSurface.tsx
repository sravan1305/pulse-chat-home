import { ArrowUp } from "lucide-react";
import { forwardRef, useEffect, useRef, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";

import { AppShell } from "@/components/AppShell";
import { cn } from "@/lib/utils";

interface ChatSurfaceProps {
  title: string;
  subtitle?: string;
  meta?: ReactNode;
  messages: ReactNode;
  controls?: ReactNode;
  composer: ReactNode;
  /** Re-scroll when this value changes. */
  scrollKey?: unknown;
}

/**
 * Shared chat layout used by the in-app /chat page AND the onboarding flow.
 * Keeps header, scroll container, and composer placement identical.
 */
export function ChatSurface({
  title,
  subtitle,
  meta,
  messages,
  controls,
  composer,
  scrollKey,
}: ChatSurfaceProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [scrollKey]);

  return (
    <AppShell>
      <div className="flex flex-col h-[calc(100vh-12rem)] sm:h-[calc(100vh-10rem)]">
        <div className="mb-4">
          <h1 className="text-navy text-3xl sm:text-4xl">{title}</h1>
          {subtitle && <p className="text-stone mt-1">{subtitle}</p>}
          {meta && <div className="text-stone text-xs font-semibold uppercase tracking-wider mt-2">{meta}</div>}
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto card-soft p-5 sm:p-6 space-y-5">
          {messages}
          {controls && <div className="pt-1">{controls}</div>}
        </div>

        <div className="mt-4">{composer}</div>
      </div>
    </AppShell>
  );
}

export function AssistantBubble({ children }: { children: ReactNode }) {
  return (
    <div className="flex justify-start">
      <div className="max-w-[90%] rounded-2xl rounded-bl-md bg-secondary/70 text-navy px-4 py-3 text-[15px] leading-relaxed prose prose-sm max-w-none prose-headings:text-navy prose-strong:text-navy prose-p:my-2 prose-ul:my-2 prose-li:my-0.5">
        {typeof children === "string" ? <ReactMarkdown>{children}</ReactMarkdown> : children}
      </div>
    </div>
  );
}

export function UserBubble({
  children,
  onClick,
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  title?: string;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <div className="flex justify-end">
      <Tag
        {...(onClick ? { type: "button" as const, onClick, title } : {})}
        className={cn(
          "max-w-[85%] rounded-2xl rounded-br-md bg-navy text-white px-4 py-2.5 text-[15px] font-medium leading-relaxed text-left",
          onClick && "hover:brightness-110 active:scale-[0.99] transition cursor-pointer",
        )}
      >
        {children}
      </Tag>
    </div>
  );
}

export function ChoiceChip({
  selected,
  disabled,
  onClick,
  children,
}: {
  selected?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "text-left text-sm font-semibold rounded-2xl px-4 py-3 leading-snug transition",
        "disabled:opacity-40 disabled:cursor-not-allowed",
        selected
          ? "bg-cta text-navy"
          : "bg-cta/20 text-navy hover:bg-cta/40",
      )}
    >
      {children}
    </button>
  );
}

interface ComposerProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  placeholder?: string;
  loading?: boolean;
}

export const Composer = forwardRef<HTMLTextAreaElement, ComposerProps>(function Composer(
  { value, onChange, onSubmit, disabled, placeholder, loading },
  ref,
) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!disabled && !loading && value.trim()) onSubmit();
      }}
      className="flex items-end gap-2"
    >
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (!disabled && !loading && value.trim()) onSubmit();
          }
        }}
        rows={1}
        disabled={disabled}
        placeholder={placeholder ?? "Ask about your energy, bill, contract…"}
        className="flex-1 resize-none rounded-2xl border border-border bg-card px-4 py-3 text-navy placeholder:text-stone/70 focus:outline-none focus:ring-2 focus:ring-yellow disabled:bg-muted/30 disabled:cursor-not-allowed"
      />
      <button
        type="submit"
        disabled={disabled || loading || !value.trim()}
        className="btn-cta disabled:opacity-50 disabled:cursor-not-allowed h-12 w-12 justify-center !p-0"
        aria-label="Send"
      >
        <ArrowUp className="w-5 h-5" />
      </button>
    </form>
  );
});
