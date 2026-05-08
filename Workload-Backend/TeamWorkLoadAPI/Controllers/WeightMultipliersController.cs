using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TeamWorkLoadAPI.Data;
using TeamWorkLoadAPI.Models;

namespace TeamWorkLoadAPI.Controllers
{
    [Authorize(Roles = "Admin")]
    [ApiController]
    [Route("api/[controller]")]
    public class WeightMultipliersController : ControllerBase
    {
        private readonly AppDbContext _context;

        public WeightMultipliersController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            var items = await _context.WeightMultipliers
                .OrderBy(w => w.Category)
                .ThenBy(w => w.Key)
                .Select(w => new
                {
                    w.Id,
                    w.Category,
                    Key = w.Key,
                    w.Multiplier,
                    w.CreatedAt
                })
                .ToListAsync();

            return Ok(items);
        }

        [HttpGet("{id:guid}")]
        public async Task<IActionResult> GetById(Guid id)
        {
            var item = await _context.WeightMultipliers
                .Where(w => w.Id == id)
                .Select(w => new
                {
                    w.Id,
                    w.Category,
                    Key = w.Key,
                    w.Multiplier,
                    w.CreatedAt
                })
                .FirstOrDefaultAsync();

            if (item == null)
                return NotFound(new { message = "Weight multiplier not found." });

            return Ok(item);
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateWeightMultiplierRequest request)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var exists = await _context.WeightMultipliers.AnyAsync(w =>
                w.Category == request.Category && w.Key == request.Key);

            if (exists)
                return BadRequest(new { message = "This category/key combination already exists." });

            var item = new WeightMultiplier
            {
                Id = Guid.NewGuid(),
                Category = request.Category,
                Key = request.Key,
                Multiplier = request.Multiplier,
                CreatedAt = DateTime.UtcNow
            };

            _context.WeightMultipliers.Add(item);
            await _context.SaveChangesAsync();

            return Ok(item);
        }

        [HttpPut("{id:guid}")]
        public async Task<IActionResult> Update(Guid id, [FromBody] UpdateWeightMultiplierRequest request)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var item = await _context.WeightMultipliers.FirstOrDefaultAsync(w => w.Id == id);
            if (item == null)
                return NotFound(new { message = "Weight multiplier not found." });

            var duplicate = await _context.WeightMultipliers.AnyAsync(w =>
                w.Id != id &&
                w.Category == request.Category &&
                w.Key == request.Key);

            if (duplicate)
                return BadRequest(new { message = "Another multiplier with this category/key already exists." });

            item.Category = request.Category;
            item.Key = request.Key;
            item.Multiplier = request.Multiplier;

            await _context.SaveChangesAsync();

            return Ok(item);
        }

        [HttpDelete("{id:guid}")]
        public async Task<IActionResult> Delete(Guid id)
        {
            var item = await _context.WeightMultipliers.FirstOrDefaultAsync(w => w.Id == id);
            if (item == null)
                return NotFound(new { message = "Weight multiplier not found." });

            _context.WeightMultipliers.Remove(item);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Weight multiplier deleted successfully." });
        }
    }
}