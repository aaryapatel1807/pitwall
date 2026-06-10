import { motion } from "framer-motion";

export interface PodiumPrediction {
  pos: 1 | 2 | 3;
  driver: string;
  team: string;
  teamColor: string;
  confidence: number;
}

interface PodiumGraphicProps {
  predictions: PodiumPrediction[];
}

const HEIGHT: Record<1 | 2 | 3, string> = {
  1: "h-28",
  2: "h-20",
  3: "h-16",
};

const ORDER: Array<1 | 2 | 3> = [2, 1, 3];

const MEDAL: Record<1 | 2 | 3, string> = {
  1: "#FFD700",
  2: "#C0C0C0",
  3: "#CD7F32",
};

export function PodiumGraphic({ predictions }: PodiumGraphicProps) {
  const byPos = new Map(predictions.map((p) => [p.pos, p]));

  return (
    <div className="flex items-end justify-center gap-3 pb-2 pt-6">
      {ORDER.map((pos) => {
        const p = byPos.get(pos);
        if (!p) return null;

        return (
          <motion.div
            key={pos}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: pos === 1 ? 0.1 : pos === 2 ? 0.2 : 0.3 }}
            className="flex flex-col items-center gap-2"
            style={{ minWidth: 96 }}
          >
            {/* Driver name above block */}
            <div className="text-center">
              <p className="text-xs font-extrabold uppercase tracking-wide text-white">{p.driver}</p>
              <p className="mt-0.5 text-[10px] font-semibold text-[#A0A0B0]">{p.team}</p>
              <p className="mt-1 text-[10px] font-bold" style={{ color: p.teamColor }}>
                {p.confidence}% confident
              </p>
            </div>

            {/* Podium block */}
            <div
              className={`relative w-full ${HEIGHT[pos]} flex items-center justify-center rounded-t-lg`}
              style={{
                backgroundColor: `${p.teamColor}20`,
                borderBottom: `4px solid ${p.teamColor}`,
                boxShadow: `0 0 20px ${p.teamColor}30`,
              }}
            >
              {/* Position number */}
              <span
                className="text-3xl font-extrabold"
                style={{ color: MEDAL[pos] }}
              >
                {pos}
              </span>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
