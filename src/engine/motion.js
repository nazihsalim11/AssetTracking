// StyleSeed Motion Presets matching the system configurations
// Targets Framer Motion (motion.div, motion.button, etc.)

export const spring = {
  entrance: {
    initial: { opacity: 0, scale: 0.9, y: 15 },
    animate: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 0.95, y: -10 },
    transition: { type: "spring", stiffness: 300, damping: 18 }
  },
  exit: {
    initial: { opacity: 1, scale: 1, y: 0 },
    animate: { opacity: 0, scale: 0.95, y: -10 },
    transition: { type: "spring", stiffness: 300, damping: 20 }
  },
  hover: {
    whileHover: { scale: 1.03, y: -2 },
    transition: { type: "spring", stiffness: 400, damping: 15 }
  },
  press: {
    whileTap: { scale: 0.95 },
    transition: { type: "spring", stiffness: 400, damping: 10 }
  }
};

export const silk = {
  entrance: {
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -8 },
    transition: { type: "spring", stiffness: 100, damping: 20 }
  },
  exit: {
    initial: { opacity: 1, y: 0 },
    animate: { opacity: 0, y: -8 },
    transition: { type: "spring", stiffness: 100, damping: 20 }
  },
  hover: {
    whileHover: { scale: 1.015, y: -1 },
    transition: { type: "spring", stiffness: 150, damping: 25 }
  },
  press: {
    whileTap: { scale: 0.98 },
    transition: { type: "spring", stiffness: 200, damping: 18 }
  }
};

export const snap = {
  entrance: {
    initial: { opacity: 0, scale: 0.98 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.99 },
    transition: { type: "spring", stiffness: 400, damping: 30 }
  },
  exit: {
    initial: { opacity: 1, scale: 1 },
    animate: { opacity: 0, scale: 0.99 },
    transition: { type: "spring", stiffness: 400, damping: 35 }
  },
  hover: {
    whileHover: { scale: 1.01 },
    transition: { type: "spring", stiffness: 500, damping: 28 }
  },
  press: {
    whileTap: { scale: 0.99 },
    transition: { type: "spring", stiffness: 600, damping: 25 }
  }
};

export const float = {
  entrance: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -15 },
    transition: { type: "spring", stiffness: 60, damping: 15 }
  },
  exit: {
    initial: { opacity: 1, y: 0 },
    animate: { opacity: 0, y: -15 },
    transition: { type: "spring", stiffness: 60, damping: 15 }
  },
  hover: {
    whileHover: { y: -4 },
    transition: { type: "spring", stiffness: 80, damping: 12 }
  },
  press: {
    whileTap: { scale: 0.97 },
    transition: { type: "spring", stiffness: 150, damping: 10 }
  }
};

export const pulse = {
  entrance: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    transition: { duration: 0.3 }
  },
  hover: {
    whileHover: { scale: 1.05 },
    transition: { repeat: Infinity, duration: 1, repeatType: "reverse" }
  }
};

// Named Motion Keywords (distinctive moves)
export const MOTION_LIBRARY = {
  "pulse-beat": {
    animate: { scale: [1, 1.08, 1] },
    transition: { repeat: Infinity, duration: 1.2, ease: "easeInOut" }
  },
  "shimmer": {
    animate: { backgroundPosition: ["200% 0", "-200% 0"] },
    transition: { repeat: Infinity, duration: 1.5, ease: "linear" }
  }
};
