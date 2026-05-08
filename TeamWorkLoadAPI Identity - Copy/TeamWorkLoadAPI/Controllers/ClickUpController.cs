using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TeamWorkLoadAPI.Data;
using TeamWorkLoadAPI.Models;
using TeamWorkLoadAPI.Services;

namespace TeamWorkLoadAPI.Controllers;

[ApiController]
[Route("api/clickup")]
public sealed class ClickUpController : ControllerBase
{
    private readonly ClickUpService _clickUpService;
    private readonly AppDbContext _db;
    private readonly IConfiguration _configuration;

    public ClickUpController(
        ClickUpService clickUpService,
        AppDbContext db,
        IConfiguration configuration)
    {
        _clickUpService = clickUpService;
        _db = db;
        _configuration = configuration;
    }

    [HttpGet("test")]
    public async Task<IActionResult> Test(CancellationToken cancellationToken)
    {
        try
        {
            var result = await _clickUpService.GetTasksAsync(cancellationToken);
            return Ok(result);
        }
        catch (Exception ex)
        {
            return BadRequest(new
            {
                ok = false,
                error = ex.Message
            });
        }
    }

    [HttpPost("sync")]
    public async Task<IActionResult> Sync(CancellationToken cancellationToken)
    {
        try
        {
            var options = _configuration.GetSection("ClickUp").Get<ClickUpOptions>();

            if (options is null)
                return BadRequest(new { ok = false, error = "ClickUp config is missing." });

            if (!Guid.TryParse(options.TeamId, out var teamId))
                return BadRequest(new { ok = false, error = "ClickUp TeamId is not a valid GUID." });

            if (!Guid.TryParse(options.SyncUserId, out var syncUserId))
                return BadRequest(new { ok = false, error = "ClickUp SyncUserId is not a valid GUID." });

            var payload = await _clickUpService.GetTasksAsync(cancellationToken);

            if (!payload.TryGetProperty("tasks", out var tasksElement) || tasksElement.ValueKind != JsonValueKind.Array)
                return Ok(new { ok = true, inserted = 0, updated = 0, total = 0 });

            var inserted = 0;
            var updated = 0;

            foreach (var taskJson in tasksElement.EnumerateArray())
            {
                var clickUpTaskId = GetString(taskJson, "id");
                if (string.IsNullOrWhiteSpace(clickUpTaskId))
                    continue;

                var existing = await _db.Tasks
                    .FirstOrDefaultAsync(t => t.ClickUpTaskId == clickUpTaskId, cancellationToken);

                var title = GetString(taskJson, "name") ?? "Untitled";
                var description = GetString(taskJson, "description");
                var rawStatus = GetNestedString(taskJson, "status", "status");
                var rawPriority = GetNestedString(taskJson, "priority", "priority");
                var dueDate = ParseClickUpDate(GetString(taskJson, "due_date"))
                              ?? DateOnly.FromDateTime(DateTime.UtcNow.Date.AddDays(7));

                var effortHours = GetCustomFieldNumber(taskJson, "Effort Hours", 0);
                var complexity = GetCustomFieldDropdownName(taskJson, "Complexity", "Medium");

                if (existing is null)
                {
                    var newTask = new TaskItem
                    {
                        Id = Guid.NewGuid(),
                        TeamId = teamId,
                        Title = title,
                        Description = description,
                        AssignedUserId = null,
                        Priority = MapPriority(rawPriority),
                        Complexity = complexity,
                        EffortHours = effortHours,
                        StartDate = DateOnly.FromDateTime(DateTime.UtcNow.Date),
                        DueDate = dueDate,
                        Status = MapStatus(rawStatus),
                        CreatedByUserId = syncUserId,
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = null,
                        ClickUpTaskId = clickUpTaskId,
                        ClickUpListId = options.ListId,
                        LastSyncedAt = DateTime.UtcNow
                    };

                    _db.Tasks.Add(newTask);
                    inserted++;
                }
                else
                {
                    existing.Title = title;
                    existing.Description = description;
                    existing.Priority = MapPriority(rawPriority);
                    existing.Complexity = complexity;
                    existing.EffortHours = effortHours;
                    existing.DueDate = dueDate;
                    existing.Status = MapStatus(rawStatus);
                    existing.ClickUpListId = options.ListId;
                    existing.LastSyncedAt = DateTime.UtcNow;
                    existing.UpdatedAt = DateTime.UtcNow;

                    updated++;
                }
            }

            await _db.SaveChangesAsync(cancellationToken);

            return Ok(new
            {
                ok = true,
                inserted,
                updated,
                total = inserted + updated
            });
        }
        catch (Exception ex)
        {
            return BadRequest(new
            {
                ok = false,
                error = ex.Message,
                innerError = ex.InnerException?.Message
            });
        }
    }

    private static string? GetString(JsonElement element, string propertyName)
    {
        if (!element.TryGetProperty(propertyName, out var value))
            return null;

        return value.ValueKind switch
        {
            JsonValueKind.String => value.GetString(),
            JsonValueKind.Number => value.ToString(),
            JsonValueKind.Null => null,
            _ => value.ToString()
        };
    }

    private static string? GetNestedString(JsonElement element, string parentProperty, string childProperty)
    {
        if (!element.TryGetProperty(parentProperty, out var parent))
            return null;

        if (parent.ValueKind != JsonValueKind.Object)
            return null;

        return GetString(parent, childProperty);
    }

    private static decimal GetCustomFieldNumber(JsonElement taskJson, string fieldName, decimal defaultValue = 0)
    {
        if (!taskJson.TryGetProperty("custom_fields", out var customFields) || customFields.ValueKind != JsonValueKind.Array)
            return defaultValue;

        foreach (var field in customFields.EnumerateArray())
        {
            var name = GetString(field, "name");
            if (!string.Equals(name, fieldName, StringComparison.OrdinalIgnoreCase))
                continue;

            if (!field.TryGetProperty("value", out var value))
                return defaultValue;

            if (value.ValueKind == JsonValueKind.Number && value.TryGetDecimal(out var number))
                return number;

            if (value.ValueKind == JsonValueKind.String && decimal.TryParse(value.GetString(), out var parsed))
                return parsed;

            return defaultValue;
        }

        return defaultValue;
    }
        private static string GetCustomFieldDropdownName(JsonElement taskJson, string fieldName, string defaultValue = "")
    {
        if (!taskJson.TryGetProperty("custom_fields", out var customFields) || customFields.ValueKind != JsonValueKind.Array)
            return defaultValue;

        foreach (var field in customFields.EnumerateArray())
        {
            var name = GetString(field, "name");
            if (!string.Equals(name, fieldName, StringComparison.OrdinalIgnoreCase))
                continue;

            if (!field.TryGetProperty("value", out var value))
                return defaultValue;

            var rawValue = value.ToString();

            if (field.TryGetProperty("type_config", out var typeConfig) &&
                typeConfig.TryGetProperty("options", out var options) &&
                options.ValueKind == JsonValueKind.Array)
            {
                foreach (var option in options.EnumerateArray())
                {
                    var optionName = GetString(option, "name");
                    var optionId = GetString(option, "id");
                    var optionOrderIndex = GetString(option, "orderindex");

                    if (string.Equals(rawValue, optionId, StringComparison.OrdinalIgnoreCase) ||
                        string.Equals(rawValue, optionOrderIndex, StringComparison.OrdinalIgnoreCase))
                    {
                        return optionName ?? defaultValue;
                    }
                }
            }

            return rawValue;
        }

        return defaultValue;
    }
    

    private static string GetCustomFieldText(JsonElement taskJson, string fieldName, string defaultValue = "")
    {
        if (!taskJson.TryGetProperty("custom_fields", out var customFields) || customFields.ValueKind != JsonValueKind.Array)
            return defaultValue;

        foreach (var field in customFields.EnumerateArray())
        {
            var name = GetString(field, "name");
            if (!string.Equals(name, fieldName, StringComparison.OrdinalIgnoreCase))
                continue;

            if (!field.TryGetProperty("value", out var value))
                return defaultValue;

            if (value.ValueKind == JsonValueKind.String)
                return value.GetString() ?? defaultValue;

            return value.ToString();
        }

        return defaultValue;
    }

    private static DateOnly? ParseClickUpDate(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return null;

        if (!long.TryParse(value, out var milliseconds))
            return null;

        var dateTime = DateTimeOffset.FromUnixTimeMilliseconds(milliseconds).UtcDateTime;
        return DateOnly.FromDateTime(dateTime);
    }

    private static string MapPriority(string? rawPriority)
    {
        return rawPriority?.Trim().ToLowerInvariant() switch
        {
            "urgent" => "Critical",
            "high" => "High",
            "normal" => "Medium",
            "low" => "Low",
            _ => "Medium"
        };
    }

           private static string MapStatus(string? rawStatus)
    {
        return rawStatus?.Trim().ToLowerInvariant() switch
        {
            "to do" => "New",
            "in progress" => "In Progress",
            "blocked" => "Blocked",
            "complete" => "Done",
            _ => "New"
        };
    }
}