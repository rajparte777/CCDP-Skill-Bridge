import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import Badge from '../../components/Badge';
import Modal from '../../components/Modal';
import { GitPullRequest, MessageSquare, Plus, CheckCircle, AlertCircle, FileCode, Check, X } from 'lucide-react';

export default function ReviewManager({ projectId, projectRole, currentUser }) {
  const [reviews, setReviews] = useState([]);
  const [selectedReview, setSelectedReview] = useState(null);
  const [isNewReviewModalOpen, setIsNewReviewModalOpen] = useState(false);
  const [isAddCommentModalOpen, setIsAddCommentModalOpen] = useState(false);

  // New review form
  const [newTitle, setNewTitle] = useState('');

  // New comment form
  const [filePath, setFilePath] = useState('src/syncEngine.js');
  const [lineNumber, setLineNumber] = useState('');
  const [commentBody, setCommentBody] = useState('');
  const [suggestion, setSuggestion] = useState('');

  const canReview = ['owner', 'reviewer', 'contributor'].includes(projectRole);

  useEffect(() => {
    loadReviews();
  }, [projectId]);

  async function loadReviews() {
    try {
      const res = await api.get(`/reviews/projects/${projectId}`);
      const list = res.reviews || [];
      setReviews(list);
      if (list.length > 0 && !selectedReview) {
        loadReviewDetails(list[0].id);
      }
    } catch (err) {
      console.error('Failed to load reviews:', err);
    }
  }

  async function loadReviewDetails(reviewId) {
    try {
      const res = await api.get(`/reviews/${reviewId}`);
      setSelectedReview(res.review);
    } catch (err) {
      console.error('Failed to load review details:', err);
    }
  }

  async function handleCreateReview(e) {
    e.preventDefault();
    if (!newTitle.trim()) return;

    try {
      const res = await api.post(`/reviews/projects/${projectId}`, { title: newTitle.trim() });
      setIsNewReviewModalOpen(false);
      setNewTitle('');
      await loadReviews();
      loadReviewDetails(res.review.id);
    } catch (err) {
      alert(err.message || 'Failed to create review');
    }
  }

  async function handleAddComment(e) {
    e.preventDefault();
    if (!commentBody.trim() || !selectedReview) return;

    try {
      await api.post(`/reviews/${selectedReview.id}/comments`, {
        file_path: filePath,
        line_number: lineNumber ? parseInt(lineNumber, 10) : null,
        body: commentBody.trim(),
        suggestion: suggestion.trim()
      });

      setIsAddCommentModalOpen(false);
      setCommentBody('');
      setSuggestion('');
      setLineNumber('');
      loadReviewDetails(selectedReview.id);
      loadReviews();
    } catch (err) {
      alert(err.message || 'Failed to add review comment');
    }
  }

  async function handleDecision(decision) {
    if (!selectedReview) return;
    try {
      await api.put(`/reviews/${selectedReview.id}/decision`, { status: decision });
      loadReviewDetails(selectedReview.id);
      loadReviews();
    } catch (err) {
      alert(err.message || 'Failed to submit review decision');
    }
  }

  async function handleCommentStatus(commentId, status) {
    try {
      await api.put(`/reviews/comments/${commentId}/status`, { status });
      loadReviewDetails(selectedReview.id);
    } catch (err) {
      alert(err.message || 'Failed to update suggestion status');
    }
  }

  const statusVariant = {
    pending: 'amber',
    changes_requested: 'red',
    approved: 'green'
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Code Reviews & Corrections</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Inspect changes, propose line-level corrections, and record review decisions.
          </p>
        </div>

        {canReview && (
          <button className="btn btn-primary btn-sm" onClick={() => setIsNewReviewModalOpen(true)}>
            <Plus size={15} />
            <span>New Code Review</span>
          </button>
        )}
      </div>

      {/* Main Review Layout */}
      <div className="grid-2">
        {/* Left Reviews List */}
        <div className="card" style={{ padding: '16px' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: 12, color: 'var(--text-muted)' }}>
            Review Threads ({reviews.length})
          </h3>

          {reviews.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text-dim)', fontSize: '0.85rem' }}>
              No code reviews requested yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {reviews.map((r) => (
                <div
                  key={r.id}
                  onClick={() => loadReviewDetails(r.id)}
                  style={{
                    background: selectedReview?.id === r.id ? '#21262d' : 'var(--bg-main)',
                    border: '1px solid',
                    borderColor: selectedReview?.id === r.id ? 'var(--accent-blue)' : 'var(--border-color)',
                    padding: '12px',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <Badge variant={statusVariant[r.status] || 'gray'}>
                      {r.status.replace('_', ' ')}
                    </Badge>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <MessageSquare size={12} /> {r.comment_count || 0}
                    </span>
                  </div>

                  <h4 style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: 6 }}>
                    {r.title}
                  </h4>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                    <img
                      src={r.author_avatar || 'https://api.dicebear.com/7.x/bottts/svg?seed=user'}
                      alt={r.author_name}
                      style={{ width: 16, height: 16, borderRadius: '50%' }}
                    />
                    <span>{r.author_name}</span>
                    <span>•</span>
                    <span>{new Date(r.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Selected Review Details */}
        <div className="card" style={{ padding: '20px' }}>
          {selectedReview ? (
            <div>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <Badge variant={statusVariant[selectedReview.status] || 'gray'}>
                      {selectedReview.status.replace('_', ' ')}
                    </Badge>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                      Author: {selectedReview.author_name}
                    </span>
                  </div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 600 }}>{selectedReview.title}</h3>
                </div>

                {/* Review decisions */}
                {canReview && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleDecision('changes_requested')}
                      title="Request modifications"
                    >
                      <AlertCircle size={14} style={{ color: 'var(--accent-red)' }} />
                      <span>Changes</span>
                    </button>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => handleDecision('approved')}
                      title="Approve changes"
                    >
                      <CheckCircle size={14} />
                      <span>Approve</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Action: Add Comment */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '20px 0 12px', borderBottom: '1px solid var(--border-color)', paddingBottom: 8 }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                  Inline Comments & Suggestions ({selectedReview.comments?.length || 0})
                </span>
                {canReview && (
                  <button className="btn btn-outline-blue btn-sm" onClick={() => setIsAddCommentModalOpen(true)}>
                    <Plus size={14} /> Add Suggestion
                  </button>
                )}
              </div>

              {/* Comments Feed */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {(!selectedReview.comments || selectedReview.comments.length === 0) ? (
                  <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-dim)', fontSize: '0.85rem' }}>
                    No comments or suggestions recorded for this review yet.
                  </div>
                ) : (
                  selectedReview.comments.map((c) => (
                    <div
                      key={c.id}
                      style={{
                        background: '#161b22',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '14px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'var(--accent-blue)' }}>
                          <FileCode size={14} />
                          <span style={{ fontWeight: 600 }}>{c.file_path}</span>
                          {c.line_number && <span style={{ color: 'var(--text-dim)' }}>: line {c.line_number}</span>}
                        </div>

                        <Badge variant={c.status === 'accepted' ? 'green' : c.status === 'rejected' ? 'red' : 'gray'}>
                          {c.status}
                        </Badge>
                      </div>

                      <p style={{ fontSize: '0.88rem', color: 'var(--text-main)', marginBottom: 8, lineHeight: 1.4 }}>
                        {c.body}
                      </p>

                      {/* Code Suggestion Snippet */}
                      {c.suggestion && (
                        <div style={{
                          background: '#0d1117',
                          border: '1px solid var(--border-color)',
                          borderRadius: '4px',
                          padding: '8px 12px',
                          marginBottom: 8,
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.82rem',
                          color: 'var(--accent-green)'
                        }}>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginBottom: 4 }}>Proposed correction:</div>
                          <code>{c.suggestion}</code>
                        </div>
                      )}

                      {/* Comment footer */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <img
                            src={c.author_avatar || 'https://api.dicebear.com/7.x/bottts/svg?seed=c'}
                            alt={c.author_name}
                            style={{ width: 16, height: 16, borderRadius: '50%' }}
                          />
                          <span>{c.author_name}</span>
                          <span>•</span>
                          <span>{new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>

                        {/* Suggestion actions */}
                        {c.suggestion && c.status === 'open' && canReview && (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '2px 6px', fontSize: '0.75rem' }}
                              onClick={() => handleCommentStatus(c.id, 'accepted')}
                            >
                              <Check size={12} style={{ color: 'var(--accent-green)' }} /> Accept
                            </button>
                            <button
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '2px 6px', fontSize: '0.75rem' }}
                              onClick={() => handleCommentStatus(c.id, 'rejected')}
                            >
                              <X size={12} style={{ color: 'var(--accent-red)' }} /> Reject
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-dim)' }}>
              Select a review to inspect comments and suggestions
            </div>
          )}
        </div>
      </div>

      {/* New Review Modal */}
      <Modal isOpen={isNewReviewModalOpen} onClose={() => setIsNewReviewModalOpen(false)} title="Start Code Review">
        <form onSubmit={handleCreateReview}>
          <div className="form-group">
            <label className="form-label">Review Title *</label>
            <input
              type="text"
              className="input-text"
              placeholder="e.g. Code Review: WebSocket presence indicators and error boundaries"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              required
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setIsNewReviewModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Create Review
            </button>
          </div>
        </form>
      </Modal>

      {/* Add Comment / Suggestion Modal */}
      <Modal isOpen={isAddCommentModalOpen} onClose={() => setIsAddCommentModalOpen(false)} title="Add Comment & Suggestion">
        <form onSubmit={handleAddComment}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Target File Path *</label>
              <input
                type="text"
                className="input-text"
                value={filePath}
                onChange={(e) => setFilePath(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Line Number</label>
              <input
                type="number"
                className="input-text"
                placeholder="e.g. 42"
                value={lineNumber}
                onChange={(e) => setLineNumber(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Comment Body *</label>
            <textarea
              className="input-textarea"
              placeholder="Explain the suggestion, potential issue, or review observation..."
              value={commentBody}
              onChange={(e) => setCommentBody(e.target.value)}
              rows={3}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Proposed Code Correction (Optional)</label>
            <textarea
              className="input-textarea"
              style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}
              placeholder="const result = await sanitizePayload(input);"
              value={suggestion}
              onChange={(e) => setSuggestion(e.target.value)}
              rows={2}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setIsAddCommentModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Submit Comment
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
