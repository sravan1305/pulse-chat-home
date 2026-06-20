import { useChat } from "@ai-sdk/react";
import { createFileRoute } from "@tanstack/react-router";
import { DefaultChatTransport } from "ai";
import { Database, Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { z } from "zod";

import { useActiveHouseholdId } from "@/components/AppShell";
import {
  AssistantBubble,
  ChatSurface,
  ChoiceChip,
  Composer,
  UserBubble,
} from "@/components/chat/ChatSurface";
import { toolSourceLabels } from "@/lib/agent-tool-labels";

const searchSchema = z.object({ q: z.string().optional(), hh: z.string().optional() });

export const Route = createFileRoute("/chat")({
  head: () => ({
    meta: [
      { title: "Chat — Enpal Pulse" },
      { name: "description", content: "Ask your Enpal home energy assistant anything." },
    ],
  }),
  validateSearch: searchSchema,
  component: ChatPage,
});

const SUGGESTIONS = [
  "How much would it cost to run the dishwasher for 2 hours right now?",
  "What's the best time today to charge my EV?",
  "Is my heat pump covered under my maintenance contract?",
  "Why was my bill higher in August?",
];

function ChatPage() {
  const { q } = Route.useSearch();
  const householdId = useActiveHouseholdId();
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const submittedQ = useRef<string | null>(null);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: { householdId },
      }),
    [householdId],
  );

  const { messages, sendMessage, status, setMessages } = useChat({ transport });

  useEffect(() => {
    setMessages([]);
    submittedQ.current = null;
  }, [householdId, setMessages]);

  const isLoading = status === "submitted" || status === "streaming";

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    if (q && submittedQ.current !== q) {
      submittedQ.current = q;
      sendMessage({ text: q });
    }
  }, [q, sendMessage]);

  const onSubmit = () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    sendMessage({ text: trimmed });
    setInput("");
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const messagesNode = (
    <>
      {messages.length === 0 && (
        <div className="space-y-4">
          <p className="text-stone">Try one of these:</p>
          <div className="grid sm:grid-cols-2 gap-2.5">
            {SUGGESTIONS.map((s) => (
              <ChoiceChip key={s} onClick={() => sendMessage({ text: s })}>
                {s}
              </ChoiceChip>
            ))}
          </div>
        </div>
      )}

      {messages.map((m) => (
        <MessageRow key={m.id} message={m} />
      ))}

      {status === "submitted" && (
        <div className="flex items-center gap-2 text-stone text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          Checking your data…
        </div>
      )}
    </>
  );

  return (
    <ChatSurface
      title="Ask Enpal Pulse"
      subtitle="Grounded in your household, tariff, contract and live prices."
      messages={messagesNode}
      scrollKey={messages.length + (status === "streaming" ? 1 : 0)}
      composer={
        <Composer
          ref={textareaRef}
          value={input}
          onChange={setInput}
          onSubmit={onSubmit}
          loading={isLoading}
          placeholder="Ask about your energy, bill, contract…"
        />
      }
    />
  );
}

type UIMsg = ReturnType<typeof useChat>["messages"][number];

function MessageRow({ message }: { message: UIMsg }) {
  const isUser = message.role === "user";

  const text = message.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");

  const toolNames = new Set<string>();
  for (const part of message.parts) {
    const t = (part as { type: string }).type;
    if (t.startsWith("tool-")) toolNames.add(t.slice("tool-".length));
  }
  const sources = Array.from(toolNames)
    .map((n) => toolSourceLabels[n as keyof typeof toolSourceLabels])
    .filter(Boolean);
  const uniqueSources = Array.from(new Set(sources));

  if (isUser) return <UserBubble>{text}</UserBubble>;

  return (
    <div className="space-y-2">
      <AssistantBubble>
        {text ? <ReactMarkdown>{text}</ReactMarkdown> : <span className="text-stone italic">…</span>}
      </AssistantBubble>
      {uniqueSources.length > 0 && (
        <div className="flex items-center gap-1.5 text-xs text-stone pl-1">
          <Database className="w-3 h-3" />
          <span className="font-semibold">based on:</span>
          <span>{uniqueSources.join(", ")}</span>
        </div>
      )}
    </div>
  );
}
