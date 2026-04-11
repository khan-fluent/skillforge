import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../lib/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import Modal from "../components/Modal.jsx";

export default function Upskill() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [plans, setPlans] = useState([]);
  const [members, setMembers] = useState([]);
  const [insights, setInsights] = useState([]);
  const [activePlan, setActivePlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [genMessage, setGenMessage] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const isAdmin = user.role === "admin";

  const reload = useCallback(() => {
    Promise.all([
      api.upskillPlans(),
      isAdmin ? api.members() : Promise.resolve([]),
      api.insights(),
    ]).then(([p, m, ins]) => {
      setPlans(p);
      setMembers(m);
      setInsights(ins.filter((i) => i.type === "upskill" || i.type === "gap"));
    }).catch(() => {}).finally(() => setLoading(false));
  }, [isAdmin]);

  useEffect(() => { reload(); }, [reload]);

  // Handle generate param from Gaps CTA
  useEffect(() => {
    const genData = params.get("generate");
    if (genData) {
      setParams({}, { replace: true });
      try { generatePlan(JSON.parse(decodeURIComponent(genData))); } catch {}
    }
  }, []);

  const generatePlan = async (data) => {
    setGenerating(true);
    setGenMessage(`Creating upskilling plan for ${data.user_name} in ${data.skill_name}...`);
    try {
      const plan = await api.generateUpskill(data);
      reload();
      loadPlan(plan.id);
    } catch (e) {
      alert("Failed to generate plan: " + e.message);
    } finally {
      setGenerating(false);
      setGenMessage("");
    }
  };

  const loadPlan = async (id) => {
    const plan = await api.upskillPlan(id);
    setActivePlan(plan);
  };

  const deletePlan = async (id) => {
    if (!confirm("Delete this plan?")) return;
    await api.deleteUpskill(id);
    if (activePlan?.id === id) setActivePlan(null);
    reload();
  };

  if (loading) return <div style={{ padding: 48 }}><span className="loader"><span /><span /><span /></span></div>;

  // Group plans by user for admin view
  const groupedByUser = {};
  for (const p of plans) {
    const key = p.user_name;
    if (!groupedByUser[key]) groupedByUser[key] = [];
    groupedByUser[key].push(p);
  }

  return (
    <>
      <div className="page-hd">
        <div>
          <h1>Upskill</h1>
          <p>AI-powered learning plans to close skill gaps and grow {isAdmin ? "your team" : "your skills"}.</p>
        </div>
        <button className="btn" onClick={() => setShowCreate(true)}>+ Create plan</button>
      </div>

      {/* Generation progress */}
      {generating && (
        <div className="card upskill-generating">
          <div className="upskill-gen-spinner">
            <span className="loader"><span /><span /><span /></span>
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Generating upskilling plan...</div>
            <div style={{ fontSize: 12, color: "var(--ink-mute)", marginTop: 4 }}>{genMessage}</div>
          </div>
        </div>
      )}

      {/* AI Suggestions — actionable */}
      {insights.length > 0 && !generating && (
        <div className="upskill-suggestions">
          <div style={{ fontSize: 11, color: "var(--ink-mute)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
            AI-suggested upskilling opportunities
          </div>
          <div className="upskill-suggestion-grid">
            {insights.map((ins, i) => (
              <button
                key={i}
                className={`upskill-suggestion ${ins.priority}`}
                onClick={() => generatePlan({
                  user_name: ins.user_name || user.name,
                  skill_name: ins.skill_name || "General",
                  current_level: ins.current_level || 0,
                  skill_id: ins.skill_id,
                  user_id: ins.user_id,
                })}
                disabled={generating}
              >
                <span className={`pill ${ins.priority === "critical" ? "bad" : "warn"}`} style={{ fontSize: 9 }}>
                  {ins.type === "gap" ? "Gap" : "Upskill"}
                </span>
                <span className="upskill-suggestion-title">{ins.title}</span>
                <span className="upskill-suggestion-desc">{ins.description}</span>
                <span className="upskill-suggestion-cta">Generate plan</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="upskill-layout">
        {/* Plan list */}
        <div className="upskill-sidebar">
          {plans.length === 0 && !generating && (
            <div style={{ textAlign: "center", padding: 24, color: "var(--ink-mute)", fontSize: 13 }}>
              No plans yet. Create one manually or generate from AI suggestions above.
            </div>
          )}

          {isAdmin ? (
            // Admin: grouped by user
            Object.entries(groupedByUser).map(([userName, userPlans]) => (
              <div key={userName} style={{ marginBottom: 16 }}>
                <div className="upskill-group-label">{userName}</div>
                {userPlans.map((p) => (
                  <PlanItem key={p.id} plan={p} active={activePlan?.id === p.id} onClick={() => loadPlan(p.id)} />
                ))}
              </div>
            ))
          ) : (
            // Member: flat list
            plans.map((p) => (
              <PlanItem key={p.id} plan={p} active={activePlan?.id === p.id} onClick={() => loadPlan(p.id)} />
            ))
          )}
        </div>

        {/* Plan detail */}
        <div className="upskill-main">
          {activePlan ? (
            <PlanDetail
              plan={activePlan}
              isAdmin={isAdmin}
              userId={user.id}
              onReload={() => { loadPlan(activePlan.id); reload(); }}
              onDelete={() => deletePlan(activePlan.id)}
            />
          ) : (
            <div className="card" style={{ textAlign: "center", padding: 56, color: "var(--ink-mute)" }}>
              {plans.length > 0 ? "Select a plan to view and track progress." : "Create your first upskilling plan."}
            </div>
          )}
        </div>
      </div>

      {/* Create plan modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create upskilling plan">
        <CreatePlanForm
          isAdmin={isAdmin}
          members={members}
          userId={user.id}
          onClose={() => setShowCreate(false)}
          onCreated={(plan) => { setShowCreate(false); reload(); loadPlan(plan.id); }}
        />
      </Modal>
    </>
  );
}

function PlanItem({ plan: p, active, onClick }) {
  const pct = p.total_steps > 0 ? Math.round((p.completed_steps / p.total_steps) * 100) : 0;
  return (
    <div className={`upskill-plan-item ${active ? "active" : ""} ${p.status !== "active" ? "dimmed" : ""}`} onClick={onClick}>
      <div className="upskill-plan-title">{p.title}</div>
      <div className="upskill-plan-meta">
        {p.skill_name || "General"} {p.status !== "active" && <span className="pill" style={{ fontSize: 9, marginLeft: 4 }}>{p.status}</span>}
      </div>
      {p.total_steps > 0 && (
        <div className="upskill-plan-progress">
          <div className="upskill-plan-bar"><div style={{ width: `${pct}%` }} /></div>
          <span>{p.completed_steps}/{p.total_steps}</span>
        </div>
      )}
    </div>
  );
}

function PlanDetail({ plan, isAdmin, userId, onReload, onDelete }) {
  const [editingStep, setEditingStep] = useState(null);
  const [addingStep, setAddingStep] = useState(false);
  const [newStep, setNewStep] = useState({ title: "", description: "" });
  const canEdit = isAdmin || plan.user_id === userId;
  const completedCount = plan.steps?.filter((s) => s.completed).length || 0;
  const pct = plan.steps?.length > 0 ? Math.round((completedCount / plan.steps.length) * 100) : 0;

  const toggleStep = async (stepId, completed) => {
    await api.updateStep(stepId, { completed });
    onReload();
  };

  const saveStepEdit = async (stepId, data) => {
    await api.updateStep(stepId, data);
    setEditingStep(null);
    onReload();
  };

  const deleteStep = async (stepId) => {
    await api.deleteStep(stepId);
    onReload();
  };

  const addStep = async () => {
    if (!newStep.title.trim()) return;
    await api.addStep(plan.id, newStep);
    setNewStep({ title: "", description: "" });
    setAddingStep(false);
    onReload();
  };

  const updateStatus = async (status) => {
    await api.updateUpskill(plan.id, { status });
    onReload();
  };

  return (
    <div className="card upskill-detail">
      <div className="upskill-detail-header">
        <div style={{ flex: 1 }}>
          <div className="upskill-detail-meta">
            {plan.user_name} · {plan.skill_name || "General"} · {new Date(plan.created_at).toLocaleDateString()}
            {plan.created_by_name && plan.created_by_name !== plan.user_name && (
              <span> · assigned by {plan.created_by_name}</span>
            )}
          </div>
          <h2 style={{ margin: "4px 0 0", fontSize: 20 }}>{plan.title}</h2>
          {plan.summary && <p style={{ fontSize: 13, color: "var(--ink-soft)", marginTop: 6, lineHeight: 1.5 }}>{plan.summary}</p>}
        </div>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          {plan.status === "active" && <button className="btn ghost small" onClick={() => updateStatus("completed")}>Complete</button>}
          {plan.status === "completed" && <button className="btn ghost small" onClick={() => updateStatus("active")}>Reopen</button>}
          <button className="btn ghost small" onClick={() => updateStatus("archived")} style={{ color: "var(--ink-mute)" }}>Archive</button>
          {(isAdmin || plan.user_id === userId) && (
            <button className="btn ghost small" onClick={onDelete} style={{ color: "var(--bad)" }}>&times;</button>
          )}
        </div>
      </div>

      {plan.steps?.length > 0 && (
        <div className="upskill-progress-strip">
          <div className="upskill-progress-bar"><div style={{ width: `${pct}%` }} /></div>
          <span className="upskill-progress-label">{pct}% · {completedCount} of {plan.steps.length} steps</span>
        </div>
      )}

      <div className="upskill-steps">
        {(plan.steps || []).map((step) => (
          editingStep === step.id ? (
            <StepEditor
              key={step.id}
              step={step}
              onSave={(data) => saveStepEdit(step.id, data)}
              onCancel={() => setEditingStep(null)}
              onDelete={() => deleteStep(step.id)}
            />
          ) : (
            <div key={step.id} className={`upskill-step ${step.completed ? "done" : ""}`}>
              <button
                className={`upskill-check ${step.completed ? "checked" : ""}`}
                onClick={() => canEdit && toggleStep(step.id, !step.completed)}
                style={{ cursor: canEdit ? "pointer" : "default" }}
              >
                {step.completed && "\u2713"}
              </button>
              <div className="upskill-step-content" onClick={() => canEdit && setEditingStep(step.id)} style={{ cursor: canEdit ? "pointer" : "default" }}>
                <div className="upskill-step-title">{step.title}</div>
                {step.description && <div className="upskill-step-desc">{step.description}</div>}
              </div>
            </div>
          )
        ))}

        {/* Add step */}
        {canEdit && (
          addingStep ? (
            <div className="upskill-step-add">
              <input className="input" placeholder="Step title" value={newStep.title}
                onChange={(e) => setNewStep({ ...newStep, title: e.target.value })} autoFocus />
              <textarea className="input" placeholder="Description (optional)" rows={2} value={newStep.description}
                onChange={(e) => setNewStep({ ...newStep, description: e.target.value })} style={{ marginTop: 6, resize: "vertical" }} />
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button className="btn small" onClick={addStep} disabled={!newStep.title.trim()}>Add step</button>
                <button className="btn ghost small" onClick={() => { setAddingStep(false); setNewStep({ title: "", description: "" }); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <button className="upskill-add-step-btn" onClick={() => setAddingStep(true)}>
              + Add step
            </button>
          )
        )}
      </div>
    </div>
  );
}

function StepEditor({ step, onSave, onCancel, onDelete }) {
  const [form, setForm] = useState({ title: step.title, description: step.description || "" });
  return (
    <div className="upskill-step-edit">
      <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} autoFocus />
      <textarea className="input" rows={3} value={form.description}
        onChange={(e) => setForm({ ...form, description: e.target.value })}
        style={{ marginTop: 6, resize: "vertical" }} />
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button className="btn small" onClick={() => onSave(form)} disabled={!form.title.trim()}>Save</button>
        <button className="btn ghost small" onClick={onCancel}>Cancel</button>
        <button className="btn ghost small" onClick={onDelete} style={{ marginLeft: "auto", color: "var(--bad)" }}>Delete step</button>
      </div>
    </div>
  );
}

function CreatePlanForm({ isAdmin, members, userId, onClose, onCreated }) {
  const [form, setForm] = useState({ title: "", summary: "", user_id: userId });
  const [busy, setBusy] = useState(false);
  const change = (k) => (e) => setForm({ ...form, [k]: k === "user_id" ? parseInt(e.target.value, 10) : e.target.value });
  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try { const plan = await api.createUpskill(form); onCreated(plan); }
    catch { setBusy(false); }
  };
  return (
    <form onSubmit={submit}>
      <div className="field" style={{ marginBottom: 14 }}>
        <label className="label">Plan title</label>
        <input className="input" value={form.title} onChange={change("title")} placeholder="Learn Kubernetes fundamentals" required />
      </div>
      {isAdmin && members.length > 0 && (
        <div className="field" style={{ marginBottom: 14 }}>
          <label className="label">Assign to</label>
          <select className="input" value={form.user_id} onChange={change("user_id")}>
            {members.map((m) => <option key={m.id} value={m.id}>{m.name}{m.id === userId ? " (you)" : ""}</option>)}
          </select>
        </div>
      )}
      <div className="field">
        <label className="label">Summary (optional)</label>
        <textarea className="input" rows={2} value={form.summary} onChange={change("summary")} placeholder="What this plan covers" style={{ resize: "vertical" }} />
      </div>
      <div className="actions">
        <button type="button" className="btn ghost small" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn small" disabled={busy}>{busy ? "Creating..." : "Create plan"}</button>
      </div>
    </form>
  );
}
