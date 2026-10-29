import React from 'react';
import { 
  Shield, 
  Database, 
  Cpu, 
  Lock, 
  CheckCircle, 
  ArrowRight, 
  Layers, 
  Activity, 
  Sliders, 
  UserCheck, 
  ShieldCheck, 
  Key, 
  Play,
  FileCheck,
  AlertTriangle,
  Server
} from 'lucide-react';
import { api } from '../services/api';
import { UserProfile } from '../types/api';

interface LandingHeroProps {
  onOpenLogin: () => void;
  onOpenDemo: () => void;
  onExploreCatalog: () => void;
  onSelectPersona: (email: string, pass: string) => void;
}

const PRELOADED_PERSONAS = [
  {
    role: 'ANALYST 1',
    name: 'Krish (Lead Epidemiologist)',
    email: 'krish.24bce0846@vitstudent.ac.in',
    password: 'AnalystPass2026!',
    badgeColor: 'badge-cyan',
    icon: Activity,
    desc: 'Authorized clinical researcher submitting DP aggregates, testing bounded Laplace noise, and inspecting query risk telemetry.'
  },
  {
    role: 'ANALYST 2',
    name: 'Parv (Biostatistician)',
    email: 'parv.24bce0870@vitstudent.ac.in',
    password: 'AnalystPass2026!',
    badgeColor: 'badge-cyan',
    icon: Activity,
    desc: 'Collaborative analyst evaluating multi-analyst privacy budget partitions, quota exhaustion, and grant validity.'
  },
  {
    role: 'DATA OWNER',
    name: 'Dr. V. Sivakumar (Chief Data Officer)',
    email: 'dr.sivakumar@vit.ac.in',
    password: 'OwnerPass2026!',
    badgeColor: 'badge-emerald',
    icon: UserCheck,
    desc: 'Chief dataset custodian governing differential privacy policies, allocating epsilon quotas, and managing grant revocations.'
  },
  {
    role: 'COMPLIANCE AUDITOR',
    name: 'Lead Compliance Auditor',
    email: 'compliance.auditor@vit.ac.in',
    password: 'AuditorPass2026!',
    badgeColor: 'badge-violet',
    icon: ShieldCheck,
    desc: 'Independent auditor inspecting immutable trigger-protected financial ledgers, cryptographic HMACs, and forensic access logs.'
  },
  {
    role: 'SYSTEM ADMIN',
    name: 'System Administrator',
    email: 'admin@privacyvault.local',
    password: 'AdminPass2026!',
    badgeColor: 'badge-amber',
    icon: Server,
    desc: 'Global administrator monitoring PostgreSQL 17 health telemetry, connection pools, and zero-trust security invariants.'
  }
];

export const LandingHero: React.FC<LandingHeroProps> = ({
  onOpenLogin,
  onOpenDemo,
  onExploreCatalog,
  onSelectPersona
}) => {
  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: '36px 24px', display: 'flex', flexDirection: 'column', gap: 48 }}>
      
      {/* Hero Header Section */}
      <section style={{ textAlign: 'center', maxWidth: 960, margin: '0 auto' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 9999, background: 'var(--accent-primary-light)', border: '1px solid var(--border-info)', marginBottom: 20, fontSize: '0.78rem', color: 'var(--accent-primary)', fontWeight: 600 }}>
          <Shield size={14} />
          ISO/IEC 27701 & HIPAA Safe-Harbor Enclave | Differential Privacy 3NF Gateway
        </div>

        <h1 style={{ fontSize: '2.8rem', lineHeight: 1.15, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 18, color: 'var(--text-primary)' }}>
          Zero-Trust Differential Privacy <br />
          <span style={{ color: 'var(--accent-primary)' }}>for Relational Clinical Databases</span>
        </h1>

        <p style={{ fontSize: '1.05rem', color: 'var(--text-secondary)', lineHeight: 1.65, maxWidth: 780, margin: '0 auto 28px auto' }}>
          Execute explainable, mathematically provable aggregate queries over <strong>10,000 sensitive inpatient records</strong> without exposing raw microdata. 
          Protected by <strong>Harvard OpenDP 0.16.0</strong> Laplace/Gaussian noise mechanisms, 
          atomic row-locked budget ledger triggers, and automated query-history differencing attack defense.
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 14, flexWrap: 'wrap' }}>
          <button 
            onClick={onOpenLogin} 
            className="btn btn-primary" 
            style={{ padding: '12px 28px', fontSize: '0.95rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 14px 0 rgba(30, 64, 175, 0.25)' }}
          >
            <Key size={16} />
            1-Click Persona Simulator
          </button>
          
          <button 
            onClick={onOpenDemo} 
            className="btn btn-secondary" 
            style={{ padding: '12px 24px', fontSize: '0.95rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 8 }}
          >
            <Play size={16} color="var(--color-warning)" />
            Run Compliance Defense Scenarios (A–H)
          </button>

          <button 
            onClick={onExploreCatalog} 
            className="btn btn-secondary" 
            style={{ padding: '12px 20px', fontSize: '0.95rem', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 8 }}
          >
            <Database size={16} color="var(--accent-primary)" />
            Inspect Schema Metadata
          </button>
        </div>

        {/* Live Architecture Status Chips */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 28, flexWrap: 'wrap' }}>
          <span className="badge badge-cyan" style={{ fontSize: '0.74rem', padding: '5px 12px' }}>
            <Database size={12} /> PostgreSQL 17 (3NF Normalized Schema)
          </span>
          <span className="badge badge-emerald" style={{ fontSize: '0.74rem', padding: '5px 12px' }}>
            <Cpu size={12} /> OpenDP 0.16.0 Laplace & Gaussian Core
          </span>
          <span className="badge badge-violet" style={{ fontSize: '0.74rem', padding: '5px 12px' }}>
            <Lock size={12} /> Trigger-Protected Append-Only Ledger
          </span>
          <span className="badge badge-amber" style={{ fontSize: '0.74rem', padding: '5px 12px' }}>
            <AlertTriangle size={12} /> Query-History Differencing Defense
          </span>
        </div>
      </section>

      {/* Live Enterprise Telemetry Grid */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
        <div className="glass-panel" style={{ padding: 24, borderTop: '4px solid var(--accent-primary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Clinical Cohort</span>
            <div style={{ width: 32, height: 32, borderRadius: 'var(--radius-sm)', background: 'var(--bg-info)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Database size={16} color="var(--accent-primary)" />
            </div>
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>10,000 Records</div>
          <div style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Synthetic multi-specialty clinical admissions table with ICD-10 codes, treatment costs, and outcomes. RLS blocks microdata leakage.
          </div>
        </div>

        <div className="glass-panel" style={{ padding: 24, borderTop: '4px solid var(--color-success)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Privacy Guarantees</span>
            <div style={{ width: 32, height: 32, borderRadius: 'var(--radius-sm)', background: 'var(--bg-success)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Cpu size={16} color="var(--color-success)" />
            </div>
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--color-success)', marginBottom: 4 }}>Pure & Approx DP</div>
          <div style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Provable bounds: Pure (ε, 0)-DP via Laplace mechanism and Approximate (ε, δ)-DP via Gaussian mechanism with sensitivity clamping.
          </div>
        </div>

        <div className="glass-panel" style={{ padding: 24, borderTop: '4px solid var(--color-purple)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Ledger Integrity</span>
            <div style={{ width: 32, height: 32, borderRadius: 'var(--radius-sm)', background: 'var(--bg-purple)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Lock size={16} color="var(--color-purple)" />
            </div>
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--color-purple)', marginBottom: 4 }}>Append-Only Trigger</div>
          <div style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Trigger <code>tr_enforce_append_only_ledger</code> forbids all UPDATE/DELETE queries on financial budget ledger with atomic row-locking.
          </div>
        </div>

        <div className="glass-panel" style={{ padding: 24, borderTop: '4px solid var(--color-danger)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Adversarial Shield</span>
            <div style={{ width: 32, height: 32, borderRadius: 'var(--radius-sm)', background: 'var(--bg-danger)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShieldCheck size={16} color="var(--color-danger)" />
            </div>
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--color-danger)', marginBottom: 4 }}>Differencing Block</div>
          <div style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Automatic query-history analysis catches single-out subtraction attacks and denies overlapping queries before database execution.
          </div>
        </div>
      </section>

      {/* 1-Click Interactive Persona Launcher Board */}
      <section className="glass-panel" style={{ padding: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2 style={{ fontSize: '1.3rem', display: 'flex', alignItems: 'center', gap: 10 }}>
              <Key size={20} color="var(--accent-primary)" />
              1-Click Academic & Evaluation Persona Launcher
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 4 }}>
              Instantly authenticate as any authorized role to evaluate permissions, differential privacy workflows, and governance controls.
            </p>
          </div>
          <span className="badge badge-cyan" style={{ fontSize: '0.72rem' }}>PostgreSQL Single Users Table RBAC</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
          {PRELOADED_PERSONAS.map((p) => {
            const Icon = p.icon;
            return (
              <button
                key={p.email}
                type="button"
                onClick={() => onSelectPersona(p.email, p.password)}
                className="glass-panel"
                style={{
                  padding: 20,
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  textAlign: 'left',
                  background: 'var(--bg-surface)',
                  transition: 'all 0.2s ease',
                  border: '1px solid var(--border-subtle)',
                  width: '100%',
                  fontFamily: 'inherit'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--accent-primary)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = 'var(--shadow-dropdown)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-subtle)';
                  e.currentTarget.style.transform = 'none';
                  e.currentTarget.style.boxShadow = 'var(--shadow-card)';
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <span className={`badge ${p.badgeColor}`} style={{ fontSize: '0.65rem' }}>{p.role}</span>
                    <Icon size={16} color="var(--text-muted)" />
                  </div>
                  <h3 style={{ fontSize: '0.98rem', fontWeight: 700, marginBottom: 4, color: 'var(--text-primary)' }}>{p.name}</h3>
                  <div style={{ fontSize: '0.72rem', color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)', marginBottom: 10 }}>
                    {p.email}
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.45, marginBottom: 16 }}>
                    {p.desc}
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', fontWeight: 600, color: 'var(--accent-primary)' }}>
                  Launch Session <ArrowRight size={14} />
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* 5-Stage Zero-Trust Differential Privacy Pipeline Architecture */}
      <section className="glass-panel" style={{ padding: 32 }}>
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: '1.3rem', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Layers size={20} color="var(--accent-primary)" />
            5-Stage Zero-Trust Differential Privacy Pipeline Architecture
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 4 }}>
            From structured parameter inputs to cryptographically signed noisy outputs — zero direct SQL and zero microdata exposure.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
          <div style={{ padding: 18, background: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--accent-primary)', marginBottom: 6 }}>STAGE 1</div>
            <h4 style={{ fontSize: '0.92rem', marginBottom: 6, fontWeight: 700 }}>Structured Aggregate</h4>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
              Analyst specifies approved metric (<code>COUNT</code>, <code>BOUNDED_SUM</code>, <code>BOUNDED_AVG</code>) and cohort filters. Direct SQL is blocked.
            </p>
          </div>

          <div style={{ padding: 18, background: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-danger)', marginBottom: 6 }}>STAGE 2</div>
            <h4 style={{ fontSize: '0.92rem', marginBottom: 6, fontWeight: 700 }}>Differencing Defense</h4>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
              Risk engine cross-checks candidate query against past releases to intercept sub-cohort isolation and reconstruction attempts.
            </p>
          </div>

          <div style={{ padding: 18, background: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-purple)', marginBottom: 6 }}>STAGE 3</div>
            <h4 style={{ fontSize: '0.92rem', marginBottom: 6, fontWeight: 700 }}>Row-Locked Ledger</h4>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
              Database executes <code>SELECT ... FOR UPDATE</code> in serializable transaction to atomically reserve privacy budget.
            </p>
          </div>

          <div style={{ padding: 18, background: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-success)', marginBottom: 6 }}>STAGE 4</div>
            <h4 style={{ fontSize: '0.92rem', marginBottom: 6, fontWeight: 700 }}>OpenDP Rust Enclave</h4>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
              Harvard OpenDP computes calibrated sensitivity $\Delta f$ and adds mathematically sound Laplace or Gaussian perturbation.
            </p>
          </div>

          <div style={{ padding: 18, background: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--accent-primary)', marginBottom: 6 }}>STAGE 5</div>
            <h4 style={{ fontSize: '0.92rem', marginBottom: 6, fontWeight: 700 }}>Signed Verification</h4>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
              Emits perturbed statistic with cryptographic SHA-256 HMAC verification token into immutable ledger.
            </p>
          </div>
        </div>
      </section>

      {/* Interactive Demonstration Scenarios Preview (A–H) */}
      <section className="glass-panel" style={{ padding: 32, borderLeft: '4px solid var(--color-warning)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2 style={{ fontSize: '1.3rem', display: 'flex', alignItems: 'center', gap: 10 }}>
              <Play size={20} color="var(--color-warning)" />
              Automated Security & Compliance Test Scenarios (A–H)
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 4 }}>
              Validates 8 core privacy, concurrency, and adversarial defense capabilities directly against live PostgreSQL and OpenDP runtimes.
            </p>
          </div>
          <button onClick={onOpenDemo} className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Play size={14} /> Launch All Scenarios
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
          <div style={{ padding: 14, background: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent-primary)' }}>SCENARIO A</div>
            <div style={{ fontWeight: 600, fontSize: '0.85rem', marginTop: 2 }}>Ordinary DP Aggregate Release</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>OpenDP Laplace execution with calibrated noise scale $b = \Delta f / \epsilon$.</div>
          </div>

          <div style={{ padding: 14, background: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-danger)' }}>SCENARIO B</div>
            <div style={{ fontWeight: 600, fontSize: '0.85rem', marginTop: 2 }}>Direct Identifier & SQL Injection Block</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>Strict query AST validation denying direct MRN and SQL injection payloads.</div>
          </div>

          <div style={{ padding: 14, background: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-warning)' }}>SCENARIO C</div>
            <div style={{ fontWeight: 600, fontSize: '0.85rem', marginTop: 2 }}>Differencing Attack Defense</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>Risk engine thwarts targeted individual reconstruction across query histories.</div>
          </div>

          <div style={{ padding: 14, background: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-danger)' }}>SCENARIO D</div>
            <div style={{ fontWeight: 600, fontSize: '0.85rem', marginTop: 2 }}>Privacy Budget Exhaustion Denial</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>Enforces atomic ledger block when requested $\epsilon$ exceeds remaining quota.</div>
          </div>

          <div style={{ padding: 14, background: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-purple)' }}>SCENARIO E</div>
            <div style={{ fontWeight: 600, fontSize: '0.85rem', marginTop: 2 }}>Restricted Runtime Role Isolation</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>Direct microdata access blocked via PostgreSQL least-privilege role privileges.</div>
          </div>

          <div style={{ padding: 14, background: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-emerald)' }}>SCENARIO F</div>
            <div style={{ fontWeight: 600, fontSize: '0.85rem', marginTop: 2 }}>Dynamic Access Grant Revocation</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>Immediate invalidation of analyst dataset grants by the data custodian.</div>
          </div>

          <div style={{ padding: 14, background: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent-primary)' }}>SCENARIO G</div>
            <div style={{ fontWeight: 600, fontSize: '0.85rem', marginTop: 2 }}>Atomic Failure Recovery & Refund</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>Automated budget rollback if query pipeline fails mid-execution.</div>
          </div>

          <div style={{ padding: 14, background: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-violet)' }}>SCENARIO H</div>
            <div style={{ fontWeight: 600, fontSize: '0.85rem', marginTop: 2 }}>Immutable Audit Trail Verification</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>Forensic analysis of trigger-enforced ledger and cryptographic HMAC trail.</div>
          </div>
        </div>
      </section>

    </div>
  );
};
