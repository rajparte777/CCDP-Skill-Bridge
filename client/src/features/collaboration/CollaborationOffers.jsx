import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import Badge from '../../components/Badge';
import Modal from '../../components/Modal';
import {
  DollarSign, HeartHandshake, Plus, Check, X, CreditCard,
  ShieldCheck, CheckCircle2, FileText, Send, Eye, Clock,
  ArrowRight, ExternalLink, AlertCircle, RefreshCw, Layers,
  Receipt, UserCheck, Sparkles, Filter
} from 'lucide-react';

export default function CollaborationOffers({
  projectId,
  projectMembers = [],
  currentUser,
  isOwner,
  viewMode = 'project' // 'project' or 'user'
}) {
  const [subView, setSubView] = useState('agreements'); // 'agreements', 'ledger', 'requests'
  const [offers, setOffers] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [ledgerSummary, setLedgerSummary] = useState(null);
  const [requests, setRequests] = useState([]);
  const [projectTasks, setProjectTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [statusFilter, setStatusFilter] = useState('all');

  // Modals state
  const [isNewOfferModalOpen, setIsNewOfferModalOpen] = useState(false);
  const [selectedOfferForDeliverable, setSelectedOfferForDeliverable] = useState(null);
  const [selectedOfferForReview, setSelectedOfferForReview] = useState(null);
  const [selectedOfferForPayment, setSelectedOfferForPayment] = useState(null);
  const [selectedReceipt, setSelectedReceipt] = useState(null);

  // New Offer Form state
  const [contributorId, setContributorId] = useState('');
  const [terms, setTerms] = useState('');
  const [amount, setAmount] = useState('250.00');
  const [currency, setCurrency] = useState('USD');
  const [isPaid, setIsPaid] = useState(true);
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [customMilestoneTitle, setCustomMilestoneTitle] = useState('');

  // Deliverables submission form
  const [deliverableNote, setDeliverableNote] = useState('');
  const [deliverableUrl, setDeliverableUrl] = useState('');

  // Payment rail form
  const [paymentRail, setPaymentRail] = useState('sandbox_card');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  useEffect(() => {
    loadAllData();
  }, [projectId, viewMode]);

  async function loadAllData() {
    setLoading(true);
    await Promise.all([
      loadOffers(),
      loadLedger(),
      (viewMode === 'project' && isOwner) ? loadRequests() : Promise.resolve(),
      (projectId) ? loadTasks() : Promise.resolve()
    ]);
    setLoading(false);
  }

  async function loadOffers() {
    try {
      if (viewMode === 'project') {
        const res = await api.get(`/collaborations/projects/${projectId}`);
        setOffers(res.offers || []);
      } else {
        const res = await api.get('/collaborations/my');
        setOffers(res.offers || []);
      }
    } catch (err) {
      console.error('Failed to load offers:', err);
    }
  }

  async function loadLedger() {
    try {
      const res = await api.get('/collaborations/ledger');
      setLedger(res.ledger || []);
      setLedgerSummary(res.summary || null);
    } catch (err) {
      console.error('Failed to load ledger:', err);
    }
  }

  async function loadRequests() {
    if (!projectId) return;
    try {
      const res = await api.get(`/collaborations/projects/${projectId}/requests`);
      setRequests(res.requests || []);
    } catch (err) {
      console.error('Failed to load collaboration requests:', err);
    }
  }

  async function loadTasks() {
    if (!projectId) return;
    try {
      const res = await api.get(`/tasks/${projectId}`);
      setProjectTasks(res.tasks || []);
    } catch (err) {
      console.error('Failed to load tasks:', err);
    }
  }

  // Create new collaboration offer
  async function handleCreateOffer(e) {
    e.preventDefault();
    if (!contributorId || !terms.trim()) return;

    try {
      await api.post(`/collaborations/projects/${projectId}`, {
        contributor_id: contributorId,
        terms: terms.trim(),
        amount: isPaid ? parseFloat(amount) : 0,
        currency,
        task_id: selectedTaskId || null,
        milestone_title: customMilestoneTitle.trim() || undefined
      });

      setIsNewOfferModalOpen(false);
      setTerms('');
      setContributorId('');
      setSelectedTaskId('');
      setCustomMilestoneTitle('');
      await loadOffers();
    } catch (err) {
      alert(err.message || 'Failed to create offer');
    }
  }

  // Contributor accepts or declines offer
  async function handleRespondOffer(offerId, action) {
    try {
      await api.put(`/collaborations/${offerId}/respond`, { action });
      await loadOffers();
    } catch (err) {
      alert(err.message || 'Failed to respond to offer');
    }
  }

  // Contributor submits deliverables for milestone
  async function handleSubmitDeliverable(e) {
    e.preventDefault();
    if (!selectedOfferForDeliverable) return;

    try {
      await api.put(`/collaborations/${selectedOfferForDeliverable.id}/submit-deliverable`, {
        deliverable_note: deliverableNote.trim(),
        deliverable_url: deliverableUrl.trim()
      });
      setSelectedOfferForDeliverable(null);
      setDeliverableNote('');
      setDeliverableUrl('');
      await loadOffers();
      alert('Milestone deliverables submitted successfully for review!');
    } catch (err) {
      alert(err.message || 'Failed to submit deliverable');
    }
  }

  // Owner reviews milestone deliverable
  async function handleReviewMilestone(offerId, action) {
    try {
      await api.put(`/collaborations/${offerId}/review-milestone`, { action });
      setSelectedOfferForReview(null);
      await loadOffers();
      alert(action === 'approved' ? 'Milestone approved! You can now settle payment.' : 'Revisions requested.');
    } catch (err) {
      alert(err.message || 'Failed to review milestone');
    }
  }

  // Owner settles payment in provider sandbox
  async function handleExecutePayment(e) {
    e.preventDefault();
    if (!selectedOfferForPayment) return;

    setIsProcessingPayment(true);
    try {
      // Step 1: Initiate payment session (FR-33)
      const initRes = await api.post('/payments/initiate', {
        offerId: selectedOfferForPayment.id,
        method: paymentRail
      });
      const providerRef = initRes.payment.provider_reference;

      // Step 2: Confirm in provider sandbox (FR-34)
      await api.post('/payments/sandbox/confirm', {
        provider_reference: providerRef,
        status: 'completed'
      });

      await Promise.all([loadOffers(), loadLedger()]);
      setSelectedOfferForPayment(null);
      alert(`Payment settled successfully in sandbox!\nProvider Reference: ${providerRef}`);
    } catch (err) {
      alert(err.message || 'Payment settlement failed');
    } finally {
      setIsProcessingPayment(false);
    }
  }

  // View receipt
  async function handleViewReceipt(paymentId) {
    try {
      const res = await api.get(`/payments/receipt/${paymentId}`);
      setSelectedReceipt(res.receipt);
    } catch (err) {
      alert('Could not fetch receipt: ' + err.message);
    }
  }

  // Owner responds to collaboration inquiry
  async function handleRespondRequest(requestId, action) {
    try {
      await api.put(`/collaborations/requests/${requestId}/respond`, { action });
      await loadRequests();
    } catch (err) {
      alert(err.message || 'Failed to update request');
    }
  }

  const statusVariant = {
    pending: 'amber',
    accepted: 'blue',
    declined: 'red',
    completed: 'green'
  };

  const filteredOffers = offers.filter(o => {
    if (statusFilter === 'all') return true;
    return o.status === statusFilter;
  });

  return (
    <div>
      {/* Top Header & Navigation Switcher */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>{viewMode === 'project' ? 'Project Collaboration & Milestone Agreements' : 'My Collaboration Agreements & Financial Ledger'}</span>
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Structured agreements, milestone deliverables, verified provider sandbox settlements, and audit ledgers.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {viewMode === 'project' && isOwner && (
            <button className="btn btn-primary btn-sm" onClick={() => setIsNewOfferModalOpen(true)}>
              <Plus size={15} />
              <span>Create Milestone Offer</span>
            </button>
          )}
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="tabs" style={{ marginBottom: 20 }}>
        <button
          className={`tab-btn ${subView === 'agreements' ? 'active' : ''}`}
          onClick={() => setSubView('agreements')}
        >
          <Layers size={15} />
          <span>Agreements & Milestones ({offers.length})</span>
        </button>

        <button
          className={`tab-btn ${subView === 'ledger' ? 'active' : ''}`}
          onClick={() => setSubView('ledger')}
        >
          <CreditCard size={15} />
          <span>Financial Ledger & Receipts ({ledger.length})</span>
        </button>

        {viewMode === 'project' && isOwner && (
          <button
            className={`tab-btn ${subView === 'requests' ? 'active' : ''}`}
            onClick={() => setSubView('requests')}
          >
            <UserCheck size={15} />
            <span>Collaboration Inquiries ({requests.filter(r => r.status === 'pending').length})</span>
          </button>
        )}
      </div>

      {/* ===================== VIEW 1: AGREEMENTS & MILESTONES ===================== */}
      {subView === 'agreements' && (
        <div>
          {/* Filter Bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Filter size={14} style={{ color: 'var(--text-dim)' }} />
              <span style={{ fontSize: '0.82rem', color: 'var(--text-dim)' }}>Filter Status:</span>
              {['all', 'pending', 'accepted', 'completed', 'declined'].map((st) => (
                <button
                  key={st}
                  className={`btn btn-sm ${statusFilter === st ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ textTransform: 'capitalize', fontSize: '0.78rem', padding: '3px 10px' }}
                  onClick={() => setStatusFilter(st)}
                >
                  {st}
                </button>
              ))}
            </div>

            <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
              Showing {filteredOffers.length} of {offers.length} agreements
            </span>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--text-muted)' }}>Loading agreements...</div>
          ) : filteredOffers.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '50px 20px' }}>
              <HeartHandshake size={36} style={{ color: 'var(--text-dim)', marginBottom: 12 }} />
              <h3 style={{ fontSize: '1.05rem', marginBottom: 6 }}>No Collaboration Agreements Found</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                {viewMode === 'project'
                  ? 'Define scope, milestones, and compensation terms for your project team members.'
                  : 'You do not have any agreements matching the current filter.'}
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {filteredOffers.map((offer) => {
                const isTargetContributor = currentUser?.id === offer.contributor_id;
                const isCreator = currentUser?.id === offer.creator_id;
                const isOfferPaid = parseFloat(offer.amount) > 0;

                return (
                  <div key={offer.id} className="card" style={{ padding: '20px 22px' }}>
                    {/* Header Chips */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Badge variant={statusVariant[offer.status] || 'gray'}>
                          {offer.status.toUpperCase()}
                        </Badge>

                        <Badge variant={isOfferPaid ? 'purple' : 'blue'}>
                          {isOfferPaid ? (
                            <>
                              <DollarSign size={13} />
                              <span>{offer.currency} {parseFloat(offer.amount).toFixed(2)}</span>
                            </>
                          ) : (
                            <>
                              <HeartHandshake size={13} />
                              <span>Free / Open Source</span>
                            </>
                          )}
                        </Badge>

                        {/* Milestone Status Badge */}
                        {offer.status === 'accepted' && (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            padding: '2px 8px',
                            borderRadius: '12px',
                            background: offer.milestone_status === 'approved'
                              ? 'var(--accent-green-bg)'
                              : offer.milestone_status === 'submitted'
                              ? 'var(--accent-blue-bg)'
                              : 'var(--accent-amber-bg)',
                            color: offer.milestone_status === 'approved'
                              ? 'var(--accent-green)'
                              : offer.milestone_status === 'submitted'
                              ? 'var(--accent-blue)'
                              : 'var(--accent-amber)'
                          }}>
                            <Clock size={11} />
                            Milestone: {offer.milestone_status === 'approved' ? 'Approved & Ready to Settle' : offer.milestone_status === 'submitted' ? 'Deliverables In Review' : 'Work In Progress'}
                          </span>
                        )}
                      </div>

                      <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                        Created {new Date(offer.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    {/* Milestone / Task Link Pill if available */}
                    {(offer.milestone_title || offer.task_title) && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        background: '#0d1117',
                        border: '1px solid var(--border-color)',
                        padding: '6px 12px',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.82rem',
                        marginBottom: 12
                      }}>
                        <Sparkles size={14} style={{ color: 'var(--accent-purple)' }} />
                        <span style={{ color: 'var(--text-dim)' }}>Linked Milestone:</span>
                        <strong style={{ color: 'var(--text-main)' }}>{offer.milestone_title || offer.task_title}</strong>
                        {offer.task_status && (
                          <span style={{ color: 'var(--text-dim)', fontSize: '0.75rem', marginLeft: 'auto' }}>
                            Task Board Status: <code>{offer.task_status}</code>
                          </span>
                        )}
                      </div>
                    )}

                    {/* Project Title (if global view) */}
                    {viewMode === 'user' && offer.project_title && (
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-dim)', marginBottom: 6 }}>
                        Project: <strong style={{ color: 'var(--accent-blue)' }}>{offer.project_title}</strong>
                      </div>
                    )}

                    {/* Terms & Scope */}
                    <h4 style={{ fontSize: '0.96rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: 6 }}>
                      Agreement Scope & Deliverables:
                    </h4>
                    <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 14 }}>
                      {offer.terms}
                    </p>

                    {/* Contributor Deliverable Notes (if submitted) */}
                    {offer.deliverable_note && (
                      <div style={{
                        background: 'rgba(31, 111, 235, 0.08)',
                        border: '1px solid rgba(31, 111, 235, 0.3)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '10px 14px',
                        marginBottom: 14,
                        fontSize: '0.84rem'
                      }}>
                        <div style={{ fontWeight: 600, color: 'var(--accent-blue)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <CheckCircle2 size={14} /> Contributor Submitted Deliverable:
                        </div>
                        <p style={{ color: 'var(--text-main)', marginBottom: 6 }}>{offer.deliverable_note}</p>
                        {offer.deliverable_url && (
                          <a
                            href={offer.deliverable_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--accent-blue)', fontSize: '0.8rem', textDecoration: 'underline' }}
                          >
                            <span>Open Verification URL / PR / Branch</span>
                            <ExternalLink size={12} />
                          </a>
                        )}
                      </div>
                    )}

                    {/* Parties Involved & Actions */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingTop: 12,
                      borderTop: '1px solid var(--border-color)',
                      flexWrap: 'wrap',
                      gap: 12
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 20, fontSize: '0.82rem', color: 'var(--text-dim)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span>Creator:</span>
                          <img src={offer.creator_avatar || 'https://api.dicebear.com/7.x/bottts/svg?seed=c'} alt="" style={{ width: 20, height: 20, borderRadius: '50%' }} />
                          <strong style={{ color: 'var(--text-main)' }}>{offer.creator_name}</strong>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span>Contributor:</span>
                          <img src={offer.contributor_avatar || 'https://api.dicebear.com/7.x/bottts/svg?seed=u'} alt="" style={{ width: 20, height: 20, borderRadius: '50%' }} />
                          <strong style={{ color: 'var(--text-main)' }}>{offer.contributor_name}</strong>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        {/* Contributor accept/decline */}
                        {isTargetContributor && offer.status === 'pending' && (
                          <>
                            <button className="btn btn-primary btn-sm" onClick={() => handleRespondOffer(offer.id, 'accepted')}>
                              <Check size={14} /> Accept Terms
                            </button>
                            <button className="btn btn-secondary btn-sm" onClick={() => handleRespondOffer(offer.id, 'declined')}>
                              <X size={14} /> Decline
                            </button>
                          </>
                        )}

                        {/* Contributor: Submit Deliverables */}
                        {isTargetContributor && offer.status === 'accepted' && (
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => {
                              setSelectedOfferForDeliverable(offer);
                              setDeliverableNote(offer.deliverable_note || '');
                              setDeliverableUrl(offer.deliverable_url || '');
                            }}
                          >
                            <Send size={13} />
                            <span>{offer.milestone_status === 'submitted' ? 'Update Deliverable' : 'Submit Deliverable'}</span>
                          </button>
                        )}

                        {/* Creator: Review Deliverables */}
                        {isCreator && offer.status === 'accepted' && offer.milestone_status === 'submitted' && (
                          <button
                            className="btn btn-outline-blue btn-sm"
                            onClick={() => setSelectedOfferForReview(offer)}
                          >
                            <Eye size={13} />
                            <span>Review Deliverable</span>
                          </button>
                        )}

                        {/* Creator: Settle Payment */}
                        {isCreator && isOfferPaid && offer.status === 'accepted' && (
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => setSelectedOfferForPayment(offer)}
                          >
                            <CreditCard size={14} />
                            <span>Settle Sandbox Payment</span>
                          </button>
                        )}

                        {/* Completed Payment Badge & Receipt */}
                        {offer.status === 'completed' && isOfferPaid && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ color: 'var(--accent-green)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 5, fontWeight: 600 }}>
                              <CheckCircle2 size={15} /> Settled ({offer.provider_reference || 'Sandbox Verified'})
                            </span>
                            {offer.payment_id && (
                              <button
                                className="btn btn-secondary btn-sm"
                                style={{ padding: '3px 8px', fontSize: '0.75rem' }}
                                onClick={() => handleViewReceipt(offer.payment_id)}
                              >
                                <Receipt size={12} /> Receipt
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ===================== VIEW 2: FINANCIAL LEDGER & RECEIPTS ===================== */}
      {subView === 'ledger' && (
        <div>
          {/* Summary KPI Cards */}
          {ledgerSummary && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 20 }}>
              <div className="card" style={{ padding: '16px' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Disbursed (Paid Out)</span>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--accent-purple)', marginTop: 4 }}>
                  ${ledgerSummary.totalDisbursed}
                </div>
              </div>

              <div className="card" style={{ padding: '16px' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Received (Earned)</span>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--accent-green)', marginTop: 4 }}>
                  ${ledgerSummary.totalReceived}
                </div>
              </div>

              <div className="card" style={{ padding: '16px' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Pending Commitments</span>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--accent-amber)', marginTop: 4 }}>
                  ${ledgerSummary.pendingDisbursements}
                </div>
              </div>

              <div className="card" style={{ padding: '16px' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Settled Transactions</span>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--accent-blue)', marginTop: 4 }}>
                  {ledgerSummary.totalTransactions}
                </div>
              </div>
            </div>
          )}

          {/* Ledger Table */}
          {ledger.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '50px 20px' }}>
              <Receipt size={36} style={{ color: 'var(--text-dim)', marginBottom: 12 }} />
              <h3 style={{ fontSize: '1.05rem', marginBottom: 6 }}>No Transaction Records in Ledger</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Once milestone agreements are paid and confirmed via the payment sandbox, official transaction records will appear here.
              </p>
            </div>
          ) : (
            <div className="card" style={{ padding: '0', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', background: '#0d1117', color: 'var(--text-dim)' }}>
                    <th style={{ padding: '12px 16px' }}>Date</th>
                    <th style={{ padding: '12px 16px' }}>Provider Reference</th>
                    <th style={{ padding: '12px 16px' }}>Project</th>
                    <th style={{ padding: '12px 16px' }}>Payer / Payee</th>
                    <th style={{ padding: '12px 16px' }}>Rail</th>
                    <th style={{ padding: '12px 16px' }}>Amount</th>
                    <th style={{ padding: '12px 16px' }}>Status</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Receipt</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.map((item) => (
                    <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '12px 16px', color: 'var(--text-dim)' }}>
                        {new Date(item.created_at).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--accent-blue)' }}>
                        {item.provider_reference}
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                        {item.project_title}
                      </td>
                      <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>
                        <div>From: <strong>{item.payer_name}</strong></div>
                        <div>To: <strong>{item.payee_name}</strong></div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <code style={{ fontSize: '0.75rem', background: '#21262d', padding: '2px 6px', borderRadius: '4px' }}>
                          {item.method || 'sandbox_card'}
                        </code>
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-main)' }}>
                        {item.currency} {parseFloat(item.amount).toFixed(2)}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <Badge variant={item.status === 'completed' ? 'green' : 'amber'}>
                          {item.status.toUpperCase()}
                        </Badge>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '4px 8px' }}
                          onClick={() => handleViewReceipt(item.id)}
                        >
                          <Receipt size={13} />
                          <span>View</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ===================== VIEW 3: COLLABORATION INQUIRIES ===================== */}
      {subView === 'requests' && viewMode === 'project' && isOwner && (
        <div>
          {requests.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '50px 20px' }}>
              <UserCheck size={36} style={{ color: 'var(--text-dim)', marginBottom: 12 }} />
              <h3 style={{ fontSize: '1.05rem', marginBottom: 6 }}>No Collaboration Inquiries Yet</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Developers exploring your project can submit collaboration requests explaining what they can contribute.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {requests.map((req) => (
                <div key={req.id} className="card" style={{ padding: '18px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <img src={req.avatar_url || 'https://api.dicebear.com/7.x/bottts/svg?seed=u'} alt="" style={{ width: 32, height: 32, borderRadius: '50%' }} />
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{req.name}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                          Applied for role: <strong style={{ color: 'var(--accent-blue)', textTransform: 'capitalize' }}>{req.role}</strong>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Badge variant={statusVariant[req.status] || 'gray'}>
                        {req.status.toUpperCase()}
                      </Badge>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                        {new Date(req.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <div style={{
                    background: '#0d1117',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '12px 14px',
                    marginBottom: 14,
                    fontSize: '0.88rem',
                    color: 'var(--text-muted)'
                  }}>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: 4, fontWeight: 600 }}>
                      Applicant Pitch / Proposed Contribution:
                    </div>
                    {req.pitch}
                  </div>

                  {req.status === 'pending' && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleRespondRequest(req.id, 'declined')}
                      >
                        <X size={14} /> Decline
                      </button>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => handleRespondRequest(req.id, 'accepted')}
                      >
                        <Check size={14} /> Accept as {req.role}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===================== MODAL: CREATE COLLABORATION OFFER ===================== */}
      <Modal isOpen={isNewOfferModalOpen} onClose={() => setIsNewOfferModalOpen(false)} title="Create Milestone Collaboration Offer">
        <form onSubmit={handleCreateOffer}>
          <div className="form-group">
            <label className="form-label">Target Contributor *</label>
            <select
              className="input-select"
              value={contributorId}
              onChange={(e) => setContributorId(e.target.value)}
              required
            >
              <option value="">Select project member...</option>
              {projectMembers.filter(m => m.user_id !== currentUser?.id).map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.name} ({m.role})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Agreement Type</label>
            <div style={{ display: 'flex', gap: 16 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.88rem', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="offer_type"
                  checked={isPaid}
                  onChange={() => setIsPaid(true)}
                />
                Paid Milestone Offer
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.88rem', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="offer_type"
                  checked={!isPaid}
                  onChange={() => setIsPaid(false)}
                />
                Free / Unpaid Collaboration
              </label>
            </div>
          </div>

          {/* Link Task / Milestone (FR-31) */}
          <div className="form-group">
            <label className="form-label">Link Project Kanban Task (Optional)</label>
            <select
              className="input-select"
              value={selectedTaskId}
              onChange={(e) => {
                setSelectedTaskId(e.target.value);
                const task = projectTasks.find(t => t.id === e.target.value);
                if (task) {
                  setCustomMilestoneTitle(task.title);
                }
              }}
            >
              <option value="">-- No linked task (manual milestone) --</option>
              {projectTasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title} [{t.status}]
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Milestone Title</label>
            <input
              type="text"
              className="input-text"
              placeholder="e.g. Implement WebSocket CRDT Synchronizer"
              value={customMilestoneTitle}
              onChange={(e) => setCustomMilestoneTitle(e.target.value)}
            />
          </div>

          {isPaid && (
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Compensation Amount *</label>
                <input
                  type="number"
                  step="0.01"
                  className="input-text"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Currency</label>
                <select className="input-select" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="INR">INR (₹)</option>
                  <option value="GBP">GBP (£)</option>
                </select>
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Terms & Deliverables Scope *</label>
            <textarea
              className="input-textarea"
              placeholder="Specify the milestone deliverables, technical requirements, acceptance criteria, and timeline..."
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
              rows={4}
              required
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setIsNewOfferModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Send Milestone Offer
            </button>
          </div>
        </form>
      </Modal>

      {/* ===================== MODAL: SUBMIT DELIVERABLES ===================== */}
      <Modal
        isOpen={Boolean(selectedOfferForDeliverable)}
        onClose={() => setSelectedOfferForDeliverable(null)}
        title="Submit Milestone Deliverables for Review"
      >
        <form onSubmit={handleSubmitDeliverable}>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: 14 }}>
            Agreement: <strong>{selectedOfferForDeliverable?.milestone_title || selectedOfferForDeliverable?.terms.slice(0, 40)}</strong>
          </p>

          <div className="form-group">
            <label className="form-label">Work Summary & Deliverables Completed *</label>
            <textarea
              className="input-textarea"
              placeholder="Detail the code modules implemented, test results, and verification steps performed..."
              value={deliverableNote}
              onChange={(e) => setDeliverableNote(e.target.value)}
              rows={4}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Proof / Verification URL (PR Link, Git Commit, or Deployment)</label>
            <input
              type="url"
              className="input-text"
              placeholder="https://github.com/owner/repo/pull/42"
              value={deliverableUrl}
              onChange={(e) => setDeliverableUrl(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setSelectedOfferForDeliverable(null)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              <Send size={14} /> Submit for Review
            </button>
          </div>
        </form>
      </Modal>

      {/* ===================== MODAL: REVIEW DELIVERABLES ===================== */}
      <Modal
        isOpen={Boolean(selectedOfferForReview)}
        onClose={() => setSelectedOfferForReview(null)}
        title="Review Contributor Deliverables"
      >
        <div>
          <h4 style={{ fontSize: '0.96rem', fontWeight: 600, marginBottom: 6 }}>
            {selectedOfferForReview?.milestone_title || 'Milestone Deliverable'}
          </h4>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-dim)', marginBottom: 14 }}>
            Submitted by: <strong>{selectedOfferForReview?.contributor_name}</strong>
          </p>

          <div style={{
            background: '#0d1117',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-sm)',
            padding: '12px 14px',
            marginBottom: 14,
            fontSize: '0.88rem'
          }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: 4 }}>Contributor Summary:</div>
            <p style={{ color: 'var(--text-main)', lineHeight: 1.5 }}>{selectedOfferForReview?.deliverable_note}</p>
            {selectedOfferForReview?.deliverable_url && (
              <a
                href={selectedOfferForReview.deliverable_url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--accent-blue)', marginTop: 8 }}
              >
                <span>View Submitted Code Artifact</span>
                <ExternalLink size={12} />
              </a>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
            <button
              className="btn btn-secondary"
              onClick={() => handleReviewMilestone(selectedOfferForReview.id, 'revisions_requested')}
            >
              Request Revisions
            </button>
            <button
              className="btn btn-primary"
              onClick={() => handleReviewMilestone(selectedOfferForReview.id, 'approved')}
            >
              <Check size={14} /> Approve Deliverable
            </button>
          </div>
        </div>
      </Modal>

      {/* ===================== MODAL: SETTLE SANDBOX PAYMENT ===================== */}
      <Modal
        isOpen={Boolean(selectedOfferForPayment)}
        onClose={() => setSelectedOfferForPayment(null)}
        title="Settle Milestone Payment in Provider Sandbox"
      >
        <form onSubmit={handleExecutePayment}>
          <div style={{
            background: '#0d1117',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-sm)',
            padding: '14px',
            marginBottom: 16
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: '0.88rem' }}>
              <span style={{ color: 'var(--text-dim)' }}>Milestone Compensation:</span>
              <strong style={{ color: 'var(--text-main)' }}>
                {selectedOfferForPayment?.currency} {parseFloat(selectedOfferForPayment?.amount || 0).toFixed(2)}
              </strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: '0.88rem' }}>
              <span style={{ color: 'var(--text-dim)' }}>DevCollab Platform Escrow Fee:</span>
              <span style={{ color: 'var(--accent-green)', fontWeight: 600 }}>$0.00 (Academic Free Tier)</span>
            </div>

            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              paddingTop: 8,
              borderTop: '1px solid var(--border-color)',
              fontSize: '1rem',
              fontWeight: 700
            }}>
              <span>Total Settlement:</span>
              <span style={{ color: 'var(--accent-blue)' }}>
                {selectedOfferForPayment?.currency} {parseFloat(selectedOfferForPayment?.amount || 0).toFixed(2)}
              </span>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Select Sandbox Payment Rail</label>
            <select
              className="input-select"
              value={paymentRail}
              onChange={(e) => setPaymentRail(e.target.value)}
            >
              <option value="sandbox_card">Credit / Debit Card (Sandbox Mock Token)</option>
              <option value="sandbox_stripe">Stripe Sandbox Integration</option>
              <option value="sandbox_upi">UPI Instant Sandbox (INR)</option>
              <option value="sandbox_bank">Direct Wire / SEPA Sandbox</option>
            </select>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: '0.8rem',
            color: 'var(--text-dim)',
            background: 'rgba(210, 153, 34, 0.1)',
            border: '1px solid rgba(210, 153, 34, 0.3)',
            padding: '8px 12px',
            borderRadius: 'var(--radius-sm)',
            marginBottom: 20
          }}>
            <ShieldCheck size={16} style={{ color: 'var(--accent-amber)' }} />
            <span>Sandbox Mode: Uses mock cryptographic tokens without touching real financial cards or banks.</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setSelectedOfferForPayment(null)}
              disabled={isProcessingPayment}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isProcessingPayment}
            >
              <CreditCard size={14} />
              <span>{isProcessingPayment ? 'Settling with Provider...' : 'Execute Verified Settlement'}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* ===================== MODAL: OFFICIAL RECEIPT ===================== */}
      <Modal
        isOpen={Boolean(selectedReceipt)}
        onClose={() => setSelectedReceipt(null)}
        title="Verified Settlement Receipt & Invoice"
      >
        {selectedReceipt && (
          <div style={{ padding: '4px' }}>
            {/* Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              borderBottom: '2px solid var(--border-color)',
              paddingBottom: 14,
              marginBottom: 16
            }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                  DevCollab Settlement Receipt
                </h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                  IEEE SRS Standard • Provider Sandbox Certificate
                </span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.9rem', color: 'var(--accent-blue)' }}>
                  {selectedReceipt.receipt_number}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                  {new Date(selectedReceipt.issued_at).toLocaleString()}
                </div>
              </div>
            </div>

            {/* Payer and Payee */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16, fontSize: '0.85rem' }}>
              <div style={{ background: '#0d1117', padding: '10px 12px', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Payer (Project Owner)</span>
                <div style={{ fontWeight: 600, color: 'var(--text-main)', marginTop: 2 }}>{selectedReceipt.payer_name}</div>
                <div style={{ color: 'var(--text-dim)', fontSize: '0.78rem' }}>{selectedReceipt.payer_email}</div>
              </div>

              <div style={{ background: '#0d1117', padding: '10px 12px', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Payee (Contributor)</span>
                <div style={{ fontWeight: 600, color: 'var(--text-main)', marginTop: 2 }}>{selectedReceipt.payee_name}</div>
                <div style={{ color: 'var(--text-dim)', fontSize: '0.78rem' }}>{selectedReceipt.payee_email}</div>
              </div>
            </div>

            {/* Itemized Deliverables */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 6 }}>
                Milestone Deliverable
              </div>
              <div style={{ background: '#161b22', padding: '10px 12px', borderRadius: '4px', fontSize: '0.88rem' }}>
                <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                  {selectedReceipt.milestone_title || 'Project Milestone Work'}
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: 4 }}>
                  {selectedReceipt.terms}
                </div>
              </div>
            </div>

            {/* Totals Breakdown */}
            <div style={{ background: '#0d1117', padding: '12px 14px', borderRadius: '4px', marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: 6 }}>
                <span style={{ color: 'var(--text-dim)' }}>Disbursed Compensation:</span>
                <span>{selectedReceipt.currency} {parseFloat(selectedReceipt.amount).toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: 6 }}>
                <span style={{ color: 'var(--text-dim)' }}>Platform Processing Fee:</span>
                <span style={{ color: 'var(--accent-green)' }}>$0.00</span>
              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '1rem',
                fontWeight: 700,
                borderTop: '1px solid var(--border-color)',
                paddingTop: 8,
                marginTop: 6
              }}>
                <span>Total Settled:</span>
                <span style={{ color: 'var(--accent-green)' }}>
                  {selectedReceipt.currency} {parseFloat(selectedReceipt.amount).toFixed(2)}
                </span>
              </div>
            </div>

            {/* Cryptographic Audit Seal */}
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', background: '#161b22', padding: '10px 12px', borderRadius: '4px' }}>
              <div><strong>Provider Reference:</strong> <code>{selectedReceipt.provider_reference}</code></div>
              <div style={{ marginTop: 4, wordBreak: 'break-all' }}>
                <strong>Verification Signature (HMAC-SHA256):</strong> <code>{selectedReceipt.verification_hash}</code>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
              <button className="btn btn-primary btn-sm" onClick={() => setSelectedReceipt(null)}>
                Close Receipt
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
