import { motion, AnimatePresence } from "framer-motion";

export default function Modal({ open, onClose, title, lede, children }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="modal-backdrop"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="modal"
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2>{title}</h2>
            {lede && <p className="lede">{lede}</p>}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
