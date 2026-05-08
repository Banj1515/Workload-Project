using System.ComponentModel.DataAnnotations;

namespace TeamWorkLoadAPI.Models
{
    public class UpdateTeamRequest
    {
        [Required]
        public string Name { get; set; } = string.Empty;

        public string? Description { get; set; }
    }
}