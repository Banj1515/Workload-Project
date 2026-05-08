using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using TeamWorkLoadAPI.Data;

namespace TeamWorkLoadAPI.Controllers;

[ApiController]
[Route("api/db")]
public sealed class DbController : ControllerBase
{
    private readonly AppDbContext _db;

    public DbController(AppDbContext db)
    {
        _db = db;
    }

    [HttpGet("ping")]
    public async Task<IActionResult> Ping()
    {
        try
        {
            var connection = _db.Database.GetDbConnection();
            await connection.OpenAsync();

            using var command = connection.CreateCommand();
            command.CommandText = "SELECT DB_NAME()";

            var dbName = await command.ExecuteScalarAsync();

            return Ok(new
            {
                canConnect = true,
                database = dbName
            });
        }
        catch (Exception ex)
        {
            return Ok(new
            {
                canConnect = false,
                error = ex.Message,
                innerError = ex.InnerException?.Message
            });
        }
    }
}