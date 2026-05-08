using System.ComponentModel.DataAnnotations;

namespace TeamWorkLoadAPI.Models
{
    public class CreateTeamRequest
    {
        [Required]
        public string Name { get; set; } = string.Empty;

        public string? Description { get; set; }
    }
}
