using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TeamWorkLoadAPI.Data;
using TeamWorkLoadAPI.Models;

namespace TeamWorkLoadAPI.Controllers
{
    [Authorize(Roles = "Admin,Team Leader")]
    [ApiController]
    [Route("api/[controller]")]
    public class TeamsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public TeamsController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<IActionResult> GetTeams()
        {
            var teams = await _context.Teams
                .OrderBy(t => t.Name)
                .Select(t => new
                {
                    t.Id,
                    t.Name,
                    t.Description,
                    MemberCount = _context.TeamMembers.Count(tm => tm.TeamId == t.Id)
                })
                .ToListAsync();

            return Ok(teams);
        }

        [HttpGet("{id:guid}")]
        public async Task<IActionResult> GetTeamById(Guid id)
        {
            var team = await _context.Teams
                .Where(t => t.Id == id)
                .Select(t => new
                {
                    t.Id,
                    t.Name,
                    t.Description,
                    MemberCount = _context.TeamMembers.Count(tm => tm.TeamId == t.Id)
                })
                .FirstOrDefaultAsync();

            if (team == null)
                return NotFound(new { message = "Team not found." });

            return Ok(team);
        }

        [HttpPost]
        public async Task<IActionResult> CreateTeam([FromBody] CreateTeamRequest request)
        {
            if (!ModelState.IsValid)
                return BadRequest(new { message = "Invalid team data." });

            var name = request.Name.Trim();

            if (string.IsNullOrWhiteSpace(name))
                return BadRequest(new { message = "Team name is required." });

            var exists = await _context.Teams.AnyAsync(t => t.Name == name);
            if (exists)
                return BadRequest(new { message = "A team with this name already exists." });

            var team = new Team
            {
                Id = Guid.NewGuid(),
                Name = name,
                Description = request.Description,
                CreatedAt = DateTime.UtcNow
            };

            _context.Teams.Add(team);
            await _context.SaveChangesAsync();

            return Ok(new
            {
                team.Id,
                team.Name,
                team.Description
            });
        }

        [HttpPut("{id:guid}")]
        public async Task<IActionResult> UpdateTeam(Guid id, [FromBody] UpdateTeamRequest request)
        {
            if (!ModelState.IsValid)
                return BadRequest(new { message = "Invalid team data." });

            var team = await _context.Teams.FirstOrDefaultAsync(t => t.Id == id);
            if (team == null)
                return NotFound(new { message = "Team not found." });

            var name = request.Name.Trim();

            if (string.IsNullOrWhiteSpace(name))
                return BadRequest(new { message = "Team name is required." });

            var duplicateExists = await _context.Teams.AnyAsync(t =>
                t.Id != id &&
                t.Name == name);

            if (duplicateExists)
                return BadRequest(new { message = "A team with this name already exists." });

            team.Name = name;
            team.Description = request.Description;

            await _context.SaveChangesAsync();

            return Ok(new
            {
                team.Id,
                team.Name,
                team.Description
            });
        }

        [HttpDelete("{id:guid}")]
        public async Task<IActionResult> DeleteTeam(Guid id)
        {
            var team = await _context.Teams.FirstOrDefaultAsync(t => t.Id == id);
            if (team == null)
                return NotFound(new { message = "Team not found." });

            var hasTasks = await _context.Tasks.AnyAsync(t => t.TeamId == id);
            if (hasTasks)
                return BadRequest(new { message = "Cannot delete this team because it has tasks." });

            var members = await _context.TeamMembers
                .Where(tm => tm.TeamId == id)
                .ToListAsync();

            _context.TeamMembers.RemoveRange(members);
            _context.Teams.Remove(team);

            await _context.SaveChangesAsync();

            return Ok(new { message = "Team deleted successfully." });
        }

        [HttpGet("{teamId:guid}/members")]
        public async Task<IActionResult> GetTeamMembers(Guid teamId)
        {
            var teamExists = await _context.Teams.AnyAsync(t => t.Id == teamId);
            if (!teamExists)
                return NotFound(new { message = "Team not found." });

            var members = await _context.TeamMembers
                .Where(tm => tm.TeamId == teamId)
                .Join(
                    _context.Users,
                    tm => tm.UserId,
                    u => u.Id,
                    (tm, u) => new
                    {
                        UserId = u.Id,
                        u.DisplayName,
                        u.Email
                    })
                .OrderBy(m => m.DisplayName)
                .ToListAsync();

            return Ok(members);
        }

        [HttpPost("{teamId:guid}/members")]
        public async Task<IActionResult> AddTeamMember(Guid teamId, [FromBody] AssignTeamMemberRequest request)
        {
            if (!ModelState.IsValid)
                return BadRequest(new { message = "Invalid member data." });

            var team = await _context.Teams.FirstOrDefaultAsync(t => t.Id == teamId);
            if (team == null)
                return NotFound(new { message = "Team not found." });

            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == request.UserId);
            if (user == null)
                return NotFound(new { message = "User not found." });

            var alreadyExists = await _context.TeamMembers.AnyAsync(tm =>
                tm.TeamId == teamId &&
                tm.UserId == request.UserId);

            if (alreadyExists)
                return Ok(new { message = "User is already a team member." });

            var teamMember = new TeamMember
            {
                TeamId = teamId,
                UserId = request.UserId,
                TeamRole = "Member",
                JoinedAt = DateTime.UtcNow
            };

            _context.TeamMembers.Add(teamMember);
            await _context.SaveChangesAsync();

            return Ok(new { message = "User added to team successfully." });
        }

        [HttpDelete("{teamId:guid}/members/{userId:guid}")]
        public async Task<IActionResult> RemoveTeamMember(Guid teamId, Guid userId)
        {
            var member = await _context.TeamMembers.FirstOrDefaultAsync(tm =>
                tm.TeamId == teamId &&
                tm.UserId == userId);

            if (member == null)
                return NotFound(new { message = "Team member not found." });

            var hasAssignedTasks = await _context.Tasks.AnyAsync(t =>
                t.TeamId == teamId &&
                t.AssignedUserId == userId);

            if (hasAssignedTasks)
                return BadRequest(new { message = "Cannot remove member because they have assigned tasks in this team." });

            _context.TeamMembers.Remove(member);
            await _context.SaveChangesAsync();

            return Ok(new { message = "User removed from team successfully." });
        }
    }
}
