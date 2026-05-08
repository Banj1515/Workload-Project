using Microsoft.AspNetCore.Identity;
using System.ComponentModel.DataAnnotations.Schema;

namespace TeamWorkLoadAPI.Models
{
    [Table("RoleClaims")]
    public class RoleClaim : IdentityRoleClaim<Guid>
    {
    }
}