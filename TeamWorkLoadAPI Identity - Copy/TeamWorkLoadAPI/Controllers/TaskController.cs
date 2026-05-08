using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TeamWorkLoadAPI.Data;
using TeamWorkLoadAPI.Models;

namespace TeamWorkLoadAPI.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/tasks")]
    public class TasksController : ControllerBase
    {
        private readonly AppDbContext _context;

        public TasksController(AppDbContext context)
        {
            _context = context;
        }

        private Guid? GetCurrentUserId()
        {
            var rawUserId =
                User.FindFirstValue(ClaimTypes.NameIdentifier) ??
                User.FindFirstValue("sub");

            return Guid.TryParse(rawUserId, out var userId) ? userId : null;
        }

        private static bool IsValidStatus(string? status)
        {
            return status == "New"
                || status == "In Progress"
                || status == "Blocked"
                || status == "Done";
        }

        private static string NormalizeStatus(string? status)
        {
            return status?.Trim() switch
            {
                "New" => "New",
                "In Progress" => "In Progress",
                "Blocked" => "Blocked",
                "Done" => "Done",
                _ => "New"
            };
        }

        private static bool IsValidPriority(string? priority)
        {
            return priority == "Low"
                || priority == "Medium"
                || priority == "High"
                || priority == "Critical";
        }

        private static bool IsValidComplexity(string? complexity)
        {
            return complexity == "Simple"
                || complexity == "Medium"
                || complexity == "Complex";
        }

        private async Task<bool> HasApprovedChangeRequestAsync(Guid taskId, string changeType, string requestedValue)
        {
            return await _context.TaskChangeRequests.AnyAsync(r =>
                r.TaskId == taskId &&
                r.ChangeType == changeType &&
                r.NewValue == requestedValue &&
                r.Status == "Approved");
        }

        private void AddFieldChangeHistory(Guid taskId, string fieldName, string? oldValue, string? newValue, Guid changedByUserId)
        {
            if (string.Equals(oldValue, newValue, StringComparison.Ordinal))
                return;

            _context.TaskChangeHistories.Add(new TaskChangeHistory
            {
                Id = Guid.NewGuid(),
                TaskId = taskId,
                FieldName = fieldName,
                OldValue = oldValue,
                NewValue = newValue,
                ChangedByUserId = changedByUserId,
                ChangedAt = DateTime.UtcNow
            });
        }

        private async Task<decimal> CalculateWeightAsync(TaskItem task)
        {
            var priorityMultiplier = await _context.WeightMultipliers
                .Where(w => w.Category == "Priority" && w.Key == task.Priority)
                .Select(w => w.Multiplier)
                .FirstOrDefaultAsync();

            var complexityMultiplier = await _context.WeightMultipliers
                .Where(w => w.Category == "Complexity" && w.Key == task.Complexity)
                .Select(w => w.Multiplier)
                .FirstOrDefaultAsync();

            if (priorityMultiplier == 0)
                priorityMultiplier = 1;

            if (complexityMultiplier == 0)
                complexityMultiplier = 1;

            return task.EffortHours * complexityMultiplier * priorityMultiplier;
        }

        private async Task<object> GetWeightBreakdownAsync(TaskItem task)
        {
            var priorityMultiplier = await _context.WeightMultipliers
                .Where(w => w.Category == "Priority" && w.Key == task.Priority)
                .Select(w => w.Multiplier)
                .FirstOrDefaultAsync();

            var complexityMultiplier = await _context.WeightMultipliers
                .Where(w => w.Category == "Complexity" && w.Key == task.Complexity)
                .Select(w => w.Multiplier)
                .FirstOrDefaultAsync();

            if (priorityMultiplier == 0)
                priorityMultiplier = 1;

            if (complexityMultiplier == 0)
                complexityMultiplier = 1;

            var weight = task.EffortHours * complexityMultiplier * priorityMultiplier;

            return new
            {
                task.EffortHours,
                Complexity = task.Complexity,
                ComplexityMultiplier = complexityMultiplier,
                Priority = task.Priority,
                PriorityMultiplier = priorityMultiplier,
                Formula = $"{task.EffortHours} × {complexityMultiplier} × {priorityMultiplier}",
                Weight = weight
            };
        }

        private async Task<IActionResult?> ValidateTaskReferencesAsync(Guid? teamId, Guid? assignedUserId)
        {
            if (teamId.HasValue)
            {
                var teamExists = await _context.Teams.AnyAsync(t => t.Id == teamId.Value);
                if (!teamExists)
                    return BadRequest(new { message = "Selected team does not exist." });
            }

            if (assignedUserId.HasValue)
            {
                var userExists = await _context.Users.AnyAsync(u => u.Id == assignedUserId.Value);
                if (!userExists)
                    return BadRequest(new { message = "Selected assigned user does not exist." });
            }

            return null;
        }

        private IActionResult? ValidateTaskInput(
            string? title,
            string? priority,
            string? complexity,
            string? status,
            decimal effortHours,
            DateOnly startDate,
            DateOnly dueDate)
        {
            if (string.IsNullOrWhiteSpace(title))
                return BadRequest(new { message = "Task title is required." });

            if (!IsValidPriority(priority))
                return BadRequest(new { message = "Priority must be Low, Medium, High, or Critical." });

            if (!IsValidComplexity(complexity))
                return BadRequest(new { message = "Complexity must be Simple, Medium, or Complex." });

            if (!IsValidStatus(status))
                return BadRequest(new { message = "Status must be New, In Progress, Blocked, or Done." });

            if (effortHours < 0)
                return BadRequest(new { message = "Effort hours cannot be negative." });

            if (startDate > dueDate)
                return BadRequest(new { message = "Start date cannot be after due date." });

            return null;
        }

        [Authorize(Roles = "Admin,Team Leader")]
        [HttpPost]
        public async Task<IActionResult> CreateTask([FromBody] CreateTaskRequest request)
        {
            if (!ModelState.IsValid)
                return BadRequest(new { message = "Invalid task data." });

            var inputError = ValidateTaskInput(
                request.Title,
                request.Priority,
                request.Complexity,
                request.Status,
                request.EffortHours,
                request.StartDate,
                request.DueDate);

            if (inputError != null)
                return inputError;

            var referenceError = await ValidateTaskReferencesAsync(request.TeamId, request.AssignedUserId);
            if (referenceError != null)
                return referenceError;

            var currentUserId = GetCurrentUserId();
            if (currentUserId == null)
                return Unauthorized(new { message = "User identity is invalid." });

            var task = new TaskItem
            {
                Id = Guid.NewGuid(),
                TeamId = request.TeamId,
                Title = request.Title.Trim(),
                Description = request.Description,
                AssignedUserId = request.AssignedUserId,
                Priority = request.Priority,
                Complexity = request.Complexity,
                EffortHours = request.EffortHours,
                StartDate = request.StartDate,
                DueDate = request.DueDate,
                Status = NormalizeStatus(request.Status),
                CreatedByUserId = currentUserId.Value,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = null,
                ClickUpTaskId = null,
                ClickUpListId = null,
                LastSyncedAt = null
            };

            _context.Tasks.Add(task);
            await _context.SaveChangesAsync();

            var weight = await CalculateWeightAsync(task);

            return Ok(new
            {
                task.Id,
                task.Title,
                task.Description,
                task.Priority,
                task.Complexity,
                task.EffortHours,
                Weight = weight,
                task.StartDate,
                task.DueDate,
                task.Status,
                task.AssignedUserId,
                task.TeamId,
                task.CreatedByUserId,
                task.CreatedAt
            });
        }

        [Authorize(Roles = "Admin,Team Leader")]
        [HttpPut("{id:guid}")]
        public async Task<IActionResult> UpdateTask(Guid id, [FromBody] UpdateTaskRequest request)
        {
            if (!ModelState.IsValid)
                return BadRequest(new { message = "Invalid task data." });

            var inputError = ValidateTaskInput(
                request.Title,
                request.Priority,
                request.Complexity,
                request.Status,
                request.EffortHours,
                request.StartDate,
                request.DueDate);

            if (inputError != null)
                return inputError;

            var referenceError = await ValidateTaskReferencesAsync(request.TeamId, request.AssignedUserId);
            if (referenceError != null)
                return referenceError;

            var task = await _context.Tasks.FirstOrDefaultAsync(t => t.Id == id);
            if (task == null)
                return NotFound(new { message = "Task not found." });

            var ownerChanged = task.AssignedUserId != request.AssignedUserId;
            var dueDateChanged = task.DueDate != request.DueDate;
            var effortIncreased = request.EffortHours > task.EffortHours;

            var canBypassApproval = User.IsInRole("Admin") || User.IsInRole("Team Leader");

            if (!canBypassApproval)
            {
                if (ownerChanged)
                {
                    var approved = await HasApprovedChangeRequestAsync(
                        task.Id,
                        "OwnerChange",
                        request.AssignedUserId?.ToString() ?? string.Empty);

                    if (!approved)
                        return BadRequest(new { message = "Changing task owner requires an approved change request." });
                }

                if (dueDateChanged)
                {
                    var approved = await HasApprovedChangeRequestAsync(
                        task.Id,
                        "DueDateChange",
                        request.DueDate.ToString("yyyy-MM-dd"));

                    if (!approved)
                        return BadRequest(new { message = "Changing due date requires an approved change request." });
                }

                if (effortIncreased)
                {
                    var approved = await HasApprovedChangeRequestAsync(
                        task.Id,
                        "EffortIncrease",
                        request.EffortHours.ToString());

                    if (!approved)
                        return BadRequest(new { message = "Increasing effort requires an approved change request." });
                }
            }

            var changedByUserId = GetCurrentUserId();
            if (changedByUserId == null)
                return Unauthorized(new { message = "User identity is invalid." });

            var oldTitle = task.Title;
            var oldDescription = task.Description;
            var oldTeamId = task.TeamId?.ToString();
            var oldAssignedUserId = task.AssignedUserId?.ToString();
            var oldPriority = task.Priority;
            var oldComplexity = task.Complexity;
            var oldEffortHours = task.EffortHours.ToString();
            var oldStartDate = task.StartDate.ToString("yyyy-MM-dd");
            var oldDueDate = task.DueDate.ToString("yyyy-MM-dd");
            var oldStatus = NormalizeStatus(task.Status);

            task.TeamId = request.TeamId;
            task.Title = request.Title.Trim();
            task.Description = request.Description;
            task.AssignedUserId = request.AssignedUserId;
            task.Priority = request.Priority;
            task.Complexity = request.Complexity;
            task.EffortHours = request.EffortHours;
            task.StartDate = request.StartDate;
            task.DueDate = request.DueDate;
            task.Status = NormalizeStatus(request.Status);
            task.UpdatedAt = DateTime.UtcNow;

            AddFieldChangeHistory(task.Id, "Title", oldTitle, task.Title, changedByUserId.Value);
            AddFieldChangeHistory(task.Id, "Description", oldDescription, task.Description, changedByUserId.Value);
            AddFieldChangeHistory(task.Id, "TeamId", oldTeamId, task.TeamId?.ToString(), changedByUserId.Value);
            AddFieldChangeHistory(task.Id, "AssignedUserId", oldAssignedUserId, task.AssignedUserId?.ToString(), changedByUserId.Value);
            AddFieldChangeHistory(task.Id, "Priority", oldPriority, task.Priority, changedByUserId.Value);
            AddFieldChangeHistory(task.Id, "Complexity", oldComplexity, task.Complexity, changedByUserId.Value);
            AddFieldChangeHistory(task.Id, "EffortHours", oldEffortHours, task.EffortHours.ToString(), changedByUserId.Value);
            AddFieldChangeHistory(task.Id, "StartDate", oldStartDate, task.StartDate.ToString("yyyy-MM-dd"), changedByUserId.Value);
            AddFieldChangeHistory(task.Id, "DueDate", oldDueDate, task.DueDate.ToString("yyyy-MM-dd"), changedByUserId.Value);

            if (!string.Equals(oldStatus, task.Status, StringComparison.OrdinalIgnoreCase))
            {
                _context.TaskStatusHistories.Add(new TaskStatusHistory
                {
                    Id = Guid.NewGuid(),
                    TaskId = task.Id,
                    OldStatus = oldStatus,
                    NewStatus = task.Status,
                    ChangedByUserId = changedByUserId.Value,
                    ChangedAt = DateTime.UtcNow
                });
            }

            await _context.SaveChangesAsync();

            var weight = await CalculateWeightAsync(task);

            return Ok(new
            {
                task.Id,
                task.Title,
                task.Description,
                task.Priority,
                task.Complexity,
                task.EffortHours,
                Weight = weight,
                task.StartDate,
                task.DueDate,
                task.Status,
                task.AssignedUserId,
                task.TeamId,
                task.UpdatedAt
            });
        }

        [Authorize(Roles = "Admin,Team Leader,Member")]
        [HttpPut("{id:guid}/status")]
        public async Task<IActionResult> UpdateTaskStatus(Guid id, [FromBody] UpdateTaskStatusRequest request)
        {
            if (!ModelState.IsValid)
                return BadRequest(new { message = "Invalid status data." });

            if (!IsValidStatus(request.Status))
                return BadRequest(new { message = "Invalid task status." });

            var currentUserId = GetCurrentUserId();
            if (currentUserId == null)
                return Unauthorized(new { message = "User identity is invalid." });

            var task = await _context.Tasks.FirstOrDefaultAsync(t => t.Id == id);
            if (task == null)
                return NotFound(new { message = "Task not found." });

            var isAdmin = User.IsInRole("Admin");
            var isTeamLeader = User.IsInRole("Team Leader");
            var isMember = User.IsInRole("Member");

            if (isMember && !isAdmin && !isTeamLeader)
            {
                if (task.AssignedUserId == null || task.AssignedUserId != currentUserId.Value)
                    return Forbid();
            }

            var oldStatus = NormalizeStatus(task.Status);
            var newStatus = NormalizeStatus(request.Status);

            if (string.Equals(oldStatus, newStatus, StringComparison.OrdinalIgnoreCase))
            {
                return Ok(new
                {
                    message = "Task status unchanged.",
                    task.Id,
                    Status = oldStatus
                });
            }

            task.Status = newStatus;
            task.UpdatedAt = DateTime.UtcNow;

            _context.TaskStatusHistories.Add(new TaskStatusHistory
            {
                Id = Guid.NewGuid(),
                TaskId = task.Id,
                OldStatus = oldStatus,
                NewStatus = newStatus,
                ChangedByUserId = currentUserId.Value,
                ChangedAt = DateTime.UtcNow
            });

            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = "Task status updated successfully.",
                task.Id,
                task.Status,
                ChangedByUserId = currentUserId.Value
            });
        }

        [Authorize(Roles = "Admin,Team Leader")]
        [HttpDelete("{id:guid}")]
        public async Task<IActionResult> DeleteTask(Guid id)
        {
            var task = await _context.Tasks.FirstOrDefaultAsync(t => t.Id == id);

            if (task == null)
                return NotFound(new { message = "Task not found." });

            _context.Tasks.Remove(task);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Task deleted successfully." });
        }

        [HttpGet]
        public async Task<IActionResult> GetTasks()
        {
            var tasks = await _context.Tasks
                .OrderByDescending(t => t.CreatedAt)
                .ToListAsync();

            var userIds = tasks
                .Where(t => t.AssignedUserId != null)
                .Select(t => t.AssignedUserId!.Value)
                .Distinct()
                .ToList();

            var users = await _context.Users
                .Where(u => userIds.Contains(u.Id))
                .ToListAsync();

            var result = new List<object>();

            foreach (var task in tasks)
            {
                var weight = await CalculateWeightAsync(task);

                var assignedMember = task.AssignedUserId == null
                    ? null
                    : users
                        .Where(u => u.Id == task.AssignedUserId)
                        .Select(u => new
                        {
                            u.Id,
                            u.DisplayName,
                            u.Email
                        })
                        .FirstOrDefault();

                result.Add(new
                {
                    task.Id,
                    task.Title,
                    Description = task.Description,
                    Priority = task.Priority,
                    task.Complexity,
                    task.EffortHours,
                    Weight = weight,
                    task.StartDate,
                    task.DueDate,
                    Status = NormalizeStatus(task.Status),
                    task.AssignedUserId,
                    AssignedMember = assignedMember,
                    task.TeamId,
                    task.ClickUpTaskId,
                    task.LastSyncedAt
                });
            }

            return Ok(result);
        }

        [Authorize(Roles = "Admin,Team Leader,Member")]
        [HttpGet("my")]
        public async Task<IActionResult> GetMyTasks()
        {
            var currentUserId = GetCurrentUserId();
            if (currentUserId == null)
                return Unauthorized(new { message = "User identity is invalid." });

            var tasks = await _context.Tasks
                .Where(t => t.AssignedUserId == currentUserId.Value)
                .OrderBy(t => t.DueDate)
                .ThenBy(t => t.Title)
                .ToListAsync();

            var result = new List<object>();

            foreach (var task in tasks)
            {
                var weight = await CalculateWeightAsync(task);

                result.Add(new
                {
                    task.Id,
                    task.Title,
                    Description = task.Description,
                    task.Priority,
                    task.Complexity,
                    task.EffortHours,
                    Weight = weight,
                    task.StartDate,
                    task.DueDate,
                    Status = NormalizeStatus(task.Status),
                    task.AssignedUserId,
                    task.TeamId,
                    task.ClickUpTaskId,
                    task.LastSyncedAt,
                    task.AcknowledgedByUserId,
                    task.AcknowledgedAt
                });
            }

            return Ok(result);
        }

        [HttpGet("{id:guid}")]
        public async Task<IActionResult> GetTaskById(Guid id)
        {
            var task = await _context.Tasks.FirstOrDefaultAsync(t => t.Id == id);

            if (task == null)
                return NotFound(new { message = "Task not found." });

            var weightBreakdown = await GetWeightBreakdownAsync(task);

            var assignedMember = task.AssignedUserId == null
                ? null
                : await _context.Users
                    .Where(u => u.Id == task.AssignedUserId)
                    .Select(u => new
                    {
                        u.Id,
                        u.DisplayName,
                        u.Email
                    })
                    .FirstOrDefaultAsync();

            var acknowledgedBy = task.AcknowledgedByUserId == null
                ? null
                : await _context.Users
                    .Where(u => u.Id == task.AcknowledgedByUserId)
                    .Select(u => new
                    {
                        u.Id,
                        u.DisplayName,
                        u.Email
                    })
                    .FirstOrDefaultAsync();

            var statusHistoryRaw = await _context.TaskStatusHistories
                .Where(h => h.TaskId == task.Id)
                .OrderByDescending(h => h.ChangedAt)
                .ToListAsync();

            var fieldChangeHistoryRaw = await _context.TaskChangeHistories
                .Where(h => h.TaskId == task.Id)
                .OrderByDescending(h => h.ChangedAt)
                .ToListAsync();

            var requestChangeHistoryRaw = await _context.TaskChangeRequests
                .Where(r => r.TaskId == task.Id)
                .OrderByDescending(r => r.CreatedAt)
                .ToListAsync();

            var userIds = statusHistoryRaw.Select(x => x.ChangedByUserId)
                .Concat(fieldChangeHistoryRaw.Select(x => x.ChangedByUserId))
                .Concat(requestChangeHistoryRaw.Select(x => x.RequestedByUserId))
                .Concat(requestChangeHistoryRaw.Where(x => x.ReviewedByUserId != null).Select(x => x.ReviewedByUserId!.Value))
                .Append(task.AcknowledgedByUserId ?? Guid.Empty)
                .Where(x => x != Guid.Empty)
                .Distinct()
                .ToList();

            var historyUsers = await _context.Users
                .Where(u => userIds.Contains(u.Id))
                .ToListAsync();

            object? FindUser(Guid? userId)
            {
                if (userId == null)
                    return null;

                return historyUsers
                    .Where(u => u.Id == userId.Value)
                    .Select(u => new
                    {
                        u.Id,
                        u.DisplayName,
                        u.Email
                    })
                    .FirstOrDefault();
            }

            return Ok(new
            {
                task.Id,
                task.Title,
                Description = task.Description,
                Priority = task.Priority,
                task.Complexity,
                task.EffortHours,
                WeightBreakdown = weightBreakdown,
                task.StartDate,
                task.DueDate,
                Status = NormalizeStatus(task.Status),
                task.AssignedUserId,
                AssignedMember = assignedMember,
                task.TeamId,
                task.ClickUpTaskId,
                task.ClickUpListId,
                task.LastSyncedAt,
                task.CreatedAt,
                task.UpdatedAt,
                task.AcknowledgedByUserId,
                AcknowledgedBy = acknowledgedBy,
                task.AcknowledgedAt,
                StatusHistory = statusHistoryRaw.Select(h => new
                {
                    h.Id,
                    OldStatus = NormalizeStatus(h.OldStatus),
                    NewStatus = NormalizeStatus(h.NewStatus),
                    h.ChangedByUserId,
                    ChangedBy = FindUser(h.ChangedByUserId),
                    h.ChangedAt
                }),
                FieldChangeHistory = fieldChangeHistoryRaw.Select(h => new
                {
                    h.Id,
                    h.FieldName,
                    h.OldValue,
                    h.NewValue,
                    h.ChangedByUserId,
                    ChangedBy = FindUser(h.ChangedByUserId),
                    h.ChangedAt
                }),
                ChangeHistory = requestChangeHistoryRaw.Select(r => new
                {
                    r.Id,
                    r.ChangeType,
                    r.CurrentValue,
                    RequestedValue = r.NewValue,
                    r.Reason,
                    r.Notes,
                    r.Status,
                    r.RequestedByUserId,
                    RequestedBy = FindUser(r.RequestedByUserId),
                    r.ReviewedByUserId,
                    ReviewedBy = FindUser(r.ReviewedByUserId),
                    r.CreatedAt,
                    r.ReviewedAt
                })
            });
        }

        [Authorize(Roles = "Admin,Team Leader,Member")]
        [HttpPost("{id:guid}/acknowledge")]
        public async Task<IActionResult> AcknowledgeTask(Guid id)
        {
            var currentUserId = GetCurrentUserId();
            if (currentUserId == null)
                return Unauthorized(new { message = "User identity is invalid." });

            var task = await _context.Tasks.FirstOrDefaultAsync(t => t.Id == id);

            if (task == null)
                return NotFound(new { message = "Task not found." });

            if (task.AssignedUserId == null)
                return BadRequest(new { message = "This task is not assigned to any member." });

            if (task.AssignedUserId != currentUserId.Value)
                return Forbid();

            if (task.AcknowledgedAt != null)
                return BadRequest(new { message = "This task has already been acknowledged." });

            task.AcknowledgedByUserId = currentUserId.Value;
            task.AcknowledgedAt = DateTime.UtcNow;
            task.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = "Task acknowledged successfully.",
                task.Id,
                task.AcknowledgedByUserId,
                task.AcknowledgedAt
            });
        }
    }
}