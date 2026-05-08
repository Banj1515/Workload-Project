using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace TeamWorkLoadAPI.Models
{
    [Table("TeamMember")]
    public class TeamMember
    {
        public Guid TeamId { get; set; }
        public Guid UserId { get; set; }

        [MaxLength(100)]
        public string? TeamRole { get; set; }

        public DateTime JoinedAt { get; set; }
    }
}
