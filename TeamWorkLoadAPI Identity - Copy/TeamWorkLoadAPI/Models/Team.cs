using System.ComponentModel.DataAnnotations.Schema;

namespace TeamWorkLoadAPI.Models
{
    [Table("Team")]
    public class Team
    {
        public Guid Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}