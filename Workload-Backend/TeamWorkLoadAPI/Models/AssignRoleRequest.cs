using System.ComponentModel.DataAnnotations;

namespace TeamWorkLoadAPI.Models
{
    public class AssignRoleRequest
    {
        [Required]
        public Guid RoleId { get; set; }
    }
}