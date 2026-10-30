import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import Badge from '../../components/Badge';
import Modal from '../../components/Modal';
import { Plus, CheckSquare, Clock, AlertTriangle, ArrowRight, Trash2 } from 'lucide-react';

export default function TaskBoard({ projectId, projectMembers = [], currentUser, canManageTasks }) {
  const [tasks, setTasks] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [assigneeId, setAssigneeId] = useState('');
  const [dueDate, setDueDate] = useState('');

  useEffect(() => {
    loadTasks();
  }, [projectId]);

  async function loadTasks() {
    try {
      const res = await api.get(`/tasks/${projectId}`);
      setTasks(res.tasks || []);
    } catch (err) {
      console.error('Failed to load tasks:', err);
    }
  }

  async function handleCreateTask(e) {
    e.preventDefault();
    if (!title.trim()) return;

    try {
      await api.post(`/tasks/${projectId}`, {
        title,
        description,
        priority,
        assignee_id: assigneeId || null,
        due_date: dueDate || null
      });

      setIsModalOpen(false);
      setTitle('');
      setDescription('');
      setAssigneeId('');
      setDueDate('');
      loadTasks();
    } catch (err) {
      alert(err.message || 'Failed to create task');
    }
  }

  async function handleStatusChange(taskId, newStatus) {
    try {
      await api.put(`/tasks/task/${taskId}`, { status: newStatus });
      loadTasks();
    } catch (err) {
      alert(err.message || 'Failed to update task status');
    }
  }

  async function handleDeleteTask(taskId) {
    if (!confirm('Are you sure you want to delete this task?')) return;
    try {
      await api.delete(`/tasks/task/${taskId}`);
      loadTasks();
    } catch (err) {
      alert(err.message || 'Failed to delete task');
    }
  }

  const columns = [
    { key: 'todo', label: 'To Do', color: 'gray' },
    { key: 'in_progress', label: 'In Progress', color: 'blue' },
    { key: 'review', label: 'Under Review', color: 'purple' },
    { key: 'completed', label: 'Completed', color: 'green' }
  ];

  const priorityVariants = {
    low: 'gray',
    medium: 'blue',
    high: 'amber',
    urgent: 'red'
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Project Tasks & Milestones</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Track sprint items, assign responsibility, and manage work progress.
          </p>
        </div>

        {canManageTasks && (
          <button className="btn btn-primary btn-sm" onClick={() => setIsModalOpen(true)}>
            <Plus size={15} />
            <span>Add Task</span>
          </button>
        )}
      </div>

      {/* Kanban Columns */}
      <div className="kanban-grid">
        {columns.map((col) => {
          const colTasks = tasks.filter((t) => t.status === col.key);

          return (
            <div key={col.key} className="kanban-col">
              <div className="kanban-col-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>{col.label}</span>
                  <span style={{
                    background: '#21262d',
                    padding: '2px 6px',
                    borderRadius: '10px',
                    fontSize: '0.72rem'
                  }}>
                    {colTasks.length}
                  </span>
                </div>
              </div>

              <div style={{ flex: 1, overflowY: 'auto' }}>
                {colTasks.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-dim)', fontSize: '0.8rem' }}>
                    No tasks
                  </div>
                ) : (
                  colTasks.map((t) => (
                    <div key={t.id} className="task-card">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                        <Badge variant={priorityVariants[t.priority] || 'blue'}>
                          {t.priority}
                        </Badge>
                        {canManageTasks && (
                          <button
                            onClick={() => handleDeleteTask(t.id)}
                            style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: 2 }}
                            title="Delete task"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>

                      <h4 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-main)' }}>
                        {t.title}
                      </h4>

                      {t.description && (
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 10, lineHeight: 1.4 }}>
                          {t.description}
                        </p>
                      )}

                      {/* Meta Footer */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: 8 }}>
                        {t.assignee_name ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }} title={`Assigned to ${t.assignee_name}`}>
                            <img
                              src={t.assignee_avatar || 'https://api.dicebear.com/7.x/bottts/svg?seed=user'}
                              alt={t.assignee_name}
                              style={{ width: 18, height: 18, borderRadius: '50%' }}
                            />
                            <span>{t.assignee_name.split(' ')[0]}</span>
                          </div>
                        ) : (
                          <span style={{ fontStyle: 'italic' }}>Unassigned</span>
                        )}

                        {/* Status switcher */}
                        {canManageTasks && (
                          <select
                            style={{
                              background: '#161b22',
                              border: '1px solid var(--border-color)',
                              color: 'var(--text-muted)',
                              fontSize: '0.72rem',
                              borderRadius: '4px',
                              padding: '2px 4px'
                            }}
                            value={t.status}
                            onChange={(e) => handleStatusChange(t.id, e.target.value)}
                          >
                            <option value="todo">To Do</option>
                            <option value="in_progress">In Progress</option>
                            <option value="review">Review</option>
                            <option value="completed">Done</option>
                          </select>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Create Task Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Create New Task">
        <form onSubmit={handleCreateTask}>
          <div className="form-group">
            <label className="form-label">Task Title *</label>
            <input
              type="text"
              className="input-text"
              placeholder="e.g. Implement WebSocket reconnection retry loop"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea
              className="input-textarea"
              placeholder="Detailed acceptance criteria or implementation notes..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="form-group">
              <label className="form-label">Priority</label>
              <select className="input-select" value={priority} onChange={(e) => setPriority(e.target.value)}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Assignee</label>
              <select className="input-select" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
                <option value="">Unassigned</option>
                {projectMembers.map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.name} ({m.role})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Due Date (Optional)</label>
            <input
              type="date"
              className="input-text"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Create Task
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
