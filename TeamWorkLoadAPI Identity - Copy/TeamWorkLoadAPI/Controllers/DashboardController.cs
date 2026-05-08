using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TeamWorkLoadAPI.Data;
using TeamWorkLoadAPI.Models;

namespace TeamWorkLoadAPI.Controllers
{
    [Authorize(Roles = "Admin,Team Leader,Member")]
    [ApiController]
    [Route("api/[controller]")]
    public class DashboardController : ControllerBase
    {
        private readonly AppDbContext _context;

        public DashboardController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet("summary")]
        public async Task<IActionResult> GetSummary(
    [FromQuery] string? range = null,
    [FromQuery] DateOnly? startDate = null,
    [FromQuery] DateOnly? endDate = null)
        {
            var dateRange = TryResolveDateRange(range, startDate, endDate);
            if (!dateRange.IsValid)
                return BadRequest(new { message = dateRange.Error });

            var tasks = await GetFilteredTasksAsync(
                dateRange.IncludeAll,
                dateRange.StartDate,
                dateRange.EndDate);

            var totalTasks = tasks.Count;
            var activeTasks = tasks.Count(t =>
                !string.Equals(t.Status, "Done", StringComparison.OrdinalIgnoreCase));
            var doneTasks = tasks.Count(t =>
                string.Equals(t.Status, "Done", StringComparison.OrdinalIgnoreCase));

            var totalEffort = tasks.Sum(t => t.EffortHours);
            var totalWeight = await CalculateTotalWeightAsync(tasks);

            var memberWeights = await CalculateMemberWeightsAsync(tasks);

            var availableMembers = memberWeights.Count(w => GetWorkloadStatus(w) == "Available");
            var moderateMembers = memberWeights.Count(w => GetWorkloadStatus(w) == "Moderate");
            var overloadedMembers = memberWeights.Count(w => GetWorkloadStatus(w) == "Overloaded");

            return Ok(new
            {
                startDate = dateRange.IncludeAll ? (DateOnly?)null : dateRange.StartDate,
                endDate = dateRange.IncludeAll ? (DateOnly?)null : dateRange.EndDate,
                range = dateRange.IncludeAll ? "all" : range ?? "this",

                totalTasks,
                activeTasks,
                doneTasks,

                totalEffort,
                totalWeight,

                availableMembers,
                moderateMembers,
                overloadedMembers
            });
        }

        private async Task<decimal> CalculateTotalWeightAsync(List<TaskItem> tasks)
        {
            decimal totalWeight = 0;

            foreach (var task in tasks)
            {
                totalWeight += await CalculateWeightAsync(task);
            }

            return totalWeight;
        }
        [HttpGet("summary-breakdown")]
public async Task<IActionResult> GetSummaryBreakdown(
    [FromQuery] string? range = null,
    [FromQuery] DateOnly? startDate = null,
    [FromQuery] DateOnly? endDate = null)
{
    var dateRange = TryResolveDateRange(range, startDate, endDate);
    if (!dateRange.IsValid)
        return BadRequest(new { message = dateRange.Error });

    var tasks = await GetFilteredTasksAsync(
        dateRange.IncludeAll,
        dateRange.StartDate,
        dateRange.EndDate);

    var breakdownTasks = new List<object>();

    decimal totalEffort = 0;
    decimal totalWeight = 0;

    foreach (var task in tasks)
    {
        var priorityMultiplier = await GetMultiplierAsync("Priority", task.Priority);
        var complexityMultiplier = await GetMultiplierAsync("Complexity", task.Complexity);

        var weight = task.EffortHours * priorityMultiplier * complexityMultiplier;

        totalEffort += task.EffortHours;
        totalWeight += weight;

        breakdownTasks.Add(new
        {
            task.Id,
            task.Title,
            task.Status,
            task.Priority,
            task.Complexity,
            task.EffortHours,
            PriorityMultiplier = priorityMultiplier,
            ComplexityMultiplier = complexityMultiplier,
            Formula = $"{task.EffortHours} × {priorityMultiplier} × {complexityMultiplier}",
            Weight = weight,
            task.StartDate,
            task.DueDate,
            task.AssignedUserId,
            task.ClickUpTaskId
        });
    }

    return Ok(new
    {
        startDate = dateRange.IncludeAll ? (DateOnly?)null : dateRange.StartDate,
        endDate = dateRange.IncludeAll ? (DateOnly?)null : dateRange.EndDate,
        range = dateRange.IncludeAll ? "all" : range ?? "this",

        totalEffort,
        totalEffortFormula = "Sum of all task EffortHours in the selected range",

        totalWeight,
        totalWeightFormula = "Sum of each task weight: EffortHours × PriorityMultiplier × ComplexityMultiplier",

        tasks = breakdownTasks
    });
}

private async Task<decimal> GetMultiplierAsync(string category, string key)
{
    var multiplier = await _context.WeightMultipliers
        .Where(w => w.Category == category && w.Key == key)
        .Select(w => w.Multiplier)
        .FirstOrDefaultAsync();

    return multiplier == 0 ? 1 : multiplier;
}

        [HttpGet("charts")]
        public async Task<IActionResult> GetCharts(
            [FromQuery] string? range = null,
            [FromQuery] DateOnly? startDate = null,
            [FromQuery] DateOnly? endDate = null)
        {
            var dateRange = TryResolveDateRange(range, startDate, endDate);
            if (!dateRange.IsValid)
                return BadRequest(new { message = dateRange.Error });

            var tasks = await GetFilteredTasksAsync(dateRange.IncludeAll, dateRange.StartDate, dateRange.EndDate);

            var statusCounts = tasks
                .GroupBy(t => t.Status)
                .Select(g => new
                {
                    label = g.Key,
                    value = g.Count()
                })
                .OrderBy(x => x.label)
                .ToList();

            var priorityCounts = tasks
                .GroupBy(t => t.Priority)
                .Select(g => new
                {
                    label = g.Key,
                    value = g.Count()
                })
                .OrderBy(x => x.label)
                .ToList();

            var memberWeights = await CalculateMemberWeightsAsync(tasks);

            var workloadCounts = memberWeights
                .GroupBy(GetWorkloadStatus)
                .Select(g => new
                {
                    label = g.Key,
                    value = g.Count()
                })
                .OrderBy(x => x.label)
                .ToList();

            var unassignedTasks = tasks.Count(t => t.AssignedUserId == null);

            return Ok(new
            {
                startDate = dateRange.IncludeAll ? (DateOnly?)null : dateRange.StartDate,
                endDate = dateRange.IncludeAll ? (DateOnly?)null : dateRange.EndDate,
                range = dateRange.IncludeAll ? "all" : range ?? "this",
                statusCounts,
                priorityCounts,
                workloadCounts,
                unassignedTasks
            });
        }

        [HttpGet("workload-details")]
        public async Task<IActionResult> GetWorkloadDetails(
            [FromQuery] string? range = null,
            [FromQuery] DateOnly? startDate = null,
            [FromQuery] DateOnly? endDate = null)
        {
            var dateRange = TryResolveDateRange(range, startDate, endDate);
            if (!dateRange.IsValid)
                return BadRequest(new { message = dateRange.Error });

            var tasks = await GetFilteredTasksAsync(dateRange.IncludeAll, dateRange.StartDate, dateRange.EndDate);

            var users = await _context.Users
                .OrderBy(u => u.DisplayName)
                .Select(u => new
                {
                    u.Id,
                    u.DisplayName,
                    u.Email
                })
                .ToListAsync();

            var teamMemberships = await _context.TeamMembers.ToListAsync();
            var teams = await _context.Teams.ToListAsync();

            var result = new List<object>();

            foreach (var user in users)
            {
                var userTeamNames = teamMemberships
                    .Where(tm => tm.UserId == user.Id)
                    .Join(
                        teams,
                        tm => tm.TeamId,
                        t => t.Id,
                        (_, t) => t.Name)
                    .Distinct()
                    .OrderBy(x => x)
                    .ToList();

                var assignedTasks = tasks
                    .Where(t => t.AssignedUserId == user.Id)
                    .OrderBy(t => t.DueDate)
                    .ThenBy(t => t.Title)
                    .ToList();

                var taskDtos = new List<object>();
                decimal totalEffort = 0;
                decimal totalWeight = 0;

                foreach (var task in assignedTasks)
                {
                    var weight = await CalculateWeightAsync(task);

                    totalEffort += task.EffortHours;
                    totalWeight += weight;

                    taskDtos.Add(new
                    {
                        task.Id,
                        task.Title,
                        task.Status,
                        task.Priority,
                        DueDate = DateTime.SpecifyKind(task.DueDate.ToDateTime(TimeOnly.MinValue), DateTimeKind.Utc),
                        task.EffortHours,
                        Weight = weight
                    });
                }

                result.Add(new
                {
                    user.Id,
                    user.DisplayName,
                    Email = user.Email ?? string.Empty,
                    TeamName = userTeamNames.Count == 0 ? string.Empty : string.Join(", ", userTeamNames),
                    WorkloadStatus = GetWorkloadStatus(totalWeight),
                    TaskCount = assignedTasks.Count,
                    TotalEffort = totalEffort,
                    TotalWeight = totalWeight,
                    Tasks = taskDtos
                });
            }

            return Ok(result);
        }

        private async Task<List<TaskItem>> GetFilteredTasksAsync(bool includeAll, DateOnly startDate, DateOnly endDate)
        {
            var query = _context.Tasks.AsQueryable();

            if (!includeAll)
            {
                query = query.Where(t =>
                    t.DueDate >= startDate &&
                    t.DueDate <= endDate);
            }

            return await query
                .OrderByDescending(t => t.CreatedAt)
                .ToListAsync();
        }

        private async Task<List<decimal>> CalculateMemberWeightsAsync(List<TaskItem> tasks)
        {
            var assignedTasks = tasks
                .Where(t => t.AssignedUserId != null)
                .GroupBy(t => t.AssignedUserId!.Value)
                .ToList();

            var results = new List<decimal>();

            foreach (var group in assignedTasks)
            {
                decimal totalWeight = 0;

                foreach (var task in group)
                {
                    totalWeight += await CalculateWeightAsync(task);
                }

                results.Add(totalWeight);
            }

            return results;
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

        private static string GetWorkloadStatus(decimal totalWeight)
        {
            if (totalWeight <= 15m)
                return "Available";

            if (totalWeight <= 25m)
                return "Moderate";

            return "Overloaded";
        }

        private static DateRangeResult TryResolveDateRange(string? range, DateOnly? startDate, DateOnly? endDate)
        {
            var normalizedRange = (range ?? "this").Trim().ToLowerInvariant();

            if (normalizedRange == "all")
            {
                return DateRangeResult.Valid(includeAll: true, startDate: DateOnly.MinValue, endDate: DateOnly.MaxValue);
            }

            if (startDate.HasValue ^ endDate.HasValue)
            {
                return DateRangeResult.Invalid("startDate and endDate must be provided together.");
            }

            if (startDate.HasValue && endDate.HasValue)
            {
                if (endDate.Value < startDate.Value)
                    return DateRangeResult.Invalid("endDate must be greater than or equal to startDate.");

                return DateRangeResult.Valid(includeAll: false, startDate: startDate.Value, endDate: endDate.Value);
            }

            var today = DateOnly.FromDateTime(DateTime.Today);
            var currentWeekStart = StartOfWeek(today, DayOfWeek.Monday);

            return normalizedRange switch
            {
                "this" => DateRangeResult.Valid(false, currentWeekStart, currentWeekStart.AddDays(6)),
                "next" => DateRangeResult.Valid(false, currentWeekStart.AddDays(7), currentWeekStart.AddDays(13)),
                _ => DateRangeResult.Invalid("range must be 'this', 'next', or 'all'.")
            };
        }

        private static DateOnly StartOfWeek(DateOnly date, DayOfWeek startOfWeek)
        {
            var diff = (7 + (date.DayOfWeek - startOfWeek)) % 7;
            return date.AddDays(-diff);
        }

        private readonly record struct DateRangeResult(
            bool IsValid,
            bool IncludeAll,
            DateOnly StartDate,
            DateOnly EndDate,
            string? Error)
        {
            public static DateRangeResult Valid(bool includeAll, DateOnly startDate, DateOnly endDate) =>
                new(true, includeAll, startDate, endDate, null);

            public static DateRangeResult Invalid(string error) =>
                new(false, false, default, default, error);
        }
    }
}