import { motion } from "framer-motion";

/** 토글 스위치 컴포넌트 */
export function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      role="switch"
      aria-checked={on}
      className="relative w-12 h-6 rounded-full transition-colors duration-300"
      style={{ backgroundColor: on ? "#6C63FF" : "#E5E7EB" }}
    >
      <motion.span
        className="absolute top-1 w-4 h-4 bg-white rounded-full shadow"
        animate={{ left: on ? "26px" : "4px" }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
      />
    </button>
  );
}
