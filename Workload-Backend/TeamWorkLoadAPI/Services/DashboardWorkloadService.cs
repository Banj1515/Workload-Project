using Microsoft.EntityFrameworkCore;
using TeamWorkLoadAPI.Data;
using TeamWorkLoadAPI.Models;

namespace TeamWorkLoadAPI.Services
{
    public class DashboardWorkloadService
    {
        private readonly AppDbContext _context;

        public DashboardWorkloadService(AppDbContext context)
        {
            _context = context;
        }

        public async Task<IReadOnlyList<DashboardWorkloadMemberDto>> GetWorkloadDetailsAsync(
            string? range,
            DateOnly? startDate,
            DateOnly? endDate,
            CancellationToken cancellationToken = default)
        {
            var resolved = ResolveDateRange(range, startDate, endDate);

            var users = await _context.Users
                .OrderBy(u => u.DisplayName)
                .Select(u => new
                {
                    u.Id,
                    u.DisplayName,
                    u.Email
                })
                .ToListAsync(cancellationToken);

            var teamRows = await (
                from tm in _context.TeamMembers
                join t in _context.Teams on tm.TeamId equals t.Id
                select new
                {
                    tm.UserId,
                    TeamName = t.Name
                })
                .ToListAsync(cancellationToken);

            var teamNamesByUser = teamRows
                .GroupBy(x => x.UserId)
                .ToDictionary(
                    g => g.Key,
                    g => string.Join(", ", g.Select(x => x.TeamName).Distinct().OrderBy(x => x)));

            var memberDtos = users
                .Select(u => new DashboardWorkloadMemberDto
                {
                    Id = u.Id,
                    DisplayName = u.DisplayName,
                    Email = u.Email ?? string.Empty,
                    TeamName = teamNamesByUser.TryGetValue(u.Id, out var teamName) ? teamName : string.Empty,
                    WorkloadStatus = "Available",
                    TaskCount = 0,
                    TotalEffort = 0,
                    TotalWeight = 0,
                    Tasks = new List<DashboardWorkloadTaskDto>()
                })
                .ToDictionary(x => x.Id);

            var taskQuery = _context.Tasks
                .Where(t => t.AssignedUserId != null);

            if (!resolved.IncludeAll)
            {
                taskQuery = taskQuery.Where(t =>
                    t.StartDate <= resolved.EndDate &&
                    t.DueDate >= resolved.StartDate);
            }

            var tasks = await taskQuery.ToListAsync(cancellationToken);

            var priorityMultipliers = await _context.WeightMultipliers
                .Where(w => w.Category == "Priority")
                .ToDictionaryAsync(w => w.Key, w => w.Multiplier, cancellationToken);

            var complexityMultipliers = await _context.WeightMultipliers
                .Where(w => w.Category == "Complexity")
                .ToDictionaryAsync(w => w.Key, w => w.Multiplier, cancellationToken);

            foreach (var task in tasks)
            {
                if (task.AssignedUserId == null)
                    continue;

                if (!memberDtos.TryGetValue(task.AssignedUserId.Value, out var member))
                    continue;

                var priorityMultiplier = priorityMultipliers.TryGetValue(task.Priority, out var p) ? p : 1m;
                var complexityMultiplier = complexityMultipliers.TryGetValue(task.Complexity, out var c) ? c : 1m;
                var weight = task.EffortHours * priorityMultiplier * complexityMultiplier;

                member.Tasks.Add(new DashboardWorkloadTaskDto
                {
                    Id = task.Id,
                    Title = task.Title,
                    Status = task.Status,
                    Priority = task.Priority,
                    DueDate = DateTime.SpecifyKind(task.DueDate.ToDateTime(TimeOnly.MinValue), DateTimeKind.Utc),
                    EffortHours = task.EffortHours,
                    Weight = weight
                });

                member.TaskCount += 1;
                member.TotalEffort += task.EffortHours;
                member.TotalWeight += weight;
            }

            foreach (var member in memberDtos.Values)
            {
                member.WorkloadStatus = GetWorkloadStatus(member.TotalWeight);
                member.Tasks = member.Tasks
                    .OrderBy(t => t.DueDate)
                    .ThenBy(t => t.Title)
                    .ToList();
            }

            return memberDtos.Values
                .OrderBy(m => m.DisplayName)
                .ToList();
        }

        private static string GetWorkloadStatus(decimal totalWeight)
        {
            if (totalWeight <= 15m)
                return "Available";

            if (totalWeight <= 25m)
                return "Moderate";

            return "Overloaded";
        }

        private static ResolvedDateRange ResolveDateRange(
            string? range,
            DateOnly? startDate,
            DateOnly? endDate)
        {
            var normalizedRange = (range ?? "this").Trim().ToLowerInvariant();

            if (normalizedRange == "all")
            {
                return new ResolvedDateRange(
                    IncludeAll: true,
                    StartDate: default,
                    EndDate: default);
            }

            if (startDate.HasValue ^ endDate.HasValue)
                throw new ArgumentException("startDate and endDate must be provided together.");

            if (startDate.HasValue && endDate.HasValue)
            {
                if (endDate.Value < startDate.Value)
                    throw new ArgumentException("endDate must be greater than or equal to startDate.");

                return new ResolvedDateRange(
                    IncludeAll: false,
                    StartDate: startDate.Value,
                    EndDate: endDate.Value);
            }

            var today = DateOnly.FromDateTime(DateTime.Today);
            var currentWeekStart = StartOfWeek(today, DayOfWeek.Monday);

            return normalizedRange switch
            {
                "this" => new ResolvedDateRange(false, currentWeekStart, currentWeekStart.AddDays(6)),
                "next" => new ResolvedDateRange(false, currentWeekStart.AddDays(7), currentWeekStart.AddDays(13)),
                _ => throw new ArgumentException("range must be one of: this, next, all.")
            };
        }

        private static DateOnly StartOfWeek(DateOnly date, DayOfWeek startOfWeek)
        {
            var diff = (7 + (date.DayOfWeek - startOfWeek)) % 7;
            return date.AddDays(-diff);
        }

        private readonly record struct ResolvedDateRange(
            bool IncludeAll,
            DateOnly StartDate,
            DateOnly EndDate);
    }
}
