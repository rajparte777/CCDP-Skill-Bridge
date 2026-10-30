const { v4: uuidv4 } = require('uuid');
const db = require('../../config/db');
const { createNotification } = require('../notifications/notificationService');
const { logAuditEvent } = require('../audit/auditService');

async function createTask(req, res, next) {
  try {
    const { projectId } = req.params;
    const { title, description = '', status = 'todo', priority = 'medium', assignee_id = null, due_date = null } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Task title is required.' }
      });
    }

    const taskId = uuidv4();
    const result = await db.query(
      `INSERT INTO tasks (id, project_id, assignee_id, title, description, status, priority, due_date, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING *`,
      [taskId, projectId, assignee_id, title.trim(), description, status, priority, due_date]
    );

    const task = result.rows[0];

    // Notify assignee if assigned
    if (assignee_id && assignee_id !== req.user.id) {
      await createNotification({
        userId: assignee_id,
        type: 'TASK_ASSIGNED',
        message: `${req.user.name} assigned you to task "${title.trim()}".`,
        relatedEntityType: 'TASK',
        relatedEntityId: taskId
      });
    }

    await logAuditEvent({
      actorId: req.user.id,
      action: 'TASK_CREATED',
      entityType: 'TASK',
      entityId: taskId,
      details: { projectId, title, assignee_id }
    });

    res.status(201).json({
      message: 'Task created successfully',
      task
    });
  } catch (err) {
    next(err);
  }
}

async function listProjectTasks(req, res, next) {
  try {
    const { projectId } = req.params;
    const { status, assignee_id } = req.query;

    let sql = `
      SELECT t.*, u.name as assignee_name, u.avatar_url as assignee_avatar
      FROM tasks t
      LEFT JOIN users u ON t.assignee_id = u.id
      WHERE t.project_id = $1
    `;
    const params = [projectId];

    if (status) {
      params.push(status);
      sql += ` AND t.status = $${params.length}`;
    }

    if (assignee_id) {
      params.push(assignee_id);
      sql += ` AND t.assignee_id = $${params.length}`;
    }

    sql += ' ORDER BY t.created_at DESC';

    const result = await db.query(sql, params);
    res.json({ tasks: result.rows });
  } catch (err) {
    next(err);
  }
}

async function updateTask(req, res, next) {
  try {
    const { taskId } = req.params;
    const { title, description, status, priority, assignee_id, due_date } = req.body;

    const existingRes = await db.query('SELECT * FROM tasks WHERE id = $1', [taskId]);
    if (existingRes.rows.length === 0) {
      return res.status(404).json({
        error: { code: 'TASK_NOT_FOUND', message: 'Task not found.' }
      });
    }

    const current = existingRes.rows[0];

    const updatedTitle = title !== undefined ? title.trim() : current.title;
    const updatedDesc = description !== undefined ? description : current.description;
    const updatedStatus = status !== undefined ? status : current.status;
    const updatedPriority = priority !== undefined ? priority : current.priority;
    const updatedAssignee = assignee_id !== undefined ? assignee_id : current.assignee_id;
    const updatedDueDate = due_date !== undefined ? due_date : current.due_date;

    const updateRes = await db.query(
      `UPDATE tasks
       SET title = $1, description = $2, status = $3, priority = $4, assignee_id = $5, due_date = $6, updated_at = CURRENT_TIMESTAMP
       WHERE id = $7
       RETURNING *`,
      [updatedTitle, updatedDesc, updatedStatus, updatedPriority, updatedAssignee, updatedDueDate, taskId]
    );

    const updatedTask = updateRes.rows[0];

    // Notification if status changed to completed
    if (updatedStatus === 'completed' && current.status !== 'completed') {
      await logAuditEvent({
        actorId: req.user.id,
        action: 'TASK_COMPLETED',
        entityType: 'TASK',
        entityId: taskId,
        details: { title: updatedTitle, projectId: current.project_id }
      });
    }

    // Notification if newly assigned
    if (updatedAssignee && updatedAssignee !== current.assignee_id && updatedAssignee !== req.user.id) {
      await createNotification({
        userId: updatedAssignee,
        type: 'TASK_ASSIGNED',
        message: `${req.user.name} assigned you to task "${updatedTitle}".`,
        relatedEntityType: 'TASK',
        relatedEntityId: taskId
      });
    }

    res.json({
      message: 'Task updated successfully',
      task: updatedTask
    });
  } catch (err) {
    next(err);
  }
}

async function deleteTask(req, res, next) {
  try {
    const { taskId } = req.params;
    await db.query('DELETE FROM tasks WHERE id = $1', [taskId]);
    res.json({ message: 'Task deleted successfully' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createTask,
  listProjectTasks,
  updateTask,
  deleteTask
};
