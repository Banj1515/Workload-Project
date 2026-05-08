using System.Globalization;
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
    [Route("api/changerequests")]
    public class ChangeRequestsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public ChangeRequestsController(AppDbContext context)
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
        
        private static IActionResult ValidationFailed(ActionContext context)
        {
            var errors = context.ModelState
                .Where(x => x.Value?.Errors.Count > 0)
                .ToDictionary(
                    x => x.Key,
                    x => x.Value!.Errors
                        .Select(e => string.IsNullOrWhiteSpace(e.ErrorMessage)
                            ? "Invalid value."
                            : e.ErrorMessage)
                        .ToArray());

            return new BadRequestObjectResult(new
            {
                message = "Validation failed.",
                errors
            });
        }

        [Authorize(Roles = "Admin,Team Leader,Member")]
        [HttpPost]
        public async Task<IActionResult> CreateChangeRequest([FromBody] CreateTaskChangeRequestDto request)
        {
            if (!ModelState.IsValid)
                return ValidationFailed(ControllerContext);

            var currentUserId = GetCurrentUserId();
            if (currentUserId == null)
                return Unauthorized(new { message = "User identity is invalid." });

            var task = await _context.Tasks.FirstOrDefaultAsync(t => t.Id == request.TaskId);
            if (task == null)
                return NotFound(new { message = "Task not found." });

            var changeType = request.EffectiveChangeType;
            var requestedValue = request.EffectiveRequestedValue;

            var currentValue = changeType switch
            {
                "OwnerChange" => task.AssignedUserId?.ToString() ?? string.Empty,
                "DueDateChange" => task.DueDate.ToString("yyyy-MM-dd"),
                "EffortIncrease" => task.EffortHours.ToString(CultureInfo.InvariantCulture),
                _ => string.Empty
            };

            if (changeType == "OwnerChange")
            {
                var requestedUserId = Guid.Parse(requestedValue);

                var userExists = await _context.Users.AnyAsync(u => u.Id == requestedUserId);
                if (!userExists)
                {
                    return BadRequest(new
                    {
                        message = "Validation failed.",
                        errors = new Dictionary<string, string[]>
                        {
                            ["requestedValue"] = new[] { "Requested owner does not exist." }
                        }
                    });
                }
            }

            if (changeType == "EffortIncrease")
            {
                var requestedEffort = decimal.Parse(requestedValue, CultureInfo.InvariantCulture);

                if (requestedEffort <= task.EffortHours)
                {
                    return BadRequest(new
                    {
                        message = "Validation failed.",
                        errors = new Dictionary<string, string[]>
                        {
                            ["requestedValue"] = new[] { "EffortIncrease must be greater than the current effort." }
                        }
                    });
                }
            }

            var entity = new TaskChangeRequest
            {
                Id = Guid.NewGuid(),
                TaskId = request.TaskId,
                ChangeType = changeType,
                CurrentValue = currentValue,
                NewValue = requestedValue,
                Reason = request.Reason,
                Notes = request.Notes,
                RequestedByUserId = currentUserId.Value,
                Status = "Pending",
                CreatedAt = DateTime.UtcNow,
                ReviewedByUserId = null,
                ReviewedAt = null
            };

            _context.TaskChangeRequests.Add(entity);
            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = "Change request created successfully.",
                entity.Id,
                entity.TaskId,
                entity.ChangeType,
                entity.CurrentValue,
                RequestedValue = entity.NewValue,
                entity.Reason,
                entity.Notes,
                entity.Status,
                entity.RequestedByUserId,
                entity.CreatedAt
            });
        }

        [Authorize(Roles = "Admin,Team Leader")]
        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            var requests = await _context.TaskChangeRequests
                .OrderByDescending(r => r.CreatedAt)
                .ToListAsync();

            return Ok(await MapRequestsAsync(requests));
        }

        [Authorize(Roles = "Admin,Team Leader")]
        [HttpGet("pending")]
        public async Task<IActionResult> GetPending()
        {
            var requests = await _context.TaskChangeRequests
                .Where(r => r.Status == "Pending")
                .OrderByDescending(r => r.CreatedAt)
                .ToListAsync();

            return Ok(await MapRequestsAsync(requests));
        }

        [Authorize(Roles = "Admin,Team Leader")]
        [HttpPost("{id:guid}/review")]
        public async Task<IActionResult> Review(Guid id, [FromBody] ReviewTaskChangeRequest request)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var currentUserId = GetCurrentUserId();
            if (currentUserId == null)
                return Unauthorized(new { message = "User identity is invalid." });

            await using var transaction = await _context.Database.BeginTransactionAsync();

            try
            {
                var changeRequest = await _context.TaskChangeRequests
                    .FirstOrDefaultAsync(r => r.Id == id);

                if (changeRequest == null)
                    return NotFound(new { message = "Change request not found." });

                if (changeRequest.Status != "Pending")
                    return BadRequest(new { message = "This change request has already been reviewed." });

                var task = await _context.Tasks.FirstOrDefaultAsync(t => t.Id == changeRequest.TaskId);
                if (task == null)
                    return NotFound(new { message = "Related task not found." });

                var updatedTaskFields = new Dictionary<string, object?>();

                if (request.Approved)
                {
                    switch (NormalizeChangeType(changeRequest.ChangeType))
                    {
                        case "OwnerChange":
                            {
                                if (!Guid.TryParse(changeRequest.NewValue, out var newAssignedUserId))
                                    return BadRequest(new { message = "Invalid owner value in change request." });

                                var oldValue = task.AssignedUserId?.ToString();
                                task.AssignedUserId = newAssignedUserId;
                                task.UpdatedAt = DateTime.UtcNow;

                                AddTaskChangeHistory(task.Id, "AssignedUserId", oldValue, newAssignedUserId.ToString(), currentUserId.Value);
                                updatedTaskFields["assignedUserId"] = task.AssignedUserId;
                                break;
                            }

                        case "DueDateChange":
                            {
                                if (!DateOnly.TryParse(changeRequest.NewValue, out var newDueDate))
                                    return BadRequest(new { message = "Invalid due date value in change request." });

                                var oldValue = task.DueDate.ToString("yyyy-MM-dd");
                                task.DueDate = newDueDate;
                                task.UpdatedAt = DateTime.UtcNow;

                                AddTaskChangeHistory(task.Id, "DueDate", oldValue, newDueDate.ToString("yyyy-MM-dd"), currentUserId.Value);
                                updatedTaskFields["dueDate"] = task.DueDate.ToString("yyyy-MM-dd");
                                break;
                            }

                        case "EffortIncrease":
                            {
                                if (!decimal.TryParse(changeRequest.NewValue, NumberStyles.Number, CultureInfo.InvariantCulture, out var newEffort))
                                    return BadRequest(new { message = "Invalid effort value in change request." });

                                var oldValue = task.EffortHours.ToString(CultureInfo.InvariantCulture);
                                task.EffortHours = newEffort;
                                task.UpdatedAt = DateTime.UtcNow;

                                AddTaskChangeHistory(task.Id, "EffortHours", oldValue, newEffort.ToString(CultureInfo.InvariantCulture), currentUserId.Value);
                                updatedTaskFields["effortHours"] = task.EffortHours;
                                break;
                            }

                        default:
                            return BadRequest(new { message = $"Unsupported change type '{changeRequest.ChangeType}'." });
                    }
                }

                changeRequest.Status = request.Approved ? "Approved" : "Rejected";
                changeRequest.ReviewedByUserId = currentUserId.Value;
                changeRequest.ReviewedAt = DateTime.UtcNow;

                if (!string.IsNullOrWhiteSpace(request.Notes))
                    changeRequest.Notes = request.Notes;

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                return Ok(new
                {
                    message = "Change request reviewed successfully.",
                    changeRequestId = changeRequest.Id,
                    status = changeRequest.Status,
                    taskId = task.Id,
                    updatedTaskFields,
                    reviewedByUserId = changeRequest.ReviewedByUserId,
                    reviewedAt = changeRequest.ReviewedAt,
                    notes = changeRequest.Notes
                });
            }
            catch
            {
                await transaction.RollbackAsync();
                throw;
            }
        }

        private async Task<List<object>> MapRequestsAsync(List<TaskChangeRequest> requests)
        {
            var userIds = requests
                .Select(r => r.RequestedByUserId)
                .Concat(requests.Where(r => r.ReviewedByUserId != null).Select(r => r.ReviewedByUserId!.Value))
                .Distinct()
                .ToList();

            var users = await _context.Users
                .Where(u => userIds.Contains(u.Id))
                .Select(u => new
                {
                    u.Id,
                    u.DisplayName,
                    u.Email
                })
                .ToListAsync();

            var taskIds = requests
                .Select(r => r.TaskId)
                .Distinct()
                .ToList();

            var tasks = await _context.Tasks
                .Where(t => taskIds.Contains(t.Id))
                .Select(t => new
                {
                    t.Id,
                    t.Title
                })
                .ToListAsync();

            object? FindUser(Guid? userId)
            {
                if (userId == null)
                    return null;

                return users.FirstOrDefault(u => u.Id == userId.Value);
            }

            string? FindTaskTitle(Guid taskId)
            {
                return tasks.FirstOrDefault(t => t.Id == taskId)?.Title;
            }

            return requests.Select(r => new
            {
                r.Id,
                r.TaskId,
                TaskTitle = FindTaskTitle(r.TaskId),
                Task = tasks
                    .Where(t => t.Id == r.TaskId)
                    .Select(t => new
                    {
                        t.Id,
                        t.Title
                    })
                    .FirstOrDefault(),
                r.ChangeType,
                r.CurrentValue,
                RequestedValue = r.NewValue,
                r.Reason,
                r.Notes,
                r.Status,
                r.RequestedByUserId,
                RequestedBy = FindUser(r.RequestedByUserId),
                RequestedAt = r.CreatedAt,
                r.ReviewedByUserId,
                ReviewedBy = FindUser(r.ReviewedByUserId),
                r.CreatedAt,
                r.ReviewedAt
            }).Cast<object>().ToList();
        }

        private void AddTaskChangeHistory(Guid taskId, string fieldName, string? oldValue, string? newValue, Guid changedByUserId)
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

        private static string NormalizeChangeType(string? changeType)
        {
            return changeType?.Trim() switch
            {
                "Owner" => "OwnerChange",
                "Owner Change" => "OwnerChange",
                "OwnerChange" => "OwnerChange",

                "DueDate" => "DueDateChange",
                "Due Date" => "DueDateChange",
                "Due Date Change" => "DueDateChange",
                "DueDateChange" => "DueDateChange",

                "Effort" => "EffortIncrease",
                "Effort Hours" => "EffortIncrease",
                "Effort Increase" => "EffortIncrease",
                "EffortIncrease" => "EffortIncrease",

                _ => changeType?.Trim() ?? string.Empty
            };
        }
    }
}