import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../lib/api.js";
import { useAuth } from "../context/AuthContext.jsx";

export default function Upskill() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [plans, setPlans] = useState([]);
  const [activePlan, setActivePlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const isAdmin = user.role === "admin";

  const reload = () => {
    api.upskillPlans().then(setPlans).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { reload(); }, []);

  // Handle generate param from insight CTA
  useEffect(() => {
    const genData = params.get("generate");
    if (genData) {
      setParams({}, { replace: true });
      try {
        const data = JSON.parse(decodeURIComponent(genData));
        generatePlan(data);
      } catch {}
    }
  }, []);

  const generatePlan = async (data) => {
    setGenerating(true);
    try {
      const plan = await api.generateUpskill(data);
      reload();
      loadPlan(plan.id);
    } catch (e) {
      alert("Failed to generate plan: " + e.message);
    } finally {
      setGenerating(false);
    }
  };

  const loadPlan = async (id) => {
    const plan = await api.upskillPlan(id);
    setActivePlan(plan);
  };

  const toggleStep = async (stepId, completed) => {
    await api.toggleStep(stepId, completed);
    if (activePlan) loadPlan(activePlan.id);
    reload();
  };

  const updateStatus = async (id, status) => {
    await api.updateUpskill(id, { status });
    reload();
    if (activePlan?.id === id) loadPlan(id);
  };

  const deletePlan = async (id) => {
    if (!confirm("Delete this upskilling plan?")) return;
    await api.deleteUpskill(id);
    if (activePlan?.id === id) setActivePlan(null);
    reload();
  };

  if (loading) return <div style={{ padding: 48 }}><span className="loader"><span /><span /><span /></span></div>;

  const activePlans = plans.filter((p) => p.status === "active");
  const completedPlans = plans.filter((p) => p.status === "completed");
  const archivedPlans = plans.filter((p) => p.status === "archived");

  return (
    <>
      <div className="page-hd">
        <div>
          <h1>Upskill</h1>
          <p>AI-generated learning plans to close skill gaps and grow your team.</p>
        </div>
      </div>

      {generating && (
        <div className="card" style={{ textAlign: "center", padding: 48, marginBottom: 24 }}>
          <span className="loader" style={{ marginBottom: 16 }}><span /><span /><span /></span>
          <div style={{ fontSize: 14, color: "var(--ink-soft)", marginTop: 16 }}>AI is generating your upskilling plan...</div>
          <div style={{ fontSize: 12, color: "var(--ink-mute)", marginTop: 4 }}>This may take a few seconds.</div>
        </div>
      )}

      <div className="upskill-layout">
        {/* Plan list */}
        <div className="upskill-sidebar">
          {plans.length === 0 && !generating && (
            <div style={{ textAlign: "center", padding: 24, color: "var(--ink-mute)", fontSize: 13 }}>
              No plans yet. Click "Take action" on an upskilling insight in Knowledge Gaps to create one.
            </div>
          )}

          {activePlans.length > 0 && (
            <PlanGroup label="Active" plans={activePlans} activePlan={activePlan} onSelect={loadPlan} />
          )}
          {completedPlans.length > 0 && (
            <PlanGroup label="Completed" plans={completedPlans} activePlan={activePlan} onSelect={loadPlan} />
          )}
          {archivedPlans.length > 0 && (
            <PlanGroup label="Archived" plans={archivedPlans} activePlan={activePlan} onSelect={loadPlan} />
          )}
        </div>

        {/* Plan detail */}
        <div className="upskill-main">
          {activePlan ? (
            <PlanDetail
              plan={activePlan}
              isAdmin={isAdmin}
              userId={user.id}
              onToggleStep={toggleStep}
              onUpdateStatus={updateStatus}
              onDelete={deletePlan}
            />
          ) : (
            <div className="card" style={{ textAlign: "center", padding: 56, color: "var(--ink-mute)" }}>
              {plans.length > 0 ? "Select a plan to view details." : "Create your first upskilling plan from the Gaps page."}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function PlanGroup({ label, plans, activePlan, onSelect }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div className="upskill-group-label">{label}</div>
      {plans.map((p) => {
        const pct = p.total_steps > 0 ? Math.round((p.completed_steps / p.total_steps) * 100) : 0;
        return (
          <div
            key={p.id}
            className={`upskill-plan-item ${activePlan?.id === p.id ? "active" : ""}`}
            onClick={() => onSelect(p.id)}
          >
            <div className="upskill-plan-title">{p.title}</div>
            <div className="upskill-plan-meta">
              {p.user_name} · {p.skill_name || "General"}
            </div>
            {p.total_steps > 0 && (
              <div className="upskill-plan-progress">
                <div className="upskill-plan-bar">
                  <div style={{ width: `${pct}%` }} />
                </div>
                <span>{p.completed_steps}/{p.total_steps}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function PlanDetail({ plan, isAdmin, userId, onToggleStep, onUpdateStatus, onDelete }) {
  const canEdit = isAdmin || plan.user_id === userId;
  const pct = plan.steps?.length > 0 ? Math.round((plan.steps.filter((s) => s.completed).length / plan.steps.length) * 100) : 0;

  return (
    <div className="card upskill-detail">
      {/* Header */}
      <div className="upskill-detail-header">
        <div>
          <div className="upskill-detail-meta">
            {plan.user_name} · {plan.skill_name || "General"} · Created {new Date(plan.created_at).toLocaleDateString()}
          </div>
          <h2 style={{ margin: "4px 0 0", fontSize: 20 }}>{plan.title}</h2>
          {plan.summary && <p style={{ fontSize: 13, color: "var(--ink-soft)", marginTop: 6, lineHeight: 1.5 }}>{plan.summary}</p>}
        </div>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          {plan.status === "active" && (
            <button className="btn ghost small" onClick={() => onUpdateStatus(plan.id, "completed")}>Mark complete</button>
          )}
          {plan.status === "completed" && (
            <button className="btn ghost small" onClick={() => onUpdateStatus(plan.id, "active")}>Reopen</button>
          )}
          <button className="btn ghost small" onClick={() => onUpdateStatus(plan.id, "archived")} style={{ color: "var(--ink-mute)" }}>Archive</button>
          {isAdmin && (
            <button className="btn ghost small" onClick={() => onDelete(plan.id)} style={{ color: "var(--bad)" }}>&times;</button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {plan.steps?.length > 0 && (
        <div className="upskill-progress-strip">
          <div className="upskill-progress-bar">
            <div style={{ width: `${pct}%` }} />
          </div>
          <span className="upskill-progress-label">{pct}% complete</span>
        </div>
      )}

      {/* Steps checklist */}
      <div className="upskill-steps">
        {(plan.steps || []).map((step) => (
          <div key={step.id} className={`upskill-step ${step.completed ? "done" : ""}`}>
            <button
              className={`upskill-check ${step.completed ? "checked" : ""}`}
              onClick={() => canEdit && onToggleStep(step.id, !step.completed)}
              style={{ cursor: canEdit ? "pointer" : "default" }}
            >
              {step.completed && "\u2713"}
            </button>
            <div className="upskill-step-content">
              <div className="upskill-step-title">{step.title}</div>
              {step.description && <div className="upskill-step-desc">{step.description}</div>}
            </div>
          </div>
        ))}
        {(!plan.steps || plan.steps.length === 0) && (
          <div style={{ textAlign: "center", padding: 24, color: "var(--ink-mute)", fontSize: 13 }}>
            No steps in this plan.
          </div>
        )}
      </div>
    </div>
  );
}
