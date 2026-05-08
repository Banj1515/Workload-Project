using System.ComponentModel.DataAnnotations;

namespace TeamWorkLoadAPI.Models
{
    public class AssignTeamMemberRequest
    {
        [Required]
        public Guid UserId { get; set; }
    }
}