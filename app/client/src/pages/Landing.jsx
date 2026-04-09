import { Link } from "react-router-dom";
import { motion } from "framer-motion";

const fade = { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 } };

export default function Landing() {
  return (
    <div className="landing">
      <header className="landing-nav">
        <div className="brand">Skillforge<span className="dot">.</span></div>
        <div style={{ display: "flex", gap: 12 }}>
          <Link to="/login" className="btn ghost small">Sign in</Link>
          <Link to="/signup" className="btn small">Get started</Link>
        </div>
      </header>

      <section className="hero">
        <motion.div {...fade} transition={{ duration: 0.5 }} className="eyebrow">
          <span className="dot" /> A new home for what your team knows
        </motion.div>
        <motion.h1 {...fade} transition={{ duration: 0.6, delay: 0.05 }}>
          Know what your team<br /><em>actually knows.</em>
        </motion.h1>
        <motion.p {...fade} transition={{ duration: 0.6, delay: 0.15 }} className="lede">
          Skillforge maps your team's expertise, surfaces the skills only one
          person knows, and helps you staff projects and grow people without
          guesswork.
        </motion.p>
        <motion.div {...fade} transition={{ duration: 0.6, delay: 0.25 }} className="cta-row">
          <Link to="/signup" className="btn">Start your team — free</Link>
          <Link to="/login" className="btn ghost">I already have an account</Link>
        </motion.div>
      </section>

      <section className="features">
        <motion.div className="feature" {...fade} transition={{ duration: 0.5, delay: 0.1 }}>
          <span className="num">01</span>
          <h3>A warm skill matrix</h3>
          <p>See every person against every skill in a single readable grid. Sort by domain, click any cell to update — no spreadsheet anywhere in sight.</p>
        </motion.div>
        <motion.div className="feature" {...fade} transition={{ duration: 0.5, delay: 0.2 }}>
          <span className="num">02</span>
          <h3>Bus-factor that bites you back</h3>
          <p>Find the skills only one person knows before they go on vacation. Skillforge ranks every gap by risk so you know what to cross-train next.</p>
        </motion.div>
        <motion.div className="feature" {...fade} transition={{ duration: 0.5, delay: 0.3 }}>
          <span className="num">03</span>
          <h3>An assistant that knows your team</h3>
          <p>Ask Skillforge AI in plain English: "who should staff this Kubernetes project?" or "what should Mei learn next?" Grounded in your live team data.</p>
        </motion.div>
      </section>

      <section className="section-wrap">
        <div className="label-row">How it works</div>
        <h2>Three steps, then it just<br /><em>quietly works.</em></h2>
        <div className="steps">
          <div className="step">
            <div className="step-num">STEP 01</div>
            <h4>Create your team</h4>
            <p>Sign up in 30 seconds. You become the admin and shape the workspace from there.</p>
          </div>
          <div className="step">
            <div className="step-num">STEP 02</div>
            <h4>Add people & skills</h4>
            <p>Invite teammates, add the skills you care about, and set proficiency levels — or let people self-assess.</p>
          </div>
          <div className="step">
            <div className="step-num">STEP 03</div>
            <h4>Discover gaps & decide</h4>
            <p>Watch the matrix fill in. Surface bus-factor risks. Ask the assistant. Make better staffing calls.</p>
          </div>
        </div>
      </section>

      <footer className="landing-foot">
        Skillforge · built by khan-fluent · {new Date().getFullYear()}
      </footer>
    </div>
  );
}
