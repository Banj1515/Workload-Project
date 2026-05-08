using Microsoft.AspNetCore.Identity;
using System.ComponentModel.DataAnnotations.Schema;

namespace TeamWorkLoadAPI.Models
{
    [Table("UserRole")]
    public class UserRole : IdentityUserRole<Guid>
    {
    }
}