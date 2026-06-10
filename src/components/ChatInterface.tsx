import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Send } from "lucide-react";

export interface ChatMessage {
  id: string;
  role: "user" | "ai";
  text: string;
}

interface ChatInterfaceProps {
  messages: ChatMessage[];
  loading: boolean;
  inputValue: string;
  onInputChange: (v: string) => void;
  onSend: (text: string) => void;
  placeholder?: string;
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm bg-[#15151E] px-4 py-3">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="block h-1.5 w-1.5 rounded-full bg-[#A0A0B0]"
          animate={{ opacity: [0.3, 1, 0.3], y: [0, -4, 0] }}
          transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.18, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

export function ChatInterface({
  messages,
  loading,
  inputValue,
  onInputChange,
  onSend,
  placeholder = "Ask about this race...",
}: ChatInterfaceProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey && inputValue.trim()) {
      e.preventDefault();
      onSend(inputValue.trim());
    }
  };

  return (
    <div className="flex max-h-80 flex-col gap-3 overflow-y-auto pr-1">
      <AnimatePresence initial={false}>
        {messages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {msg.role === "user" ? (
              <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-[#E8002D] px-4 py-2.5 text-sm font-medium text-white">
                {msg.text}
              </div>
            ) : (
              <div className="max-w-[85%] rounded-2xl rounded-bl-sm border-l-2 border-[#E8002D]/40 bg-[#15151E] px-4 py-2.5 text-sm leading-relaxed text-[#D0D0E0]">
                {msg.text}
              </div>
            )}
          </motion.div>
        ))}

        {loading && (
          <motion.div
            key="typing"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.2 }}
            className="flex justify-start"
          >
            <TypingIndicator />
          </motion.div>
        )}
      </AnimatePresence>
      <div ref={bottomRef} />

      {/* Input row — rendered outside scroll area via caller, but kept here for portability */}
      <div className="sticky bottom-0 flex items-center gap-2 rounded-lg bg-[#0D0D1A] px-3 py-2">
        <input
          value={inputValue}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-sm text-white placeholder:text-[#6B6B6B] focus:outline-none"
        />
        <button
          onClick={() => inputValue.trim() && onSend(inputValue.trim())}
          disabled={!inputValue.trim() || loading}
          className="grid h-8 w-8 place-items-center rounded-md bg-[#E8002D] text-white transition-colors hover:bg-[#CC0027] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}
