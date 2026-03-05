import { useLocation } from "wouter";
import { motion } from "framer-motion";
import logoPath from "@assets/WhatsApp_Image_2026-03-01_at_10.45.20-removebg-preview_(1)_1772727577713.png";

export default function Home() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden"
      style={{
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 30%, #f093fb 60%, #f5576c 100%)"
      }}
    >
      {/* Animated background bubbles */}
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(8)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full opacity-20"
            style={{
              width: `${60 + i * 40}px`,
              height: `${60 + i * 40}px`,
              background: i % 2 === 0 ? "#fff" : "#ffd700",
              left: `${(i * 13) % 90}%`,
              top: `${(i * 17) % 80}%`,
            }}
            animate={{
              y: [0, -20, 0],
              scale: [1, 1.1, 1],
              opacity: [0.15, 0.25, 0.15],
            }}
            transition={{
              duration: 3 + i * 0.5,
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 0.4,
            }}
          />
        ))}
      </div>

      {/* Music notes floating */}
      <div className="absolute inset-0 pointer-events-none select-none">
        {["♩", "♪", "♫", "♬", "♭"].map((note, i) => (
          <motion.span
            key={i}
            className="absolute text-white/30 font-bold"
            style={{
              fontSize: `${24 + i * 8}px`,
              left: `${10 + i * 18}%`,
              top: `${20 + (i % 3) * 25}%`,
            }}
            animate={{ y: [0, -15, 0], rotate: [-5, 5, -5] }}
            transition={{ duration: 4 + i * 0.7, repeat: Infinity, ease: "easeInOut", delay: i * 0.5 }}
          >
            {note}
          </motion.span>
        ))}
      </div>

      <motion.div
        className="relative z-10 flex flex-col items-center gap-8 px-6 w-full max-w-md"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      >
        {/* Logo */}
        <motion.div
          className="flex flex-col items-center gap-3"
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        >
          <img
            src={logoPath}
            alt="NoteBeat Kids"
            className="w-52 h-52 object-contain drop-shadow-2xl"
            data-testid="img-logo"
          />
          <div className="text-center">
            <p className="text-white/90 text-lg font-bold tracking-wide drop-shadow">
              Learn Music Through Play!
            </p>
          </div>
        </motion.div>

        {/* Buttons */}
        <div className="flex flex-col gap-4 w-full">
          <motion.button
            data-testid="button-teacher-login"
            className="w-full py-5 px-8 rounded-3xl text-xl font-extrabold shadow-2xl flex items-center justify-center gap-3 cursor-pointer"
            style={{
              background: "linear-gradient(135deg, #667eea, #764ba2)",
              color: "white",
              border: "4px solid rgba(255,255,255,0.4)",
            }}
            whileHover={{ scale: 1.04, boxShadow: "0 20px 40px rgba(0,0,0,0.3)" }}
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate("/teacher/login")}
          >
            <span className="text-3xl">👩‍🏫</span>
            Teacher Login
          </motion.button>

          <motion.button
            data-testid="button-student-login"
            className="w-full py-5 px-8 rounded-3xl text-xl font-extrabold shadow-2xl flex items-center justify-center gap-3 cursor-pointer"
            style={{
              background: "linear-gradient(135deg, #f093fb, #f5576c)",
              color: "white",
              border: "4px solid rgba(255,255,255,0.4)",
            }}
            whileHover={{ scale: 1.04, boxShadow: "0 20px 40px rgba(0,0,0,0.3)" }}
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate("/student/login")}
          >
            <span className="text-3xl">🎵</span>
            Student Login
          </motion.button>
        </div>

        {/* Admin link - subtle */}
        <motion.button
          data-testid="link-admin"
          className="text-white/60 text-sm underline cursor-pointer mt-2"
          onClick={() => navigate("/admin/login")}
          whileHover={{ opacity: 1 }}
        >
          Admin Access
        </motion.button>
      </motion.div>
    </div>
  );
}
