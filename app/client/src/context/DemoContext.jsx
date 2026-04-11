/**
 * DemoContext — provides in-memory mock data and API-like methods
 * for the sandbox/try mode. No server calls. Everything lives in
 * React state and disappears when the user leaves.
 */

import { createContext, useContext, useState, useCallback } from "react";

const DemoCtx = createContext(null);

// Pre-seeded data so the sandbox feels alive
const SEED_TEAM = { id: 0, name: "Demo Team" };
const SEED_USER = { id: 1, team_id: 0, name: "You", email: "demo@example.com", role: "admin", job_title: "Team Lead", accepted_at: new Date().toISOString() };
const SEED_MEMBERS = [
  SEED_USER,
  { id: 2, team_id: 0, name: "Alex Chen", email: "alex@example.com", role: "member", job_title: "Backend Engineer", accepted_at: new Date().toISOString(), skill_count: 4, avg_level: 3.5 },
  { id: 3, team_id: 0, name: "Jordan Park", email: "jordan@example.com", role: "member", job_title: "DevOps Engineer", accepted_at: new Date().toISOString(), skill_count: 5, avg_level: 4.0 },
];
const SEED_SKILLS = [
  { id: 1, name: "JavaScript", domain: "languages", description: "Core web programming language", people_count: 3, proficient_count: 2, avg_level: 3.7 },
  { id: 2, name: "PostgreSQL", domain: "databases", description: "Relational database management", people_count: 2, proficient_count: 1, avg_level: 3.0 },
  { id: 3, name: "AWS", domain: "cloud", description: "Amazon Web Services cloud platform", people_count: 3, proficient_count: 1, avg_level: 2.7 },
  { id: 4, name: "Docker", domain: "tools", description: "Container platform for building and deploying applications", people_count: 2, proficient_count: 2, avg_level: 4.0 },
  { id: 5, name: "CI/CD", domain: "practices", description: "Continuous Integration and Deployment pipelines", people_count: 2, proficient_count: 1, avg_level: 3.5 },
];
const SEED_CELLS = { "1:1": 4, "1:2": 3, "1:3": 2, "1:4": 5, "1:5": 4, "2:1": 5, "2:2": 4, "2:3": 3, "2:4": 3, "3:1": 2, "3:3": 3, "3:4": 4, "3:5": 3 };

const ACTION_LIMIT = 8; // Actions before signup gate

export function DemoProvider({ children }) {
  const [user] = useState(SEED_USER);
  const [team] = useState(SEED_TEAM);
  const [members, setMembers] = useState(SEED_MEMBERS);
  const [skills, setSkills] = useState(SEED_SKILLS);
  const [cells, setCells] = useState(SEED_CELLS);
  const [actions, setActions] = useState(0);
  const [gateOpen, setGateOpen] = useState(false);

  let nextId = 100;
  const genId = () => ++nextId;

  const checkGate = useCallback(() => {
    setActions((prev) => {
      const next = prev + 1;
      if (next >= ACTION_LIMIT) setGateOpen(true);
      return next;
    });
  }, []);

  // Mock API that mirrors the real api object shape
  const demoApi = {
    // Auth
    me: async () => ({ user, team }),

    // Members
    members: async () => members.map((m) => ({
      ...m,
      skill_count: Object.keys(cells).filter((k) => k.startsWith(`${m.id}:`)).length,
      avg_level: (() => {
        const lvls = Object.entries(cells).filter(([k]) => k.startsWith(`${m.id}:`)).map(([, v]) => v);
        return lvls.length > 0 ? lvls.reduce((a, b) => a + b, 0) / lvls.length : 0;
      })(),
    })),
    createMember: async (data) => {
      checkGate();
      const m = { id: genId(), team_id: 0, ...data, accepted_at: null, invited_at: new Date().toISOString(), invite_token: "demo" };
      setMembers((prev) => [...prev, m]);
      return m;
    },
    updateMember: async (id, data) => { checkGate(); setMembers((prev) => prev.map((m) => m.id === id ? { ...m, ...data } : m)); },
    deleteMember: async (id) => { setMembers((prev) => prev.filter((m) => m.id !== id)); },

    // Skills
    skills: async () => skills.map((s) => {
      const profEntries = Object.entries(cells).filter(([k, v]) => k.endsWith(`:${s.id}`) && v >= 4);
      const allEntries = Object.entries(cells).filter(([k]) => k.endsWith(`:${s.id}`));
      return { ...s, people_count: allEntries.length, proficient_count: profEntries.length, avg_level: allEntries.length > 0 ? allEntries.reduce((a, [, v]) => a + v, 0) / allEntries.length : 0 };
    }),
    createSkill: async (data) => {
      checkGate();
      const s = { id: genId(), ...data, people_count: 0, proficient_count: 0, avg_level: 0 };
      setSkills((prev) => [...prev, s]);
      return s;
    },
    updateSkill: async (id, data) => { checkGate(); setSkills((prev) => prev.map((s) => s.id === id ? { ...s, ...data } : s)); },
    deleteSkill: async (id) => { setSkills((prev) => prev.filter((s) => s.id !== id)); },

    // Matrix
    matrix: async () => ({ people: members.filter((m) => m.accepted_at), skills, cells }),

    // Proficiency
    setProficiency: async ({ user_id, skill_id, level }) => {
      checkGate();
      setCells((prev) => ({ ...prev, [`${user_id}:${skill_id}`]: level }));
    },

    // Gaps
    gaps: async () => {
      const gapSkills = skills.map((s) => {
        const profPeople = members.filter((m) => (cells[`${m.id}:${s.id}`] || 0) >= 4).map((m) => m.name);
        const totalKnown = members.filter((m) => cells[`${m.id}:${s.id}`] > 0).length;
        return { id: s.id, name: s.name, domain: s.domain, bus_factor: profPeople.length, total_known: totalKnown, proficient_people: profPeople };
      });
      return {
        summary: {
          critical: gapSkills.filter((s) => s.bus_factor === 0).length,
          high_risk: gapSkills.filter((s) => s.bus_factor === 1).length,
          healthy: gapSkills.filter((s) => s.bus_factor >= 2).length,
          total: gapSkills.length,
        },
        skills: gapSkills.sort((a, b) => a.bus_factor - b.bus_factor),
      };
    },

    // Stubs for features that require signup
    certifications: async () => [],
    domainGaps: async () => ({ summary: { critical: 0, high_risk: 0, healthy: 0, total: 0 }, domains: [] }),
    domainMatrix: async () => ({ members: [], domains: [], proficiencies: {} }),
    domains: async () => [],
    insights: async () => [],
    upskillPlans: async () => [],
    chatSessions: async () => [],
    kbFolders: async () => [],
    kbDocuments: async () => [],
    kbStats: async () => ({ storage_used: 0, storage_limit: 50000000, documents: 0, folders: 0 }),
    team: async () => team,

    // Gate-triggering stubs
    chat: async () => { setGateOpen(true); return { role: "assistant", content: "Sign up to use AI features — they're grounded in your real team data." }; },
    generateSkills: async () => { setGateOpen(true); return { skills: [] }; },
    generateUpskill: async () => { setGateOpen(true); return {}; },
    kbBySkill: async () => [],
    authProviders: async () => ({ method: "local", local: true, sso: false }),
  };

  return (
    <DemoCtx.Provider value={{ user, team, demoApi, gateOpen, setGateOpen, actions, isDemo: true }}>
      {children}
    </DemoCtx.Provider>
  );
}

export function useDemo() {
  return useContext(DemoCtx);
}
