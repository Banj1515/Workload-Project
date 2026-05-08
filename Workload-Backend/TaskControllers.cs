using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TeamWorkLoadAPI.Data;

namespace TeamWorkLoadAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class TasksControllers : ControllerBase
    {
        private readonly AppDbContext _context;

        public TasksControllers(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<IActionResult> GetTasks()
        {
            var tasks = await _context.Tasks
                .OrderByDescending(t => t.CreatedAt)
                .Select(t => new
                {
                    t.Id,
                    t.Title,
                    Description = t.Description,
                    Priority = t.Priority,
                    t.Complexity,
                    t.EffortHours,
                    t.StartDate,
                    t.DueDate,
                    t.Status,
                    t.AssignedUserId,
                    t.TeamId,
                    t.ClickUpTaskId,
                    t.LastSyncedAt
                })
                .ToListAsync();

            return Ok(tasks);
        }
    }
}