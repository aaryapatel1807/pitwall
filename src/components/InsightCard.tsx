import { motion } from "framer-motion";

interface InsightCardProps {
  icon: string;
  title: string;
  content: React.ReactNode;
  loading?: boolean;
  teamColor?: string;
}

export function InsightCard({ icon, title, content, loading = false, teamColor }: InsightCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
      className="flex flex-col gap-3 rounded-xl bg-[#1E1E2E] p-5"
      style={teamColor ? { borderLeft: `4px solid ${teamColor}` } : {}}
    >
      <div className="flex items-center gap-2">
        <span className="text-xl leading-none">{icon}</span>
        <h3 className="text-xs font-bold uppercase tracking-widest text-[#A0A0B0]">{title}</h3>
      </div>

      {loading ? (
        <div className="space-y-2.5">
          {[100, 85, 92].map((w, i) => (
            <div
              key={i}
              className="h-3.5 animate-pulse rounded-md bg-white/10"
              style={{ width: `${w}%`, animationDelay: `${i * 80}ms` }}
            />
          ))}
          <div className="h-3.5 w-2/3 animate-pulse rounded-md bg-white/10" style={{ animationDelay: "240ms" }} />
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="text-sm leading-relaxed text-[#D0D0E0]"
        >
          {content}
        </motion.div>
      )}
    </motion.div>
  );
}
