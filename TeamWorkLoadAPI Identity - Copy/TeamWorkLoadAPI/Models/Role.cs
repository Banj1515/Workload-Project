using Microsoft.AspNetCore.Identity;
using System.ComponentModel.DataAnnotations.Schema;

namespace TeamWorkLoadAPI.Models
{
    [Table("Roles")]
    public class Role : IdentityRole<Guid>
    {
    }
}